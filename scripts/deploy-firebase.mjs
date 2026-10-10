// Memo's Firebase side (project in .firebaserc): see what is live there, and release what this folder holds.
//
//   node scripts/deploy-firebase.mjs            compare only: the live rules against firestore.rules and storage.rules.
//                                               Changes nothing. Ends with 1 when something differs or does not compile.
//   node scripts/deploy-firebase.mjs --apply    release the rules files that differ, then read them back to make sure
//
// The web app goes out with scripts/deploy.sh (Vercel builds every push). This is the rest, which used to be done by
// hand in the Firebase console, so nobody could tell whether the rules in this repository were the rules in force.
//
//   Firestore rules   firestore.rules → release "cloud.firestore"
//   Storage rules     storage.rules → release "firebase.storage/<bucket>", one for each bucket of the project.
//                     The project has no bucket (an image is kept inside its memo), so there is nowhere to release
//                     them to; the file is still compiled, and the script says so.
//   Functions         functions/ is not deployed: the free Spark plan cannot run it. The script only reports what is
//                     there. After a move to the Blaze plan: `cd functions && npm run deploy` (firebase-tools).
//
// It uses the Firebase Rules API with the gcloud login of this Mac (`gcloud auth login` as the project owner, the same
// login the nightly backup in ../Vector_DB_Memo_v1.0/backup_firestore.py reads with): no firebase CLI, no key file.
// Firebase compiles a file before anything is released (a syntax error stops here), and a release is read back.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT = JSON.parse(readFileSync(join(ROOT, '.firebaserc'), 'utf8')).projects.default
const RULES_API = 'https://firebaserules.googleapis.com/v1'
const APPLY = process.argv.includes('--apply')
const say = (line) => console.log(`[firebase] ${line}`)
const fail = (line) => { console.error(`[firebase] 실패: ${line}`); process.exit(1) }

function accessToken() {
  try {
    const out = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 }).trim()
    if (out) return out
  } catch { /* said below */ }
  return fail('gcloud 로그인 토큰을 얻지 못했어요. gcloud auth login 으로 로그인한 뒤 다시 실행해요')
}
const TOKEN = accessToken()

/** One Google API call as the logged-in owner. `missingOk`: a 404 answers null instead of failing. */
async function api(url, { method = 'GET', body, missingOk = false } = {}) {
  const init = {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60_000),
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  const res = await fetch(url, init)
  if (res.status === 404 && missingOk) return null
  if (!res.ok) {
    const why = await res.json().then((d) => d?.error?.message, () => '')
    throw new Error(`${method} ${new URL(url).pathname} → ${res.status}${why ? ` (${String(why).slice(0, 200)})` : ''}`)
  }
  return res.json()
}

/** What a release serves: its rules text and when it was released. null: nothing was ever released under that name. */
async function live(name) {
  const rel = await api(`${RULES_API}/projects/${PROJECT}/releases/${name}`, { missingOk: true })
  if (!rel) return null
  const set = await api(`${RULES_API}/${rel.rulesetName}`)
  return { text: set.source?.files?.[0]?.content ?? '', at: rel.updateTime ?? rel.createTime ?? '' }
}

/** Firebase compiles the file without releasing it. [] when it is fine. */
async function problems(file, text) {
  const out = await api(`${RULES_API}/projects/${PROJECT}:test`, { method: 'POST', body: { source: { files: [{ name: file, content: text }] } } })
  return (out.issues ?? []).filter((i) => i.severity === 'ERROR').map((i) => `${file}:${i.sourcePosition?.line ?? '?'} ${i.description}`)
}

async function release(name, file, text) {
  const set = await api(`${RULES_API}/projects/${PROJECT}/rulesets`, { method: 'POST', body: { source: { files: [{ name: file, content: text }] } } })
  const full = `projects/${PROJECT}/releases/${name}`
  if (await api(`${RULES_API}/${full}`, { missingOk: true })) {
    await api(`${RULES_API}/${full}`, { method: 'PATCH', body: { release: { name: full, rulesetName: set.name } } })
  } else {
    await api(`${RULES_API}/projects/${PROJECT}/releases`, { method: 'POST', body: { name: full, rulesetName: set.name } })
  }
  if ((await live(name))?.text !== text) throw new Error(`${name}: 올린 뒤 다시 읽었더니 ${file} 파일과 달라요`)
}

const day = (iso) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '')   // 2026.02.14
let waiting = 0   // rules that differ and were not released (no --apply)

/** One rules file against the releases it belongs to ([] = nowhere to release it: compile only). */
async function rules(label, file, releases, nowhere) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const bad = await problems(file, text)
  if (bad.length) fail(`${file} 파일이 규칙 문법에 맞지 않아요\n  ${bad.join('\n  ')}`)
  if (!releases.length) return say(`${label}: ${nowhere} (${file} 파일의 문법은 맞아요)`)
  for (const name of releases) {
    const now = await live(name)
    if (now?.text === text) {
      say(`${label}: 운영 규칙이 ${file} 파일과 같아요 (${day(now.at)}에 올린 것)`)
    } else if (!APPLY) {
      waiting++
      say(`${label}: 운영 규칙이 ${file} 파일과 달라요${now ? ` (운영은 ${day(now.at)}에 올린 것)` : ' (아직 올린 적이 없어요)'}`)
    } else {
      await release(name, file, text)
      say(`${label}: ${file} 파일을 올렸어요 (${name})`)
    }
  }
}

try {
  say(`프로젝트 ${PROJECT}${APPLY ? '' : ' · 비교만 해요 (올리려면 --apply)'}`)
  await rules('Firestore 규칙', 'firestore.rules', ['cloud.firestore'])

  const buckets = (await api(`https://storage.googleapis.com/storage/v1/b?project=${PROJECT}&fields=items(name)`)).items ?? []
  await rules('Storage 규칙', 'storage.rules', buckets.map((b) => `firebase.storage/${b.name}`), 'Storage 버킷이 없어서 올릴 곳이 없어요')

  const lists = await Promise.all(['v1', 'v2'].map((version) =>
    api(`https://cloudfunctions.googleapis.com/${version}/projects/${PROJECT}/locations/-/functions`)))
  const names = [...new Set(lists.flatMap((list) => (list.functions ?? []).map((f) => f.name.split('/').pop())))]
  say(names.length
    ? `Functions: ${names.length}개가 배포돼 있어요 (${names.join(', ')}). 이 스크립트는 함수를 올리지 않아요: cd functions && npm run deploy`
    : 'Functions: 배포된 함수가 없어요 (Spark 요금제에서는 올릴 수 없어요)')
} catch (e) {
  fail(e instanceof Error ? e.message : String(e))
}
if (waiting) {
  say(`다른 곳이 ${waiting}군데 있어요. node scripts/deploy-firebase.mjs --apply 로 올려요`)
  process.exit(1)
}
say(APPLY ? '끝났어요. 운영 규칙이 이 폴더와 같아요' : '운영이 이 폴더와 같아요')
