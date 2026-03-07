import { useMemo } from 'react'
import { useMemoStore } from '@/stores/memoStore'

export interface GraphNode {
  id: string
  label: string
  group: string  // primary tag or 'none'
}

export interface GraphLink {
  source: string
  target: string
  weight: number  // number of shared tags
}

export function useGraphData() {
  const memos = useMemoStore((s) => s.memos)

  return useMemo(() => {
    const active = memos.filter((m) => !m.deletedAt && m.id != null && m.tags.length > 0)
    const nodes: GraphNode[] = active.map((m) => ({
      id: String(m.id),
      label: m.title || '\uC81C\uBAA9 \uC5C6\uC74C',
      group: m.tags[0] || 'none',
    }))

    const links: GraphLink[] = []
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const shared = active[i].tags.filter((t) => active[j].tags.includes(t))
        if (shared.length > 0) {
          links.push({
            source: String(active[i].id),
            target: String(active[j].id),
            weight: shared.length,
          })
        }
      }
    }

    return { nodes, links }
  }, [memos])
}
