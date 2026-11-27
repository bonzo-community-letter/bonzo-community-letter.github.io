import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { letterHashPlugin } from './build/letter-hash.ts'

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

// The site is published on a custom domain (bonzo-community-letter.com), served
// from the root — so `base` is '/' in production and CI sets VITE_BASE=/.
// Without a custom domain it would be a GitHub Pages project page, and base would
// have to match the repository name ('/open-letter/'), or every asset 404s.
const base = process.env.VITE_BASE?.trim() || '/open-letter/'

/**
 * The CSP lives in `index.html`, where it is visible and a test can read it. Vite's
 * dev server injects an inline module (React refresh) and talks to an HMR WebSocket,
 * neither of which exists in a production build — so dev gets the same policy with
 * exactly those two allowances added, and nothing else. The build is untouched.
 */
function devCsp(): Plugin {
  return {
    name: 'dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]+)(")/,
        (_match, open: string, policy: string, close: string) =>
          open +
          policy
            .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
            .replace("connect-src 'self'", "connect-src 'self' ws: http://localhost:* http://127.0.0.1:*") +
          close,
      )
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), letterHashPlugin(), devCsp()],
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
