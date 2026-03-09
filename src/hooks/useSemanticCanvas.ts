import { useState, useEffect, useRef, useCallback } from 'react'
import { forceSimulation, forceCenter, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force'
import type { MemoColor } from '@/lib/types'
import { useMemoStore } from '@/stores/memoStore'
import { getOrComputeEmbedding, hasEmbeddingCapability } from '@/services/embeddingService'
import { projectTo2D } from '@/services/dimensionReducer'

export interface CanvasNode {
  id: number
  x: number
  y: number
  title: string
  color: MemoColor
  tags: string[]
  bodyLength: number
}

interface SimNode {
  id: number
  x: number
  y: number
  targetX: number
  targetY: number
  title: string
  color: MemoColor
  tags: string[]
  bodyLength: number
}

export function useSemanticCanvas() {
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [isComputing, setIsComputing] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null)
  const memos = useMemoStore((s) => s.memos)

  const compute = useCallback(async () => {
    const capable = hasEmbeddingCapability()
    setHasApiKey(capable)
    if (!capable) return

    const activeMemos = memos
      .filter((m) => !m.deletedAt && (m.title.trim() || m.body.trim()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 80)

    if (activeMemos.length === 0) return

    setIsComputing(true)

    try {
      // Compute embeddings for all memos
      const embeddings: Array<{ memoId: number; vector: number[] }> = []

      for (const memo of activeMemos) {
        const text = `${memo.title}\n${memo.body}`.trim()
        const vector = await getOrComputeEmbedding(memo.id!, text, memo.updatedAt)
        if (vector) {
          embeddings.push({ memoId: memo.id!, vector })
        }
      }

      if (embeddings.length < 2) {
        // Not enough embeddings, show in a simple grid
        const result: CanvasNode[] = activeMemos.map((m, i) => ({
          id: m.id!,
          x: (i % 5) * 80 - 160,
          y: Math.floor(i / 5) * 80 - 160,
          title: m.title || m.body.slice(0, 30),
          color: m.color,
          tags: m.tags,
          bodyLength: m.body.length,
        }))
        setNodes(result)
        setIsComputing(false)
        return
      }

      // PCA projection
      const vectors = embeddings.map((e) => e.vector)
      const positions = projectTo2D(vectors)

      // Build simulation nodes
      const width = 800
      const height = 600
      const simNodes: SimNode[] = embeddings
        .map((e, i) => {
          const memo = activeMemos.find((m) => m.id === e.memoId)
          if (!memo) return null
          return {
            id: memo.id!,
            x: positions[i].x * (width / 2.5),
            y: positions[i].y * (height / 2.5),
            targetX: positions[i].x * (width / 2.5),
            targetY: positions[i].y * (height / 2.5),
            title: memo.title || memo.body.slice(0, 30),
            color: memo.color,
            tags: memo.tags,
            bodyLength: memo.body.length,
          }
        })
        .filter((n): n is SimNode => n !== null)

      // Run d3-force simulation
      if (simulationRef.current) {
        simulationRef.current.stop()
      }

      const simulation = forceSimulation(simNodes as unknown as SimulationNodeDatum[])
        .force('center', forceCenter(0, 0))
        .force('collide', forceCollide<SimulationNodeDatum>().radius(30))
        .force('x', forceX<SimulationNodeDatum>().x((d) => (d as unknown as SimNode).targetX).strength(0.3))
        .force('y', forceY<SimulationNodeDatum>().y((d) => (d as unknown as SimNode).targetY).strength(0.3))
        .stop()

      simulationRef.current = simulation

      // Run simulation synchronously (tick 120 times)
      for (let i = 0; i < 120; i++) {
        simulation.tick()
      }

      // Extract final positions
      const finalNodes: CanvasNode[] = simNodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        title: n.title,
        color: n.color,
        tags: n.tags,
        bodyLength: n.bodyLength,
      }))

      setNodes(finalNodes)
    } catch (err) {
      console.error('Semantic canvas computation failed:', err)
    } finally {
      setIsComputing(false)
    }
  }, [memos])

  useEffect(() => {
    compute()
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [compute])

  return { nodes, isComputing, hasApiKey }
}
