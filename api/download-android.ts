import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './_lib/cors.js'

/**
 * Download of the Android app: the signed APK on the rolling GitHub release "android".
 *
 * The file is named <service>_v<versionName>_<the day it was built, YYMMDD>.apk (Moonwave UX,
 * build/build-frontend#apk), so its name changes with every build and is written into no
 * screen and no route. The build leaves a record beside the file (android.json: versionName,
 * versionCode, builtAt, sizeBytes, file) and this route follows it: it reads the record and
 * 302-redirects the browser to the file the record names. The APK streams straight from
 * GitHub, never through this function, and is saved under its own name. `?info=1` answers
 * the record instead of redirecting (what the settings screen shows beside the button).
 *
 * No login: the file is public where it is kept, and this route only says which one it is.
 * The record is remembered for a minute per instance, so a run of calls asks GitHub once.
 *
 * Publishing side: scripts/build-android.sh --publish (nightly, from origin/master).
 */
const REPO = process.env.RELEASE_REPO || 'hersouls/moonwave-memo-v1'
const BASE = `https://github.com/${REPO}/releases/download/android`
const RECORD_TTL_MS = 60_000
// a file name and nothing else: the redirect never leaves the release
const APK_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.apk$/

interface AndroidRecord {
  versionName: string
  versionCode: number
  builtAt: string
  sizeBytes: number
  file: string
}

let kept: { record: AndroidRecord; at: number } | null = null
let keptHistory: { list: AndroidRecord[]; at: number } | null = null

/** Forget the remembered record (tests). */
export function clearRecordMemory(): void {
  kept = null
  keptHistory = null
}

class RecordError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function readRecord(): Promise<AndroidRecord> {
  const now = Date.now()
  if (kept && now - kept.at < RECORD_TTL_MS) return kept.record

  let upstream: Response
  try {
    upstream = await fetch(`${BASE}/android.json`, { signal: AbortSignal.timeout(8000) })
  } catch {
    throw new RecordError(502, 'Android 앱 정보를 읽지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
  }
  if (upstream.status === 404) throw new RecordError(404, '아직 올라온 Android 앱이 없어요.')
  if (!upstream.ok) throw new RecordError(502, 'Android 앱 정보를 읽지 못했어요. 잠시 뒤에 다시 시도해 주세요.')

  const data = (await upstream.json().catch(() => null)) as Partial<AndroidRecord> | null
  // the record may name the file with a path (/app/…): what is kept on the release is its last part
  const file = typeof data?.file === 'string' ? data.file.split('/').pop() ?? '' : ''
  if (!data || !APK_FILE.test(file)) throw new RecordError(502, 'Android 앱의 기록에 파일 이름이 없어요.')

  const record: AndroidRecord = {
    versionName: String(data.versionName ?? ''),
    versionCode: Number(data.versionCode) || 0,
    builtAt: String(data.builtAt ?? ''),
    sizeBytes: Number(data.sizeBytes) || 0,
    file,
  }
  kept = { record, at: now }
  return record
}

function toRecord(data: Partial<AndroidRecord> & { notes?: unknown }): (AndroidRecord & { notes?: string }) | null {
  const file = typeof data.file === 'string' ? data.file.split('/').pop() ?? '' : ''
  if (!APK_FILE.test(file)) return null
  return {
    versionName: String(data.versionName ?? ''),
    versionCode: Number(data.versionCode) || 0,
    builtAt: String(data.builtAt ?? ''),
    sizeBytes: Number(data.sizeBytes) || 0,
    file,
    ...(typeof data.notes === 'string' && data.notes ? { notes: data.notes } : {}),
  }
}

/** history.json on the release: every build so far, newest first. Missing or unreadable → just no history. */
async function readHistory(): Promise<AndroidRecord[]> {
  const now = Date.now()
  if (keptHistory && now - keptHistory.at < RECORD_TTL_MS) return keptHistory.list
  let list: AndroidRecord[] = []
  try {
    const upstream = await fetch(`${BASE}/history.json`, { signal: AbortSignal.timeout(8000) })
    if (upstream.ok) {
      const data = (await upstream.json().catch(() => null)) as unknown
      if (Array.isArray(data)) list = data.map((d) => toRecord(d as Partial<AndroidRecord>)).filter((d): d is AndroidRecord => d != null)
    }
  } catch {
    list = []
  }
  keptHistory = { list, at: now }
  return list
}

/** The kit's AppInstall reads version.json / history.json whose `file` is where the screen links to: this route, by name. */
const viaRoute = <T extends AndroidRecord>(r: T): T => ({ ...r, file: `/api/download-android?file=${encodeURIComponent(r.file)}` })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const file = typeof req.query.file === 'string' ? req.query.file : ''
    if (file) {
      // an earlier build kept on the release: a bare file name, nothing else
      if (!APK_FILE.test(file)) return res.status(400).json({ error: '파일 이름이 맞지 않아요.' })
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Location', `${BASE}/${encodeURIComponent(file)}`)
      return res.status(302).end()
    }
    const record = await readRecord()
    if (req.query.doc === 'version') {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(viaRoute(record))
    }
    if (req.query.doc === 'history') {
      const list = await readHistory()
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json((list.some((h) => h.versionCode === record.versionCode) ? list : [record, ...list]).map(viaRoute))
    }
    if (req.query.info != null) {
      res.setHeader('Cache-Control', 'public, max-age=300')
      return res.status(200).json(record)
    }
    // never kept by a cache: the next build replaces the file this points to
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Location', `${BASE}/${encodeURIComponent(record.file)}`)
    return res.status(302).end()
  } catch (err) {
    const known = err instanceof RecordError
    return res.status(known ? err.status : 502).json({ error: known ? err.message : 'Android 앱을 내려받지 못했어요. 잠시 뒤에 다시 시도해 주세요.' })
  }
}
