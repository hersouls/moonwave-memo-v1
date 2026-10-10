import { FOLDER_COLORS, FOLDER_COLOR_NAMES } from '@/utils/constants'

interface ColorSwatchPickerProps {
  value: string
  onChange: (color: string) => void
  colors?: readonly string[]
  className?: string
}

/**
 * 폴더의 색을 골라요. 키트의 Select 칩이에요: 색 점과 이름을 함께 보여서 색만으로 알리지 않아요.
 * 고를 수 있는 색은 일곱 가지(키트의 범주 색)예요.
 */
export function ColorSwatchPicker({ value, onChange, colors = FOLDER_COLORS, className }: ColorSwatchPickerProps) {
  return (
    <div role="group" aria-label="색 고르기" className={['flex flex-wrap gap-2', className].filter(Boolean).join(' ')}>
      {colors.map((c) => {
        const isSelected = value === c
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={isSelected}
            className={`mw-select-chip mw-select-chip--${isSelected ? 'on' : 'off'}`}
          >
            <span className="memo-nav__dot" style={{ backgroundColor: c }} aria-hidden="true" />
            {FOLDER_COLOR_NAMES[c] ?? '고른 색'}
          </button>
        )
      })}
    </div>
  )
}
