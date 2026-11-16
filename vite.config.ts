/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Solo en desarrollo: reenvía /supabase al stack local, para poder abrir la app
    // desde otro dispositivo o una vista previa sin exponer Supabase directamente.
    proxy: {
      '/supabase': {
        target: 'http://127.0.0.1:54321',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/supabase/, ''),
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
