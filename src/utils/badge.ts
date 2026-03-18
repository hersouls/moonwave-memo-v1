export async function setAppBadge(count: number): Promise<void> {
  if (!('setAppBadge' in navigator)) return
  try {
    if (count > 0) {
      await (navigator as unknown as { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count)
    } else {
      await (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge()
    }
  } catch { /* not supported */ }
}

export async function clearAppBadge(): Promise<void> {
  if (!('clearAppBadge' in navigator)) return
  try {
    await (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge()
  } catch { /* not supported */ }
}
