import { describe, it, expect, afterEach, vi } from 'vitest'
import { createConnectivityMonitor, type ConnectivityEnv } from '@/services/connectivity'

// The offline banner must not trust navigator.onLine alone (Chrome has been stuck
// reporting offline with a working network): offline requires a failed reachability probe.

function fakeEnv(opts: { navigatorOnline: boolean; probe: () => Promise<boolean> }) {
  const env = {
    navigatorOnline: opts.navigatorOnline,
    probe: vi.fn(opts.probe),
    handlers: null as null | { online(): void; offline(): void; visible(): void },
  }
  const connectivityEnv: ConnectivityEnv = {
    navigatorOnline: () => env.navigatorOnline,
    probe: () => env.probe(),
    listen(handlers) {
      env.handlers = handlers
      return () => { env.handlers = null }
    },
  }
  return { env, connectivityEnv }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('connectivity monitor', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays online when the browser says offline but the server is reachable', async () => {
    const { env, connectivityEnv } = fakeEnv({ navigatorOnline: false, probe: async () => true })
    const monitor = createConnectivityMonitor(connectivityEnv)
    const seen: boolean[] = []
    monitor.subscribe((online) => seen.push(online))
    await flush()

    expect(env.probe).toHaveBeenCalled()
    expect(monitor.isOnline()).toBe(true)
    expect(seen).toEqual([])
  })

  it('goes offline only after the reachability probe fails', async () => {
    let resolveProbe!: (ok: boolean) => void
    const { env, connectivityEnv } = fakeEnv({
      navigatorOnline: true,
      probe: () => new Promise<boolean>((r) => { resolveProbe = r }),
    })
    const monitor = createConnectivityMonitor(connectivityEnv)
    monitor.subscribe(() => {})

    env.navigatorOnline = false
    env.handlers!.offline()
    // The 'offline' event alone doesn't flip the state…
    expect(monitor.isOnline()).toBe(true)
    // …a failed probe does.
    resolveProbe(false)
    await flush()
    expect(monitor.isOnline()).toBe(false)
  })

  it('keeps re-checking while the browser reports offline, and recovers without an online event', async () => {
    vi.useFakeTimers()
    let reachable = false
    const { env, connectivityEnv } = fakeEnv({ navigatorOnline: false, probe: async () => reachable })
    const monitor = createConnectivityMonitor(connectivityEnv, { recheckIntervalMs: 15_000 })
    monitor.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    expect(monitor.isOnline()).toBe(false)

    reachable = true // network back, but navigator.onLine stays stuck at false
    await vi.advanceTimersByTimeAsync(15_000)
    expect(monitor.isOnline()).toBe(true)

    // Still verifying while the flag is stuck, so a real outage is caught later too.
    const probes = env.probe.mock.calls.length
    reachable = false
    await vi.advanceTimersByTimeAsync(15_000)
    expect(env.probe.mock.calls.length).toBeGreaterThan(probes)
    expect(monitor.isOnline()).toBe(false)
  })

  it('trusts an online event immediately and stops probing', async () => {
    vi.useFakeTimers()
    const { env, connectivityEnv } = fakeEnv({ navigatorOnline: false, probe: async () => false })
    const monitor = createConnectivityMonitor(connectivityEnv, { recheckIntervalMs: 15_000 })
    monitor.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    expect(monitor.isOnline()).toBe(false)

    env.navigatorOnline = true
    env.handlers!.online()
    expect(monitor.isOnline()).toBe(true)
    const probes = env.probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(env.probe.mock.calls.length).toBe(probes)
  })
})
