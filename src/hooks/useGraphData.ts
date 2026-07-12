import { useMemo } from 'react'
import { useMemoStore } from '@/stores/memoStore'

/* 옵시디언식 지식 그래프 데이터
   - 노드: 모든 메모 (태그 유무와 무관)
   - 엣지: 메모 본문의 위키링크 [[제목]] → 해당 제목 메모로 연결
   - 그룹: 폴더 (색상·범례용). 태그는 사용/표시하지 않음. */

export interface GraphNode {
  id: string
  label: string
  group: string // folderId(문자열) 또는 'none'
  degree: number // 연결(위키링크) 수 — 노드 크기·허브 판별에 사용
}

export interface GraphLink {
  source: string
  target: string
  weight: number // 링크 등장 횟수
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
  /** 연결이 하나도 없는 고아 노드 수 */
  orphanCount: number
}

// 성능 상한 — SVG 렌더·힘 시뮬레이션 부담을 제한. 초과 시 최근 수정 순 상위 N개.
const MAX_NODES = 250
// 위키링크 [[제목]] (별칭·헤딩 표기는 제목 부분만 사용)
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

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

    // [[제목]] 위키링크로 무방향 엣지 구성 (가중치 = 등장 횟수)
    const edgeMap = new Map<string, GraphLink>()
    for (const m of active) {
      if (!m.body) continue
      const srcId = String(m.id)
      for (const match of m.body.matchAll(WIKILINK_RE)) {
        const inner = match[1].split(/[|#]/)[0].trim() // [[제목|별칭]], [[제목#헤딩]] 대응
        const targets = titleToIds.get(inner)
        if (!targets) continue
        for (const tgt of targets) {
          if (tgt === srcId) continue
          const a = srcId < tgt ? srcId : tgt
          const b = srcId < tgt ? tgt : srcId
          const key = `${a}~${b}`
          const e = edgeMap.get(key)
          if (e) e.weight++
          else edgeMap.set(key, { source: a, target: b, weight: 1 })
        }
      }
    }

    const links: GraphLink[] = []
    for (const e of edgeMap.values()) {
      links.push(e)
      nodeById.get(e.source)!.degree++
      nodeById.get(e.target)!.degree++
    }

    const orphanCount = nodes.reduce((acc, n) => acc + (n.degree === 0 ? 1 : 0), 0)

    // 폴더(group) 빈도 내림차순 — 색상·범례가 안정적으로 동일 순서를 따르도록
    const freq = new Map<string, number>()
    for (const n of nodes) freq.set(n.group, (freq.get(n.group) || 0) + 1)
    const groups = [...freq.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])

    return { nodes, links, groups, total, truncated, orphanCount }
  }, [memos])
}
