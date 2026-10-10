import { apiUrl } from '@/lib/apiBase'
import type { WeatherCondition } from '@/lib/types'

/**
 * 메모의 맥락 기록(날씨 · 낮과 밤 · 대략의 위치)에 쓰는 값을 서비스 자신의 API에서 받아요.
 * 화면이 바깥 주소(IP 위치 조회, 날씨 API)를 직접 부르지 않아요: /api/context 하나만 불러요.
 */
export interface ContextAnswer {
  position: { latitude: number; longitude: number } | null
  weather: { condition: WeatherCondition; temperature: number } | null
}

let inflight: Promise<ContextAnswer | null> | null = null

export function fetchContext(): Promise<ContextAnswer | null> {
  inflight ??= (async () => {
    try {
      const res = await fetch(apiUrl('/api/context'), { signal: AbortSignal.timeout(6000) })
      if (!res.ok) return null
      return (await res.json()) as ContextAnswer
    } catch {
      return null
    } finally {
      // 같은 순간의 두 요청만 하나로 묶어요. 다음 번(한 시간 뒤)에는 새로 물어요.
      setTimeout(() => { inflight = null }, 0)
    }
  })()
  return inflight
}
