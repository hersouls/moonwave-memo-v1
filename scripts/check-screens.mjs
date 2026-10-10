// Memo: do the phone screens still hold up when there are real-looking memos in them?
//
//   node scripts/check-screens.mjs            run the checks (scripts/deploy.sh does, before every deploy)
//   node scripts/check-screens.mjs --shots    …and leave screenshots in the system temp folder (path is printed)
//
// Why this exists: on 2026-10-10 an automatic UX fix moved every screen to the Moonwave kit and deployed with the
// UX audit at 100 — and the owner's phone showed a three-column grid of squeezed cards, a clipped editor whose scroll
// jumped to the top on every keystroke, and checkboxes drawn over their text. The audit opens Memo as a first-time
// visitor (three sample memos), so nothing with tags, long titles, tables, tasks or a long body was ever looked at.
// This opens the app the way the owner uses it and fails the deploy when one of those breaks comes back.
//
// It needs what this Mac has: Google Chrome, playwright-core (the UX monitor's copy) and the public Firebase web
// config in ~/Library/Application Support/Moonwave/memo-android.env. Where one of them is missing it says so and
// ends with 0: it is a net for this Mac's deploys, not a build requirement.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PLAYWRIGHT = '/Volumes/Work/Moonwave_Web/Vector-DB_UX_v1.0/monitor/node_modules/playwright-core/index.mjs'
const AUDIT = '/Volumes/Work/Moonwave_Web/Vector-DB_UX_v1.0/monitor/lib/collect.mjs' // the audit's own touch-target probe
const ENV_FILE = process.env.MEMO_ANDROID_ENV ?? join(homedir(), 'Library/Application Support/Moonwave/memo-android.env')
const SHOTS = process.argv.includes('--shots') ? mkdtempSync(join(tmpdir(), 'memo-screens-')) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const skip = (why) => { console.log(`[screens] 건너뛰어요: ${why}`); process.exit(0) }

if (!existsSync(CHROME)) skip('Google Chrome이 없어요')
if (!existsSync(PLAYWRIGHT)) skip('playwright-core가 없어요 (Vector-DB_UX_v1.0/monitor)')
if (!existsSync(ENV_FILE)) skip('Firebase 웹 설정 파일이 없어요 (memo-android.env)')
for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = /^(VITE_FIREBASE_[A-Z_]+)=(.*)$/.exec(line)
  if (m) process.env[m[1]] = m[2]
}

// ── what the owner's memos look like: bracketed long titles, five tags, tables, tasks, code, a body of several screens
const LONG = `**작성일**: 2026-03-13
**대상**: 물류센터 연료전지 (정격 900kW, 3×300kW Energy Server)
**목적**: 출력제어 기인 추가 열화 9.7%(85.31kW)의 적정성 검증

---

## 1. 주장 요약

| 항목 | 값 | 비고 |
|---|---|---|
| 기준 출력 | 900kW | 정격 |

- [ ] 원자료 요청
- [x] 계약서 조항 확인

\`\`\`python
def degrade(hours, cycles):
    return 0.0031 * hours + 0.02 * cycles  # 긴 줄은 옆으로 넘겨 봐요, 줄이 길어도 화면 밖으로 나가지 않아야 해요
\`\`\`

본문 문단이 길게 이어져요. 열화율은 가동 시간과 부하 패턴에 따라 달라지고, 출력제어가 잦을수록 스택의 열 사이클이 늘어요.

`.repeat(4)
const MEMOS = [
  { title: '[IPP]_Fleet 기준 열화율 검증_260313', body: LONG, folder: 'IPP', tags: ['연료전지', '열화분석', 'Bloom_Energy', '출력제어', '보고서'], pin: true, star: true },
  { title: 'Anthropic API 사용 메모', body: '모델별 요금과 한도 정리\n\n- 입력\n- 출력', folder: '개발', tags: ['보안', 'API키', '개발', '참고'], pin: true, star: true },
  { title: '[회사]_신사업 후보 정리', body: '| 유형 | 구분 | 지역 | 사업 개요 (모델) | 사업비 |\n|---|---|---|---|---|\n| ESS | 신규 | 전남 | 계통 연계 | 120억 |', folder: '회사', tags: ['재생에너지', 'ESS', '검토'], pin: true },
  { title: '독서 노트 — 고요할수록 밝아지는 것들', body: '마음에 남은 문장을 적어요.', folder: null, tags: ['독서', '문장'] },
  { title: '', body: '제목 없이 쓴 짧은 메모예요.', folder: null, tags: [] },
  { title: 'Very long English title that should wrap or truncate nicely on a phone screen', body: 'Body text', folder: '개발', tags: ['english'] },
]

const { chromium } = await import(PLAYWRIGHT)
const { createServer } = await import('vite')
const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 5187 } })
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] })
const touchSrc = existsSync(AUDIT) ? (() => { const s = readFileSync(AUDIT, 'utf8'); const a = s.indexOf('function touchTargets()'); return a < 0 ? null : s.slice(a, s.indexOf('/**', a)).replace('function touchTargets()', 'function ()') })() : null

const failures = []
try {
  // the two widths the owner's phones really have: 412 (default display size) and 360 (text one step bigger)
  for (const size of [{ width: 412, height: 915 }, { width: 360, height: 780 }]) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul',
      userAgent: 'Mozilla/5.0 (Linux; Android 16; SM-S948N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' })
    const page = await ctx.newPage()
    const fail = (where, what) => failures.push(`${size.width}px ${where}: ${what}`)
    page.on('pageerror', (e) => fail('화면 오류', String(e).slice(0, 160)))
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await sleep(3000)
    const firstId = await page.evaluate(async (MEMOS) => {
      const folders = (await import('/src/stores/folderStore.ts')).useFolderStore.getState()
      const memos = (await import('/src/stores/memoStore.ts')).useMemoStore.getState()
      const ids = {}
      for (const [name, n] of [['IPP', 3], ['개발', 6], ['회사', 4]]) ids[name] = await folders.addFolder(name, `var(--mw-cat-${n})`)
      let first
      for (const m of [...MEMOS].reverse()) {
        const id = await memos.addMemo({ title: m.title, body: m.body, folderId: m.folder ? ids[m.folder] : null, tags: m.tags })
        if (m.pin) await memos.togglePin(id)
        if (m.star) await memos.toggleStar(id)
        first = id
      }
      return first
    }, MEMOS)
    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500) // the app reads the seeded memos back from its database
    const go = async (path, wait = 2000) => { await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }, path); await sleep(wait) }
    const view = (mode) => page.evaluate(async (mode) => { (await import('/src/stores/uiStore.ts')).useUIStore.getState().setViewMode(mode) }, mode)
    const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${size.width}-${name}.png`) }) }
    const common = async (where) => {
      const f = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }))
      if (f.sw > f.w + 1) fail(where, `화면이 옆으로 넘쳐요 (${f.sw}px > ${f.w}px)`)
      if (touchSrc) { const t = await page.evaluate(`(${touchSrc})()`); if (t.small) fail(where, `누르는 영역이 44px보다 작은 것이 ${t.small}개예요 (${t.samples.join(' · ')})`) }
      await shot(where)
    }

    // ── 메모 목록: 카드가 화면 너비를 쓰고, 격자는 412px에서 두 칸 · 360px에서 한 칸
    await go('/memos'); await view('list'); await sleep(500)
    const list = await page.evaluate(() => [...document.querySelectorAll('.memo-card')].slice(0, 4).map((c) => { const r = c.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(innerWidth - r.right), w: Math.round(r.width) } }))
    if (!list.length) fail('목록', '메모 카드가 보이지 않아요')
    for (const c of list) if (c.left > 20 || c.right > 20) { fail('목록', `카드가 화면 끝에서 ${c.left}px · ${c.right}px 떨어져 있어요 (페이지 여백은 16px)`); break }
    await common('목록')
    await view('grid'); await sleep(700)
    const grid = await page.evaluate(() => { const cards = [...document.querySelectorAll('.memo-card')]; const tops = cards.map((c) => Math.round(c.getBoundingClientRect().top)); return { perRow: tops.filter((t) => t === tops[0]).length, narrow: Math.min(...cards.map((c) => Math.round(c.getBoundingClientRect().width))) } })
    const want = size.width > 380 ? 2 : 1
    if (grid.perRow !== want) fail('격자', `한 줄에 카드가 ${grid.perRow}장이에요 (${size.width}px 폰은 ${want}장)`)
    if (grid.narrow < 150) fail('격자', `카드가 ${grid.narrow}px까지 좁아졌어요`)
    await common('격자'); await view('list')

    // ── 편집기: 칸이 잘리지 않고, 긴 글의 끝에서 글자를 쳐도 화면이 튀지 않아요
    await go('/memo/' + firstId, 2800)
    const ed = await page.evaluate(() => {
      const box = document.querySelector('.mw-textarea'), ta = document.querySelector('textarea'), title = document.querySelector('.mw-textfield')
      if (!box || !ta || !title) return null
      const rect = (el) => el.getBoundingClientRect()
      const clip = (() => { for (let p = box.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY) && p.clientHeight > 0 && p !== document.body && p !== document.documentElement) { const r = rect(p); if (rect(box).bottom > r.bottom + 1 || rect(box).top < r.top - 1) return Math.round(rect(box).bottom - r.bottom) } return 0 })()
      const side = title.closest('.mw-textfield-container')?.parentElement?.querySelector('button.mw-icon-button')
      const tags = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '태그 편집')?.parentElement
      return { clip, boxH: Math.round(rect(box).height), titleRight: Math.round(rect(title).right), bodyRight: Math.round(rect(box).right), overlap: side ? Math.round(rect(title).right - rect(side).left) : 0, tagRow: tags ? Math.round(rect(tags).height) : 0 }
    })
    if (!ed) fail('편집기', '제목 칸이나 내용 칸을 찾지 못했어요')
    else {
      if (ed.clip > 0) fail('편집기', `내용 칸이 아래에서 ${ed.clip}px 잘려요 (테두리가 끊겨 보여요)`)
      if (ed.boxH < 200) fail('편집기', `내용 칸의 높이가 ${ed.boxH}px뿐이에요`)
      if (ed.overlap > 0) fail('편집기', `제목 칸이 옆의 버튼 밑으로 ${ed.overlap}px 들어가요`)
      if (ed.tagRow > 64) fail('편집기', `태그 줄이 ${ed.tagRow}px을 차지해요 (한 줄이어야 해요)`)
    }
    const scrolls = () => page.evaluate(() => { const out = []; for (let e = document.querySelector('textarea'); e; e = e.parentElement) if (e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) out.push(Math.round(e.scrollTop)); return out })
    await page.evaluate(() => { const ta = document.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); for (let e = ta; e; e = e.parentElement) if (e.scrollHeight > e.clientHeight + 2) e.scrollTop = e.scrollHeight })
    await sleep(300)
    const before = await scrolls(); await page.keyboard.type('가나'); await sleep(400); const after = await scrolls()
    if (before.some((top, i) => top > 100 && (after[i] ?? 0) < top - 100)) fail('편집기', `긴 메모의 끝에서 글자를 치면 스크롤이 위로 튀어요 (${before.join(',')} → ${after.join(',')})`)
    await page.evaluate(() => document.activeElement?.blur()); await sleep(300)
    await common('편집기')

    // ── 미리보기: 체크와 글, 코드와 그 머리가 겹치지 않아요
    await page.getByRole('tab', { name: '미리보기' }).first().click({ timeout: 5000 }).catch(() => fail('미리보기', '미리보기 탭을 누르지 못했어요')); await sleep(1300)
    const pv = await page.evaluate(() => {
      const root = document.querySelector('.memo-markdown-preview'); if (!root) return null
      const rect = (el) => el.getBoundingClientRect()
      let taskOverlap = 0, disabled = 0, codeOverlap = 0
      for (const li of root.querySelectorAll('li.task-list-item')) {
        const input = li.querySelector('input[type="checkbox"]'), box = li.querySelector('.mw-checkbox') ?? input
        if (!input || !box) continue
        if (input.disabled) disabled++
        const range = document.createRange(); const texts = [...li.querySelectorAll('*')].flatMap((e) => [...e.childNodes]).concat([...li.childNodes]).filter((n) => n.nodeType === 3 && n.textContent.trim())
        if (texts[0]) { range.selectNodeContents(texts[0]); if (range.getBoundingClientRect().left < rect(box).right - 1) taskOverlap++ }
      }
      for (const pre of root.querySelectorAll('pre')) { const code = pre.querySelector('code'); const head = code?.previousElementSibling; if (code && head && rect(head).bottom > rect(code).top + 1) codeOverlap++ }
      return { tasks: root.querySelectorAll('li.task-list-item').length, taskOverlap, disabled, codeOverlap, tables: root.querySelectorAll('table').length }
    })
    if (!pv || !pv.tasks || !pv.tables) fail('미리보기', '할 일이나 표가 그려지지 않았어요')
    else {
      if (pv.taskOverlap) fail('미리보기', `할 일 ${pv.taskOverlap}줄에서 체크가 글자에 겹쳐요`)
      if (pv.disabled) fail('미리보기', `할 일 체크 ${pv.disabled}개가 꺼져 있어요 (눌러서 마칠 수 있어야 해요)`)
      if (pv.codeOverlap) fail('미리보기', '코드 블록의 머리(언어 이름)가 코드의 첫 줄에 겹쳐요')
    }
    await common('미리보기')
    await ctx.close()
  }
} finally {
  await browser.close()
  await server.close()
}

if (SHOTS) console.log(`[screens] 화면 사진: ${SHOTS}`)
if (failures.length) {
  console.error(`[screens] 메모가 든 폰 화면에서 ${failures.length}곳이 깨졌어요:`)
  for (const f of failures) console.error(`  - ${f}`)
  console.error('[screens] 고친 뒤 다시 실행해요: node scripts/check-screens.mjs --shots (화면 사진을 남겨요)')
  process.exit(1)
}
console.log('[screens] 메모가 든 폰 화면(412 · 360px)의 목록 · 격자 · 편집기 · 미리보기가 모두 괜찮아요')
