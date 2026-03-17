import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'
import fs from 'fs'

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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    swVersionPlugin(),
    compression({ algorithm: 'gzip', exclude: [/\.(br)$/], threshold: 1024 }),
    compression({ algorithm: 'brotliCompress', exclude: [/\.(gz)$/], threshold: 1024 }),
    // Sentry source map upload (only when auth token is available)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
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
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-ui': ['lucide-react', '@headlessui/react'],
          'vendor-data': ['zustand', 'dexie', 'dexie-react-hooks', 'date-fns', 'fuse.js'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'remark-breaks', 'rehype-raw', 'rehype-highlight'],
          'vendor-d3': ['d3-force', 'd3-selection'],
          'vendor-media': ['html-to-image', 'canvas-confetti'],
          'vendor-diff': ['diff'],
          'vendor-tiptap': ['@tiptap/react', '@tiptap/starter-kit', 'tiptap-markdown'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-highlight': ['highlight.js', 'lowlight'],
        },
      },
    },
  },
})
