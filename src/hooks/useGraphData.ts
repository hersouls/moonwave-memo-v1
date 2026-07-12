import { useMemo } from 'react'
import { useMemoStore } from '@/stores/memoStore'

export interface GraphNode {
  id: string
  label: string
  group: string // 대표 태그(첫 번째) 또는 'none'
  tags: string[]
  degree: number // 연결 수 — 노드 크기·허브 판별에 사용
}

export interface GraphLink {
  source: string
  target: string
  weight: number // 공유 태그 수
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  /** 빈도 내림차순으로 정렬된 대표 태그 목록 — 색상 매핑·범례 순서의 단일 소스 */
  groups: string[]
  /** 태그가 있는 전체 메모 수 (캡 적용 전) */
  total: number
  /** MAX_NODES 초과로 최근 항목만 표시했는지 여부 */
  truncated: boolean
}

// 성능 상한 — 단일 태그가 지배적일 때 링크가 O(n²)로 폭증하고
// 동기 정착(pre-tick)이 메인 스레드를 막는 것을 방지한다.
// 초과 시 최근 수정 순으로 상위 MAX_NODES개만 시각화한다.
const MAX_NODES = 140

export function useGraphData(): GraphData {
  const memos = useMemoStore((s) => s.memos)

  return useMemo(() => {
    const activeAll = memos.filter((m) => !m.deletedAt && m.id != null && m.tags.length > 0)
    const total = activeAll.length
    const truncated = total > MAX_NODES

    // 캡 초과 시 최근 수정 순으로 상위 항목만
    const active = truncated
      ? [...activeAll].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, MAX_NODES)
      : activeAll

    const nodes: GraphNode[] = active.map((m) => ({
      id: String(m.id),
      label: m.title?.trim() || '제목 없음',
      group: m.tags[0] || 'none',
      tags: m.tags,
      degree: 0,
    }))

    const nodeById = new Map(nodes.map((n) => [n.id, n]))

    const links: GraphLink[] = []
    for (let i = 0; i < active.length; i++) {
      const aTags = new Set(active[i].tags)
      for (let j = i + 1; j < active.length; j++) {
        // 양쪽 모두 집합으로 다뤄 중복 태그가 가중치를 부풀리지 않도록 한다
        let shared = 0
        for (const t of new Set(active[j].tags)) if (aTags.has(t)) shared++
        if (shared > 0) {
          const s = String(active[i].id)
          const t = String(active[j].id)
          links.push({ source: s, target: t, weight: shared })
          nodeById.get(s)!.degree++
          nodeById.get(t)!.degree++
        }
      }
    }

    // 대표 태그를 빈도 내림차순으로 정렬 — 색상·범례가 안정적으로 동일 순서를 따르도록
    const freq = new Map<string, number>()
    for (const n of nodes) freq.set(n.group, (freq.get(n.group) || 0) + 1)
    const groups = [...freq.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])

    return { nodes, links, groups, total, truncated }
  }, [memos])
}
