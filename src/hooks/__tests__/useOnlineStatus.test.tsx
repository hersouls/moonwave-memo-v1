// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

// End-to-end through the real browser wiring: the offline banner (useOnlineStatus) only
// turns on when navigator.onLine is false AND a HEAD /manifest.json probe fails.

let navigatorOnline = true
const fetchMock = vi.fn<typeof fetch>()

beforeAll(() => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => navigatorOnline })
  vi.stubGlobal('fetch', fetchMock)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('useOnlineStatus', () => {
  it('ignores an offline event when the server still answers the probe', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    navigatorOnline = false
    act(() => { window.dispatchEvent(new Event('offline')) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/manifest.json')
    expect(init).toMatchObject({ method: 'HEAD', cache: 'no-store' })
    await act(async () => { await Promise.resolve() })
    expect(result.current).toBe(true)
  })

  it('shows offline once the probe fails, and clears on the online event', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useOnlineStatus())

    navigatorOnline = false
    act(() => { window.dispatchEvent(new Event('offline')) })
    await waitFor(() => expect(result.current).toBe(false))

    navigatorOnline = true
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(result.current).toBe(true)
  })
})
