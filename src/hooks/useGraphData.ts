import { useMemo } from 'react'
import { useMemoStore } from '@/stores/memoStore'

/* 옵시디언식 지식 그래프 데이터 — 하이브리드 연결
   - 노드: 모든 메모 (태그 유무와 무관)
   - 엣지(무료 신호, 동기 계산):
     · wiki    — 본문의 [[제목]] 위키링크 (명시적, 실선)
     · mention — 본문에 다른 메모 제목이 그대로 등장 (옵시디언 unlinked mention)
     · tag     — 희소 태그 공유 (태그 자체는 UI에 노출하지 않음 — 연결 신호로만)
   - semantic(AI 임베딩) 엣지는 useSemanticLinks에서 비동기로 얹는다.
   - 그룹: 폴더 (색상·범례용) */

export type LinkKind = 'wiki' | 'mention' | 'tag' | 'semantic'

export interface GraphNode {
  id: string
  label: string
  group: string // folderId(문자열) 또는 'none'
  degree: number // 연결 수 — 노드 크기·허브 판별에 사용
}

export interface GraphLink {
  source: string
  target: string
  weight: number
  kind: LinkKind
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  /** 그래프에 존재하는 폴더 id(문자열) — 노드 수 내림차순 (색상·범례 순서) */
  groups: string[]
  /** 전체 메모 수 (캡 적용 전) */
  total: number
  /** MAX_NODES 초과로 최근 항목만 표시했는지 여부 */
  truncated: boolean
}

// 성능 상한 — SVG 렌더·힘 시뮬레이션 부담을 제한. 초과 시 최근 수정 순 상위 N개.
const MAX_NODES = 250
// 위키링크 [[제목]] (별칭·헤딩 표기는 제목 부분만 사용)
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g
// 언급 감지 최소 제목 길이 — 짧은 제목의 우연 일치 노이즈 방지
const MENTION_MIN_TITLE = 4
// 태그 연결: 이보다 많은 메모가 공유하는 태그는 정보량이 낮아(불용어化) 제외
const TAG_MAX_GROUP = 15
// 태그 엣지 전체 상한 — 지배적 태그로 인한 O(n²) 헤어볼 방지
const TAG_EDGE_CAP = 800

const pairKey = (a: string, b: string) => (a < b ? `${a}~${b}` : `${b}~${a}`)

export function useGraphData(): GraphData {
  const memos = useMemoStore((s) => s.memos)

  return useMemo(() => {
    const activeAll = memos.filter((m) => !m.deletedAt && m.id != null)
    const total = activeAll.length
    const truncated = total > MAX_NODES

    const active = truncated
      ? [...activeAll]
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
          .slice(0, MAX_NODES)
      : activeAll

    const nodes: GraphNode[] = active.map((m) => ({
      id: String(m.id),
      label: m.title?.trim() || '제목 없음',
      group: m.folderId != null ? String(m.folderId) : 'none',
      degree: 0,
    }))
    const nodeById = new Map(nodes.map((n) => [n.id, n]))

    // 제목 → id(들) — 표시 대상 노드에 한해 (동명이인 대비 배열)
    const titleToIds = new Map<string, string[]>()
    for (const m of active) {
      const t = (m.title || '').trim()
      if (!t) continue
      const id = String(m.id)
      const arr = titleToIds.get(t)
      if (arr) arr.push(id)
      else titleToIds.set(t, [id])
    }

    const edgeMap = new Map<string, GraphLink>()
    const addEdge = (a: string, b: string, kind: LinkKind) => {
      if (a === b) return
      const key = pairKey(a, b)
      const e = edgeMap.get(key)
      if (e) {
        // 같은 종류면 가중치 누적 — 다른 종류면 먼저 기록된 강한 신호(wiki>mention) 유지
        if (e.kind === kind) e.weight++
      } else {
        edgeMap.set(key, { source: a < b ? a : b, target: a < b ? b : a, weight: 1, kind })
      }
    }

    // 1) wiki — [[제목]] 위키링크 (가장 강한 명시적 신호, 우선 기록)
    for (const m of active) {
      if (!m.body) continue
      const srcId = String(m.id)
      for (const match of m.body.matchAll(WIKILINK_RE)) {
        const inner = match[1].split(/[|#]/)[0].trim() // [[제목|별칭]], [[제목#헤딩]] 대응
        const targets = titleToIds.get(inner)
        if (!targets) continue
        for (const tgt of targets) addEdge(srcId, tgt, 'wiki')
      }
    }

    // 2) mention — 본문에 다른 메모의 제목이 평문으로 등장 (unlinked mention)
    const mentionTitles = [...titleToIds.entries()].filter(([t]) => t.length >= MENTION_MIN_TITLE)
    for (const m of active) {
      if (!m.body) continue
      const srcId = String(m.id)
      for (const [title, ids] of mentionTitles) {
        if (!m.body.includes(title)) continue
        for (const tgt of ids) addEdge(srcId, tgt, 'mention')
      }
    }

    // 3) tag — 희소 태그 공유 (2..TAG_MAX_GROUP개 메모가 쓰는 태그만 — IDF 발상)
    const tagIndex = new Map<string, string[]>()
    for (const m of active) {
      const id = String(m.id)
      for (const t of new Set(m.tags)) {
        const arr = tagIndex.get(t)
        if (arr) arr.push(id)
        else tagIndex.set(t, [id])
      }
    }
    const tagEdges = new Map<string, GraphLink>()
    for (const ids of tagIndex.values()) {
      if (ids.length < 2 || ids.length > TAG_MAX_GROUP) continue
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = pairKey(ids[i], ids[j])
          if (edgeMap.has(key)) continue // wiki/mention이 이미 연결한 쌍은 그대로
          const e = tagEdges.get(key)
          if (e) e.weight++
          else {
            const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]]
            tagEdges.set(key, { source: a, target: b, weight: 1, kind: 'tag' })
          }
        }
      }
    }
    // 태그 엣지 상한 — 가중치(공유 태그 수) 높은 순으로 유지
    let tagList = [...tagEdges.values()]
    if (tagList.length > TAG_EDGE_CAP) {
      tagList.sort((a, b) => b.weight - a.weight)
      tagList = tagList.slice(0, TAG_EDGE_CAP)
    }

    const links: GraphLink[] = [...edgeMap.values(), ...tagList]
    for (const e of links) {
      nodeById.get(e.source)!.degree++
      nodeById.get(e.target)!.degree++
    }

    // 폴더(group) 빈도 내림차순 — 색상·범례가 안정적으로 동일 순서를 따르도록
    const freq = new Map<string, number>()
    for (const n of nodes) freq.set(n.group, (freq.get(n.group) || 0) + 1)
    const groups = [...freq.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])

    return { nodes, links, groups, total, truncated }
  }, [memos])
}
