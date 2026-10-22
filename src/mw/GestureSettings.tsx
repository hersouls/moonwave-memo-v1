/* Moonwave UX — GestureSettings (설정 화면의 ‘손짓’: 손짓 단계와 세부 설정)
   서비스의 설정 화면에 그대로 한 번 둬요. 고르면 바로 반영되고, 새로 고치지 않아도 돼요.
   규격: https://ux.moonwave.kr/patterns/touch-gestures#settings */
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Button } from './Button'
import { cx } from './cx'
import {
  canVibrate, GESTURES, LEVEL_GROUP_LABEL, LEVELS, MOTION_STEPS, motionStepOf, PRESS_LABEL, PRESS_MS, SENSITIVITY_LABEL, STEP_OF_LEVEL,
  SWIPE_ACTION_LABEL, SWIPE_ACTIONS, SWIPE_DISTANCE, systemReducedMotion,
} from './gesture-settings'
import type { GestureId, GestureLevel, PressTime, SwipeAction, SwipeSensitivity } from './gesture-settings'
import { useGestureSettings, useGestureSync, useReducedMotion } from './gestures'
import { haptics } from './haptics'
import { IcLineChevronDown } from './icons'
import { Switch } from './Switch'

/** 고르는 칩 묶음(라디오)이에요. 화살표 키로 옮기면 바로 골라져요(ViewSwitch와 같아요). */
function Choice<T extends string | number>({ label, value, options, onChange, extra }: { label: string; value: T | null; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; extra?: string }) {
  const group = useRef<HTMLDivElement>(null)
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = Math.max(0, options.findIndex((o) => o.value === value))
    const next = options[(i + step + options.length) % options.length]
    onChange(next.value)
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[options.indexOf(next)]?.focus()
  }
  const current = options.some((o) => o.value === value) ? value : null
  return (
    <div ref={group} className="mw-chip-group mw-gesture-settings__choice" role="radiogroup" aria-label={label} onKeyDown={move}>
      {options.map((o, i) => {
        const on = o.value === current
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} tabIndex={on || (current === null && i === 0) ? 0 : -1}
            className={cx('mw-select-chip', on ? 'mw-select-chip--on' : 'mw-select-chip--off')} onClick={() => { haptics.select(); onChange(o.value) }}>
            {o.label}
          </button>
        )
      })}
      {extra && <span className="mw-select-chip mw-select-chip--on mw-gesture-settings__custom" aria-current="true">{extra}</span>}
    </div>
  )
}

/** 손짓 하나의 짧은 움직임 그림이에요. 단계를 고를 때 한 번 움직이고 멈춰요(되풀이하지 않아요). 누르면 다시 움직여요. 꾸밈이라 읽지 않아요. */
function Demo({ id, play }: { id: GestureId; play: number }) {
  const still = useReducedMotion()
  const [run, setRun] = useState(0)
  return (
    <span className={cx('mw-gesture-demo', `mw-gesture-demo--${id}`)} data-play={still ? undefined : ''} aria-hidden="true" onClick={() => setRun((n) => n + 1)}>
      {/* 열쇠가 바뀌면 그림을 새로 그려서 움직임이 처음부터 다시 돌아요 */}
      <span key={play + run} style={{ display: 'contents' }}>
        <i className="mw-gesture-demo__card" /><i className="mw-gesture-demo__finger" /><i className="mw-gesture-demo__finger mw-gesture-demo__finger--two" />
      </span>
    </span>
  )
}

/** 세부 설정 한 묶음이에요. 키트의 Accordion(`details`)이라 넓은 화면에서도 접혀 있고, 키보드로도 열려요. */
function Fold({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <details className="mw-accordion__item">
      <summary className="mw-accordion__header">
        <span className="mw-accordion__text"><span className="mw-accordion__label">{label}</span><span className="mw-accordion__title">{title}</span></span>
        <span className="mw-accordion__icon" aria-hidden="true"><IcLineChevronDown size={24} /></span>
      </summary>
      <div className="mw-accordion__body mw-gesture-settings__body">{children}</div>
    </details>
  )
}

export type GestureSettingsProps = {
  /** 머리글의 단계예요. 설정 화면의 h1 아래에 두면 2예요. */
  headingLevel?: 2 | 3
  className?: string
}

/**
 * 설정 화면의 ‘손짓’ 묶음이에요. 맨 위에 손짓 단계(끔 · 기본 · 표준 · 파워), 그 아래에 고른 단계에서 켜지는 손짓과 짧은 움직임,
 * 그 아래에 세부 설정이 아코디언으로 접혀 있어요.
 * 손짓을 하나씩 바꾸면 단계가 ‘커스텀’으로 바뀌어요. 진동이 없는 기기에서는 진동 설정이 꺼진 채 그 까닭을 말해요.
 */
export function GestureSettings({ headingLevel = 2, className }: GestureSettingsProps) {
  const { settings, set, setLevel, setGesture, reset, resetHints } = useGestureSettings()
  const sync = useGestureSync()
  const still = useReducedMotion()
  const [play, setPlay] = useState(0)
  const [told, setTold] = useState('')
  const vibrate = canVibrate()
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const title = useId()
  // 기기가 움직임 줄이기를 켜 두었는데 설정은 아직 ‘기기를 따름’이면, 늘 줄이기를 한 번 권해요
  const [suggest, setSuggest] = useState(false)
  useEffect(() => { setSuggest(systemReducedMotion() && settings.motion === 'auto' && settings.at === 0) }, [settings.motion, settings.at])

  const level = settings.level
  const shownLevel: GestureLevel = level === 'custom' ? 3 : level
  const onNow = GESTURES.filter((g) => settings.on[g.id])
  const say = (text: string) => { setTold(''); requestAnimationFrame(() => setTold(text)) }
  const pickLevel = (l: GestureLevel) => { setLevel(l); setPlay((n) => n + 1); say(`${LEVELS[l].label} 단계로 바꿨어요. 움직임은 ${MOTION_STEPS.find((m) => m.step === STEP_OF_LEVEL[l])!.label}예요.`) }
  const actionOptions = SWIPE_ACTIONS.map((a) => ({ value: a, label: SWIPE_ACTION_LABEL[a] }))
  const about = level === 'custom' ? '손짓을 하나씩 골랐어요. 단계를 고르면 그 단계의 손짓으로 돌아가요.' : LEVELS[level].about
  // 손짓 단계가 움직임의 결도 정해요(키트 1.10). 줄이기를 켜면 단계와 상관없이 결과만 보여요
  const step = MOTION_STEPS.find((m) => m.step === motionStepOf(settings))!
  const motionLine = settings.motion === 'reduce' || still ? '움직임을 줄이고 있어서 움직이지 않고 결과만 보여요.' : step.about

  return (
    <section className={cx('mw-gesture-settings', className)} aria-labelledby={title}>
      <H id={title} className="mw-gesture-settings__title">손짓</H>
      <p className="mw-gesture-settings__lead">밀기 · 당기기 · 길게 누르기로 하는 빠른 길이에요. 어느 단계에서도 모든 일은 버튼과 메뉴로 할 수 있어요.</p>

      <Choice<GestureLevel> label={LEVEL_GROUP_LABEL} value={level === 'custom' ? null : level} onChange={pickLevel}
        options={LEVELS.map((l) => ({ value: l.level, label: l.label }))} extra={level === 'custom' ? '커스텀' : undefined} />
      <p className="mw-gesture-settings__about">{about}</p>
      <p className="mw-gesture-settings__motion"><b>움직임 · {settings.motion === 'reduce' || still ? '줄임' : step.label}</b>{motionLine}</p>

      {suggest && (
        <div className="mw-gesture-hint" role="note">
          <span>이 기기는 움직임 줄이기를 켜 두었어요. 손짓의 움직임도 늘 줄일까요?</span>
          <button type="button" className="mw-gesture-hint__ok" onClick={() => { set({ motion: 'reduce' }); setSuggest(false) }}>줄이기</button>
          <button type="button" className="mw-gesture-hint__ok" onClick={() => setSuggest(false)}>그대로 두기</button>
        </div>
      )}

      {onNow.length > 0 ? (
        <ul className="mw-gesture-settings__now" aria-label="지금 켜진 손짓">
          {onNow.map((g) => (
            <li key={g.id} className="mw-gesture-settings__item">
              <Demo id={g.id} play={play} />
              <span><b>{g.label}</b><small>{g.how} 손짓 없이: {g.instead}</small></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mw-gesture-settings__none">켜진 손짓이 없어요. 모든 일은 버튼과 메뉴로 해요.</p>
      )}

      <div className="mw-accordion mw-gesture-settings__more">
        <Fold label="하나씩" title="손짓 켜고 끄기">
          <ul className="mw-gesture-settings__list">
            {GESTURES.map((g) => (
              <li key={g.id} className="mw-gesture-settings__row">
                <span id={`${title}-${g.id}`}><b>{g.label}</b><small>{LEVELS[g.level].label}부터 · {g.how}</small></span>
                <Switch checked={settings.on[g.id]} onChange={(on) => { setGesture(g.id, on); haptics.select() }} aria-labelledby={`${title}-${g.id}`} />
              </li>
            ))}
          </ul>
        </Fold>
        <Fold label="민감도" title="밀기 거리와 길게 누르기 시간">
          <div className="mw-gesture-settings__field">
            <span className="mw-gesture-settings__label">밀기 민감도</span>
            <Choice<SwipeSensitivity> label="밀기 민감도" value={settings.sensitivity} onChange={(v) => set({ sensitivity: v })}
              options={(['low', 'normal', 'high'] as const).map((v) => ({ value: v, label: `${SENSITIVITY_LABEL[v]} ${SWIPE_DISTANCE[v]}px` }))} />
            <small>이만큼 밀거나 빠르게 튕기면 걸려요. 못 미치면 제자리로 돌아가요.</small>
          </div>
          <div className="mw-gesture-settings__field">
            <span className="mw-gesture-settings__label">길게 누르기</span>
            <Choice<PressTime> label="길게 누르기 시간" value={settings.press} onChange={(v) => set({ press: v })}
              options={(['short', 'normal', 'long'] as const).map((v) => ({ value: v, label: `${PRESS_LABEL[v]} ${(PRESS_MS[v] / 1000).toLocaleString('ko-KR')}초` }))} />
          </div>
        </Fold>
        <Fold label="밀기" title="왼쪽 · 오른쪽으로 밀 때 할 일">
          <div className="mw-gesture-settings__field">
            <span className="mw-gesture-settings__label">왼쪽으로 밀기</span>
            <Choice<SwipeAction> label="왼쪽으로 밀 때 먼저 놓일 동작" value={settings.left} options={actionOptions}
              onChange={(v) => set(v === settings.right ? { left: v, right: settings.left } : { left: v })} />
          </div>
          <div className="mw-gesture-settings__field">
            <span className="mw-gesture-settings__label">오른쪽으로 밀기</span>
            <Choice<SwipeAction> label="오른쪽으로 밀 때 먼저 놓일 동작" value={settings.right} options={actionOptions}
              onChange={(v) => set(v === settings.left ? { right: v, left: settings.right } : { right: v })} />
            <small>항목에 없는 동작이면 그 항목에 있는 다른 동작이 놓여요. 지우기는 어느 쪽에서나 빨간색이에요.</small>
          </div>
        </Fold>
        <Fold label="그 밖에" title="진동 · 지우기 전 확인 · 움직임 · 초기화">
          <ul className="mw-gesture-settings__list">
            <li className="mw-gesture-settings__row">
              <span id={`${title}-haptics`}><b>진동</b><small>{vibrate ? '손짓이 걸리거나 끝났을 때 짧게 떨어요.' : '이 기기는 진동을 지원하지 않아요. Android 폰에서만 떨어요.'}</small></span>
              <Switch checked={vibrate && settings.haptics} disabled={!vibrate} onChange={(on) => set({ haptics: on })} aria-labelledby={`${title}-haptics`} />
            </li>
            <li className="mw-gesture-settings__row">
              <span id={`${title}-confirm`}><b>끝까지 밀어 지우기 전에 묻기</b><small>묻지 않아도 지운 뒤 5초 동안 되돌릴 수 있어요.</small></span>
              <Switch checked={settings.confirmDelete} onChange={(on) => set({ confirmDelete: on })} aria-labelledby={`${title}-confirm`} />
            </li>
            <li className="mw-gesture-settings__row">
              <span id={`${title}-motion`}><b>움직임 줄이기</b><small>{settings.motion === 'reduce' ? '손짓 단계와 상관없이 움직임 없이 결과만 보여요.' : still ? '기기 설정에 따라 지금 줄이고 있어요.' : '기기의 움직임 줄이기 설정을 따라요.'}</small></span>
              <Switch checked={settings.motion === 'reduce'} onChange={(on) => set({ motion: on ? 'reduce' : 'auto' })} aria-labelledby={`${title}-motion`} />
            </li>
          </ul>
          <div className="mw-gesture-settings__actions">
            <Button variant="secondary" size="medium" onClick={() => { resetHints(); say('손짓 안내를 다시 보여 줘요.') }}>안내 다시 보기</Button>
            <Button variant="tertiary" size="medium" onClick={() => { reset(); setPlay((n) => n + 1); say('기본값(표준)으로 되돌렸어요.') }}>기본값으로 되돌리기</Button>
          </div>
        </Fold>
      </div>

      <p className="mw-gesture-settings__sync">
        {sync === 'local' ? '이 기기에 저장돼요.' : sync === 'synced' ? '로그인한 기기끼리 맞춰져요.' : sync === 'syncing' ? '다른 기기와 맞추는 중이에요.' : '서버에 닿지 못해 이 기기에만 저장했어요. 다시 연결되면 맞춰요.'}
        {` 지금: ${level === 'custom' ? '커스텀' : LEVELS[shownLevel].label}`}
      </p>
      <p className="mw-sr-only" aria-live="polite">{told}</p>
    </section>
  )
}
