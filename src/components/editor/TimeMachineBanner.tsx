import type { ContextSnapshot, WeatherCondition } from '@/lib/types'
import { IcLineClose, IcLineCloud, IcMwRain, IcMwSnow, IcMwSun } from '@/mw/icons'

interface TimeMachineBannerProps {
  snapshot: ContextSnapshot
  onDismiss: () => void
}

function WeatherIcon({ weather }: { weather: WeatherCondition | null }) {
  const className = 'h-4 w-4'
  switch (weather) {
    case 'clear':
      return <IcMwSun className={className} />
    case 'rain':
      return <IcMwRain className={className} />
    case 'snow':
      return <IcMwSnow className={className} />
    case 'overcast':
      return <IcLineCloud className={className} />
    default:
      return null
  }
}

export function TimeMachineBanner({ snapshot, onDismiss }: TimeMachineBannerProps) {
  return (
    <div className="relative mx-4 mt-2 mb-1 rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-orange-50/60 px-4 py-2.5 dark:border-amber-800/40 dark:from-amber-950/20 dark:to-orange-950/15">
      <button type="button"
        onClick={onDismiss}
        className="mw-icon-button absolute top-1.5 right-1.5"
        aria-label="닫기"
      >
        <IcLineClose size={16} />
      </button>

      <div className="flex items-center gap-2 pr-6 text-sm text-amber-700 dark:text-amber-300">
        <span className="text-amber-500 dark:text-amber-400">
          <WeatherIcon weather={snapshot.weather} />
        </span>
        <span>
          작성 당시:
          {snapshot.weather && ` ${weatherLabel(snapshot.weather)}`}
          {snapshot.temperature !== null && ` ${snapshot.temperature}°C`}
          {` ${snapshot.hour}시`}
        </span>
      </div>
    </div>
  )
}

function weatherLabel(weather: WeatherCondition): string {
  switch (weather) {
    case 'clear': return '맑음'
    case 'rain': return '비'
    case 'snow': return '눈'
    case 'overcast': return '흐림'
  }
}
