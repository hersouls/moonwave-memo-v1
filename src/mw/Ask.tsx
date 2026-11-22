/* Moonwave UX — Ask (Wavie에게 묻기): 서비스 안의 묻기 화면 하나 (키트 1.10.1)
   규격: https://ux.moonwave.kr/ai/ask
   서비스는 화면을 만들지 않아요. 자기 자료를 묻는 통로(`ask`), 예시 질문, 모델 상태만 넘기면 모든 서비스가 같은
   화면이에요: 페이지 머리(Wavie에게 묻기 · 새 대화 · 지난 대화), 첫 화면(인사말 · 예시 · 모델 · Bot으로), 대화(질문 제목 · 진행 ·
   답 · 출처 · 이어 묻기), 아래의 입력란(폰에서는 하단 탭 위). 서버의 답은 아래 `AskEvent` 약속으로 옮겨서 보내요. */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { cx } from './cx'
import { DetailDrawer } from './DetailDrawer'
import { reducedMotion } from './gesture-settings'
import { IcLineCheck, IcLineChevronDown, IcLineDuplicate, IcLineExternalLink, IcLineInfo, IcLineRefresh, IcLineTrash, IcLineWarning, IcMwSend, IcMwSparkles } from './icons'
import { useUndo } from './UndoSnackbar'

// ── 약속: 서비스의 통로가 보내는 것

/** 답에 쓴 자료 하나예요. `href`가 있으면 그 기록으로 바로 가요(같은 서비스의 화면). */
export type AskSource = { id: string; title: string; detail?: string; href?: string }

/**
 * 통로가 화면에 알리는 일이에요. 서버의 형식이 무엇이든 이것으로 옮겨요.
 * - `step`: 진행 단계(질문 이해 · 자료 찾기 · 답 정리 …). 같은 `id`를 다시 보내면 그 단계를 고쳐요. `done`이면 끝난 단계예요.
 * - `text`: 답의 글자를 이어 붙여요. `answer`는 답 전체를 한 번에 줄 때예요.
 * - `sources`: 답에 쓴 자료예요. `follow`: 이어서 물을 만한 질문(세 개까지 보여요).
 * - `caution`: 답 아래에 붙는 주의 한 줄이에요(답의 숫자가 자료와 맞지 않을 때, 일부 자료만 봤을 때 …).
 * - `done`: 다 썼어요(쓴 모델 이름). `error`: 답을 만들지 못한 까닭이에요(해요체 한 문장).
 */
export type AskEvent =
  | { type: 'step'; id: string; label: string; detail?: string; done?: boolean }
  | { type: 'text'; text: string }
  | { type: 'answer'; text: string }
  | { type: 'sources'; sources: AskSource[] }
  | { type: 'follow'; questions: string[] }
  | { type: 'caution'; text: string }
  | { type: 'done'; model?: string }
  | { type: 'error'; message: string }

export type AskRequest = {
  question: string
  /** 같은 대화의 앞선 질문과 답이에요(오래된 것부터). */
  history: { role: 'user' | 'assistant'; content: string }[]
  /** 서버가 대화를 기억하면 그 대화의 id예요. `setSession`으로 정해요. */
  session?: string
  setSession: (id: string) => void
  emit: (e: AskEvent) => void
  /** 멈추기를 누르거나 120초 동안 아무것도 오지 않으면 끊어요. fetch에 넘겨요. */
  signal: AbortSignal
}
export type AskFn = (req: AskRequest) => Promise<void>

/** 모델 상태예요. `note`는 `보통 15~25초 걸려요`처럼 기다릴 시간이에요. */
export type AskModel = { name: string; ready: boolean; note?: string }

type StepState = { id: string; label: string; detail?: string; done: boolean }
type TurnState = 'asking' | 'done' | 'stopped' | 'failed'
export type AskTurn = { id: string; question: string; answer: string; steps: StepState[]; sources: AskSource[]; follow: string[]; caution?: string[]; state: TurnState; error?: string; ms?: number; model?: string }
export type AskThread = { id: string; title: string; at: number; session?: string; turns: AskTurn[] }

/** 지난 대화를 두는 곳이에요. 처음 값은 이 기기(`localAskStore`)예요. 서버에 둘 때는 같은 모양으로 넘겨요. */
export type AskStore = { load: () => AskThread[]; save: (threads: AskThread[]) => void }
export function localAskStore(name: string, keep = 30): AskStore {
  const key = `mw:ask:${name}`
  return {
    load: () => { try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] } },
    save: (threads) => { try { localStorage.setItem(key, JSON.stringify(threads.slice(0, keep))) } catch { /* 저장소를 쓸 수 없어도 이 화면에서는 이어져요 */ } },
  }
}

/** 서버가 보내는 Server-Sent Events를 읽어요: 빈 줄로 나뉜 덩어리의 `data:` 줄을 JSON으로 넘겨요. 통로에서 써요. */
export async function readEventStream(response: Response, onData: (data: unknown) => void): Promise<void> {
  if (!response.body) return
  const reader = response.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  const flush = (block: string) => {
    const data = block.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n')
    if (!data) return
    try { onData(JSON.parse(data)) } catch { /* JSON이 아닌 줄 */ }
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const blocks = buf.split(/\r?\n\r?\n/)
    buf = blocks.pop() ?? ''
    for (const b of blocks) flush(b)
  }
  buf += dec.decode()
  if (buf.trim()) flush(buf)
}

// ── 화면

/** 글자가 오지 않은 채 이만큼 지나면 끊어요(쓰는 중인 답은 시간으로 끊지 않아요: ai/ai-patterns#qa). */
const STALL_MS = 120_000
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
/** 대화 제목에 금액이나 긴 숫자를 드러내지 않아요(ai-principles#privacy). */
const quietTitle = (q: string) => q.replace(/\d[\d,.]*\s*(만|억|천)?\s*원/g, '…원').replace(/\d{5,}/g, '…').slice(0, 60)
const dayTime = (at: number) => { const d = new Date(at), p = (n: number) => String(n).padStart(2, '0'); return `${d.getMonth() + 1}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }

function useNarrow() {
  const q = '(max-width: 900px)'
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => { const m = matchMedia(q); const on = () => setNarrow(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on) }, [])
  return narrow
}

/** 답의 글을 요소로 읽어요: 문단, `##` 소제목, `-` · `1.` 목록, `**굵게**`, `` `코드` ``. 문자열을 마크업으로 넣지 않아요. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
      : part.startsWith('`') && part.endsWith('`') ? <code key={`${key}-${i}`}>{part.slice(1, -1)}</code> : part)
}
export function AskText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const close = () => { if (!list) return; const L = list.ordered ? 'ol' : 'ul'; blocks.push(<L key={`l${blocks.length}`}>{list.items.map((t, i) => <li key={i}>{inline(t, `li${i}`)}</li>)}</L>); list = null }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line), num = /^\s*\d+[.)]\s+(.*)$/.exec(line), head = /^#{1,4}\s+(.*)$/.exec(line)
    if (bullet || num) {
      const ordered = !!num
      if (!list || list.ordered !== ordered) { close(); list = { ordered, items: [] } }
      list.items.push((bullet ?? num)![1])
      continue
    }
    close()
    if (!line.trim()) continue
    if (head) blocks.push(<h3 key={`h${blocks.length}`}>{inline(head[1], `h${blocks.length}`)}</h3>)
    else blocks.push(<p key={`p${blocks.length}`}>{inline(line, `p${blocks.length}`)}</p>)
  }
  close()
  return <>{blocks}</>
}

export type AskProps = {
  /** 서비스의 짧은 이름이에요(저장 열쇠와 id): `asset`. */
  name: string
  /** 화면에 쓰는 서비스 이름이에요: `Asset`. */
  service: string
  /** 페이지 머리의 한 줄: 무엇을 보고 답하는지(`카드 명세서와 토스증권 기록을 이 Mac의 모델이 찾아보고 답해요`). */
  lead: string
  ask: AskFn
  /** 이 서비스가 잘 답하는 예시 질문이에요. 여섯 개까지 보여요. */
  examples: readonly string[]
  /** 모델 상태예요. 모르면 넘기지 않아요. */
  model?: AskModel | null
  /** 다른 서비스 기록까지 함께 볼 때 가는 곳(Bot의 열기 주소, `openIn`)이에요. */
  wider?: string | null
  store?: AskStore
  /** 첫 화면의 한계 문구예요. 처음 값: `Wavie가 틀릴 수 있어요. 중요한 것은 원래 기록에서 확인해 주세요.` */
  disclaimer?: string
  /** 다른 화면에서 질문을 채워 들어올 때예요(`#/ask?q=…`). 입력란에 채우기만 하고 보내지는 않아요. */
  question?: string
  /** 같은 질문을 다른 방식(다른 모델 · 엔진)으로 다시 물을 때예요: `{ label: 'Claude로 다시 묻기', ask }`. 그 방식을 쓸 수 있을 때만 넘겨요. */
  again?: { label: string; ask: AskFn } | null
  /** 화면 제목의 단계예요. 다른 페이지 안에 예시로 놓을 때만 2예요(한 화면에 h1은 하나). */
  headingLevel?: 1 | 2
}

/**
 * 서비스 안의 묻기 화면이에요. 앱 셸의 내용 영역(`mw-app-content`) 안에 그대로 놓아요. 메뉴 이름과 화면 제목은
 * 모든 서비스가 `Wavie에게 묻기`예요(소유자, 2026-10-24: "메뉴 이름 통일해줘 Wavie에게 묻기").
 * 지난 대화는 이 기기에 남고(`store`로 바꿀 수 있어요), 대화가 시작되면 첫 화면의 예시 · 한계 문구는 숨어요.
 */
export function Ask({ name, service, lead, ask, examples, model, wider, store: given, disclaimer, question, again, headingLevel = 1 }: AskProps) {
  const H = headingLevel === 2 ? 'h2' : 'h1'
  const store = useMemo(() => given ?? localAskStore(name), [given, name])
  const [threads, setThreads] = useState<AskThread[]>(() => store.load())
  const [threadId, setThreadId] = useState<string | null>(null)
  const [text, setText] = useState(question ?? '')
  useEffect(() => { if (question) { setThreadId(null); setText(question) } }, [question])
  const [history, setHistory] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const narrow = useNarrow()
  const undo = useUndo()
  const input = useRef<HTMLTextAreaElement>(null)
  const running = useRef<{ abort: AbortController; started: number; last: number; stalled: boolean } | null>(null)
  const ids = useId()
  const [main, setMain] = useState<Element | null>(null)
  useEffect(() => setMain(document.querySelector('.mw-app-main')), [])

  const thread = threads.find((t) => t.id === threadId) ?? null
  const turns = thread?.turns ?? []
  const asking = turns.some((t) => t.state === 'asking')
  const save = useCallback((next: AskThread[]) => { setThreads(next); store.save(next.map((t) => ({ ...t, turns: t.turns.map((u) => (u.state === 'asking' ? { ...u, state: 'stopped' as const } : u)) }))) }, [store])

  // 이 화면을 떠나면 답을 끊어요
  useEffect(() => () => running.current?.abort.abort(), [])
  // 걸린 시간과 120초 무응답
  useEffect(() => {
    if (!asking) return
    const t = window.setInterval(() => {
      const r = running.current
      if (!r) return
      setElapsed(Date.now() - r.started)
      if (Date.now() - r.last > STALL_MS) { r.stalled = true; r.abort.abort() }
    }, 200)
    return () => window.clearInterval(t)
  }, [asking])

  const send = (raw: string, by: AskFn = ask) => {
    const question = raw.replace(/\s+/g, ' ').trim()
    if (!question || asking) return
    const turn: AskTurn = { id: uid(), question, answer: '', steps: [], sources: [], follow: [], state: 'asking' }
    const base = thread ?? { id: uid(), title: quietTitle(question), at: Date.now(), turns: [] }
    const tid = base.id
    let all: AskThread[] = [{ ...base, at: Date.now(), turns: [...base.turns, turn] }, ...threads.filter((t) => t.id !== tid)]
    save(all)
    setThreadId(tid)
    setText('')
    const abort = new AbortController()
    const r = { abort, started: Date.now(), last: Date.now(), stalled: false }
    running.current = r
    setElapsed(0)
    const patch = (fn: (u: AskTurn) => AskTurn, session?: string) => {
      all = all.map((t) => (t.id !== tid ? t : { ...t, session: session ?? t.session, turns: t.turns.map((u) => (u.id === turn.id ? fn(u) : u)) }))
      setThreads(all)
    }
    const emit = (e: AskEvent) => {
      if (abort.signal.aborted) return
      r.last = Date.now()
      if (e.type === 'step') patch((u) => { const i = u.steps.findIndex((s) => s.id === e.id); const s = { id: e.id, label: e.label, detail: e.detail, done: !!e.done }; return { ...u, steps: i < 0 ? [...u.steps.map((x) => ({ ...x, done: true })), s] : u.steps.map((x, j) => (j === i ? s : x)) } })
      else if (e.type === 'text') patch((u) => ({ ...u, answer: u.answer + e.text }))
      else if (e.type === 'answer') patch((u) => ({ ...u, answer: e.text }))
      else if (e.type === 'sources') patch((u) => ({ ...u, sources: e.sources }))
      else if (e.type === 'follow') patch((u) => ({ ...u, follow: e.questions.slice(0, 3) }))
      else if (e.type === 'caution') patch((u) => ({ ...u, caution: [...(u.caution ?? []), e.text] }))
      else if (e.type === 'done') patch((u) => ({ ...u, model: e.model ?? u.model }))
      else if (e.type === 'error') patch((u) => ({ ...u, state: 'failed', error: e.message }))
    }
    const prior = base.turns.filter((u) => u.state === 'done').flatMap((u) => [{ role: 'user' as const, content: u.question }, { role: 'assistant' as const, content: u.answer }])
    by({ question, history: prior, session: base.session, setSession: (id) => patch((u) => u, id), emit, signal: abort.signal })
      .then(() => patch((u) => (u.state === 'asking' ? { ...u, state: 'done', steps: u.steps.map((s) => ({ ...s, done: true })), ms: Date.now() - r.started } : u)))
      .catch((err: unknown) => patch((u) => (u.state !== 'asking' ? u
        : abort.signal.aborted ? { ...u, state: r.stalled ? 'failed' : 'stopped', error: r.stalled ? '답이 오지 않아요. 잠시 뒤 다시 물어봐 주세요.' : undefined, ms: Date.now() - r.started }
          : { ...u, state: 'failed', error: err instanceof Error && err.message ? err.message : '답을 만들지 못했어요. 잠시 뒤 다시 물어봐 주세요.', ms: Date.now() - r.started })))
      .finally(() => { if (running.current === r) running.current = null; store.save(all) })
  }

  const stop = () => running.current?.abort.abort()
  const fresh = () => { if (asking) return; setThreadId(null); setText(''); input.current?.focus() }
  const open = (id: string) => { setThreadId(id); setHistory(false) }
  const remove = (id: string) => {
    const gone = threads.find((t) => t.id === id)
    // 답을 쓰는 중인 대화는 지우지 않아요(멈춘 뒤에 지워요)
    if (!gone || (asking && id === threadId)) return
    const next = threads.filter((t) => t.id !== id)
    save(next)
    if (threadId === id) setThreadId(null)
    undo.offer({ message: '대화를 지웠어요', undo: () => save([gone, ...next].sort((a, b) => b.at - a.at)) })
  }

  // 새 질문이 보이는 자리로 내용 영역만 옮겨요
  const count = turns.length
  const last = useRef<HTMLElement>(null)
  useEffect(() => { if (count) last.current?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }) }, [count])

  const rows = Math.min(4, Math.max(1, text.split('\n').length))
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글을 조합하는 동안의 Enter는 글자를 끝내는 키예요
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text) }
  }
  const composer = (
    <div className={cx('mw-prompt-input', 'mw-ask__composer', !narrow && 'mw-prompt-input--desktop', rows > 1 && 'mw-prompt-input--expanded')}>
      {!turns.length && <p className="mw-prompt-input__disclaimer">{disclaimer ?? 'Wavie가 틀릴 수 있어요. 중요한 것은 원래 기록에서 확인해 주세요.'}</p>}
      <div className="mw-prompt-input__field">
        <div className="mw-prompt-input__body">
          <textarea ref={input} className="mw-prompt-input__textarea" rows={rows} maxLength={1000} aria-label="Wavie에게 질문"
            placeholder={asking ? '답하고 있어요' : `${service}의 기록을 물어보세요`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
          {asking
            ? <button type="button" className="mw-prompt-input__send" aria-label="답변 멈추기" onClick={stop}><span className="mw-prompt-input__stop-icon" /></button>
            : <button type="button" className="mw-prompt-input__send" aria-label="보내기" disabled={!text.trim()} onClick={() => send(text)}><IcMwSend size={20} /></button>}
        </div>
      </div>
    </div>
  )

  return (
    // AI 화면이라 agent 모드(한 단계 내려간 회색 바탕에 흰 입력란 · 칩 · 카드) 위에 그려요(ai/ai-patterns)
    <div className="mw-page mw-ask" data-ask={name} data-mode="agent">
      <div className="mw-page__head">
        <div>
          <H>Wavie에게 묻기</H>
          <p>{lead}</p>
        </div>
        <div className="mw-page__actions">
          <Button variant="tertiary" size="medium" onClick={fresh} disabled={!turns.length || asking}>새 대화</Button>
          <Button variant="tertiary" size="medium" onClick={() => setHistory(true)} aria-expanded={history} aria-controls={`${ids}-history`}>지난 대화{threads.length ? ` ${threads.length}` : ''}</Button>
        </div>
      </div>

      {!turns.length ? (
        <section className="mw-ask__welcome" aria-labelledby={`${ids}-hello`}>
          <span className="mw-ask__orb" aria-hidden="true"><IcMwSparkles size={32} /></span>
          <h2 id={`${ids}-hello`} className="mw-ask__hello">무엇이 궁금하세요?</h2>
          {examples.length > 0 && (
            <div className="mw-prompt-output__suggestions mw-ask__examples" role="group" aria-labelledby={`${ids}-examples`}>
              <p className="mw-prompt-output__suggestions-label" id={`${ids}-examples`}>이렇게 물어보세요</p>
              {examples.slice(0, 6).map((q) => <button key={q} type="button" className="mw-prompt-output__suggestion" onClick={() => send(q)}>{q}</button>)}
            </div>
          )}
          {model && <p className="mw-ask__model"><span className={cx('mw-ask__model-name', !model.ready && 'mw-ask__model-name--wait')}>{model.ready ? <IcLineCheck size={16} /> : <IcLineInfo size={16} />}{model.name} {model.ready ? '준비됨' : '준비 중'}</span>{model.note && <span>{model.note}</span>}</p>}
          {wider && <p className="mw-ask__wider">다른 서비스 기록까지 함께 보려면 <a href={wider} target="_blank" rel="noreferrer">Bot에게 묻기<IcLineExternalLink size={16} /></a></p>}
        </section>
      ) : (
        <div className="mw-ask__talk">
          {turns.map((u, i) => <Turn key={u.id} turn={u} anchor={i === turns.length - 1 ? last : undefined} elapsed={u.state === 'asking' ? elapsed : u.ms ?? 0} typing={!!text.trim()}
            onAsk={send} onRetry={() => send(u.question)} again={again && !asking ? { label: again.label, run: () => send(u.question, again.ask) } : null} desktop={!narrow} />)}
        </div>
      )}

      {/* 폰에서는 하단 탭 위(엄지가 닿는 곳)에 둬요. 앱 셸이 없는 곳(문서의 예시)에서는 대화 아래에 둬요 */}
      {narrow && main ? createPortal(<div className="mw-app-action mw-app-action--bar mw-ask__dock" data-mode="agent" role="region" aria-label="질문 입력">{composer}</div>, main) : <div className="mw-ask__bottom">{composer}</div>}

      <DetailDrawer id={`${ids}-history`} open={history} onClose={() => setHistory(false)} title="지난 대화">
        {threads.length ? (
          <ul className="mw-ask__threads">
            {threads.map((t) => (
              <li key={t.id} className={cx('mw-ask__thread', t.id === threadId && 'mw-ask__thread--current')}>
                <button type="button" className="mw-ask__thread-open" aria-current={t.id === threadId ? 'true' : undefined} onClick={() => open(t.id)}>
                  <span className="mw-ellipsis">{t.title}</span><small>{dayTime(t.at)} · 질문 {t.turns.length}개</small>
                </button>
                <button type="button" className="mw-icon-button" aria-label={`${t.title} 대화 지우기`} onClick={() => remove(t.id)}><IcLineTrash size={20} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="mw-ask__none">지난 대화가 없어요. 물어본 대화가 이 기기에 남아요.</p>}
      </DetailDrawer>
      {undo.snackbar}
    </div>
  )
}

function Turn({ turn: u, anchor, elapsed, typing, onAsk, onRetry, again, desktop }: { turn: AskTurn; anchor?: Ref<HTMLElement>; elapsed: number; typing: boolean; onAsk: (q: string) => void; onRetry: () => void; again: { label: string; run: () => void } | null; desktop: boolean }) {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sources, setSources] = useState(false)
  const id = useId()
  const live = u.state === 'asking'
  const seconds = `${(elapsed / 1000).toFixed(1)}초`
  const current = u.steps.find((s) => !s.done)
  const copy = () => { navigator.clipboard?.writeText(u.answer).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500) }, () => {}) }
  return (
    <article ref={anchor} className="mw-ask__turn" aria-labelledby={`${id}-q`}>
      <div className={cx('mw-prompt-question', 'mw-prompt-question--monologue', desktop && 'mw-prompt-question--desktop')}><h2 id={`${id}-q`} className="mw-prompt-question__text">{u.question}</h2></div>

      {u.steps.length > 0 && (
        <div className="mw-process-indicator" role="status" aria-live="polite" aria-label="답을 만드는 과정">
          {!live && <button type="button" className="mw-process-indicator__toggle" aria-expanded={shown} aria-controls={`${id}-steps`} onClick={() => setShown((s) => !s)}>확인한 과정 {u.steps.length}단계<IcLineChevronDown size={20} /></button>}
          <ol id={`${id}-steps`} className="mw-process-indicator__card" hidden={!live && !shown}>
            {u.steps.map((s) => (
              <li key={s.id} className={cx('mw-process-indicator__step', !s.done && live && 'mw-process-indicator__step--active')}>
                <div className="mw-process-indicator__header">
                  {s.done || !live ? <span className="mw-process-indicator__check" aria-hidden="true"><IcLineCheck size={12} /></span> : <span className="mw-process-indicator__spinner" aria-hidden="true" />}
                  <span className="mw-process-indicator__label">{!s.done && live ? <span className="mw-process-indicator__shimmer">{s.label}</span> : s.label}</span>
                </div>
                {s.detail && <div className="mw-process-indicator__detail"><span className="mw-process-indicator__query">{s.detail}</span></div>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {live && !u.answer && !u.steps.length && <div className="mw-process-indicator" role="status" aria-live="polite"><p className="mw-process-indicator__status">질문을 이해하고 있어요</p></div>}

      {u.answer && (
        <div className={cx('mw-prompt-output', desktop && 'mw-prompt-output--desktop')}>
          <div className="mw-prompt-output__response" aria-live="polite" aria-busy={live}><AskText text={u.answer} /></div>
          {!live && (u.caution ?? []).map((t, i) => <p key={i} className="mw-prompt-output__caution" role="note"><IcLineWarning />{t}</p>)}
          {!live && u.sources.length > 0 && (
            <div className="mw-ask__sources">
              <button type="button" className="mw-prompt-output__source" aria-expanded={sources} aria-controls={`${id}-src`} onClick={() => setSources((s) => !s)}>{u.sources.length}개 출처</button>
              <ul id={`${id}-src`} className="mw-ask__source-list" hidden={!sources}>
                {u.sources.map((s) => <li key={s.id}>{s.href ? <a href={s.href}>{s.title}</a> : <span>{s.title}</span>}{s.detail && <small>{s.detail}</small>}</li>)}
              </ul>
            </div>
          )}
          {!live && (
            <ul className="mw-prompt-output__actions" aria-label="답변 도구">
              <li><button type="button" className="mw-prompt-output__action" aria-label={copied ? '복사했어요' : '답변 복사'} onClick={copy}>{copied ? <IcLineCheck size={20} /> : <IcLineDuplicate size={20} />}</button></li>
              <li><button type="button" className="mw-prompt-output__action" aria-label="다시 묻기" onClick={onRetry}><IcLineRefresh size={20} /></button></li>
            </ul>
          )}
          {!live && again && <div><Button variant="tertiary" size="small" onClick={again.run}>{again.label}</Button></div>}
          {!live && u.state === 'done' && u.follow.length > 0 && !typing && (
            <div className="mw-prompt-output__suggestions" role="group" aria-label="이어서 물어보기">
              <p className="mw-prompt-output__suggestions-label">이어서 물어보기</p>
              {u.follow.map((q) => <button key={q} type="button" className="mw-prompt-output__suggestion" onClick={() => onAsk(q)}>{q}</button>)}
            </div>
          )}
        </div>
      )}

      {u.state === 'stopped' && <div className="mw-process-indicator" role="status"><p className="mw-process-indicator__status mw-process-indicator__status--canceled">답변을 멈췄어요.</p></div>}
      {u.state === 'failed' && (
        <div className="mw-process-indicator mw-ask__failed" role="alert">
          <p className="mw-process-indicator__status mw-process-indicator__status--error"><IcLineInfo />{u.error ?? '답을 만들지 못했어요.'}</p>
          <Button variant="secondary" size="small" onClick={onRetry}>다시 묻기</Button>
        </div>
      )}
      <p className="mw-ask__meta">{live ? (current ? current.label : '답을 만들고 있어요') : u.model ?? ''}<span className="mw-num">{elapsed ? seconds : ''}</span></p>
    </article>
  )
}
