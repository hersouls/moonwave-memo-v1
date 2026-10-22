/* 설정 화면의 부품 (https://ux.moonwave.kr/patterns/settings).
   SettingsGroup: 묶음 하나. 카드(mw-surface)에 제목 · 한 줄 설명 · 설정 줄 · 아래 버튼(저장 같은 것)을 담아요.
   SettingRow: 설정 하나. 이름(과 한 줄 설명)은 왼쪽, 컨트롤은 오른쪽 끝이에요. 칩이나 입력 칸은 block으로 이름 아래에 놓아요.
   컨트롤에는 이름을 이어 줘요: control에 함수를 주면 이름의 id를 받아 aria-labelledby로 쓸 수 있어요. */
import { useId } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'
import { haptics } from './haptics'
import { THEME_LABEL, themeHint, useTheme } from './theme'
import type { ThemeMode } from './theme'

export type SettingsGroupProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** 묶음의 이름이에요. 명사로 짧게: `알림`, `서명`, `허용한 보낸 사람` */
  title: ReactNode
  /** 제목 옆의 작은 수나 상태예요: `4개`, `연결 전` */
  count?: ReactNode
  /** 제목 아래 한 줄 설명이에요. 두 줄을 넘기지 않아요. */
  lead?: ReactNode
  /** 묶음 맨 아래의 버튼 줄이에요. 입력 칸이 있는 묶음의 `저장`이 여기에 와요. */
  foot?: ReactNode
  children?: ReactNode
}

/** 설정의 묶음 하나예요. 화면의 h1 아래라서 제목은 h2예요(`as`로 h3를 고를 수 있어요). */
export function SettingsGroup({ title, count, lead, foot, className, children, as = 'h2', ...props }: SettingsGroupProps & { as?: 'h2' | 'h3' }) {
  const id = useId()
  const H = as
  return (
    <section className={cx('mw-surface', 'mw-settings-group', className)} aria-labelledby={id} {...props}>
      <div className="mw-settings-group__head">
        <H id={id} className="mw-settings-group__title">{title}{count != null && count !== '' && <small>{count}</small>}</H>
        {lead && <p className="mw-settings-group__lead">{lead}</p>}
      </div>
      {children}
      {foot && <div className="mw-settings-group__foot">{foot}</div>}
    </section>
  )
}

export type SettingRowProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 설정의 이름이에요. */
  label: ReactNode
  /** 이름 아래 한 줄 설명이에요. 지금 상태나 영향을 말해요. */
  description?: ReactNode
  /** 오른쪽 끝의 컨트롤이에요: Switch, 값(`mw-setting__value`), 꺾쇠 버튼, 작은 버튼 하나. 함수면 이름 · 설명의 id를 받아요. */
  control?: ReactNode | ((ids: { label: string; description: string }) => ReactNode)
  /** 컨트롤이 줄의 폭을 써야 할 때(칩 묶음, 입력 칸) 이름 아래에 놓아요. */
  block?: boolean
}

/** 설정 줄 하나예요. 줄 사이에는 1px 선이 그어져요. */
export function SettingRow({ label, description, control, block, className, ...props }: SettingRowProps) {
  const base = useId()
  const ids = { label: `${base}-label`, description: `${base}-desc` }
  return (
    <div className={cx('mw-setting', block && 'mw-setting--block', className)} {...props}>
      <div className="mw-setting__text">
        <span id={ids.label} className="mw-setting__label">{label}</span>
        {description && <span id={ids.description} className="mw-setting__desc">{description}</span>}
      </div>
      {control != null && <div className="mw-setting__control">{typeof control === 'function' ? control(ids) : control}</div>}
    </div>
  )
}

const MODES: ThemeMode[] = ['auto', 'light', 'dark']

/** 테마 줄이에요: 자동 · 밝게 · 어둡게. 고르면 바로 바뀌고, 설명 줄이 지금 무엇으로 보이는지 말해요. 화면 묶음에 넣어요. */
export function ThemeSetting() {
  const { mode, dark, set } = useTheme()
  return (
    <SettingRow block label="테마" description={themeHint(mode, dark)} control={({ label }) => (
      <div className="mw-chip-group" role="radiogroup" aria-labelledby={label}>
        {MODES.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} tabIndex={mode === m ? 0 : -1}
            className={`mw-select-chip ${mode === m ? 'mw-select-chip--on' : 'mw-select-chip--off'}`} onClick={() => { haptics.select(); set(m) }}>
            {THEME_LABEL[m]}
          </button>
        ))}
      </div>
    )} />
  )
}
