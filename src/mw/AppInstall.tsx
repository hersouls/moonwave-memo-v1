/* Android 앱 받기 (https://ux.moonwave.kr/patterns/app-install).
   설정의 `앱` 탭(이 기기 · 앱 설치)에 놓는 묶음 둘이에요. 서비스마다 다르게 만들지 않아요.
   AppInstall: 최신 판 · 만든 날 · 설치한 판 · 업데이트가 필요한지 · 받기 버튼.
   AppHistory: 지난 판의 이력이에요(최신이 위). 폰에서는 세 줄만 보이고 나머지는 접혀요.
   기록은 서비스가 내는 두 파일이에요: `version.json`(최신 판 하나)과 `history.json`(판 목록, 최신이 앞). 이름 규칙은 build-frontend.md › Android 앱 파일. */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Expand, ExpandButton, useExpand } from './Expand'
import { haptics } from './haptics'
import { IcLineDownload, IcLineRefresh } from './icons'
import { SettingRow, SettingsGroup } from './Settings'
import { TagStatus } from './Tag'

export type AppRelease = {
  versionName: string
  versionCode: number
  /** 그 파일을 빌드한 날이에요: `2026-10-21` */
  builtAt: string
  sizeBytes: number
  /** 받을 주소예요: `/app/memo_v1.0.2_261012.apk`. 이름이 빌드마다 바뀌어서 고정해 적지 않고 기록에서 읽어요. */
  file: string
  /** 이 판에서 바뀐 것 한 줄이에요(이력에 보여요). */
  notes?: string
}

export type AppInstallState = 'update' | 'latest' | 'newer' | 'unknown'

/** 설치한 판(`versionCode`)과 최신 판을 견줘요. 설치한 판을 모르면(브라우저) `unknown`이에요. */
export function appInstallState(release: Pick<AppRelease, 'versionCode'>, installed: number | null | undefined): AppInstallState {
  if (installed == null) return 'unknown'
  if (installed < release.versionCode) return 'update'
  return installed > release.versionCode ? 'newer' : 'latest'
}

const p2 = (n: number) => String(n).padStart(2, '0')
/** `2026-10-21` → `2026.10.21(수)` */
const day = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return '날짜를 몰라요'
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${m[1]}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}(${'일월화수목금토'[d.getDay()]})`
}
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`)

/** 서비스가 내는 기록을 읽어요. `version.json`이 없으면 release는 null이고, 읽다 실패하면 error가 참이에요. */
export function useAppRelease(base = '/app') {
  const [state, setState] = useState<{ release: AppRelease | null; history: AppRelease[]; loading: boolean; error: boolean }>({ release: null, history: [], loading: true, error: false })
  const [again, setAgain] = useState(0)
  useEffect(() => {
    const ac = new AbortController()
    const read = async <T,>(name: string): Promise<T | null> => {
      const res = await fetch(`${base}/${name}`, { cache: 'no-store', signal: ac.signal })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(String(res.status))
      return JSON.parse((await res.text()).replace(/^﻿/, '')) as T
    }
    setState((s) => ({ ...s, loading: true, error: false }))
    Promise.all([read<AppRelease>('version.json'), read<AppRelease[]>('history.json').catch(() => null)])
      .then(([release, history]) => {
        if (ac.signal.aborted) return
        const list = Array.isArray(history) ? history : []
        setState({ release, history: release && !list.some((h) => h.versionCode === release.versionCode) ? [release, ...list] : list, loading: false, error: false })
      })
      .catch(() => { if (!ac.signal.aborted) setState((s) => ({ ...s, loading: false, error: true })) })
    return () => ac.abort()
  }, [base, again])
  return { ...state, reload: () => setAgain((n) => n + 1) }
}

export type AppInstallProps = {
  /** 앱 이름이에요: `Drive`. */
  name: string
  release: AppRelease | null
  /** 이 기기에 설치된 판이에요. 앱 안에서는 브리지가 알려 주고, 브라우저에서는 null이에요. */
  installed?: { versionName?: string; versionCode: number } | null
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  /** 묶음 아래에 더 놓을 것(권한 줄 같은 것)이에요. */
  children?: ReactNode
}

const STATE_TAG: Record<Exclude<AppInstallState, 'unknown'>, { type: 'warning' | 'success' | 'info'; label: string }> = {
  update: { type: 'warning', label: '업데이트 필요' },
  latest: { type: 'success', label: '최신' },
  newer: { type: 'info', label: '새 판보다 앞서요' },
}

/** 설정 › 앱의 첫 묶음이에요: 지금 받을 수 있는 판과, 이 기기의 앱이 그것과 같은지를 말해요. */
export function AppInstall({ name, release, installed, loading, error, onRetry, children }: AppInstallProps) {
  const lead = '내려받은 파일을 열어 설치해 주세요. Tailscale을 켜 둔 채로 받아요.'
  if (loading) return <SettingsGroup title="Android 앱" lead={lead} aria-busy="true"><SettingRow label="앱 파일을 확인하고 있어요" /></SettingsGroup>
  if (error) return (
    <SettingsGroup title="Android 앱" lead={lead}>
      <SettingRow label="앱 파일 정보를 불러오지 못했어요" description="연결을 확인한 뒤 다시 시도해 주세요." control={onRetry && <button type="button" className="mw-button mw-button--tertiary-subtle mw-button--small" onClick={onRetry}>다시 시도</button>} />
    </SettingsGroup>
  )
  if (!release) return <SettingsGroup title="Android 앱" lead={lead}><SettingRow label="아직 앱 파일이 없어요" description={`${name} 앱을 만들면 여기에서 받을 수 있어요.`} /></SettingsGroup>

  const s = appInstallState(release, installed?.versionCode)
  const tag = s === 'unknown' ? null : STATE_TAG[s]
  const label = s === 'update' ? `${release.versionName} 업데이트 받기` : s === 'unknown' ? `${release.versionName} 받기` : `${release.versionName} 다시 받기`
  const said = s === 'update' ? `설치한 판 ${installed?.versionName ?? installed?.versionCode}보다 새 판이에요.`
    : s === 'latest' ? '가장 새 판을 쓰고 있어요.'
    : s === 'newer' ? '설치한 판이 올라온 파일보다 앞서요.'
    : '브라우저에서는 설치한 판을 알 수 없어요. 앱 안에서 열면 견줘 드려요.'
  return (
    <SettingsGroup title="Android 앱" count={tag && <TagStatus type={tag.type}>{tag.label}</TagStatus>} lead={lead}
      foot={<a className={`mw-button ${s === 'update' || s === 'unknown' ? 'mw-button--primary' : 'mw-button--secondary'} mw-button--medium`} href={release.file} onClick={() => haptics.tap()}>
        {s === 'update' ? <IcLineRefresh aria-hidden="true" width={20} height={20} /> : <IcLineDownload aria-hidden="true" width={20} height={20} />}{label}
      </a>}>
      <SettingRow label="받을 수 있는 판" description={said} control={<span className="mw-setting__value mw-num">v{release.versionName}</span>} />
      <SettingRow label="만든 날" control={<span className="mw-setting__value mw-num">{day(release.builtAt)}</span>} />
      <SettingRow label="설치한 판" control={<span className={`mw-setting__value mw-num${installed ? '' : ' mw-setting__value--muted'}`}>{installed ? `v${installed.versionName ?? installed.versionCode}` : '알 수 없어요'}</span>} />
      <SettingRow label="파일 크기" control={<span className="mw-setting__value mw-num">{size(release.sizeBytes)}</span>} />
      {children}
    </SettingsGroup>
  )
}

export type AppHistoryProps = {
  history: AppRelease[]
  installed?: { versionCode: number } | null
  /** 접기 이름이에요: `drive:app-history` */
  name?: string
}

/** 지난 판의 이력이에요. 최신이 위, 한 줄에 판 · 만든 날 · 바뀐 것이에요. 설치한 판에는 `설치됨`이 붙어요. */
export function AppHistory({ history, installed, name }: AppHistoryProps) {
  const x = useExpand({ name })
  if (history.length === 0) return null
  const row = (h: AppRelease) => (
    <SettingRow key={h.versionCode} label={<>v{h.versionName}{installed?.versionCode === h.versionCode && <> <TagStatus type="info" size="small">설치됨</TagStatus></>}</>}
      description={h.notes ? `${day(h.builtAt)} · ${h.notes}` : day(h.builtAt)}
      control={<a className="mw-button mw-button--tertiary-subtle mw-button--small" href={h.file} aria-label={`v${h.versionName} 받기`}>받기</a>} />
  )
  const head = history.slice(0, 3)
  const rest = history.slice(3)
  return (
    <SettingsGroup title="이력" count={`${history.length}판`} lead="앞선 판이 필요할 때 다시 받을 수 있어요.">
      {head.map(row)}
      {rest.length > 0 && (
        <>
          <Expand {...x.region} flush>{rest.map(row)}</Expand>
          <div className="mw-setting__more"><ExpandButton {...x.button} more="지난 판 모두 보기" count={rest.length} /></div>
        </>
      )}
    </SettingsGroup>
  )
}
