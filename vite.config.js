import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// relative base so the build works on GitHub Pages under /<repo>/
export default defineConfig({
  base: './',
  plugins: [react()],
})
