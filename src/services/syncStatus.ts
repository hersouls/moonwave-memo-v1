import { waitForPendingWrites } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { SyncStatus } from '@/lib/types'
import { db } from './database'
import { connectivity } from './connectivity'

// ─── Sync status, derived from real signals ──────────────────────────────────
//
// 'synced' is only claimed once the cloud has actually confirmed our writes: the sync
// session is running, both live listeners have a server-confirmed (non-cache) snapshot,
// no push is in flight, the offline queue is empty, and Firestore's waitForPendingWrites()
// resolved (server acknowledged everything written so far — including writes persisted by
// an earlier session). Anything short of that is 'syncing'; a failed session / listener /
// queue replay is 'error'; a confirmed-offline network is 'offline'.

export interface SyncStatusSnapshot {
  status: SyncStatus
  /** When 'synced' was last confirmed in this session. */
  lastSyncTime: string | null
}

type Session = 'none' | 'starting' | 'running' | 'failed'
type ListenerState = 'waiting' | 'cache' | 'server' | 'error'

// Every save passes through a short syncing phase; don't flip the published status to
// 'syncing' unless confirmation actually takes a moment.
const SLOW_CONFIRM_MS = 400

let session: Session = 'none'
let sessionUid: string | null = null
// Bumped per session so a write that outlives its session can't skew the next one's count.
let sessionSeq = 0
const listeners = new Map<string, ListenerState>()
let inflightWrites = 0
let writeSeq = 0
let queueFailed = false

let current: SyncStatusSnapshot = { status: 'idle', lastSyncTime: null }
const subscribers = new Set<(s: SyncStatusSnapshot) => void>()
let confirmedHook: ((uid: string, confirmedFrom: string) => void) | null = null

let generation = 0
let scheduled = false
let ack: { seq: number; promise: Promise<void> } | null = null
let connectivityUnsub: (() => void) | null = null

function publish(status: SyncStatus, lastSyncTime: string | null = current.lastSyncTime) {
  if (status === current.status && lastSyncTime === current.lastSyncTime) return
  current = { status, lastSyncTime }
  // Snapshot: a subscriber may unsubscribe while we notify.
  for (const fn of Array.from(subscribers)) {
    try { fn(current) } catch (err) { console.error('sync status subscriber failed:', err) }
  }
}

function ensureConnectivity() {
  if (connectivityUnsub) return
  connectivityUnsub = connectivity.subscribe(() => schedule())
}

function schedule() {
  generation++ // invalidates any evaluation already waiting on an async signal
  if (scheduled) return
  scheduled = true
  setTimeout(() => {
    scheduled = false
    void evaluate()
  }, 0)
}

function serverAck(): Promise<void> {
  // Reuse the in-flight confirmation while no new write has started since it was issued
  // (it covers exactly the writes issued before the call).
  if (!ack || ack.seq !== writeSeq) {
    const promise = waitForPendingWrites(firestore)
    ack = { seq: writeSeq, promise }
    const mine = ack
    promise.then(() => { if (ack === mine) ack = null }, () => { if (ack === mine) ack = null })
  }
  return ack.promise
}

async function queueLength(): Promise<number> {
  try {
    return await db.pendingSyncs.count()
  } catch {
    return 0
  }
}

async function evaluate(): Promise<void> {
  const gen = generation
  const stale = () => gen !== generation

  if (session === 'none') return publish('idle', null)
  if (!connectivity.isOnline()) return publish('offline')
  if (session === 'failed' || queueFailed || [...listeners.values()].includes('error')) return publish('error')
  if (
    session === 'starting' ||
    inflightWrites > 0 ||
    [...listeners.values()].some((s) => s !== 'server')
  ) {
    return publish('syncing')
  }

  const confirmedFrom = new Date().toISOString()
  if ((await queueLength()) > 0) {
    if (!stale()) publish('syncing')
    return
  }
  if (stale()) return

  const slow = setTimeout(() => { if (!stale()) publish('syncing') }, SLOW_CONFIRM_MS)
  try {
    await serverAck()
  } catch {
    // Rejected on user change / shutdown — the session change schedules a fresh evaluation.
    return
  } finally {
    clearTimeout(slow)
  }
  if (stale()) return
  if ((await queueLength()) > 0) {
    if (!stale()) publish('syncing')
    return
  }
  if (stale()) return

  publish('synced', new Date().toISOString())
  if (sessionUid) confirmedHook?.(sessionUid, confirmedFrom)
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getSyncStatus(): SyncStatusSnapshot {
  return current
}

export function subscribeSyncStatus(fn: (s: SyncStatusSnapshot) => void): () => void {
  subscribers.add(fn)
  ensureConnectivity()
  return () => { subscribers.delete(fn) }
}

/** Called with (uid, time) whenever all local writes up to `time` are confirmed. */
export function onSyncConfirmed(hook: ((uid: string, confirmedFrom: string) => void) | null): void {
  confirmedHook = hook
}

export function syncSessionStarting(uid: string): void {
  ensureConnectivity()
  session = 'starting'
  sessionUid = uid
  sessionSeq++
  listeners.clear()
  inflightWrites = 0
  queueFailed = false
  schedule()
}

export function syncSessionRunning(): void {
  if (session === 'none') return
  session = 'running'
  schedule()
}

/** Sign-in sync could not start (it will be retried). */
export function syncSessionFailed(): void {
  session = 'failed'
  listeners.clear()
  schedule()
}

export function syncSessionEnded(): void {
  session = 'none'
  sessionUid = null
  sessionSeq++
  listeners.clear()
  inflightWrites = 0
  queueFailed = false
  schedule()
}

/** A live listener was (re)attached and has not delivered a snapshot yet. */
export function noteListenerWaiting(name: string): void {
  listeners.set(name, 'waiting')
  schedule()
}

export function noteListenerSnapshot(name: string, fromCache: boolean): void {
  const next: ListenerState = fromCache ? 'cache' : 'server'
  if (listeners.get(name) === next) return
  listeners.set(name, next)
  schedule()
}

export function noteListenerFailed(name: string): void {
  listeners.set(name, 'error')
  schedule()
}

export function noteListenerRemoved(name: string): void {
  if (listeners.delete(name)) schedule()
}

/** A cloud write started; pass the returned token to noteWriteFinished. */
export function noteWriteStarted(): number {
  inflightWrites++
  writeSeq++
  schedule()
  return sessionSeq
}

export function noteWriteFinished(token: number): void {
  if (token !== sessionSeq) return
  inflightWrites = Math.max(0, inflightWrites - 1)
  schedule()
}

/** The offline queue changed; `failed` reports whether the last replay left failures. */
export function noteQueueChanged(failed?: boolean): void {
  if (failed !== undefined) queueFailed = failed
  schedule()
}
