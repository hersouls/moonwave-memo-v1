// Copy plain text to the clipboard, with a legacy fallback for non-secure
// contexts / older browsers where the async Clipboard API is unavailable.
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy fallback below
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export async function shareAsImage(blob: Blob, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const file = new File([blob], `${title}.png`, { type: 'image/png' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch {
      return 'failed'
    }
  }

  // Fallback: copy image to clipboard
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
    return 'copied'
  } catch {
    // Final fallback: download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.png`
    a.click()
    URL.revokeObjectURL(url)
    return 'copied'
  }
}

export async function shareMemo(options: {
  title: string
  body: string
  url?: string
}): Promise<'shared' | 'copied' | 'failed'> {
  const { title, body, url } = options

  const shareText = body ? body.slice(0, 500) : ''

  if (navigator.share) {
    try {
      await navigator.share({
        title: title || 'Memo',
        text: shareText,
        url: url || window.location.href,
      })
      return 'shared'
    } catch {
      // User cancelled
      return 'failed'
    }
  }

  // Fallback: copy to clipboard
  try {
    const clipboardText = [
      title,
      '',
      shareText,
      url ? `\n${url}` : '',
    ].filter(Boolean).join('\n')

    await navigator.clipboard.writeText(clipboardText)
    return 'copied'
  } catch {
    return 'failed'
  }
}
