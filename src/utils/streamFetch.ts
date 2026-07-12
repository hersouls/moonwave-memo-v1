import { apiUrl } from '../lib/apiBase'

export async function streamFetch(
  url: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
): Promise<{ usingServerKey: boolean }> {
  const res = await fetch(apiUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Stream error: ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No readable stream')

  const decoder = new TextDecoder()
  let usingServerKey = false
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.usingServerKey !== undefined) usingServerKey = parsed.usingServerKey
        if (parsed.text) onChunk(parsed.text)
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
      }
    }
  }

  return { usingServerKey }
}
