import type { BackupFile } from './backup'

// Configuration from environment variables
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string

// Validate credentials at module load
if (!CLIENT_ID || !API_KEY) {
    console.error('Google API 자격증명이 설정되지 않았습니다. .env.local 파일을 확인하세요.')
}

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

// Timeouts
const SCRIPT_LOAD_TIMEOUT = 10000  // 10 seconds
const AUTH_TIMEOUT = 120000        // 2 minutes

// Global gapi and google types
declare global {
    interface Window {
        gapi: any
        google: any
    }
}

// Initialization state management
type InitState = 'idle' | 'loading' | 'ready' | 'failed'
let initState: InitState = 'idle'
let initPromise: Promise<void> | null = null
let lastError: string | null = null
let tokenClient: any = null

/**
 * Retry wrapper for API calls with exponential backoff
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000
): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            if (attempt === maxRetries) throw error
            await new Promise(r => setTimeout(r, delayMs * attempt))
        }
    }
    throw new Error('재시도 횟수 초과')
}

/**
 * Load an external script with error handling and timeout
 */
async function loadScript(src: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // Prevent duplicate loading
        if (document.getElementById(id)) {
            resolve()
            return
        }

        const script = document.createElement('script')
        script.id = id
        script.src = src
        script.async = true

        const timeout = setTimeout(() => {
            reject(new Error(`스크립트 로딩 시간 초과: ${src}`))
        }, SCRIPT_LOAD_TIMEOUT)

        script.onload = () => {
            clearTimeout(timeout)
            resolve()
        }

        script.onerror = () => {
            clearTimeout(timeout)
            reject(new Error(`스크립트 로딩 실패: ${src}`))
        }

        document.body.appendChild(script)
    })
}

/**
 * Internal initialization logic
 */
async function doInitialize(): Promise<void> {
    // Validate credentials before initialization
    if (!CLIENT_ID || !API_KEY) {
        throw new Error('Google API 자격증명이 설정되지 않았습니다. 환경변수를 확인하세요.')
    }

    // Load both Google scripts in parallel
    await Promise.all([
        loadScript('https://apis.google.com/js/api.js', 'google-api-script'),
        loadScript('https://accounts.google.com/gsi/client', 'google-gsi-script')
    ])

    // Verify gapi loaded
    if (!window.gapi) {
        throw new Error('Google API 라이브러리를 로드하지 못했습니다.')
    }

    return new Promise((resolve, reject) => {
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                })

                // Verify GIS loaded
                if (!window.google?.accounts?.oauth2?.initTokenClient) {
                    throw new Error('Google Identity Services를 로드하지 못했습니다.')
                }

                tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: () => {}, // placeholder, will be overwritten in handleAuthClick
                    use_fedcm_for_prompt: true, // Chrome 117+ FedCM 지원
                })

                // Verify tokenClient created
                if (!tokenClient) {
                    throw new Error('OAuth 클라이언트 생성에 실패했습니다.')
                }

                resolve()
            } catch (err) {
                reject(err)
            }
        })
    })
}

/**
 * Initialize Google API with mutex pattern to prevent race conditions
 */
export async function initializeGoogleApi(): Promise<void> {
    // Already ready - return immediately
    if (initState === 'ready' && tokenClient) {
        return
    }

    // Already loading - return existing promise (mutex)
    if (initState === 'loading' && initPromise) {
        return initPromise
    }

    // Start initialization
    initState = 'loading'
    initPromise = doInitialize()

    try {
        await initPromise
        initState = 'ready'
        lastError = null
    } catch (error) {
        initState = 'failed'
        lastError = error instanceof Error ? error.message : 'Google API 초기화 중 알 수 없는 오류'
        throw error
    } finally {
        initPromise = null
    }
}

/**
 * Handle OAuth authentication with defensive checks and timeout
 */
export async function handleAuthClick(): Promise<void> {
    // Auto-initialize if not ready
    if (initState !== 'ready') {
        await initializeGoogleApi()
    }

    // Critical: Verify tokenClient exists
    if (!tokenClient) {
        throw new Error('Google API가 초기화되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.')
    }

    if (!getToken()) {
        return new Promise((resolve, reject) => {
            // Add timeout for OAuth request
            const timeout = setTimeout(() => {
                reject(new Error('OAuth 요청 시간 초과. 다시 시도해주세요.'))
            }, AUTH_TIMEOUT)

            tokenClient.callback = (resp: any) => {
                clearTimeout(timeout)
                if (resp.error) {
                    reject(resp)
                    return
                }
                resolve()
            }
            tokenClient.error_callback = (err: any) => {
                clearTimeout(timeout)
                reject(err)
            }

            try {
                if (window.gapi?.client?.getToken() === null) {
                    tokenClient.requestAccessToken({ prompt: 'consent' })
                } else {
                    tokenClient.requestAccessToken({ prompt: '' })
                }
            } catch (err) {
                clearTimeout(timeout)
                reject(new Error('OAuth 요청을 시작하지 못했습니다.'))
            }
        })
    }
}

/**
 * Sign out and revoke token with defensive error handling
 */
export function handleSignoutClick() {
    try {
        const token = window.gapi?.client?.getToken()
        if (token?.access_token) {
            window.google?.accounts?.oauth2?.revoke(token.access_token, () => {
                console.log('Google 토큰이 해지되었습니다.')
            })
        }
        window.gapi?.client?.setToken(null)
    } catch (error) {
        console.error('로그아웃 중 오류:', error)
    }
}

/**
 * Get current OAuth token
 */
export function getToken() {
    return window.gapi?.client?.getToken()
}

/**
 * Check if Google API is ready to use
 */
export function isApiReady(): boolean {
    return initState === 'ready' && tokenClient !== null
}

/**
 * Get last initialization error message
 */
export function getLastError(): string | null {
    return lastError
}

/**
 * Get current initialization state
 */
export function getInitState(): InitState {
    return initState
}

/**
 * Check if credentials are configured
 */
export function isCredentialsConfigured(): boolean {
    return Boolean(CLIENT_ID && API_KEY)
}

/**
 * Upload backup to Google Drive with proper error handling
 */
export async function uploadBackupToDrive(
    backupData: BackupFile,
    filename: string = 'moonwave_backup.json'
): Promise<string> {
    // Check authentication
    const token = getToken()
    if (!token) {
        throw new Error('Google 드라이브에 연결되지 않았습니다. 다시 로그인해주세요.')
    }

    // Validate backup data
    if (!backupData || !backupData.version || !backupData.exportDate) {
        throw new Error('유효하지 않은 백업 데이터입니다.')
    }

    const fileContent = JSON.stringify(backupData)
    const file = new Blob([fileContent], { type: 'application/json' })
    const metadata = {
        name: filename,
        mimeType: 'application/json',
    }

    const accessToken = token.access_token
    if (!accessToken) {
        throw new Error('액세스 토큰이 없습니다. 다시 로그인해주세요.')
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', file)

    // Use retry wrapper for network resilience
    const response = await withRetry(async () => {
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form,
        })
        return res
    })

    // Check HTTP response status
    if (!response.ok) {
        let errorMessage = `업로드 실패 (${response.status})`
        try {
            const errorData = await response.json()
            if (errorData.error?.message) {
                errorMessage += `: ${errorData.error.message}`
            }
            // Handle specific error codes
            if (response.status === 401) {
                throw new Error('인증이 만료되었습니다. Google 드라이브를 다시 연결해주세요.')
            }
            if (response.status === 403) {
                throw new Error('Google 드라이브 접근 권한이 없습니다. 권한을 확인해주세요.')
            }
            if (response.status === 507) {
                throw new Error('Google 드라이브 저장 공간이 부족합니다.')
            }
        } catch (parseError) {
            // JSON parsing failed, use generic message
        }
        throw new Error(errorMessage)
    }

    // Parse response
    let data: any
    try {
        data = await response.json()
    } catch (parseError) {
        throw new Error('Google Drive 응답을 파싱하지 못했습니다.')
    }

    // Validate response contains file ID
    if (!data.id) {
        throw new Error('Google Drive 응답에 파일 ID가 없습니다.')
    }

    return data.id
}

/**
 * List backup files from Google Drive with error handling
 */
export async function listBackups() {
    // Check authentication
    if (!getToken()) {
        throw new Error('Google 드라이브에 연결되지 않았습니다.')
    }

    try {
        const response = await window.gapi.client.drive.files.list({
            pageSize: 10,
            fields: 'files(id, name, createdTime)',
            q: "name contains 'moonwave_backup' and trashed=false",
            orderBy: 'createdTime desc'
        })

        // Check for API errors
        if (response.error) {
            throw new Error(`Google Drive API 오류: ${response.error.message || '알 수 없는 오류'}`)
        }

        // Safe access with fallback to empty array
        if (!response.result?.files) {
            console.warn('Google Drive 백업 목록이 비어있습니다.')
            return []
        }

        return response.result.files
    } catch (error) {
        // Handle specific gapi errors
        if (error instanceof Error) {
            if (error.message.includes('401')) {
                throw new Error('인증이 만료되었습니다. Google 드라이브를 다시 연결해주세요.')
            }
            throw error
        }
        throw new Error('백업 목록을 가져오는데 실패했습니다.')
    }
}

/**
 * Download backup from Google Drive with validation
 */
export async function downloadBackupFromDrive(fileId: string): Promise<BackupFile> {
    // Validate fileId
    if (!fileId || typeof fileId !== 'string') {
        throw new Error('유효하지 않은 파일 ID입니다.')
    }

    // Check authentication
    if (!getToken()) {
        throw new Error('Google 드라이브에 연결되지 않았습니다.')
    }

    try {
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        })

        // Check for API errors
        if (response.error) {
            throw new Error(`Google Drive API 오류: ${response.error.message || '알 수 없는 오류'}`)
        }

        // Validate response exists
        if (!response.result) {
            throw new Error('Google Drive에서 파일을 가져오지 못했습니다.')
        }

        // Basic structure validation
        const data = response.result as BackupFile
        if (!data.version || !data.exportDate) {
            throw new Error('유효하지 않은 백업 파일 형식입니다. 파일이 손상되었을 수 있습니다.')
        }

        return data
    } catch (error) {
        // Handle specific gapi errors
        if (error instanceof Error) {
            if (error.message.includes('401')) {
                throw new Error('인증이 만료되었습니다. Google 드라이브를 다시 연결해주세요.')
            }
            if (error.message.includes('404')) {
                throw new Error('백업 파일을 찾을 수 없습니다. 삭제되었을 수 있습니다.')
            }
            throw error
        }
        throw new Error('백업 파일을 다운로드하는데 실패했습니다.')
    }
}

/**
 * 인앱 브라우저 감지
 */
export function isInAppBrowser(): boolean {
    const ua = navigator.userAgent.toLowerCase()
    return /kakaotalk|instagram|fbav|fban|line|naver|daum/i.test(ua)
}

/**
 * 외부 브라우저 안내 메시지
 */
export function getExternalBrowserGuide(): string {
    const ua = navigator.userAgent.toLowerCase()
    if (/kakaotalk/i.test(ua)) return '카카오톡 → 우측 상단 ⋮ → 다른 브라우저로 열기'
    if (/instagram/i.test(ua)) return '인스타그램 → 우측 상단 ⋮ → 브라우저에서 열기'
    if (/naver/i.test(ua)) return '네이버 앱 → 우측 하단 ⋮ → 외부 브라우저로 열기'
    return '외부 브라우저(Chrome/Safari)에서 열어주세요.'
}

/**
 * Redirect 모드 인증 (팝업 실패 시 폴백)
 */
export function handleAuthRedirect(): void {
    if (!CLIENT_ID) {
        throw new Error('Google API 자격증명이 설정되지 않았습니다.')
    }

    const redirectUri = `${window.location.origin}/oauth/callback`
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'token')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('include_granted_scopes', 'true')

    window.location.href = authUrl.toString()
}

/**
 * 팝업 실패 시 Redirect 모드 제안 여부
 */
export function shouldSuggestRedirectMode(error: any): boolean {
    const errorCode = String(error?.error || error?.message || '')
    return ['popup_closed', 'popup_blocked', 'origin'].some(
        keyword => errorCode.toLowerCase().includes(keyword)
    )
}
