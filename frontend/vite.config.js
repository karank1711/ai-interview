import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from './tailwind.config.js'

function isLoopbackApiUrl(raw) {
  try {
    const host = new URL(String(raw || '').trim()).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const stripLoopbackFromProd = mode === 'production' && isLoopbackApiUrl(env.VITE_API_URL)

  return {
  plugins: [react()],
  define: stripLoopbackFromProd
    ? { 'import.meta.env.VITE_API_URL': JSON.stringify('') }
    : undefined,
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss(tailwindConfig),
        autoprefixer(),
      ],
    },
  },
  }
})
