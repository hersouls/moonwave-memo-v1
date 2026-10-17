/* Moonwave UX — Pending (진행 칸)
   규격: https://ux.moonwave.kr/patterns/long-wait · https://ux.moonwave.kr/components/pending */
import type { ReactNode } from 'react'
import { cx } from './cx'
import { Button } from './Button'
import type { PendingController } from './usePending'

export type PendingProps = {
  pending: PendingController
  /** 무엇을 하는지: `초안을 쓰고 있어요`. 진행형 해요체예요. */
  title: string
  /** 지금 단계: `자료를 읽는 중`. 모르면 비워 둬요. */
  step?: string
  /** 보통 걸리는 시간: `보통 10~25초`. 실제로 잰 값만 써요. */
  typical?: string
  /** 몇 퍼센트인지 알 때만 0~100을 줘요. 모르면 주지 않아요(흐르는 막대). */
  value?: number
  /** 모델을 처음 깨우는 중이면 한 줄로 알려요: `모델을 깨우는 중이라 처음에는 15초쯤 더 걸려요`. */
  warm?: string
  /** 서버가 화면과 따로 일을 계속하고 끝나면 알림을 줄 때만 true예요. 그때만 `다른 화면으로 가도 계속해요`라고 말해요. */
  background?: boolean
  /** 안 보내면 `취소`를 두지 않아요. 5초 넘게 걸리는 일에는 꼭 둬요. */
  cancelable?: boolean
  /** 실패했을 때 다시 하는 일이에요. */
  retry?: () => void
  /** 칸 아래에 더하는 것이에요. */
  children?: ReactNode
  className?: string
}

/** 오래 걸리는 일의 진행 칸이에요. 1초가 지나야 나오고(결과가 나올 자리에 놓아요), 끝나면 사라져요. */
export function Pending({ pending, title, step, typical, value, warm, background = false, cancelable = true, retry, children, className }: PendingProps) {
  const s = pending.state
  if (s.phase === 'error') {
    return (
      <div className={cx('mw-pending', 'mw-pending--error', className)} role="alert">
        <p className="mw-pending__title">{title.replace(/(고 있어요|는 중이에요)$/, '')}에 실패했어요</p>
        {s.error ? <p className="mw-pending__note">{s.error}</p> : null}
        {retry ? <div className="mw-pending__actions"><Button variant="secondary" size="small" onClick={retry}>다시 해 볼게요</Button></div> : null}
      </div>
    )
  }
  if (!s.showBlock) return null
  const known = typeof value === 'number'
  return (
    <div className={cx('mw-pending', className)} role="status" aria-live="polite">
      <div className="mw-pending__head">
        <span className="mw-pending__ring" aria-hidden="true" />
        <p className="mw-pending__title">{title}</p>
      </div>
      {step ? <p className="mw-pending__step">{step}</p> : null}
      <div
        className={cx('mw-pending__bar', !known && 'mw-pending__bar--indeterminate')}
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={known ? Math.round(value) : undefined}
        aria-valuetext={known ? `${Math.round(value)}%` : `${s.seconds}초째`}
        style={known ? ({ '--pending-value': `${Math.max(0, Math.min(100, value))}%` } as React.CSSProperties) : undefined}
      ><i /></div>
      {s.showTime ? <p className="mw-pending__time">{s.seconds}초째{typical ? ` · ${typical}` : ''}</p> : null}
      {warm && s.seconds < 40 && s.showTime ? <p className="mw-pending__note">{warm}</p> : null}
      {s.phase === 'long' ? <p className="mw-pending__note">{background ? '오래 걸려요. 다른 화면으로 가도 계속하고, 끝나면 알려 드릴게요.' : '오래 걸려요. 이 화면에서 기다려 주세요.'}</p> : null}
      {s.phase === 'giveup' ? <p className="mw-pending__note">답이 오지 않아요. 취소하고 다시 해 볼 수 있어요.</p> : null}
      {children}
      {cancelable ? <div className="mw-pending__actions"><Button variant="tertiary" size="small" onClick={pending.cancel}>취소</Button></div> : null}
    </div>
  )
}
