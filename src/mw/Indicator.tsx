/* Moonwave UX — Indicator (DotIndicator · NumberIndicator · ProgressIndicator) */
import type { HTMLAttributes, Ref } from 'react'
import { cx } from './cx'
import { IcFillPlay, IcLineAdd, IcLinePause } from './icons'

export type DotIndicatorTheme = 'default' | 'inverse'

export type DotIndicatorProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 색 테마예요. 이미지나 어두운 배경 위에서는 `inverse`를 써요. */
  theme?: DotIndicatorTheme
  /** 전체 점 개수예요. 2~7개일 때 써요. */
  total: number
  /** 지금 보고 있는 점의 순서예요. 0부터 세요. */
  current: number
  /** 인디케이터 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** 캐러셀에서 지금 위치를 점으로 보여 줘요. 보여 주기만 하는 그림이라 점은 누르는 것이 아니에요(6px). */
export function DotIndicator({ theme = 'default', total, current, className, ref, ...props }: DotIndicatorProps) {
  return (
    <div
      ref={ref}
      className={cx('mw-dot-indicator', `mw-dot-indicator--${theme}`, className)}
      role="img"
      aria-label={`${total}장 가운데 ${current + 1}번째`}
      {...props}
    >
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={cx('mw-dot-indicator__dot', index === current ? 'mw-dot-indicator__dot--active' : 'mw-dot-indicator__dot--inactive')}
        />
      ))}
    </div>
  )
}

export type NumberIndicatorType = 'basic' | 'playback' | 'selector'

export type NumberIndicatorProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 모양이에요. playback은 재생·일시정지 버튼, selector는 더하기 버튼이 붙어요. */
  type?: NumberIndicatorType
  /** 지금 순서예요. 1부터 세요. */
  current: number
  /** 전체 개수예요. */
  total: number
  /** 자동 넘김이 재생 중인지 알려 줘요. `type="playback"`에서 써요. */
  isPlaying?: boolean
  /** 재생·일시정지 버튼을 눌렀을 때 불러요. `type="playback"`에서 써요. */
  onPlaybackClick?: () => void
  /** 더하기 버튼을 눌렀을 때 불러요. `type="selector"`에서 써요. */
  onSelectorClick?: () => void
  /** 인디케이터 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** 지금 순서와 전체 개수를 `1/6`처럼 숫자로 보여 줘요. */
export function NumberIndicator({
  type = 'basic',
  current,
  total,
  isPlaying,
  onPlaybackClick,
  onSelectorClick,
  className,
  ref,
  ...props
}: NumberIndicatorProps) {
  return (
    <div
      ref={ref}
      className={cx('mw-number-indicator', `mw-number-indicator--${type}`, className)}
      role="status"
      aria-label={`${current} / ${total}`}
      {...props}
    >
      <span className="mw-number-indicator__text">{current}</span>
      <span className="mw-number-indicator__total-wrapper">
        <span className="mw-number-indicator__separator">/</span>
        <span className="mw-number-indicator__total">{total}</span>
      </span>
      {type === 'selector' && (
        <button type="button" className="mw-number-indicator__button" onClick={onSelectorClick} aria-label="선택">
          <IcLineAdd size={12} />
        </button>
      )}
      {type === 'playback' && (
        <button
          type="button"
          className="mw-number-indicator__button"
          onClick={onPlaybackClick}
          aria-label={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? <IcLinePause size={12} /> : <IcFillPlay size={12} />}
        </button>
      )}
    </div>
  )
}

export type ProgressIndicatorProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 전체 단계 수예요. */
  total: number
  /** 지금까지 채운 단계 수예요. 0보다 작거나 total보다 크면 범위 안으로 맞춰요. */
  current: number
  /** 인디케이터 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** 여러 단계로 나뉜 흐름에서 어디까지 왔는지 막대 칸으로 보여 줘요. */
export function ProgressIndicator({ total, current, className, ref, ...props }: ProgressIndicatorProps) {
  const clampedCurrent = Math.min(Math.max(current, 0), total)
  return (
    <div
      ref={ref}
      className={cx('mw-progress-indicator', className)}
      role="progressbar"
      aria-valuenow={clampedCurrent}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${clampedCurrent} / ${total}`}
      {...props}
    >
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={cx(
            'mw-progress-indicator__item',
            index < clampedCurrent ? 'mw-progress-indicator__item--fill' : 'mw-progress-indicator__item--empty',
          )}
        />
      ))}
    </div>
  )
}
