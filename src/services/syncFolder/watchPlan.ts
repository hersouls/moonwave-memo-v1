/**
 * Pure decision for the reverse-sync file watcher (§4.4 양방향).
 *
 * Given the current watch state and the root we now want to watch, decide what
 * startWatching should do. Extracted so the "폴더 변경 → 감시자 재지정" rule is
 * unit-testable without mocking the Electron bridge and the service's module state —
 * the same isolation pattern as mirrorQueue/pathOverlap.
 *
 * The bug this guards against: when the primary folder changes, the watcher must
 * follow it. If it stayed on the old folder, writes/REF_KEY would move on while a
 * stale folder is watched, which desyncs the mirror overlap guard (§4.6) and can trip
 * the §4.5 circuit breaker when a former primary is later added as a mirror.
 */
export type WatchAction = 'noop' | 'start' | 'restart'

export function planWatch(watching: boolean, watchedRoot: string | null, nextRoot: string): WatchAction {
  if (!watching) return 'start'
  if (watchedRoot === nextRoot) return 'noop'
  return 'restart'
}
