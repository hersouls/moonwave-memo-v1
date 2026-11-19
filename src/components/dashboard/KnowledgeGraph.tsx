import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useKnowledgeGraph } from '@/services/graph/graphEngine'
import type { GraphNode } from '@/services/graph/types'
import { useFolderStore } from '@/stores/folderStore'
import { WidgetCard } from './WidgetCard'
import { ForceGraph } from './ForceGraph'
import { KnowledgeGraphModal } from './KnowledgeGraphModal'
import { GROUP_COLORS, NONE_COLOR } from './graphColors'
import { IcLineExpand, IcLineShare } from '@/mw/icons'


export function KnowledgeGraph() {
  const { result } = useKnowledgeGraph()
  const folders = useFolderStore((s) => s.folders)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [modalOpen, setModalOpen] = useState(false)

  const nodes = result?.nodes ?? []
  const hasGraph = nodes.length >= 3

  // 폴더 → 색 · 이름. 폴더 고유색을 쓰고, 없으면 팔레트로.
  const { colorMap, groupNames } = useMemo(() => {
    const folderById = new Map(folders.map((f) => [String(f.id), f]))
    const colors = new Map<string, string>()
    const names = new Map<string, string>()
    ;(result?.groups ?? []).forEach((g, i) => {
      if (g === 'none') {
        colors.set(g, NONE_COLOR)
        names.set(g, '폴더 없음')
        return
      }
      const f = folderById.get(g)
      colors.set(g, f?.color || GROUP_COLORS[i % GROUP_COLORS.length])
      names.set(g, f?.name || '폴더')
    })
    return { colorMap: colors, groupNames: names }
  }, [result?.groups, folders])

  const colorOf = useCallback((n: GraphNode) => colorMap.get(n.group) || NONE_COLOR, [colorMap])

  // 그래프가 사라지면(메모 3개 미만) 크게 보기를 닫아 다시 생길 때 저절로 열리지 않게
  useEffect(() => {
    if (!hasGraph) setModalOpen(false)
  }, [hasGraph])

  // 미리보기 크기 (좁은 칸에도 맞게)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: Math.round(rect.width), height: Math.round(Math.max(rect.width * 0.62, 220)) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasGraph])

  const expandAction = hasGraph ? (
    <button
      type="button"
      onClick={() => setModalOpen(true)}
      aria-label="지식 그래프 크게 보기"
      title="크게 펼쳐 살펴보기"
      className="mw-icon-button"
    >
      <IcLineExpand size={16} />
    </button>
  ) : undefined

  return (
    <>
      <WidgetCard icon={IcLineShare} title="지식 그래프" action={expandAction} bodyClassName="px-2 py-2.5">
        {!result ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <IcLineShare size={20} className="text-zinc-400" aria-hidden="true" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">메모 사이의 연결을 찾고 있어요</p>
          </div>
        ) : !hasGraph ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <IcLineShare size={20} className="text-zinc-400" aria-hidden="true" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">메모가 3개 이상 필요해요</p>
          </div>
        ) : (
          <div className="relative block w-full overflow-hidden rounded-lg">
            <div ref={containerRef} className="w-full" style={{ height: size.height || 220 }}>
              {size.width > 0 && (
                <ForceGraph
                  nodes={nodes}
                  links={result.links}
                  colorOf={colorOf}
                  width={size.width}
                  height={size.height}
                  label={`지식 그래프 미리보기 — 메모 ${nodes.length}개, 연결 ${result.links.length}개`}
                />
              )}
            </div>
          </div>
        )}
      </WidgetCard>

      {hasGraph && result && (
        <KnowledgeGraphModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          result={result}
          colorMap={colorMap}
          groupNames={groupNames}
        />
      )}
    </>
  )
}
