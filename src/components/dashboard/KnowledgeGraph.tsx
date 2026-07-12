import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Share2 } from 'lucide-react'
import { useGraphData } from '@/hooks/useGraphData'
import { WidgetCard } from './WidgetCard'
import { ForceGraph, buildColorMap } from './ForceGraph'
import { KnowledgeGraphModal } from './KnowledgeGraphModal'

export function KnowledgeGraph() {
  const { nodes, links, groups, total, truncated } = useGraphData()
  const colorMap = useMemo(() => buildColorMap(groups), [groups])
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [modalOpen, setModalOpen] = useState(false)

  const hasGraph = nodes.length >= 3

  // 그래프가 사라지면(태그 메모 3개 미만) 모달 상태를 닫아 재등장 시 스스로 열리는 것 방지
  useEffect(() => {
    if (!hasGraph) setModalOpen(false)
  }, [hasGraph])

  // 미리보기 영역 크기 측정 (좁은 masonry 컬럼 대응)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        setSize({
          width: Math.round(rect.width),
          height: Math.round(Math.max(rect.width * 0.62, 220)),
        })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasGraph])

  const expandAction = hasGraph ? (
    <button
      type="button"
      onClick={() => setModalOpen(true)}
      aria-label="지식 그래프 확대"
      title="확대하여 탐색"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
    >
      <Maximize2 className="h-4 w-4" />
    </button>
  ) : undefined

  return (
    <>
      <WidgetCard icon={Share2} title="지식 그래프" action={expandAction} bodyClassName="px-2 py-2.5">
        {!hasGraph ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Share2 className="h-5 w-5 text-zinc-400" aria-hidden="true" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              태그가 있는 메모가 3개 이상 필요합니다
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label="지식 그래프 확대하여 탐색"
            className="group relative block w-full overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <div ref={containerRef} className="w-full" style={{ height: size.height || 220 }}>
              {size.width > 0 && (
                <ForceGraph
                  nodes={nodes}
                  links={links}
                  colorMap={colorMap}
                  width={size.width}
                  height={size.height}
                />
              )}
            </div>
            {/* 확대 유도 오버레이 */}
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-white/70 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:from-zinc-900/70">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-medium text-white backdrop-blur dark:bg-white/90 dark:text-zinc-900">
                <Maximize2 className="h-3 w-3" />
                확대하여 탐색
              </span>
            </div>
          </button>
        )}
      </WidgetCard>

      {hasGraph && (
        <KnowledgeGraphModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          nodes={nodes}
          links={links}
          groups={groups}
          colorMap={colorMap}
          total={total}
          truncated={truncated}
        />
      )}
    </>
  )
}
