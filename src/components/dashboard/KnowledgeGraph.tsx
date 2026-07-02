import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { useGraphData, type GraphNode } from '@/hooks/useGraphData'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import { select } from 'd3-selection'

// Color palette for tag groups
const GROUP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

interface SimNode extends SimulationNodeDatum, GraphNode {
  x: number
  y: number
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number
}

export function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { nodes, links } = useGraphData()
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 })

  // Measure container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(entry.contentRect.width * 0.65, 250),
        })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      navigate(`/memo/${nodeId}`)
    },
    [navigate]
  )

  // Build graph with d3-force
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || nodes.length < 3) return

    const { width, height } = dimensions

    // Build group color map
    const groups = [...new Set(nodes.map((n) => n.group))]
    const colorMap = new Map<string, string>()
    groups.forEach((g, i) => colorMap.set(g, GROUP_COLORS[i % GROUP_COLORS.length]))

    // Create simulation data
    const simNodes: SimNode[] = nodes.map((n) => ({
      ...n,
      x: Math.random() * width,
      y: Math.random() * height,
    }))

    const simLinks: SimLink[] = links.map((l) => ({
      source: l.source,
      target: l.target,
      weight: l.weight,
    }))

    // Clear existing
    const svgSelection = select(svg)
    svgSelection.selectAll('*').remove()

    // Set dimensions
    svgSelection.attr('width', width).attr('height', height)

    // Create link group
    const linkGroup = svgSelection
      .append('g')
      .attr('class', 'links')

    const linkElements = linkGroup
      .selectAll('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', '#a1a1aa')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', (d: SimLink) => Math.min(d.weight * 1.5, 4))

    // Create node group
    const nodeGroup = svgSelection
      .append('g')
      .attr('class', 'nodes')

    const nodeElements = nodeGroup
      .selectAll('g')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: SimNode) => {
        if (d.id) handleNodeClick(d.id)
      })

    nodeElements
      .append('circle')
      .attr('r', 8)
      .attr('fill', (d: SimNode) => colorMap.get(d.group) || '#a1a1aa')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.85)

    nodeElements
      .append('text')
      .text((d: SimNode) => d.label.length > 12 ? d.label.slice(0, 12) + '...' : d.label)
      .attr('font-size', '10px')
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('fill', 'currentColor')
      .attr('class', 'text-zinc-600 dark:text-zinc-400')
      .style('pointer-events', 'none')

    // Force simulation
    const simulation = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
          .strength((d) => Math.min(d.weight * 0.3, 1))
      )
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide(20))

    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => (d.source as SimNode).x)
        .attr('y1', (d) => (d.source as SimNode).y)
        .attr('x2', (d) => (d.target as SimNode).x)
        .attr('y2', (d) => (d.target as SimNode).y)

      nodeElements.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
    }
  }, [nodes, links, dimensions, handleNodeClick])

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
          <Share2 className="h-4 w-4 text-indigo-500" />
        </div>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {'지식 그래프'}
        </span>
      </div>

      <div
        ref={containerRef}
        className="border-t border-zinc-100 dark:border-zinc-700 px-2 py-3"
      >
        {nodes.length < 3 ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 dark:text-zinc-400">
            <p className="text-sm text-center">
              {'태그가 있는 메모가 3개 이상 필요합니다'}
            </p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="w-full"
            style={{ height: dimensions.height }}
          />
        )}
      </div>
    </div>
  )
}
