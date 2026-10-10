import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

function swVersionPlugin(): Plugin {
  return {
    name: 'sw-version-inject',
    writeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js')
      if (!fs.existsSync(swPath)) return

      const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
      const version = `${pkg.version}-${Date.now()}`

      let content = fs.readFileSync(swPath, 'utf-8')
      content = content.replace('__SW_VERSION__', version)
      fs.writeFileSync(swPath, content, 'utf-8')
    },
  }
}

/**
 * dist/version.json = which commit this build is. scripts/deploy.sh polls the live copy to
 * know the push has really reached production (also after a CI-gated promote), instead of
 * guessing from a timer. Vercel sets VERCEL_GIT_COMMIT_SHA; locally it falls back to git.
 */
function buildVersionPlugin(): Plugin {
  return {
    name: 'build-version',
    writeBundle() {
      let sha = process.env.VERCEL_GIT_COMMIT_SHA || ''
      if (!sha) {
        try { sha = execSync('git rev-parse HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { sha = 'unknown' }
      }
      const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
      fs.writeFileSync(path.resolve(__dirname, 'dist/version.json'), JSON.stringify({ sha, version: pkg.version, builtAt: new Date().toISOString() }) + '\n', 'utf-8')
    },
  }
}

// 설정 화면의 '버전'에 보이는 값이에요 (package.json의 version)
const appVersion: string = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [
    react(),
    tailwindcss(),
    swVersionPlugin(),
    buildVersionPlugin(),
    compression({ algorithm: 'gzip', exclude: [/\.(br)$/], threshold: 1024 }),
    compression({ algorithm: 'brotliCompress', exclude: [/\.(gz)$/], threshold: 1024 }),
    // Sentry source map upload (only when auth token is available)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          // Upload, then remove the maps so they are never served publicly.
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        })]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    // Public source maps exposed the full source; build them only for the Sentry upload
    // ('hidden' = no sourceMappingURL comment), and the plugin deletes them afterwards.
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
    // CSP script-src 'self': 인라인 preload 폴리필을 넣지 않아요
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-ui': ['@headlessui/react'],
          'vendor-data': ['zustand', 'dexie', 'dexie-react-hooks', 'date-fns', 'fuse.js'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'remark-breaks', 'rehype-raw', 'rehype-highlight'],
          'vendor-d3': ['d3-force', 'd3-selection'],
          'vendor-media': ['html-to-image'],
          'vendor-diff': ['diff'],
          'vendor-tiptap': ['@tiptap/react', '@tiptap/starter-kit', 'tiptap-markdown'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-highlight': ['highlight.js', 'lowlight'],
        },
      },
    },
  },
})
