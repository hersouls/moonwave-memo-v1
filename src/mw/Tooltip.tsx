/* Moonwave UX — Tooltip */
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { IcLineClose } from './icons'

export type TooltipType = 'toggle' | 'auto'

export type TooltipPosition =
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'left-top'
  | 'left-center'
  | 'left-bottom'
  | 'right-top'
  | 'right-center'
  | 'right-bottom'

export type TooltipProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 종류예요. toggle은 닫기 버튼이 있는 밝은 툴팁, auto는 스스로 닫히는 어두운 툴팁이에요. */
  type?: TooltipType
  /** 꼬리(Caret)가 붙는 변과 정렬이에요. `top-center`면 꼬리가 위쪽 가운데에 붙어요. */
  position?: TooltipPosition
  /** 툴팁에 보여 줄 글이에요. 줄바꿈 문자는 그대로 줄을 바꿔요. */
  children: ReactNode
  /** 닫기 버튼을 눌렀을 때 불러요. `type="toggle"`에서 이 값을 줘야 닫기 버튼이 보여요. */
  onClose?: () => void
  /** 보일지 정해요. */
  visible?: boolean
  /** 툴팁 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

type CaretSide = 'top' | 'bottom' | 'left' | 'right'

/** 꼬리 모양이에요. fill은 배경, stroke는 테두리 선을 그려요. */
const CARETS: Record<CaretSide, { width: number; height: number; fill: string; stroke: string }> = {
  top: {
    width: 14,
    height: 8,
    fill: 'M6.21094 0.368652C6.61129 -0.122884 7.38871 -0.122884 7.78906 0.368652L14 8L0 8L6.21094 0.368652Z',
    stroke: 'M6.21094 0.368652C6.61129 -0.122884 7.38871 -0.122884 7.78906 0.368652L14 8L12.5 8L7 1.29911L1.5 8L0 8L6.21094 0.368652Z',
  },
  bottom: {
    width: 14,
    height: 8,
    fill: 'M7.78906 7.63135C7.38871 8.12288 6.61129 8.12288 6.21094 7.63135L0 0L14 0L7.78906 7.63135Z',
    stroke: 'M7.78906 7.63135C7.38871 8.12288 6.61129 8.12288 6.21094 7.63135L0 0L1.5 0L7 6.70089L12.5 0L14 0L7.78906 7.63135Z',
  },
  left: {
    width: 8,
    height: 14,
    fill: 'M0.368651 7.78906C-0.122884 7.38871 -0.122883 6.61129 0.368651 6.21094L8 0L8 14L0.368651 7.78906Z',
    stroke: 'M0.368651 7.78906C-0.122884 7.38871 -0.122883 6.61129 0.368651 6.21094L8 0L8 1.5L1.29912 7L8 12.5L8 14L0.368651 7.78906Z',
  },
  right: {
    width: 8,
    height: 14,
    fill: 'M7.63135 6.21094C8.12288 6.61129 8.12288 7.38871 7.63135 7.78906L0 14L0 0L7.63135 6.21094Z',
    stroke: 'M7.63135 6.21094C8.12288 6.61129 8.12288 7.38871 7.63135 7.78906L0 14L0 12.5L6.70089 7L0 1.5L0 0L7.63135 6.21094Z',
  },
}

/** 특정 요소 옆에 붙어 도움말이나 부가 정보를 보여 줘요. 위치는 쓰는 쪽에서 잡아요. */
export function Tooltip({
  type = 'auto',
  position = 'top-center',
  className,
  children,
  onClose,
  visible = true,
  ref,
  ...props
}: TooltipProps) {
  if (!visible) return null

  const caret = CARETS[position.split('-')[0] as CaretSide]

  return (
    <div ref={ref} className={cx('mw-tooltip', `mw-tooltip--${type}`, `mw-tooltip--${position}`, className)} {...props}>
      <div className="mw-tooltip__caret-container">
        <div className="mw-tooltip__caret">
          <svg
            className="mw-tooltip__caret-bg"
            width={caret.width}
            height={caret.height}
            viewBox={`0 0 ${caret.width} ${caret.height}`}
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path className="mw-tooltip__caret-fill" d={caret.fill} />
            <path className="mw-tooltip__caret-stroke" d={caret.stroke} />
          </svg>
        </div>
      </div>
      <div className="mw-tooltip__container">
        <div className="mw-tooltip__text">{children}</div>
        {type === 'toggle' && onClose && (
          <button type="button" className="mw-tooltip__close-button" onClick={onClose} aria-label="닫기">
            <IcLineClose size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
