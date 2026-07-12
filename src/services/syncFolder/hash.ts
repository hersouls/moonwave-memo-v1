/**
 * Deterministic, dependency-free string hash for change detection.
 *
 * Used by the sync-folder layer to decide whether a memo's on-disk file needs
 * rewriting (§4.5: conflict resolution compares front-matter updatedAt + contentHash,
 * never raw filesystem mtime). A cheap non-cryptographic hash is sufficient — we only
 * need "did the content change" equality, not collision resistance.
 *
 * FNV-1a (32-bit) returned as an 8-char hex string.
 */
export function contentHash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    // h *= 16777619 with 32-bit overflow
    h = Math.imul(h, 0x01000193)
  }
  // Coerce to unsigned 32-bit and hex-encode
  return (h >>> 0).toString(16).padStart(8, '0')
}
