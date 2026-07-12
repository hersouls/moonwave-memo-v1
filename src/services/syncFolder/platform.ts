/**
 * Platform abstraction for the sync folder — picks the right FileSyncTarget backend
 * (Electron native fs vs web File System Access) and handles the platform-specific
 * "choose folder / restore / re-grant permission" flows behind one interface.
 *
 * This is the seam that lets Phase 2 (Electron) and eventually Phase 3 (Capacitor)
 * reuse everything the Phase 1 web build already has. The service layer above talks
 * only to these functions and never branches on platform itself.
 */
import { Capacitor } from '@capacitor/core'
import type { FileSyncTarget } from './FileSyncTarget'
import { FsaFileSyncTarget } from './fsaTarget'
import { IpcFileSyncTarget } from './ipcTarget'
import { CapacitorFileSyncTarget, DEFAULT_CAPACITOR_SUBDIR } from './capacitorTarget'

/** Serializable reference to a chosen folder, persisted in IndexedDB (device-local). */
export type PersistedRef =
  | { kind: 'fsa'; handle: FileSystemDirectoryHandle }
  | { kind: 'ipc'; path: string; name: string }
  | { kind: 'capacitor'; subdir: string }

function bridge(): NonNullable<Window['electronBridge']> | undefined {
  return typeof window !== 'undefined' ? window.electronBridge : undefined
}

export function isElectron(): boolean {
  return !!bridge()
}

/** True on a Capacitor native shell (Android/iOS APK). */
export function isCapacitor(): boolean {
  return Capacitor.isNativePlatform()
}

/** True when this device can write to a local folder (Electron / Capacitor / Chromium FSA). */
export function isSyncFolderSupported(): boolean {
  if (bridge()) return true
  if (Capacitor.isNativePlatform()) return true
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export interface PickResult {
  target: FileSyncTarget
  ref: PersistedRef
  displayName: string
}

/** Show the platform folder picker (user gesture). Returns null on cancel / denied permission. */
export async function pickFolder(): Promise<PickResult | null> {
  const b = bridge()
  if (b) {
    const picked = await b.pickDirectory()
    if (!picked) return null
    return {
      target: new IpcFileSyncTarget(picked.path, b),
      ref: { kind: 'ipc', path: picked.path, name: picked.name },
      displayName: picked.name,
    }
  }
  if (Capacitor.isNativePlatform()) {
    // Mobile: a fixed public Documents subfolder (no SAF dialog in M1) that a background
    // sync agent mirrors to NAS. §Phase 3 권장 경로. Arbitrary SAF pick is a later spike.
    return {
      target: new CapacitorFileSyncTarget(DEFAULT_CAPACITOR_SUBDIR),
      ref: { kind: 'capacitor', subdir: DEFAULT_CAPACITOR_SUBDIR },
      displayName: `Documents/${DEFAULT_CAPACITOR_SUBDIR}`,
    }
  }
  if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') return null
  const handle = await window.showDirectoryPicker({ id: 'moonwave-memo-sync', mode: 'readwrite' })
  const perm = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted'
  if (perm !== 'granted') return null
  return { target: new FsaFileSyncTarget(handle), ref: { kind: 'fsa', handle }, displayName: handle.name }
}

export type RestoreResult =
  | { status: 'ok'; target: FileSyncTarget; displayName: string }
  | { status: 'needs-permission'; displayName: string }
  | { status: 'missing' }

/** Rebuild a target from a persisted ref on app start (no prompt). */
export async function restoreTarget(ref: unknown): Promise<RestoreResult> {
  const normalized = normalizeRef(ref)
  if (!normalized) return { status: 'missing' }

  if (normalized.kind === 'ipc') {
    const b = bridge()
    if (!b) return { status: 'missing' } // configured on desktop, now opened on web
    const ok = await b.dirExists(normalized.path)
    return ok
      ? { status: 'ok', target: new IpcFileSyncTarget(normalized.path, b), displayName: normalized.name }
      : { status: 'missing' }
  }

  if (normalized.kind === 'capacitor') {
    if (!Capacitor.isNativePlatform()) return { status: 'missing' } // configured on mobile, now web
    return {
      status: 'ok',
      target: new CapacitorFileSyncTarget(normalized.subdir),
      displayName: `Documents/${normalized.subdir}`,
    }
  }

  const handle = normalized.handle
  const perm = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt'
  return perm === 'granted'
    ? { status: 'ok', target: new FsaFileSyncTarget(handle), displayName: handle.name }
    : { status: 'needs-permission', displayName: handle.name }
}

/** Re-grant access from a user gesture (reconnect button). Electron never needs this. */
export async function requestPermissionFor(ref: unknown): Promise<{ ok: boolean; target?: FileSyncTarget; displayName?: string }> {
  const normalized = normalizeRef(ref)
  if (!normalized) return { ok: false }

  if (normalized.kind === 'ipc') {
    const b = bridge()
    if (!b) return { ok: false }
    return { ok: true, target: new IpcFileSyncTarget(normalized.path, b), displayName: normalized.name }
  }

  if (normalized.kind === 'capacitor') {
    if (!Capacitor.isNativePlatform()) return { ok: false }
    return { ok: true, target: new CapacitorFileSyncTarget(normalized.subdir), displayName: `Documents/${normalized.subdir}` }
  }

  const handle = normalized.handle
  const perm = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted'
  if (perm !== 'granted') return { ok: false }
  return { ok: true, target: new FsaFileSyncTarget(handle), displayName: handle.name }
}

/** The absolute folder path to watch (Electron only). Web/FSA can't watch → null. */
export function watchRootFromRef(ref: unknown): string | null {
  const n = normalizeRef(ref)
  return n && n.kind === 'ipc' ? n.path : null
}

/** Pick a mirror folder — Electron only (mirrors are copy-only NAS/local targets, §4.6). */
export async function pickMirror(): Promise<{ path: string; name: string } | null> {
  const b = bridge()
  if (!b) return null
  return b.pickDirectory()
}

/** Build a write target for a mirror folder path (Electron only). */
export function buildIpcTarget(path: string): FileSyncTarget | null {
  const b = bridge()
  return b ? new IpcFileSyncTarget(path, b) : null
}

/**
 * Normalize a persisted value into a PersistedRef.
 * Handles the Phase 1 legacy shape (a raw FileSystemDirectoryHandle stored directly,
 * identifiable by its `kind: 'directory'`).
 */
function normalizeRef(ref: unknown): PersistedRef | null {
  if (!ref || typeof ref !== 'object') return null
  const r = ref as Record<string, unknown>
  if (r.kind === 'ipc' && typeof r.path === 'string') {
    return { kind: 'ipc', path: r.path, name: String(r.name ?? r.path) }
  }
  if (r.kind === 'capacitor' && typeof r.subdir === 'string') {
    return { kind: 'capacitor', subdir: r.subdir }
  }
  if (r.kind === 'fsa' && r.handle) {
    return { kind: 'fsa', handle: r.handle as FileSystemDirectoryHandle }
  }
  if (r.kind === 'directory') {
    // Legacy Phase 1: the raw FileSystemDirectoryHandle was stored directly.
    return { kind: 'fsa', handle: ref as FileSystemDirectoryHandle }
  }
  return null
}
