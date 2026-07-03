import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Settings, ZoomIn, ZoomOut } from 'lucide-react'
import clsx from 'clsx'
import { useSemanticCanvas, type CanvasNode } from '@/hooks/useSemanticCanvas'
import { useUIStore } from '@/stores/uiStore'
import type { MemoColor } from '@/lib/types'

// SVG fill colors for memo colors (matching MEMO_CARD_BG palette)
const MEMO_SVG_FILLS: Record<MemoColor, { light: string; dark: string }> = {
  white: { light: '#f4f4f5', dark: '#3f3f46' },
  yellow: { light: '#fef3c7', dark: '#78350f' },
  green: { light: '#d1fae5', dark: '#064e3b' },
  blue: { light: '#dbeafe', dark: '#1e3a5f' },
  pink: { light: '#fce7f3', dark: '#831843' },
  purple: { light: '#ede9fe', dark: '#4c1d95' },
}

const MEMO_STROKE_COLORS: Record<MemoColor, string> = {
  white: '#a1a1aa',
  yellow: '#f59e0b',
  green: '#10b981',
  blue: '#3b82f6',
  pink: '#ec4899',
  purple: '#8b5cf6',
}

function SemanticCanvas() {
  const navigate = useNavigate()
  const { nodes, isComputing, hasApiKey } = useSemanticCanvas()

  // Zoom/pan state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const lastPinchDistRef = useRef<number | null>(null)

  // Detect dark mode — 테마 토글에 실시간 반응 (documentElement class 관찰)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  })
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Node radius based on body length
  const getRadius = useCallback((bodyLength: number) => {
    return Math.min(24, Math.max(12, 12 + Math.log2(Math.max(1, bodyLength / 50)) * 3))
  }, [])

  // Mouse handlers for pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest('.canvas-node')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }, [transform.x, transform.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }))
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Wheel handler for zoom — 커서 위치 기준 줌 (포인터가 가리키는 지점 고정)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const rect = svgRef.current?.getBoundingClientRect()
    setTransform((prev) => {
      const scale = Math.min(3, Math.max(0.3, prev.scale * delta))
      if (!rect || scale === prev.scale) return { ...prev, scale }
      const k = scale / prev.scale
      // 캔버스 중심 기준 포인터 오프셋 (transform 원점이 중앙이므로)
      const px = e.clientX - rect.left - rect.width / 2
      const py = e.clientY - rect.top - rect.height / 2
      return {
        x: px - (px - prev.x) * k,
        y: py - (py - prev.y) * k,
        scale,
      }
    })
  }, [])

  // Touch: single-finger pan, two-finger pinch zoom (mobile/tablet)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if ((e.target as Element).closest?.('.canvas-node')) return
      const t = e.touches[0]
      setIsDragging(true)
      setDragStart({ x: t.clientX - transform.x, y: t.clientY - transform.y })
    } else if (e.touches.length === 2) {
      setIsDragging(false)
      const [a, b] = [e.touches[0], e.touches[1]]
      lastPinchDistRef.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
  }, [transform.x, transform.y])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0]
      setTransform((prev) => ({ ...prev, x: t.clientX - dragStart.x, y: t.clientY - dragStart.y }))
    } else if (e.touches.length === 2 && lastPinchDistRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const ratio = dist / lastPinchDistRef.current
      lastPinchDistRef.current = dist
      setTransform((prev) => ({ ...prev, scale: Math.min(3, Math.max(0.3, prev.scale * ratio)) }))
    }
  }, [isDragging, dragStart])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    lastPinchDistRef.current = null
  }, [])

  const handleZoomIn = () => {
    setTransform((prev) => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))
  }

  const handleZoomOut = () => {
    setTransform((prev) => ({ ...prev, scale: Math.max(0.3, prev.scale / 1.2) }))
  }

  const handleNodeClick = (nodeId: number) => {
    navigate(`/memo/${nodeId}`)
  }

  // No API key state
  if (!hasApiKey && !isComputing) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-4rem)] gap-4 px-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">
            시맨틱 캔버스
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            OpenAI API 키가 필요합니다
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
            메모 간의 의미적 유사성을 시각화하려면 OpenAI의 텍스트 임베딩 API가 필요합니다.
            설정에서 API 키를 입력해 주세요.
          </p>
        </div>
        <button
          onClick={() => useUIStore.getState().openSettingsModal()}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)]"
        >
          <Settings className="w-4 h-4" />
          설정 열기
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          대시보드로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[calc(100dvh-4rem)] overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
            시맨틱 캔버스
          </h1>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {nodes.length}개 메모
          </span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="축소"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {Math.round(transform.scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="확대"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Computing overlay */}
      {isComputing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              임베딩 계산 중...
            </span>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className={clsx(
          'w-full h-full pt-14',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <g transform={`translate(${transform.x + (svgRef.current?.clientWidth ?? 800) / 2}, ${transform.y + (svgRef.current?.clientHeight ?? 600) / 2}) scale(${transform.scale})`}>
          {/* Connection lines for close nodes (optional visual) */}
          {nodes.map((node, i) =>
            nodes.slice(i + 1).map((other) => {
              const dist = Math.sqrt((node.x - other.x) ** 2 + (node.y - other.y) ** 2)
              if (dist < 80) {
                return (
                  <line
                    key={`${node.id}-${other.id}`}
                    x1={node.x}
                    y1={node.y}
                    x2={other.x}
                    y2={other.y}
                    stroke={isDark ? '#3f3f46' : '#e4e4e7'}
                    strokeWidth={0.5}
                    opacity={Math.max(0.1, 1 - dist / 80)}
                  />
                )
              }
              return null
            })
          )}

          {/* Nodes */}
          {nodes.map((node) => {
            const radius = getRadius(node.bodyLength)
            const isHovered = hoveredNode?.id === node.id
            const fill = isDark ? MEMO_SVG_FILLS[node.color].dark : MEMO_SVG_FILLS[node.color].light
            const stroke = MEMO_STROKE_COLORS[node.color]

            return (
              <g
                key={node.id}
                className="canvas-node"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node.id)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? radius + 3 : radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  style={{
                    transition: 'r 0.15s ease, stroke-width 0.15s ease',
                    filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : undefined,
                  }}
                />
                {/* Title label for hovered node */}
                {isHovered && (
                  <g>
                    <rect
                      x={node.x - Math.min(node.title.length * 5.5, 100)}
                      y={node.y - radius - 30}
                      width={Math.min(node.title.length * 11, 200)}
                      height={22}
                      rx={4}
                      fill={isDark ? '#27272a' : '#ffffff'}
                      stroke={isDark ? '#3f3f46' : '#e4e4e7'}
                      strokeWidth={1}
                    />
                    <text
                      x={node.x}
                      y={node.y - radius - 15}
                      textAnchor="middle"
                      fontSize={11}
                      fill={isDark ? '#e4e4e7' : '#3f3f46'}
                      fontFamily="'Pretendard', sans-serif"
                    >
                      {node.title.length > 18 ? node.title.slice(0, 18) + '...' : node.title}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tooltip (fixed position, for mobile) */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 right-4 z-10 p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 pointer-events-none sm:hidden">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
            {hoveredNode.title}
          </div>
          {hoveredNode.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {hoveredNode.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SemanticCanvas
