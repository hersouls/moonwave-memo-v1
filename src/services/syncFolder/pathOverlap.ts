/**
 * Folder-path overlap guard for the sync folder (§4.6 미러 폴더).
 *
 * The primary folder is the single watched source of truth; mirrors are copy-only
 * fan-out targets. If a mirror equals the primary, every save is written twice and
 * watcher events double (risking the §4.5 circuit breaker). If one nests inside the
 * other, mirror copies can land inside the watched tree and get re-imported as new
 * memos. Both pickers therefore reject overlapping choices using these helpers.
 *
 * Paths come from the Electron directory picker (absolute Windows/POSIX/UNC paths).
 * Comparison is case-insensitive — correct on Windows/macOS where the desktop app
 * runs; on a case-sensitive filesystem this can only over-reject, never miss.
 *
 * Known limitation: this is a pure lexical comparison, so two different names for the
 * same physical directory are NOT recognized as overlapping — e.g. a mapped drive
 * (Z:\ ↔ \\NAS\share), an NTFS junction, or a `subst` alias. Catching those would
 * require resolving real paths in the main process (fs.realpath), which is itself
 * incomplete for mapped network drives on Windows. The guard is a best-effort UX
 * safety net against the common mistakes (same folder picked twice, nesting), not a
 * hard invariant; the mirror write path stays correct even if an alias slips through.
 */

/** Normalize an absolute OS path for comparison: forward slashes, no trailing slash, case-folded. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/** True when the two absolute paths are the same folder or one contains the other. */
export function pathsOverlap(a: string, b: string): boolean {
  const na = normalizePath(a)
  const nb = normalizePath(b)
  return na === nb || na.startsWith(`${nb}/`) || nb.startsWith(`${na}/`)
}
