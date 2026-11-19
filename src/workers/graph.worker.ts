import { computeGraph } from '@/services/graph/compute'
import type { GraphRequest, GraphResponse } from '@/services/graph/types'

/* 지식 그래프 계산 워커 — 연결·주제 묶음·레이아웃을 화면 밖에서 계산해요.
   요청이 밀리면 마지막 것만 계산해요(중간 것은 이미 낡았으니까요). */

let pending: GraphRequest | null = null
let busy = false

function drain() {
  if (busy || !pending) return
  const req = pending
  pending = null
  busy = true
  let res: GraphResponse
  try {
    res = { seq: req.seq, result: computeGraph(req) }
  } catch (err) {
    res = { seq: req.seq, error: err instanceof Error ? err.message : String(err) }
  }
  ;(self as unknown as { postMessage(m: GraphResponse): void }).postMessage(res)
  busy = false
  // 계산하는 동안 들어온 새 요청이 있으면 이어서
  setTimeout(drain, 0)
}

self.addEventListener('message', (e: MessageEvent<GraphRequest>) => {
  pending = e.data
  setTimeout(drain, 0)
})
