import { Sun, CloudRain, Snowflake, Cloud, X } from 'lucide-react'
import type { ContextSnapshot, WeatherCondition } from '@/lib/types'

interface TimeMachineBannerProps {
  snapshot: ContextSnapshot
  onDismiss: () => void
}

function WeatherIcon({ weather }: { weather: WeatherCondition | null }) {
  const className = 'h-4 w-4'
  switch (weather) {
    case 'clear':
      return <Sun className={className} />
    case 'rain':
      return <CloudRain className={className} />
    case 'snow':
      return <Snowflake className={className} />
    case 'overcast':
      return <Cloud className={className} />
    default:
      return null
  }
}

export function TimeMachineBanner({ snapshot, onDismiss }: TimeMachineBannerProps) {
  return (
    <div className="relative mx-4 mt-2 mb-1 rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-orange-50/60 px-4 py-2.5 dark:border-amber-800/40 dark:from-amber-950/20 dark:to-orange-950/15">
      <button
        onClick={onDismiss}
        className="absolute top-1.5 right-1.5 p-1 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        aria-label="닫기"
      >
        <X className="h-3.5 w-3.5" />
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
