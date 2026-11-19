import { useEffect, useSyncExternalStore } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { db } from '@/services/database'
import { getOrComputeEmbedding, hasEmbeddingCapability } from '@/services/embeddingService'
import type { Memo } from '@/lib/types'
import { computeGraph } from './compute'
import { layout3D, type Layout3DRequest, type Layout3DResponse } from './layout3d'
import type { GraphMemoInput, GraphRequest, GraphResponse, GraphResult } from './types'

/* 지식 그래프 엔진 — 화면 하나(대시보드 위젯)와 크게 보기가 같은 결과를 나눠 써요.
   - 메모가 바뀌면 잠시(DEBOUNCE_MS) 모았다가 워커에 한 번 보내요. 화면은 그동안 멈추지 않아요.
   - 이미 계산해 둔 임베딩(IndexedDB)은 늘 써요 — 돈이 들지 않아요.
   - 아직 없는 임베딩은 크게 보기에서 AI 연결이 켜져 있을 때만 만들어요(네트워크 · 비용).
   - 노드 자리는 다음 계산에 이어 줘서 그래프가 튀지 않아요. */

const DEBOUNCE_MS = 300
const EMBED_CONCURRENCY = 5

export interface SemanticState {
  /** 빠진 임베딩을 만드는 중 */
  computing: boolean
  /** 0..100 */
  progress: number
  /** 새 임베딩을 만들 수 있는지 (키 또는 로그인) */
  capable: boolean
  /** 만들지 못한 메모 수 */
  skipped: number
  /** 쓸 수 있는 임베딩 수 */
  ready: number
}

export interface GraphEngineState {
  result: GraphResult | null
  /** 워커가 계산 중 */
  computing: boolean
  semantic: SemanticState
  error: string | null
  /** 3D 자리 — 3D 보기를 연 동안만 계산해요. graphSeq는 이 자리가 바탕으로 한 그래프 결과 */
  layout3d: { graphSeq: number; pos: Map<string, [number, number, number]>; ms: number } | null
  computing3d: boolean
}

let state: GraphEngineState = {
  result: null,
  computing: false,
  semantic: { computing: false, progress: 0, capable: false, skipped: 0, ready: 0 },
  error: null,
  layout3d: null,
  computing3d: false,
}
const listeners = new Set<() => void>()
function setState(patch: Partial<GraphEngineState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
function setSemantic(patch: Partial<SemanticState>) {
  setState({ semantic: { ...state.semantic, ...patch } })
}

/* ── 워커 ── */

let worker: Worker | null | undefined
function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    if (typeof Worker === 'undefined') throw new Error('no worker')
    worker = new Worker(new URL('../../workers/graph.worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (e: MessageEvent<GraphResponse | Layout3DResponse>) => {
      const d = e.data
      if ('type' in d && d.type === 'layout3d') on3D(d)
      else onResult(d as GraphResponse)
    })
    worker.addEventListener('error', () => {
      // 워커를 못 쓰는 환경이면 같은 계산을 화면 쪽에서 해요
      worker?.terminate()
      worker = null
      if (lastReq) runInline(lastReq)
      if (last3D) run3DInline(last3D)
    })
  } catch {
    worker = null
  }
  return worker
}

function runInline(req: GraphRequest) {
  setTimeout(() => {
    try {
      onResult({ seq: req.seq, result: computeGraph(req) })
    } catch (err) {
      onResult({ seq: req.seq, error: err instanceof Error ? err.message : String(err) })
    }
  }, 0)
}

function run3DInline(req: Layout3DRequest) {
  setTimeout(() => on3D(layout3D(req)), 0)
}

/* ── 입력 · 자리 · 임베딩 ── */

let inputs: GraphMemoInput[] = []
/** null = 아직 한 번도 보내지 않았어요 (메모가 0개여도 첫 계산은 해요) */
let inputSig: string | null = null
const positions = new Map<string, [number, number]>()
const vectors = new Map<string, { updatedAt: string; v: Float32Array }>()
let seq = 0
let applied = 0
let lastReq: GraphRequest | null = null

function toInputs(memos: Memo[]): GraphMemoInput[] {
  return memos
    .filter((m) => !m.deletedAt && m.id != null)
    .map((m) => ({
      id: String(m.id),
      title: m.title || '',
      body: m.body || '',
      tags: m.tags ?? [],
      group: m.folderId != null ? String(m.folderId) : 'none',
      updatedAt: m.updatedAt || '',
    }))
}

const freshVector = (m: GraphMemoInput) => {
  const v = vectors.get(m.id)
  return v && v.updatedAt === m.updatedAt ? v.v : null
}

/** IndexedDB에 있는 임베딩 중 아직 안 읽은 것을 읽어요 (네트워크 없음) */
async function loadCached(list: GraphMemoInput[]) {
  const need = list.filter((m) => !freshVector(m))
  if (!need.length) return
  try {
    const rows = await db.embeddings.bulkGet(need.map((m) => Number(m.id)))
    rows.forEach((row, i) => {
      const m = need[i]
      if (row && row.updatedAt === m.updatedAt && row.vector.length > 0) {
        vectors.set(m.id, { updatedAt: m.updatedAt, v: Float32Array.from(row.vector) })
      }
    })
  } catch {
    // 캐시를 못 읽으면 의미 연결 없이 그려요
  }
}

function post() {
  const s = ++seq
  const vecs: Array<[string, Float32Array]> = []
  for (const m of inputs) {
    const v = freshVector(m)
    if (v) vecs.push([m.id, v])
  }
  const req: GraphRequest = { seq: s, memos: inputs, vectors: vecs, prev: [...positions].map(([id, [x, y]]) => [id, x, y]) }
  lastReq = req
  setState({ computing: true })
  setSemantic({ ready: vecs.length })
  const w = getWorker()
  if (w) w.postMessage(req)
  else runInline(req)
}

function onResult(res: GraphResponse) {
  if (res.seq < applied) return // 늦게 온 낡은 결과
  applied = res.seq
  const done = res.seq === seq
  if (res.error || !res.result) {
    setState({ computing: !done, error: res.error ?? '계산하지 못했어요' })
    return
  }
  positions.clear()
  for (const n of res.result.nodes) positions.set(n.id, [n.x, n.y])
  resultSeq = res.seq
  setState({ result: res.result, computing: !done, error: null })
  if (want3D) post3D()
}

/* ── 3D 자리 (3D 보기를 연 동안만) ── */

let want3D = false
let seq3 = 0
let resultSeq = 0
let last3D: Layout3DRequest | null = null
const positions3 = new Map<string, [number, number, number]>()
/** 3D 요청 번호 → 그 요청이 바탕으로 한 그래프 결과 번호 */
const graphSeqOf3 = new Map<number, number>()

function post3D() {
  const r = state.result
  if (!r) return
  const s = ++seq3
  graphSeqOf3.set(s, resultSeq)
  const req: Layout3DRequest = {
    type: 'layout3d',
    seq: s,
    nodes: r.nodes.map((n) => [n.id, n.degree, n.community, n.group]),
    links: r.links.map((l) => [l.source, l.target, l.kind, l.weight]),
    prev: [...positions3].map(([id, [x, y, z]]) => [id, x, y, z]),
  }
  last3D = req
  setState({ computing3d: true })
  const w = getWorker()
  if (w) w.postMessage(req)
  else run3DInline(req)
}

function on3D(res: Layout3DResponse) {
  if (res.seq !== seq3) return // 낡은 자리
  const graphSeq = graphSeqOf3.get(res.seq) ?? 0
  graphSeqOf3.clear()
  if (!res.ids.length && state.result?.nodes.length) {
    setState({ computing3d: false })
    return
  }
  positions3.clear()
  res.ids.forEach((id, i) => positions3.set(id, [res.pos[i * 3], res.pos[i * 3 + 1], res.pos[i * 3 + 2]]))
  setState({ layout3d: { graphSeq, pos: new Map(positions3), ms: res.ms }, computing3d: false })
}

/** 3D 보기가 열려 있는 동안 true — 그래프가 바뀔 때마다 3D 자리도 다시 계산해요 */
export function setWant3D(on: boolean) {
  if (on === want3D) return
  want3D = on
  if (on && state.result && state.layout3d?.graphSeq !== resultSeq) post3D()
}

let timer: ReturnType<typeof setTimeout> | null = null
function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    timer = null
    await loadCached(inputs)
    post()
  }, DEBOUNCE_MS)
}

function update(memos: Memo[]) {
  const next = toInputs(memos)
  const sig = next.map((m) => `${m.id}:${m.updatedAt}:${m.group}`).join('|')
  if (sig === inputSig) return
  inputSig = sig
  inputs = next
  schedule()
}

/* ── 빠진 임베딩 만들기 (AI 연결) ── */

let semanticWanted = false
let semanticRun = 0

async function computeMissing() {
  const run = ++semanticRun
  const capable = hasEmbeddingCapability()
  setSemantic({ capable })
  if (!capable) return
  await loadCached(inputs)
  const missing = inputs.filter((m) => !freshVector(m) && (m.title + m.body).trim())
  if (!missing.length) {
    setSemantic({ computing: false, progress: 100, skipped: 0 })
    return
  }
  setSemantic({ computing: true, progress: 0, skipped: 0 })
  let done = 0
  let skipped = 0
  let sinceRefresh = 0
  const queue = [...missing]
  const alive = () => semanticWanted && run === semanticRun
  const pump = async () => {
    while (queue.length && alive()) {
      const m = queue.shift()!
      let v: number[] | null = null
      try {
        v = await getOrComputeEmbedding(Number(m.id), `${m.title}\n${m.body}`.trim(), m.updatedAt)
      } catch {
        v = null
      }
      if (v && v.length) vectors.set(m.id, { updatedAt: m.updatedAt, v: Float32Array.from(v) })
      else skipped++
      done++
      sinceRefresh++
      if (alive()) setSemantic({ progress: Math.round((done / missing.length) * 100), skipped })
      // 오래 걸리면 중간중간 그래프에 반영해요
      if (sinceRefresh >= 60 && alive()) {
        sinceRefresh = 0
        post()
      }
    }
  }
  await Promise.all(Array.from({ length: EMBED_CONCURRENCY }, pump))
  if (run !== semanticRun) return
  setSemantic({ computing: false, progress: 100, skipped })
  post()
}

/** 크게 보기가 열려 있고 AI 연결이 켜져 있는 동안 true */
export function setSemanticWanted(on: boolean) {
  if (on === semanticWanted) return
  semanticWanted = on
  if (on) void computeMissing()
  else {
    semanticRun++
    if (state.semantic.computing) setSemantic({ computing: false })
  }
}

/** 노드를 끌어 옮긴 자리를 기억해요 (다음 계산이 이어받아요) */
export function rememberPositions(list: Array<{ id: string; x: number; y: number }>) {
  for (const n of list) positions.set(n.id, [n.x, n.y])
}

/* ── React ── */

let attached = 0
let unsubscribeMemos: (() => void) | null = null

function attach() {
  attached++
  if (attached > 1) return
  update(useMemoStore.getState().memos)
  unsubscribeMemos = useMemoStore.subscribe((s, prev) => {
    if (s.memos !== prev.memos) update(s.memos)
  })
}

function detach() {
  attached--
  if (attached > 0) return
  unsubscribeMemos?.()
  unsubscribeMemos = null
  if (timer) {
    // 보내기 전에 떠났으면 다음에 붙을 때 다시 보내요 (빠르게 다시 붙는 경우 포함)
    clearTimeout(timer)
    timer = null
    inputSig = null
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => state

/** 그래프 결과를 받아요. 쓰는 화면이 하나라도 있으면 메모 변화를 따라 다시 계산해요. */
export function useKnowledgeGraph(): GraphEngineState {
  useEffect(() => {
    attach()
    return detach
  }, [])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
