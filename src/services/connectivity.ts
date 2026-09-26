import { apiUrl } from '@/lib/apiBase'

// ─── Connectivity (offline banner / sync status) ─────────────────────────────
//
// `navigator.onLine` is only a hint: Chrome has been seen stuck reporting offline while the
// network was fine, which pinned the offline banner on. So "offline" is only believed after
// a lightweight reachability probe also fails, and while the browser keeps claiming offline
// we keep re-probing, so a stuck flag can neither hide a real outage for long nor keep a
// false banner up. 'online' events are trusted immediately (the optimistic direction).

const PROBE_TIMEOUT_MS = 4000
const RECHECK_INTERVAL_MS = 15_000

export interface ConnectivityEnv {
  /** Current `navigator.onLine` hint. */
  navigatorOnline(): boolean
  /** Resolves true when the network path to our origin works. */
  probe(): Promise<boolean>
  /** Wire browser signals; returns an unsubscribe. */
  listen(handlers: { online(): void; offline(): void; visible(): void }): () => void
}

export interface ConnectivityMonitor {
  isOnline(): boolean
  subscribe(listener: (online: boolean) => void): () => void
  /** Re-evaluate now (probes if the browser claims offline). */
  check(): Promise<boolean>
}

export function createConnectivityMonitor(
  env: ConnectivityEnv,
  opts: { recheckIntervalMs?: number } = {},
): ConnectivityMonitor {
  const recheckMs = opts.recheckIntervalMs ?? RECHECK_INTERVAL_MS
  const listeners = new Set<(online: boolean) => void>()
  // Optimistic until the browser says offline AND a probe confirms it.
  let online = true
  let started = false
  let stopListening: (() => void) | null = null
  let recheckTimer: ReturnType<typeof setTimeout> | null = null
  let inflight: Promise<boolean> | null = null

  function set(next: boolean) {
    if (next === online) return
    online = next
    // Snapshot: a listener may unsubscribe while we notify.
    for (const l of Array.from(listeners)) {
      try { l(online) } catch (err) { console.error('connectivity listener failed:', err) }
    }
  }

  function stopRecheck() {
    if (recheckTimer) { clearTimeout(recheckTimer); recheckTimer = null }
  }

  function scheduleRecheck() {
    stopRecheck()
    if (!started) return
    recheckTimer = setTimeout(() => {
      recheckTimer = null
      void check()
    }, recheckMs)
  }

  async function check(): Promise<boolean> {
    if (env.navigatorOnline()) {
      stopRecheck()
      set(true)
      return online
    }
    if (!inflight) inflight = env.probe().catch(() => false).finally(() => { inflight = null })
    const reachable = await inflight
    if (env.navigatorOnline()) {
      // An 'online' event landed while we were probing.
      stopRecheck()
      set(true)
      return online
    }
    set(reachable)
    // The browser still claims offline: keep verifying, whichever way this probe went.
    scheduleRecheck()
    return online
  }

  function start() {
    if (started) return
    started = true
    stopListening = env.listen({
      online: () => { stopRecheck(); set(true) },
      offline: () => { void check() },
      visible: () => { if (!env.navigatorOnline()) void check() },
    })
    if (!env.navigatorOnline()) void check()
  }

  function stop() {
    started = false
    stopRecheck()
    stopListening?.()
    stopListening = null
  }

  return {
    isOnline: () => online,
    subscribe(listener) {
      listeners.add(listener)
      start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stop()
      }
    },
    check,
  }
}

/** HEAD our own manifest, bypassing every cache (the service worker ignores non-GET). */
export async function probeReachability(timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  if (typeof fetch !== 'function') return true
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), timeoutMs)
  try {
    // Packaged Capacitor runs on a local origin, so probe the deployed host there.
    const url = apiUrl('/manifest.json')
    const crossOrigin = /^https?:\/\//.test(url)
    await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      ...(crossOrigin ? { mode: 'no-cors' as RequestMode } : {}),
      ...(controller ? { signal: controller.signal } : {}),
    })
    return true // any HTTP response at all proves the network path works
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function browserEnv(): ConnectivityEnv {
  return {
    navigatorOnline: () => (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine),
    probe: () => probeReachability(),
    listen(handlers) {
      if (typeof window === 'undefined') return () => {}
      const onVisibility = () => { if (document.visibilityState === 'visible') handlers.visible() }
      window.addEventListener('online', handlers.online)
      window.addEventListener('offline', handlers.offline)
      document.addEventListener('visibilitychange', onVisibility)
      return () => {
        window.removeEventListener('online', handlers.online)
        window.removeEventListener('offline', handlers.offline)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    },
  }
}

export const connectivity: ConnectivityMonitor = createConnectivityMonitor(browserEnv())
