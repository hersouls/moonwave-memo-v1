import { computeGraph } from '@/services/graph/compute'
import { layout3D, type Layout3DRequest, type Layout3DResponse } from '@/services/graph/layout3d'
import type { GraphRequest, GraphResponse } from '@/services/graph/types'

/* 지식 그래프 계산 워커 — 연결 · 주제 묶음 · 2D/3D 배치를 화면 밖에서 계산해요.
   요청이 밀리면 종류마다 마지막 것만 계산해요(중간 것은 이미 낡았으니까요).
   그래프가 먼저예요: 3D 배치는 그래프 결과를 바탕으로 하니까요. */

type Req = GraphRequest | Layout3DRequest
const post = (m: GraphResponse | Layout3DResponse, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(m, transfer)

let graphReq: GraphRequest | null = null
let req3D: Layout3DRequest | null = null
let busy = false

function drain() {
  if (busy) return
  busy = true
  try {
    if (graphReq) {
      const req = graphReq
      graphReq = null
      try {
        post({ seq: req.seq, result: computeGraph(req) })
      } catch (err) {
        post({ seq: req.seq, error: err instanceof Error ? err.message : String(err) })
      }
    } else if (req3D) {
      const req = req3D
      req3D = null
      try {
        const res = layout3D(req)
        post(res, [res.pos.buffer])
      } catch {
        // 3D 배치를 못 하면 빈 결과 — 화면이 기다리기만 하지 않게
        post({ type: 'layout3d', seq: req.seq, ids: [], pos: new Float32Array(0), ms: 0 })
      }
    }
  } finally {
    busy = false
  }
  if (graphReq || req3D) setTimeout(drain, 0)
}

self.addEventListener('message', (e: MessageEvent<Req>) => {
  const d = e.data
  if ('type' in d && d.type === 'layout3d') req3D = d
  else graphReq = d as GraphRequest
  setTimeout(drain, 0)
})
