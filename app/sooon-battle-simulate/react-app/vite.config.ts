import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/app/sooon-battle-simulate/dist/',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
