import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages project site: https://bonzo-recovery-letter.github.io/open-letter/
// `base` must match the repository name, otherwise every asset 404s in production.
// For a custom domain (letter.example.org), set base to '/' — see README.
export default defineConfig({
  base: '/open-letter/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
