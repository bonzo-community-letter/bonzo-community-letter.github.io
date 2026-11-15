# Open letter — project skeleton

Structure and plumbing for the open letter to Hedera, the HBAR Foundation, Supra Labs and the Bonzo
Finance Foundation, with signatures collected on the **Hedera Consensus Service (HCS)**.

**Status: scaffold.** The letter text, the page layout and the visual design are deliberately not
defined yet. What exists is the skeleton that makes those things buildable, testable locally, and
deployable.

## What the hosting choice forces

GitHub Pages serves static files only — no server, no runtime, no secrets. Everything below follows
from that:

- **Signing has no backend.** Each signer submits their own HCS message from their own wallet and pays
  their own fee (~0.0001 HBAR). There is no sponsor wallet and no key on the page.
- **Reading signatures has no backend.** The page reads the topic from Hedera's public mirror node over
  REST: one `GET`, no key, CORS-enabled.
- **Verification needs nothing from us.** A signature is canonical JSON containing the SHA-256 of the
  letter text, so anyone can re-read the topic and check it independently.
- **No secrets in the build.** Everything configured ends up in the client bundle, by design.

## Layout

```
.
├── .github/workflows/
│   ├── ci.yml                 PR + branch pushes: typecheck, test, build, upload dist
│   └── deploy.yml             merge to main: same checks, then deploy-pages
├── src/
│   ├── main.tsx               React entry
│   ├── App.tsx                scaffold shell — renders runtime/config state only
│   ├── config.ts              env parsing; `signingOpen` gate
│   ├── content/
│   │   └── letter.ts          ← the letter text goes here (currently empty)
│   ├── lib/
│   │   ├── hcs.ts             payload contract, mirror-node reader, parsers
│   │   └── hcs.test.ts        unit tests for the contract (8 tests)
│   ├── hooks/
│   │   └── useSignatures.ts   reads the topic, refreshes every 60 s
│   └── styles.css             Tailwind import only — no design tokens yet
├── index.html
├── vite.config.ts             base: '/open-letter/' (Pages project page)
├── vitest.config.ts
├── tsconfig.json
└── .env.example               public config, copy to .env.local
```

Not created yet, on purpose: `src/sections/` (page sections), a design system / tokens file, the
wallet-connection module, a topic-creation script. Add them when the content and design exist.

## Local development

```bash
npm ci
cp .env.example .env.local     # optional — without it the page reports signing as closed
npm run dev                    # http://localhost:5173/open-letter/
```

| command | what it does |
|---|---|
| `npm run dev` | dev server with HMR |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm test` | unit tests for the HCS contract |
| `npm run build` | typecheck + production build into `dist/` |
| `npm run preview` | serves the **built** site at `/open-letter/` — check asset paths here, not in dev |

`base` in `vite.config.ts` is `/open-letter/` because this is a GitHub Pages *project* page. A custom
domain means changing it to `/`.

## Configuration

All public. Never a Hedera private key or account secret — the page has no way to use one.

| variable | meaning |
|---|---|
| `VITE_HEDERA_NETWORK` | `mainnet` or `testnet` (default `testnet`) |
| `VITE_HCS_TOPIC_ID` | signature topic. Empty ⇒ signing closed, no messages read |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project id for the wallet handshake |
| `VITE_CONTACT_URL` | optional footer link |

Deployed builds read these from **repository variables** (Settings → Secrets and variables → Actions →
Variables), wired in `deploy.yml`.

## Deployment

- Every PR: `ci.yml` → install, typecheck, test, build, `dist` uploaded as a run artifact (reviewable
  before merge, nothing deployed).
- Every merge to `main`: `deploy.yml` → same checks, then `actions/deploy-pages`.

**One-time setup, repo admin:** Settings → Pages → Source: **GitHub Actions**. Without it the deploy
job fails with "Pages is not enabled". A deploy key cannot do this.

## The signature contract (implemented)

`src/lib/hcs.ts` defines it; `hcs.test.ts` pins it down. A message is canonical JSON — sorted keys, no
whitespace, under HCS's 1 KB cap:

```json
{
  "v": 1,
  "kind": "open-letter-signature",
  "letter": "bonzo-recovery-2026-11",
  "hash": "<sha-256 of the letter text>",
  "account": "0.0.1234",
  "ts": "2026-11-15T18:00:00.000Z"
}
```

The reader keeps only messages whose `kind`, `letter` and `hash` match the current text — anything else
on the topic (older drafts, junk) is ignored. Changing one word of the letter invalidates every
signature, which is the point of the hash.

## Still open

Content, layout, visual design, the wallet handshake, topic creation, and the awareness campaign. None
of them are started here.
