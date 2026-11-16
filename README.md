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

## The page

First layout, in `src/components/`:

- `Hero.tsx` — title, standfirst, and the four addressees. The hero carries the height that the letter
  sheet overlaps into.
- `LetterSheet.tsx` — the letter as a page of paper (second sheet behind it for depth), with a real
  letterhead: from / date, to, subject, salutation, then the body. The body renders whatever is in
  `src/content/letter.ts`, split on blank lines; while that is empty it shows a placeholder.
- `EnvelopeSvg.tsx` — the envelope as one drawing, animated by a single value. Sealed and open are
  the same geometry: the flap's tip sits 223 units below the fold when shut and 223 above it when
  open, so mirroring the flap about the fold is the whole difference. What cross-fades is only what
  the flap hides — the outside surface gives way to the dark inside, and the paper face of the flap
  gives way to its shadowed back.
- `EnvelopeOverlay.tsx` — places that drawing, in two layers with the letter between them: the standing
  flap at `z-10`, the sheet at `z-20`, the body and its flaps at `z-30`. So the letter rises in front of
  the flap and behind the pocket — it is never drawn as SVG. Everything is scroll-driven, not
  time-driven: the reveal takes 240 px, the drift out 700 px, and both start together. Where the letter
  starts is measured against the envelope in the DOM rather than derived from the viewport, so it lands
  correctly whichever height the browser reports. Below `sm` there is no room to watch an envelope open,
  so it starts open and scrolling only carries it away. With `prefers-reduced-motion: reduce` it is
  drawn open, without scroll coupling.
- The envelope's layers are `100lvh` tall, not `100vh`: iOS Safari resolves `100vh` to the *visible*
  height, so with the address bar showing the envelope ended at the bar and the letter showed through
  it. `.envelope-layer` in `styles.css` carries that, and `LetterSheet` re-places the paper when
  `visualViewport` resizes, because the bar moves the fold without firing a window resize.
- `DevStatus.tsx` — build facts and the payload a signer would submit, collapsed at the bottom. Not for
  readers.
- `src/content/page.ts` — all page copy except the letter itself (title, subtitle, letterhead labels).
  Changing it cannot invalidate signatures; changing `letter.ts` does.

**Colour: dark page, light letter.** The page background is `#14110e` on purpose — the letter is the only
bright surface, so it reads as the content rather than as a card on a website. The sheet therefore has its
own ink tokens (`--color-sheet-ink`, `-soft`, `-faint`, `--color-sheet-rule`) and never inherits page
colours; changing the page theme cannot wash out the letter. Contrast measured on both surfaces: page ink
16.4:1, soft 9.0:1, faint 5.5:1; sheet ink 18.2:1, sheet faint 5.8:1 — all AA, most AAA. One accent
(`#d97a5a`, warm terracotta) is reserved for links and selection.

### Logos and trademarks

**No third-party logo file is committed.** Using another company's mark is not automatically unlawful —
nominative use to name who a letter is addressed to is ordinary — but it sits under each brand's
guidelines and can read as endorsement, which an open letter must avoid. Until permission exists (or each
brand's asset rules are checked), the hero's **To** block simply names the addressees in the letter's own
serif. No mark, no corporate typeface.

To switch to real marks, set `logoSrc` per entry in `src/content/addressees.ts` to a file under
`public/logos/` **after**:

1. checking that brand's guidelines for third-party use, or getting written permission;
2. confirming monochrome / single-colour use is allowed, and that the mark is unmodified with clear
   space respected;
3. making sure nothing on the page implies endorsement, partnership or approval;
4. keeping a note in the commit message of which guideline or permission covers each mark.

`Hero.tsx` already renders `logoSrc` when present (`grayscale`, 70 % opacity, fixed height), so switching
is a content change, not a code change.

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
│   │   └── letter.ts          ← SUBJECT + the letter text (text currently empty)
│   ├── lib/
│   │   ├── hcs.ts             payload contract, mirror-node reader, parsers
│   │   └── hcs.test.ts        unit tests for the contract (18 tests)
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
Ours keeps the parts that carry meaning for an open letter — the account, the hash, the timestamp — and
drops the parts that do not (`app`, `agreement`, a date-versioned letter id):

```json
{"accountId":"0.0.1234","subject":"bonzo-exploit-open-letter","version":1,
 "letterHash":"<sha-256 of the letter>","signedAt":"2026-11-15T18:00:00.000Z","comment":""}
```

- **The message carries the hash, never the letter.** Same primitive as the portal's `termsHash`, and
  small enough that one message always fits.
- **`subject`** is the campaign slug, constant for the whole campaign; **`letterHash`** pins the exact
  version of the text. Both come from the build.
- **Fixed field order** — `accountId`, `subject`, `version`, `letterHash`, `signedAt`, `comment` — and no
  whitespace, so the bytes are reproducible. `FIELD_ORDER` in `src/lib/hcs.ts` is the single definition,
  and a test asserts the exact string.
- **`comment` is always present**, empty string when the signer writes nothing. Max
  `MAX_COMMENT_BYTES` (512) UTF-8 bytes, trimmed, no control characters other than newlines.
  `buildSignature()` returns the byte count and refuses anything that would exceed HCS's 1 KB cap, so a
  wallet is never asked to sign a message that cannot be submitted.
- **Reader filters** on `version`, `subject` and `letterHash`, so older drafts and foreign messages on
  the same topic are ignored.

Topic memo convention: `<subject>:v<version>:<letterHash>`, e.g.

```
bonzo-exploit-open-letter:v1:<letterHash>
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

**Decided:** comments are shown in full, from everyone, uncensored. Two consequences to build for:

- Comments are permanent and public — HCS has no edit or delete — so the signing UI must say so plainly
  before a wallet is asked to sign.
- Render comments as **text, never HTML**: they are arbitrary strings from strangers on a page we
  control. Length is already capped at 512 bytes by the payload rules.
