import { doc, setDoc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Settings } from '@/lib/types'
import {
  useSettingsStore,
  applyTheme,
  applyColorPalette,
  applyFontFamily,
  applyFontSize,
} from '@/stores/settingsStore'

let unsubSettings: Unsubscribe | null = null
let unsubStoreListener: (() => void) | null = null
let lastPushTime = 0
const PUSH_COOLDOWN = 3000
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Fields safe to sync (exclude API keys and device-specific data)
type SyncableSettings = Pick<
  Settings,
  'theme' | 'colorPalette' | 'fontFamily' | 'fontSize' | 'memoSettings' | 'highContrastMode' | 'userProfile'
>

function pickSyncableFields(settings: Settings): SyncableSettings {
  return {
    theme: settings.theme,
    colorPalette: settings.colorPalette,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    memoSettings: settings.memoSettings,
    highContrastMode: settings.highContrastMode,
    userProfile: settings.userProfile,
  }
}

function applyVisualSettings(settings: Partial<Settings>) {
  if (settings.theme) applyTheme(settings.theme)
  if (settings.colorPalette) applyColorPalette(settings.colorPalette)
  if (settings.fontFamily) applyFontFamily(settings.fontFamily)
  if (settings.fontSize) applyFontSize(settings.fontSize)
  if (settings.highContrastMode !== undefined) {
    document.documentElement.toggleAttribute('data-high-contrast', settings.highContrastMode)
  }
}

function settingsDocRef(uid: string) {
  return doc(firestore, `users/${uid}/settings`, 'preferences')
}

async function pushSettings(uid: string, settings: Settings) {
  try {
    lastPushTime = Date.now()
    const syncable = pickSyncableFields(settings)
    await setDoc(settingsDocRef(uid), syncable, { merge: true })
  } catch (err) {
    console.error('Push settings failed:', err)
  }
}

function isRecentlyPushed(): boolean {
  return Date.now() - lastPushTime < PUSH_COOLDOWN
}

async function pullAndMergeSettings(uid: string) {
  try {
    const snapshot = await getDoc(settingsDocRef(uid))
    if (!snapshot.exists()) {
      // No remote settings yet — push current local settings
      const current = useSettingsStore.getState().settings
      await pushSettings(uid, current)
      return
    }

    const remote = snapshot.data() as Partial<SyncableSettings>
    const local = useSettingsStore.getState().settings

    // Merge: remote wins for syncable fields
    const merged: Partial<Settings> = {}
    if (remote.theme && remote.theme !== local.theme) merged.theme = remote.theme
    if (remote.colorPalette && remote.colorPalette !== local.colorPalette) merged.colorPalette = remote.colorPalette
    if (remote.fontFamily && remote.fontFamily !== local.fontFamily) merged.fontFamily = remote.fontFamily
    if (remote.fontSize && remote.fontSize !== local.fontSize) merged.fontSize = remote.fontSize
    if (remote.highContrastMode !== undefined && remote.highContrastMode !== local.highContrastMode) {
      merged.highContrastMode = remote.highContrastMode
    }
    if (remote.memoSettings) {
      merged.memoSettings = { ...local.memoSettings, ...remote.memoSettings }
    }
    if (remote.userProfile) {
      merged.userProfile = { ...local.userProfile, ...remote.userProfile }
    }

    if (Object.keys(merged).length > 0) {
      lastPushTime = Date.now()
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, ...merged },
      }))
      applyVisualSettings({ ...local, ...merged })
    }
  } catch (err) {
    console.error('Pull settings failed:', err)
  }
}

function startSettingsListener(uid: string) {
  if (unsubSettings) {
    unsubSettings()
    unsubSettings = null
  }

  unsubSettings = onSnapshot(settingsDocRef(uid), (snapshot) => {
    if (isRecentlyPushed() || !snapshot.exists()) return

    const remote = snapshot.data() as Partial<SyncableSettings>
    const local = useSettingsStore.getState().settings

    const merged: Partial<Settings> = {}
    if (remote.theme && remote.theme !== local.theme) merged.theme = remote.theme
    if (remote.colorPalette && remote.colorPalette !== local.colorPalette) merged.colorPalette = remote.colorPalette
    if (remote.fontFamily && remote.fontFamily !== local.fontFamily) merged.fontFamily = remote.fontFamily
    if (remote.fontSize && remote.fontSize !== local.fontSize) merged.fontSize = remote.fontSize
    if (remote.highContrastMode !== undefined && remote.highContrastMode !== local.highContrastMode) {
      merged.highContrastMode = remote.highContrastMode
    }
    if (remote.memoSettings) {
      merged.memoSettings = { ...local.memoSettings, ...remote.memoSettings }
    }
    if (remote.userProfile) {
      merged.userProfile = { ...local.userProfile, ...remote.userProfile }
    }

    if (Object.keys(merged).length > 0) {
      lastPushTime = Date.now()
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, ...merged },
      }))
      applyVisualSettings({ ...local, ...merged })
    }
  })
}

function startStoreSubscription(uid: string) {
  if (unsubStoreListener) {
    unsubStoreListener()
    unsubStoreListener = null
  }

  let previousSettings = JSON.stringify(pickSyncableFields(useSettingsStore.getState().settings))

  unsubStoreListener = useSettingsStore.subscribe((state) => {
    if (isRecentlyPushed()) return

    const current = JSON.stringify(pickSyncableFields(state.settings))
    if (current === previousSettings) return
    previousSettings = current

    // Debounce push to avoid thrashing
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      pushSettings(uid, state.settings)
    }, 300)
  })
}

export async function initSettingsSync(userId: string) {
  await pullAndMergeSettings(userId)
  startSettingsListener(userId)
  startStoreSubscription(userId)
}

export function stopSettingsSync() {
  if (unsubSettings) { unsubSettings(); unsubSettings = null }
  if (unsubStoreListener) { unsubStoreListener(); unsubStoreListener = null }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  lastPushTime = 0
}
