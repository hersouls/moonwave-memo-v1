import type { Community } from './types'

/* 주제 묶음 — 루뱅(Louvain) 모듈러리티 최적화.
   연결 가중치를 따라 서로 촘촘히 이어진 메모들을 한 묶음으로 모으고,
   묶음마다 제목에서 대표 낱말을 뽑아 이름을 붙여요. 순수 함수(결정적)라 같은 입력이면 같은 결과예요. */

interface WEdge {
  source: string
  target: string
  weight: number
}

/** 노드 순서대로 묶음 번호(0..). 연결이 없는 노드는 혼자 한 묶음이에요. */
export function louvain(nodeIds: string[], edges: WEdge[], maxLevels = 10): number[] {
  const index = new Map(nodeIds.map((id, i) => [id, i]))
  // 현재 단계의 그래프: 인접 목록(이웃 → 가중치) + 자기 고리
  let n = nodeIds.length
  let adj: Array<Map<number, number>> = Array.from({ length: n }, () => new Map())
  let self = new Float64Array(n)
  for (const e of edges) {
    const a = index.get(e.source)
    const b = index.get(e.target)
    if (a === undefined || b === undefined || e.weight <= 0) continue
    if (a === b) {
      self[a] += e.weight
      continue
    }
    adj[a].set(b, (adj[a].get(b) ?? 0) + e.weight)
    adj[b].set(a, (adj[b].get(a) ?? 0) + e.weight)
  }
  // 원래 노드 → 현재 단계 노드
  let membership = Array.from({ length: n }, (_, i) => i)

  for (let level = 0; level < maxLevels; level++) {
    const k = new Float64Array(n)
    let m = 0
    for (let i = 0; i < n; i++) {
      let s = 2 * self[i]
      for (const w of adj[i].values()) s += w
      k[i] = s
      m += self[i]
      for (const [j, w] of adj[i]) if (j > i) m += w
    }
    if (m === 0) break
    const comm = Int32Array.from({ length: n }, (_, i) => i)
    const tot = Float64Array.from(k)

    // 1단계 — 노드를 이웃 묶음으로 옮겨 모듈러리티가 오르는 동안 반복
    let moved = false
    for (let pass = 0; pass < 30; pass++) {
      let changed = false
      for (let i = 0; i < n; i++) {
        const ci = comm[i]
        const ki = k[i]
        const toComm = new Map<number, number>()
        for (const [j, w] of adj[i]) toComm.set(comm[j], (toComm.get(comm[j]) ?? 0) + w)
        tot[ci] -= ki
        let best = ci
        let bestGain = (toComm.get(ci) ?? 0) - (tot[ci] * ki) / (2 * m)
        for (const [c, w] of toComm) {
          const gain = w - (tot[c] * ki) / (2 * m)
          if (gain > bestGain + 1e-12) {
            bestGain = gain
            best = c
          }
        }
        tot[best] += ki
        if (best !== ci) {
          comm[i] = best
          changed = true
          moved = true
        }
      }
      if (!changed) break
    }
    if (!moved) break

    // 2단계 — 묶음을 노드 하나로 접어 새 그래프를 만들어요
    const renum = new Map<number, number>()
    for (let i = 0; i < n; i++) if (!renum.has(comm[i])) renum.set(comm[i], renum.size)
    const n2 = renum.size
    const adj2: Array<Map<number, number>> = Array.from({ length: n2 }, () => new Map())
    const self2 = new Float64Array(n2)
    for (let i = 0; i < n; i++) {
      const ci = renum.get(comm[i])!
      self2[ci] += self[i]
      for (const [j, w] of adj[i]) {
        if (j < i) continue
        const cj = renum.get(comm[j])!
        if (ci === cj) self2[ci] += w
        else {
          adj2[ci].set(cj, (adj2[ci].get(cj) ?? 0) + w)
          adj2[cj].set(ci, (adj2[cj].get(ci) ?? 0) + w)
        }
      }
    }
    membership = membership.map((c) => renum.get(comm[c])!)
    if (n2 === n) break
    n = n2
    adj = adj2
    self = self2
  }
  return membership
}

/** 제목을 낱말로 — 글자·숫자 덩어리, 두 글자 이상, 숫자만인 것(날짜 등)은 빼요 */
export function titleTokens(title: string): string[] {
  return title.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2 && !/^\d+$/.test(t))
}

/**
 * 묶음 번호를 크기 순(0이 가장 큼)으로 다시 매기고 이름을 붙여요.
 * 두 개 미만인 묶음은 -1(주제 없음)이에요.
 */
export function rankCommunities(
  raw: number[],
  titles: string[]
): { community: number[]; communities: Community[] } {
  const members = new Map<number, number[]>()
  raw.forEach((c, i) => {
    const arr = members.get(c)
    if (arr) arr.push(i)
    else members.set(c, [i])
  })
  const groups = [...members.values()].filter((g) => g.length >= 2).sort((a, b) => b.length - a.length || a[0] - b[0])

  // 낱말이 나오는 메모 수(df) — 흔한 낱말은 이름으로 덜 써요
  // 대소문자는 하나로 세고, 이름에는 가장 많이 쓴 모양(PPA, ppa …)을 써요
  const shapes = new Map<string, Map<string, number>>()
  const tokensOf = titles.map((t) => {
    const set = new Set<string>()
    for (const tok of titleTokens(t)) {
      const key = tok.toLowerCase()
      set.add(key)
      const m = shapes.get(key) ?? shapes.set(key, new Map()).get(key)!
      m.set(tok, (m.get(tok) ?? 0) + 1)
    }
    return set
  })
  const shapeOf = (key: string) => [...(shapes.get(key) ?? new Map([[key, 1]]))].sort((a, b) => b[1] - a[1])[0][0]
  const df = new Map<string, number>()
  for (const set of tokensOf) for (const t of set) df.set(t, (df.get(t) ?? 0) + 1)
  const N = titles.length

  const community: number[] = Array.from({ length: raw.length }, () => -1)
  const communities: Community[] = groups.map((g, id) => {
    for (const i of g) community[i] = id
    const tf = new Map<string, number>()
    for (const i of g) for (const t of tokensOf[i]) tf.set(t, (tf.get(t) ?? 0) + 1)
    const scored = [...tf.entries()]
      // 묶음의 한 메모에만 나온 낱말은 이름감이 아니에요 (묶음이 둘일 땐 허용)
      .filter(([, c]) => c >= Math.min(2, g.length))
      .map(([t, c]) => ({ t, s: c * Math.log(1 + N / (df.get(t) ?? 1)) }))
      .sort((a, b) => b.s - a.s || a.t.localeCompare(b.t))
    const picked: string[] = []
    for (const { t } of scored) {
      if (picked.some((p) => p.includes(t) || t.includes(p))) continue
      picked.push(t)
      if (picked.length === 2) break
    }
    return { id, size: g.length, label: picked.map(shapeOf).join(' · ') || `주제 ${id + 1}` }
  })
  return { community, communities }
}
