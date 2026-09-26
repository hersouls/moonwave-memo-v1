import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// The status may only claim 'synced' once the cloud has confirmed our writes — not merely
// because sign-in finished or the browser came back online.

const { ack, net } = vi.hoisted(() => {
  const ack = {
    resolve: (() => {}) as () => void,
    calls: 0,
    next: null as Promise<void> | null,
    /** Make the next waitForPendingWrites() hang until release() is called. */
    hold() {
      ack.next = new Promise<void>((r) => { ack.resolve = r })
    },
    release() { ack.resolve(); ack.next = null },
  }
  const net = {
    online: true,
    subs: new Set<(online: boolean) => void>(),
    set(online: boolean) { net.online = online; for (const fn of net.subs) fn(online) },
  }
  return { ack, net }
})

vi.mock('@/lib/firebase', () => ({ firestore: {} }))
vi.mock('firebase/firestore', () => ({
  waitForPendingWrites: () => {
    ack.calls++
    return ack.next ?? Promise.resolve()
  },
}))
vi.mock('@/services/connectivity', () => ({
  connectivity: {
    isOnline: () => net.online,
    subscribe: (fn: (online: boolean) => void) => { net.subs.add(fn); return () => net.subs.delete(fn) },
    check: async () => net.online,
  },
}))

import { db } from '@/services/database'
import * as status from '@/services/syncStatus'

const current = () => status.getSyncStatus().status

/** Signed in, merge done, both live listeners confirmed by the server. */
function runningSession() {
  status.syncSessionStarting('u1')
  status.noteListenerWaiting('memos')
  status.noteListenerWaiting('folders')
  status.noteListenerSnapshot('memos', false)
  status.noteListenerSnapshot('folders', false)
  status.syncSessionRunning()
}

async function settle(ms = 30) {
  await new Promise((r) => setTimeout(r, ms))
}

describe('sync status', () => {
  beforeEach(async () => {
    ack.release()
    ack.calls = 0
    net.set(true)
    await db.pendingSyncs.clear()
    status.syncSessionEnded()
    await vi.waitFor(() => expect(current()).toBe('idle'))
  })

  it('reaches "synced" only after the server confirms pending writes', async () => {
    ack.hold()
    runningSession()

    // Still waiting for the server: after a moment the status admits it is syncing.
    await vi.waitFor(() => expect(current()).toBe('syncing'))
    await settle(50)
    expect(current()).toBe('syncing')
    expect(status.getSyncStatus().lastSyncTime).toBeNull()

    ack.release()
    await vi.waitFor(() => expect(current()).toBe('synced'))
    expect(status.getSyncStatus().lastSyncTime).not.toBeNull()
  })

  it('does not report "synced" while a listener only has cached data', async () => {
    status.syncSessionStarting('u1')
    status.noteListenerSnapshot('memos', true)
    status.noteListenerSnapshot('folders', false)
    status.syncSessionRunning()
    await settle()
    expect(current()).toBe('syncing')

    status.noteListenerSnapshot('memos', false)
    await vi.waitFor(() => expect(current()).toBe('synced'))
  })

  it('does not report "synced" while the offline queue still holds writes', async () => {
    await db.pendingSyncs.add({ type: 'memo', action: 'upsert', syncId: 'x', createdAt: '2026-01-01T00:00:00.000Z' })
    runningSession()
    await settle()
    expect(current()).toBe('syncing')

    await db.pendingSyncs.clear()
    status.noteQueueChanged(false)
    await vi.waitFor(() => expect(current()).toBe('synced'))
  })

  it('a write in flight moves "synced" back to "syncing" until it is confirmed', async () => {
    runningSession()
    await vi.waitFor(() => expect(current()).toBe('synced'))

    const token = status.noteWriteStarted()
    await vi.waitFor(() => expect(current()).toBe('syncing'))
    ack.hold()
    status.noteWriteFinished(token)
    await settle(50)
    expect(current()).toBe('syncing')
    ack.release()
    await vi.waitFor(() => expect(current()).toBe('synced'))
  })

  it('reports "offline" while the network is confirmed down and re-confirms before "synced"', async () => {
    runningSession()
    await vi.waitFor(() => expect(current()).toBe('synced'))
    const confirmations = ack.calls

    net.set(false)
    await vi.waitFor(() => expect(current()).toBe('offline'))

    ack.hold()
    net.set(true)
    await vi.waitFor(() => expect(current()).toBe('syncing'))
    expect(ack.calls).toBeGreaterThan(confirmations)
    ack.release()
    await vi.waitFor(() => expect(current()).toBe('synced'))
  })

  it('reports errors from a failed listener, queue or session start', async () => {
    runningSession()
    status.noteListenerFailed('memos')
    await vi.waitFor(() => expect(current()).toBe('error'))
    status.noteListenerWaiting('memos')
    status.noteListenerSnapshot('memos', false)
    await vi.waitFor(() => expect(current()).toBe('synced'))

    status.noteQueueChanged(true)
    await vi.waitFor(() => expect(current()).toBe('error'))
    status.noteQueueChanged(false)
    await vi.waitFor(() => expect(current()).toBe('synced'))

    status.syncSessionFailed()
    await vi.waitFor(() => expect(current()).toBe('error'))
  })

  it('records the confirmed-sync watermark for the session\'s account', async () => {
    const hook = vi.fn()
    status.onSyncConfirmed(hook)
    runningSession()
    await vi.waitFor(() => expect(current()).toBe('synced'))
    expect(hook).toHaveBeenCalledWith('u1', expect.any(String))
    status.onSyncConfirmed(null)
  })

  it('is "idle" with no timestamp once signed out', async () => {
    runningSession()
    await vi.waitFor(() => expect(current()).toBe('synced'))
    status.syncSessionEnded()
    await vi.waitFor(() => expect(status.getSyncStatus()).toEqual({ status: 'idle', lastSyncTime: null }))
  })
})
