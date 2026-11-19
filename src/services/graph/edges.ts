import { KIND_ORDER, type GraphLink, type GraphMemoInput, type LinkKind } from './types'

/* 연결 신호 계산 — 순수 함수라 워커에서도, 시험에서도 그대로 돌아요.
   - wiki    : 본문의 [[제목]] (명시적)
   - mention : 본문에 다른 메모 제목이 그대로 나옴 — 아호-코라식 한 번 훑기로 O(본문 길이)
   - tag     : 2..TAG_MAX_GROUP개 메모만 쓰는 드문 태그 공유
   - semantic: 임베딩 코사인 유사도 상위 TOP_K (임계값 이상) */

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g
/** 언급으로 칠 최소 제목 길이 — 짧은 제목의 우연 일치 방지 */
export const MENTION_MIN_TITLE = 4
/** 이보다 많은 메모가 공유하는 태그는 정보가 적어 연결로 치지 않아요 */
export const TAG_MAX_GROUP = 15
/** 태그 연결 전체 상한 — 큰 태그 하나로 생기는 털뭉치 방지 */
export const TAG_EDGE_CAP = 1500
export const SIM_THRESHOLD = 0.5
export const SIM_TOP_K = 3
/** 의미 연결을 계산할 최대 메모 수 — 쌍 비교가 n²이라 최근 메모부터 */
export const SEMANTIC_MAX = 1500

export const pairKey = (a: string, b: string) => (a < b ? `${a}~${b}` : `${b}~${a}`)

/* ── 아호-코라식: 제목 수천 개를 본문에서 한 번에 찾기 ── */

interface Automaton {
  next: Array<Map<number, number>>
  fail: Int32Array
  /** 상태에서 끝나는 패턴 번호들 (실패 링크를 따라 모은 것 포함) */
  out: number[][]
}

export function buildAutomaton(patterns: string[]): Automaton {
  const next: Array<Map<number, number>> = [new Map()]
  const outRaw: number[][] = [[]]
  patterns.forEach((p, pi) => {
    let s = 0
    for (let i = 0; i < p.length; i++) {
      const c = p.charCodeAt(i)
      let t = next[s].get(c)
      if (t === undefined) {
        t = next.length
        next.push(new Map())
        outRaw.push([])
        next[s].set(c, t)
      }
      s = t
    }
    outRaw[s].push(pi)
  })
  const fail = new Int32Array(next.length)
  const out: number[][] = outRaw.map((o) => o.slice())
  const queue: number[] = []
  for (const t of next[0].values()) {
    fail[t] = 0
    queue.push(t)
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const s = queue[qi]
    for (const [c, t] of next[s]) {
      let f = fail[s]
      while (f > 0 && !next[f].has(c)) f = fail[f]
      const ft = next[f].get(c)
      fail[t] = ft !== undefined && ft !== t ? ft : 0
      if (out[fail[t]].length) out[t] = out[t].concat(out[fail[t]])
      queue.push(t)
    }
  }
  return { next, fail, out }
}

/** 본문에 나오는 패턴 번호들(중복 없음) */
export function findPatterns(ac: Automaton, text: string): Set<number> {
  const found = new Set<number>()
  let s = 0
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    while (s > 0 && !ac.next[s].has(c)) s = ac.fail[s]
    s = ac.next[s].get(c) ?? 0
    const o = ac.out[s]
    for (let j = 0; j < o.length; j++) found.add(o[j])
  }
  return found
}

/* ── 연결 모으기 ── */

class EdgeBag {
  private map = new Map<string, GraphLink>()
  add(a: string, b: string, kind: LinkKind, weight = 1, sim?: number) {
    if (a === b) return
    const key = pairKey(a, b)
    const e = this.map.get(key)
    if (!e) {
      this.map.set(key, {
        source: a < b ? a : b,
        target: a < b ? b : a,
        kind,
        kinds: [kind],
        weight,
        sim,
      })
      return
    }
    if (!e.kinds.includes(kind)) {
      e.kinds.push(kind)
      e.kinds.sort((x, y) => KIND_ORDER.indexOf(x) - KIND_ORDER.indexOf(y))
      e.kind = e.kinds[0]
      e.weight += weight
    } else if (kind !== 'semantic') {
      e.weight += weight
    }
    if (sim != null) e.sim = Math.max(e.sim ?? 0, sim)
  }
  has(a: string, b: string) {
    return this.map.has(pairKey(a, b))
  }
  values() {
    return [...this.map.values()]
  }
}

export function textEdges(memos: GraphMemoInput[]): GraphLink[] {
  const bag = new EdgeBag()

  // 제목 → id들 (같은 제목이 여럿일 수 있어요)
  const titleToIds = new Map<string, string[]>()
  for (const m of memos) {
    const t = m.title.trim()
    if (!t) continue
    const arr = titleToIds.get(t)
    if (arr) arr.push(m.id)
    else titleToIds.set(t, [m.id])
  }

  // 1) wiki — [[제목|별칭]] · [[제목#헤딩]]은 제목 부분만
  for (const m of memos) {
    if (!m.body.includes('[[')) continue
    for (const match of m.body.matchAll(WIKILINK_RE)) {
      const inner = match[1].split(/[|#]/)[0].trim()
      for (const tgt of titleToIds.get(inner) ?? []) bag.add(m.id, tgt, 'wiki')
    }
  }

  // 2) mention — 제목 전부를 오토마톤 하나로 만들어 본문을 한 번만 훑어요
  const titles = [...titleToIds.keys()].filter((t) => t.length >= MENTION_MIN_TITLE)
  if (titles.length) {
    const ac = buildAutomaton(titles)
    for (const m of memos) {
      if (!m.body) continue
      for (const pi of findPatterns(ac, m.body)) {
        for (const tgt of titleToIds.get(titles[pi])!) bag.add(m.id, tgt, 'mention')
      }
    }
  }

  // 3) tag — 드문 태그만 (IDF 발상)
  const tagIndex = new Map<string, string[]>()
  for (const m of memos) {
    for (const t of new Set(m.tags)) {
      const arr = tagIndex.get(t)
      if (arr) arr.push(m.id)
      else tagIndex.set(t, [m.id])
    }
  }
  const tagPairs = new Map<string, { a: string; b: string; w: number }>()
  for (const ids of tagIndex.values()) {
    if (ids.length < 2 || ids.length > TAG_MAX_GROUP) continue
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j])
        const p = tagPairs.get(key)
        if (p) p.w++
        else tagPairs.set(key, { a: ids[i], b: ids[j], w: 1 })
      }
    }
  }
  const tagList = [...tagPairs.values()].sort((x, y) => y.w - x.w).slice(0, TAG_EDGE_CAP)
  for (const p of tagList) bag.add(p.a, p.b, 'tag', p.w)

  return bag.values()
}

/** 길이 1로 맞춘 사본 — 이후 코사인은 내적 한 번 */
export function normalize(v: ArrayLike<number>): Float32Array {
  let s = 0
  for (let i = 0; i < v.length; i++) s += v[i] * v[i]
  const inv = s > 0 ? 1 / Math.sqrt(s) : 0
  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv
  return out
}

/** 의미 연결 — 쌍별 코사인, 노드마다 상위 SIM_TOP_K (어느 한쪽의 상위에 들면 채택) */
export function semanticEdges(entries: Array<[string, Float32Array]>): Array<{ a: string; b: string; sim: number }> {
  const items = entries.filter(([, v]) => v.length > 0)
  const n = items.length
  if (n < 2) return []
  const dim = items[0][1].length
  const vecs = items.map(([, v]) => (v.length === dim ? normalize(v) : null))
  const best: Array<Array<{ j: number; sim: number }>> = Array.from({ length: n }, () => [])
  const push = (i: number, j: number, sim: number) => {
    const arr = best[i]
    if (arr.length < SIM_TOP_K) {
      arr.push({ j, sim })
      arr.sort((x, y) => y.sim - x.sim)
    } else if (sim > arr[SIM_TOP_K - 1].sim) {
      arr[SIM_TOP_K - 1] = { j, sim }
      arr.sort((x, y) => y.sim - x.sim)
    }
  }
  for (let i = 0; i < n; i++) {
    const vi = vecs[i]
    if (!vi) continue
    for (let j = i + 1; j < n; j++) {
      const vj = vecs[j]
      if (!vj) continue
      let dot = 0
      for (let d = 0; d < dim; d++) dot += vi[d] * vj[d]
      if (dot < SIM_THRESHOLD) continue
      push(i, j, dot)
      push(j, i, dot)
    }
  }
  const picked = new Map<string, { a: string; b: string; sim: number }>()
  best.forEach((arr, i) => {
    for (const { j, sim } of arr) {
      const a = items[i][0]
      const b = items[j][0]
      const key = pairKey(a, b)
      const prev = picked.get(key)
      if (!prev || sim > prev.sim) picked.set(key, { a, b, sim })
    }
  })
  return [...picked.values()]
}

/** 글 신호와 의미 신호를 한 쌍당 연결 하나로 합쳐요 */
export function mergeEdges(text: GraphLink[], semantic: Array<{ a: string; b: string; sim: number }>): GraphLink[] {
  const bag = new EdgeBag()
  for (const l of text) {
    for (const k of l.kinds) bag.add(l.source, l.target, k, k === l.kinds[0] ? l.weight : 0)
  }
  for (const s of semantic) {
    // 유사도 0.5→1, 0.9+→2.6 — 굵기·힘에 반영
    const w = Number((1 + Math.min((s.sim - SIM_THRESHOLD) * 4, 1.6)).toFixed(2))
    bag.add(s.a, s.b, 'semantic', w, Number(s.sim.toFixed(3)))
  }
  return bag.values()
}
