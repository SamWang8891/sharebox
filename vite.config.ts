import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cloudflarePages from '@hono/vite-cloudflare-pages'

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      plugins: [
        cloudflarePages({
          entry: './functions/api/[[route]].ts',
        }),
        react(),
      ],
      server: {
        port: 5173,
      },
    }
  }

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: './index.html',
        },
      },
    },
  }
})
