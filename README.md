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
├── build/
│   └── letter-hash.ts         Vite plugin: hashes src/content/letter.ts at build time
├── src/
│   ├── main.tsx               React entry
│   ├── App.tsx                scaffold shell — renders runtime/config state only
│   ├── config.ts              env parsing; `signingOpen` gate
│   ├── content/
│   │   └── letter.ts          ← the letter text goes here (currently empty)
│   ├── lib/
│   │   ├── hcs.ts             payload contract, mirror-node reader, parsers
│   │   └── hcs.test.ts        unit tests for the contract (17 tests)
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

### Seeing it from another device (tailnet)

`npm run dev` listens on loopback only. To open it from a phone or another machine on the same tailnet:

```bash
npm run dev:tailnet
```

That binds Vite to this machine's Tailscale address (not `0.0.0.0`, so the LAN cannot reach it) and
allows the MagicDNS hostname as a `Host` header. It prints the URL, typically
`http://<host>.<tailnet>.ts.net:5173/open-letter/`.

The underlying knobs, if you need them by hand:

| variable | purpose |
|---|---|
| `DEV_BIND_HOST` | interface to listen on (default `127.0.0.1`) |
| `PUBLIC_DEV_HOST` | hostname clients use — Vite blocks unknown `Host` headers without it |
| `PUBLIC_DEV_PROXY` | `1` when TLS terminates in front of Vite (e.g. `tailscale serve`) → HMR switches to `wss:443` |

For HTTPS on port 443 instead of `http://host:5173`, `tailscale serve` is the better tool, but it needs
operator rights once (`sudo tailscale set --operator=$USER`); then run with `PUBLIC_DEV_PROXY=1`.

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

Modelled on what Bonzo actually submitted for the recovery portal's terms — verified by reading
[their topic](https://hashscan.io/mainnet/topic/0.0.10955904/messages) through the mirror node:

```
{"app":"Bonzo Finance","accountId":"0.0.6754749","agreement":"redemption-waiver",
 "version":1,"termsHash":"4ad02fc0…ab85","signedAt":"2026-11-12T15:29:24.484Z"}     210 bytes
```

That topic has `admin_key: null` and `submit_key: null`: anyone can submit, nobody can censor or delete.
Ours mirrors that shape, with a comment field added:

```json
{"accountId":"0.0.1234","agreement":"bonzo-recovery-letter","app":"open-letter",
 "comment":"optional","letterHash":"<sha-256 of the letter>","letterId":"bonzo-recovery-2026-11",
 "signedAt":"2026-11-15T18:00:00.000Z","version":1}
```

- **The message carries the hash, never the letter.** Same primitive as the portal's `termsHash`, and
  small enough that one message always fits.
- **Canonical JSON** — keys sorted, no whitespace — so the bytes are reproducible.
- **Optional comment**, trimmed, max `MAX_COMMENT_BYTES` (512) UTF-8 bytes, no control characters other
  than newlines. `buildSignature()` returns the byte count and refuses anything that would exceed HCS's
  1 KB cap, so a wallet is never asked to sign a message that cannot be submitted.
- **Reader filters** on `app`, `agreement`, `version`, `letterId` and `letterHash`, so older drafts and
  foreign messages on the same topic are ignored.

Topic memo convention, mirroring `bonzo:redemption-waiver:v1:<hash>`:

```
open-letter:bonzo-recovery-letter:v1:<letterHash>
```

### The hash is computed at build time

`build/letter-hash.ts` is a Vite plugin: it bundles `src/content/letter.ts` with esbuild, imports it,
and exposes a virtual module (`virtual:letter`) with the text, its id, its byte length and its SHA-256.
There is **no runtime hashing path**, so the hash the page displays and the hash a wallet signs cannot
diverge. Editing the text and rebuilding changes the hash, which invalidates every existing signature by
design — the check is `git diff` on one file.

The plugin warns at build time when the text is empty, because the hash of an empty string would make
every signature meaningless. Signing must stay closed until the text exists.

## Still open

Content, layout, visual design, the wallet handshake, topic creation, and the awareness campaign. None
of them are started here.

One decision belongs to the visual/content phase but has a technical edge: **comments are permanent and
public**. HCS messages cannot be edited or deleted, so the page needs a policy for displaying them
(unmoderated, filtered, or shown only to the signer) before the signing UI goes live.
