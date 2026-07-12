import { useEffect, useMemo, useState } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { db } from '@/services/database'
import {
  computeEmbedding,
  computeCosineSimilarity,
  hasEmbeddingCapability,
} from '@/services/embeddingService'
import type { GraphLink } from '@/hooks/useGraphData'

/* 지식 그래프 AI 의미 연결 (semantic 엣지)
   - 각 메모를 임베딩(OpenAI text-embedding-3-small)하고 코사인 유사도가 높은
     쌍을 'semantic' 엣지로 만든다.
   - 임베딩은 Dexie(embeddings 테이블)에 메모별로 캐시 — updatedAt이 같으면 재사용.
     캐시가 있으면 API 키 없이(오프라인)도 연결을 계산한다.
   - 키가 없고 캐시도 없는 메모는 건너뛴다(부분 결과 허용). */

const SIM_THRESHOLD = 0.5 // 이 미만은 연결하지 않음
const TOP_K = 3 // 노드당 최대 의미 연결 수 (헤어볼 방지)
const CONCURRENCY = 5 // 임베딩 API 동시 호출 수

export interface SemanticLinksState {
  links: GraphLink[]
  /** 임베딩 계산 진행 중 여부 */
  computing: boolean
  /** 0..100 */
  progress: number
  /** API 키/로그인으로 새 임베딩을 만들 수 있는지 */
  capable: boolean
  /** 키·캐시 부재로 건너뛴 메모 수 */
  skipped: number
}

/** Dexie 캐시 우선으로 임베딩 확보. 미스이고 계산 가능하면 API로 만든 뒤 캐시. */
async function getEmbedding(
  memoId: number,
  text: string,
  updatedAt: string,
  canCompute: boolean
): Promise<number[] | null> {
  try {
    const cached = await db.embeddings.get(memoId)
    if (cached && cached.updatedAt === updatedAt && cached.vector.length > 0) {
      return cached.vector
    }
  } catch {
    // 캐시 읽기 실패 — 계산 경로로
  }
  if (!canCompute || !text.trim()) return null
  const vector = await computeEmbedding(text)
  if (!vector) return null
  try {
    await db.embeddings.put({ memoId, updatedAt, vector })
  } catch {
    // 캐시 저장 실패는 무시 (다음에 재계산)
  }
  return vector
}

export function useSemanticLinks(nodeIds: string[], enabled: boolean): SemanticLinksState {
  const memos = useMemoStore((s) => s.memos)
  const [state, setState] = useState<SemanticLinksState>({
    links: [],
    computing: false,
    progress: 0,
    capable: false,
    skipped: 0,
  })

  // 대상 메모 (그래프에 표시 중인 노드만) — id+updatedAt 서명으로 불필요한 재계산 방지
  const targets = useMemo(() => {
    const idSet = new Set(nodeIds)
    return memos
      .filter((m) => m.id != null && idSet.has(String(m.id)))
      .map((m) => ({
        id: String(m.id),
        memoId: m.id!,
        text: `${m.title || ''}\n${m.body || ''}`.trim(),
        updatedAt: m.updatedAt || '',
      }))
  }, [memos, nodeIds])
  const signature = useMemo(
    () => targets.map((t) => `${t.id}:${t.updatedAt}`).sort().join('|'),
    [targets]
  )

  useEffect(() => {
    if (!enabled || targets.length < 2) {
      setState((s) => (s.links.length || s.computing ? { ...s, links: [], computing: false, progress: 0 } : s))
      return
    }

    let cancelled = false
    const capable = hasEmbeddingCapability()
    setState((s) => ({ ...s, computing: true, progress: 0, capable }))

    const run = async () => {
      const vectors = new Map<string, number[]>()
      let done = 0
      let skipped = 0

      // 동시 CONCURRENCY개 워커 풀
      const queue = [...targets]
      const worker = async () => {
        while (queue.length > 0 && !cancelled) {
          const t = queue.shift()!
          const v = await getEmbedding(t.memoId, t.text, t.updatedAt, capable)
          if (v) vectors.set(t.id, v)
          else skipped++
          done++
          if (!cancelled && (done % 5 === 0 || done === targets.length)) {
            const progress = Math.round((done / targets.length) * 100)
            setState((s) => ({ ...s, progress }))
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker))
      if (cancelled) return

      // 쌍별 코사인 → 노드당 상위 TOP_K, 임계값 이상만
      const ids = [...vectors.keys()]
      const best = new Map<string, Array<{ other: string; sim: number }>>()
      for (const id of ids) best.set(id, [])
      for (let i = 0; i < ids.length; i++) {
        const vi = vectors.get(ids[i])!
        for (let j = i + 1; j < ids.length; j++) {
          const sim = computeCosineSimilarity(vi, vectors.get(ids[j])!)
          if (sim < SIM_THRESHOLD) continue
          best.get(ids[i])!.push({ other: ids[j], sim })
          best.get(ids[j])!.push({ other: ids[i], sim })
        }
      }
      // 어느 한쪽의 top-K에 들면 엣지 채택
      const picked = new Map<string, number>() // pairKey → sim
      for (const [id, arr] of best) {
        arr.sort((a, b) => b.sim - a.sim)
        for (const { other, sim } of arr.slice(0, TOP_K)) {
          const key = id < other ? `${id}~${other}` : `${other}~${id}`
          const prev = picked.get(key)
          if (prev == null || sim > prev) picked.set(key, sim)
        }
      }
      const links: GraphLink[] = [...picked.entries()].map(([key, sim]) => {
        const [a, b] = key.split('~')
        return {
          source: a,
          target: b,
          // 유사도 0.5→1, 0.9+→2.6 — 굵기·힘에 반영
          weight: Number((1 + Math.min((sim - SIM_THRESHOLD) * 4, 1.6)).toFixed(2)),
          kind: 'semantic' as const,
        }
      })

      if (!cancelled) {
        setState({ links, computing: false, progress: 100, capable, skipped })
      }
    }

    run().catch(() => {
      if (!cancelled) setState((s) => ({ ...s, computing: false }))
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature])

  return state
}
