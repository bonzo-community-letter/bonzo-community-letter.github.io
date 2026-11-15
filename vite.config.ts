import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Optional network exposure for the dev server. All unset by default, so the
// repo stays portable and nothing about one machine's network lives in the code.
//
//   DEV_BIND_HOST     interface to listen on (default 127.0.0.1)
//   PUBLIC_DEV_HOST   hostname clients use, e.g. my-host.tailnet.ts.net
//                     (Vite blocks unknown Host headers; this allows it)
//   PUBLIC_DEV_PROXY  "1" when something terminates TLS in front of Vite
//                     (e.g. `tailscale serve`) → HMR must use wss:443
const devBindHost = process.env.DEV_BIND_HOST?.trim() || '127.0.0.1'
const publicDevHost = process.env.PUBLIC_DEV_HOST?.trim() || undefined
const proxied = process.env.PUBLIC_DEV_PROXY === '1'

const allowedHosts = publicDevHost ? [publicDevHost] : []
const hmr =
  proxied && publicDevHost
    ? { host: publicDevHost, protocol: 'wss' as const, clientPort: 443 }
    : undefined

// GitHub Pages project site: https://<owner>.github.io/open-letter/
// `base` must match the repository name, otherwise every asset 404s in production.
// For a custom domain (letter.example.org), set base to '/' — see README.
export default defineConfig({
  base: '/open-letter/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    host: devBindHost,
    port: 5173,
    strictPort: true,
    allowedHosts,
    hmr,
  },
  preview: {
    host: devBindHost,
    port: 4173,
    strictPort: true,
    allowedHosts,
  },
})
