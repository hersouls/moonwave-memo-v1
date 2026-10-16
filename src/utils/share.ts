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

// 메모 한 개의 전체 글. 제목과 본문 사이는 빈 줄 하나예요.
export function memoToText(title: string | undefined, body: string | undefined): string {
  const parts: string[] = []
  if (title && title.trim()) parts.push(title.trim())
  if (body && body.length) parts.push(body)
  return parts.join('\n\n')
}

// 서식 없이 붙여 넣을 글. 줄바꿈과 코드 안의 글은 그대로 두고 마크다운 기호와 이미지 주소만 걷어내요.
export function memoToPlainText(title: string | undefined, body: string | undefined): string {
  const plain = (body ?? '')
    .replace(/!\[[^\]]*\]\(memo-image:\d+\)/g, '[이미지]')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^```.*$/gm, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/gm, '$1')
    .replace(/^(\s*)[-*+]\s+/gm, '$1· ')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, '')
  return memoToText(title, plain).replace(/\n{3,}/g, '\n\n').trim()
}
