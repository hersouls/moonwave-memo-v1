import { useMemo } from 'react'
import { useThemeOrchestrator } from '@/stores/themeOrchestratorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { IcMwCloud, IcMwRain, IcMwSnow, IcMwSun } from '@/mw/icons'

export function WeatherWidget() {
  const environmentThemeEnabled = useSettingsStore((s) => s.settings.livingWorkspace.environmentThemeEnabled)
  const environment = useThemeOrchestrator((s) => s.signals.environment)

  const { weather, temperature } = environment

  const widgetContent = useMemo(() => {
    if (!weather) return null

    let Icon = IcMwCloud
    let conditionName = '확인 전'

    switch (weather) {
      case 'clear':
        Icon = IcMwSun
        conditionName = '맑음'
        break
      case 'rain':
        Icon = IcMwRain
        conditionName = '비'
        break
      case 'snow':
        Icon = IcMwSnow
        conditionName = '눈'
        break
      case 'overcast':
        Icon = IcMwCloud
        conditionName = '흐림'
        break
    }

    const tempString = temperature !== null ? `${temperature.toFixed(1)}°C` : '--'

    return (
      <span className="mw-state" title={`지금 날씨: ${conditionName}, 기온 ${tempString}`}>
        <Icon size={16} />
        <span className="mw-num">{temperature !== null ? `${Math.round(temperature)}°` : '확인 전'}</span>
        <span className="mw-sr-only">{conditionName}</span>
      </span>
    )
  }, [weather, temperature])

  if (!environmentThemeEnabled || !weather) {
    return null
  }

  return widgetContent
}
