import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './lib/cors.js'

/**
 * In-app desktop installer download for a PRIVATE source repo.
 *
 * Release assets on a private GitHub repo are not publicly downloadable, so the app can't
 * link straight to GitHub. This endpoint authenticates with a server-side token
 * (RELEASE_GH_TOKEN, never exposed to the client), finds the latest release's installer,
 * and 302-redirects the browser to GitHub's short-lived signed asset URL — the large
 * binary streams straight from storage, never through this function (Vercel size/time
 * limits stay clear). `?info=1` returns the version/name/size instead of redirecting.
 *
 * Publishing side: .github/workflows/release-desktop.yml builds the (unsigned) installer
 * on a Windows runner and publishes it to the private repo's Releases.
 */
const REPO = process.env.RELEASE_REPO || 'hersouls/moonwave-memo-v1'
const GH_API = 'https://api.github.com'

interface Asset {
  name: string
  url: string
  size: number
}
interface Release {
  tag_name: string
  name: string
  published_at: string
  assets: Asset[]
}

/** Match the installer asset for a platform (Windows .exe is the only one built today). */
function pickAsset(assets: Asset[], platform: string): Asset | undefined {
  const matchers: Record<string, RegExp> = {
    win: /\.exe$/i,
    mac: /\.dmg$/i,
    linux: /\.appimage$/i,
  }
  const re = matchers[platform] ?? matchers.win
  return assets.find((a) => re.test(a.name))
}

function firstQuery(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.RELEASE_GH_TOKEN
  if (!token) {
    return res.status(503).json({ error: '데스크톱 다운로드가 아직 설정되지 않았습니다 (RELEASE_GH_TOKEN 미설정).' })
  }

  const platform = (firstQuery(req.query.platform) || 'win').toLowerCase()
  const wantInfo = req.query.info != null

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'moonwave-memo',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  try {
    const relRes = await fetch(`${GH_API}/repos/${REPO}/releases/latest`, { headers: ghHeaders })
    if (relRes.status === 404) {
      return res.status(404).json({ error: '아직 발행된 데스크톱 릴리스가 없습니다.' })
    }
    if (!relRes.ok) {
      return res.status(502).json({ error: `GitHub 릴리스 조회 실패 (${relRes.status}).` })
    }
    const release = (await relRes.json()) as Release
    const asset = pickAsset(release.assets || [], platform)
    if (!asset) {
      return res.status(404).json({ error: `최신 릴리스에 '${platform}' 설치본이 없습니다.` })
    }

    if (wantInfo) {
      res.setHeader('Cache-Control', 'public, max-age=300')
      return res.status(200).json({
        version: release.tag_name,
        name: asset.name,
        size: asset.size,
        publishedAt: release.published_at,
        platform,
      })
    }

    // Resolve the private asset to its short-lived signed URL and redirect the browser
    // there (Accept: octet-stream makes GitHub answer with a 302 to signed storage).
    const assetRes = await fetch(asset.url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream', 'User-Agent': 'moonwave-memo' },
      redirect: 'manual',
    })
    const location = assetRes.headers.get('location')
    if (assetRes.status >= 300 && assetRes.status < 400 && location) {
      res.setHeader('Cache-Control', 'no-store')
      return res.redirect(302, location)
    }
    return res.status(502).json({ error: `설치본 자산 응답이 예상과 다릅니다 (${assetRes.status}).` })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : '다운로드에 실패했습니다.' })
  }
}
