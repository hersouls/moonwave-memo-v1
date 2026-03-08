import { useMemo } from 'react'
import { Cloud, CloudRain, Snowflake, Sun } from 'lucide-react'
import { useThemeOrchestrator } from '@/stores/themeOrchestratorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Tooltip } from '@/components/ui/Tooltip'

export function WeatherWidget() {
  const environmentThemeEnabled = useSettingsStore((s) => s.settings.livingWorkspace.environmentThemeEnabled)
  const environment = useThemeOrchestrator((s) => s.signals.environment)

  const { weather, temperature } = environment

  const widgetContent = useMemo(() => {
    if (!weather) return null

    let Icon = Cloud
    let conditionName = '알 수 없음'

    switch (weather) {
      case 'clear':
        Icon = Sun
        conditionName = '맑음'
        break
      case 'rain':
        Icon = CloudRain
        conditionName = '비'
        break
      case 'snow':
        Icon = Snowflake
        conditionName = '눈'
        break
      case 'overcast':
        Icon = Cloud
        conditionName = '흐림'
        break
    }

    const tempString = temperature !== null ? `${temperature.toFixed(1)}°C` : '--'

    return (
      <Tooltip 
        content={`현재 날씨: ${conditionName}, 온도: ${tempString}`} 
        placement="bottom"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-default select-none">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wide">
            {temperature !== null ? `${Math.round(temperature)}°` : '--'}
          </span>
        </div>
      </Tooltip>
    )
  }, [weather, temperature])

  if (!environmentThemeEnabled || !weather) {
    return null
  }

  return widgetContent
}
