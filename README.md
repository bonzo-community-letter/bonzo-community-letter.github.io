# Open letter — project skeleton

Structure and plumbing for the open letter to Hedera Foundation, Hedera Hashgraph, Hashgraph Foundry, Supra Labs, Entropy Foundation, Bonzo
Finance Foundation and Bonzo Finance Labs, with signatures collected on the **Hedera Consensus Service (HCS)**.

**Status: scaffold.** The letter text, the page layout and the visual design are deliberately not
defined yet. What exists is the skeleton that makes those things buildable, testable locally, and
deployable.

## What the hosting choice forces

GitHub Pages serves static files only — no server, no runtime, no secrets. Everything below follows
from that:

- **Signing has no backend.** Each signer submits their own HCS message from their own wallet and pays
  their own fee (~0.005 HBAR, measured on chain — see "What a signature costs"). There is no sponsor
  wallet and no key on the page.
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
- `NavBar.tsx` / `ConnectDialog.tsx` — the thin top bar and the wallet menu: HashPack, Kabila and
  WalletConnect. See *The wallet connection* below.
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
│   ├── config.ts              the network switch: NETWORKS table, topic per network
│   ├── content/
│   │   └── letter.ts          ← SUBJECT + the letter text (text currently empty)
│   ├── lib/
│   │   ├── hcs.ts             payload contract, mirror-node reader, parsers
│   │   ├── hcs.test.ts        unit tests for the contract (18 tests)
│   │   └── wallet.ts          HashPack / Kabila / WalletConnect, lazily loaded
│   ├── hooks/
│   │   ├── useSignatures.ts   reads the topic, refreshes every 60 s
│   │   └── useWallet.ts       session state for the Connect button
│   └── styles.css             design tokens (@theme) + envelope geometry
├── index.html
├── vite.config.ts             base: '/open-letter/' (Pages project page)
├── vitest.config.ts
├── tsconfig.json
└── .env.example               public config, copy to .env.local
```

Not created yet, on purpose: `src/sections/` (page sections), the signing UI, a topic-creation script.
Add them when the content and design exist.

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

`base` in `vite.config.ts` defaults to `/open-letter/` (the shape of a GitHub Pages *project* page) and
CI overrides it with `VITE_BASE=/`, because the site is published on a custom domain served from the
root: **https://bonzo-community-letter.com/**. To match production locally, put `VITE_BASE=/` in
`.env.local` — otherwise the dev server lives at `/open-letter/`.

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

**Wallets do not work over plain HTTP from a hostname.** `http://<host>.<tailnet>.ts.net:5173` is not a
secure context, so the browser withholds `crypto.subtle` and the WalletConnect handshake can never
complete — the dialog says so instead of hanging. `localhost`/`127.0.0.1` are secure contexts and do
work. To test a wallet from another device, put HTTPS in front (once, on the machine that runs Vite):

```bash
sudo tailscale serve --bg 5173              # https://<host>.<tailnet>.ts.net/ → 127.0.0.1:5173
PUBLIC_DEV_PROXY=1 npm run dev:tailnet      # binds loopback + HMR over wss:443
```

`tailscale serve` keeps serving after the command returns (`--bg`); `tailscale serve reset` removes it.
The deployed site is HTTPS on GitHub Pages, so this only bites during local testing.

## Configuration

All public. Never a Hedera private key or account secret — the page has no way to use one.

| variable | meaning |
|---|---|
| `VITE_HEDERA_NETWORK` | **the switch**: `mainnet` or `testnet` (default `mainnet`) |
| `VITE_HCS_TOPIC_ID_TESTNET` | signature topic on testnet. Empty ⇒ signing closed, no messages read |
| `VITE_HCS_TOPIC_ID_MAINNET` | signature topic on mainnet. Empty ⇒ signing closed, no messages read |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project id for the wallet handshake |
| `VITE_CONTACT_URL` | optional footer link |

Deployed builds read these from **repository variables** (Settings → Secrets and variables → Actions →
Variables), wired in `deploy.yml`. GitHub's UI refuses an empty value, so a variable that means "nothing"
(`VITE_HCS_TOPIC_ID_TESTNET` before the topic exists) gets a single space — `read()` in `config.ts`
trims, so it arrives as empty.

### Switching between testnet and mainnet

`VITE_HEDERA_NETWORK` is the whole switch. `src/config.ts` resolves it once into `NETWORKS`, and
everything downstream reads from that table:

| what | follows the switch |
|---|---|
| wallet session chain | `hedera:testnet` / `hedera:mainnet` — a wallet is asked for one chain, not both |
| mirror node | `testnet.mirrornode.hedera.com` / `mainnet-public.mirrornode.hedera.com` |
| HCS topic | `VITE_HCS_TOPIC_ID_TESTNET` / `VITE_HCS_TOPIC_ID_MAINNET` |
| explorer links | `hashscan.io/testnet` / `hashscan.io/mainnet` |
| ledger id handed to the SDK | `LedgerId.TESTNET` / `LedgerId.MAINNET` |

There is **no runtime toggle on purpose**. A reader must not be able to sign on a network the letter was
not published on, and a signature that lands on testnet is silently worthless. Flipping the network is a
deploy, not a click.

A misspelled value (`VITE_HEDERA_NETWORK=main`) does not fall back to the default — `config.ts` throws at
load, in dev and in the build, because a silent fallback is exactly how a mainnet signature ends up on
testnet.

## The wallet connection

`Connect` in the top bar offers **HashPack**, **Kabila** and **WalletConnect**. All three are the same
protocol underneath.

- **Hedera Wallet Connect** (`@hashgraph/hedera-wallet-connect`, Apache-2.0) — the HIP-820
  implementation of WalletConnect v2. Not HashConnect: HashPack shut legacy HashConnect down and moved
  to WalletConnect, and the library's `HashConnect`-era API is gone.
- The page never holds a key, never sees a seed phrase and never asks for one. The wallet signs and
  pays the network fee (~0.005 HBAR per message; the network charges it, this page only estimates it).
- **There is no separate "HashPack API" any more.** HashConnect — the injected handshake dApps used until
  2024 — was removed in HashPack 14.3.0, and HashPack's own developer docs point at WalletConnect. Bonzo's
  shipped bundle has the same shape: `DAppConnector` from `@hashgraph/hedera-wallet-connect`, the same three
  buttons, and no `hashconnect` or `window.hashpack` anywhere. So the three buttons are one protocol with
  three routes, in this order:
  1. **Browser extension that answers the Hedera handshake** (`hedera-extension-query` → the connector's
     `extensions`) — a direct `postMessage` pairing, no QR. This is the closest thing left to the old API.
  2. **Phone** — the wallet's own link from the registry gets the pairing: `<link>/wc?uri=wc%3A…`.
  3. **Desktop without the extension** — the pairing dialog, which shows the code the extension pastes and
     a QR a phone can scan. For all three buttons, because that is the only path the protocol leaves.
- **Least privilege**: the session requests exactly one method, `hedera_signAndExecuteTransaction`, on
  exactly one chain. Nothing about the letter needs anything else, and a session that can do more is a
  session that can be abused if the page is ever compromised.
- **WalletConnect** always means the pairing dialog, for every wallet, by QR code.
- **Nothing loads until it is needed.** The connector, the WalletConnect client and the Hedera SDK are
  one lazy chunk (~600 kB gzipped) fetched on hover/click of the button; a reader who only reads the
  letter downloads none of it. The main bundle stays at ~80 kB gzipped.
- A pairing that is never answered times out after 120 s instead of leaving the button on "Connecting…".

### What the wallet libraries cost, and why the deep imports

`src/lib/wallet.ts` imports `@hashgraph/hedera-wallet-connect/dist/lib/dapp` rather than the package
root. The root entry also exports the *wallet*-side code, which pulls `@reown/walletkit`,
`@reown/appkit` and `ethers` into a dApp that uses none of them. The package publishes no `exports` map,
so those deep paths work — and the version is pinned exactly in `package.json` for that reason. Revisit
on a major bump.

`@hashgraph/hedera-wallet-connect` declares its peers (including `ethers`, `@reown/appkit`,
`@reown/walletkit`) as required, so the install uses `--legacy-peer-deps` (`.npmrc`) to avoid pulling in
code this page never imports.

One library-internal deprecation is visible in the console: the connector still builds its session with
WalletConnect's `requiredNamespaces`, which the current `@walletconnect/sign-client` maps onto
`optionalNamespaces`. Sessions therefore still ask for the `hedera` chain and
`hedera_signAndExecuteTransaction`, but a wallet is no longer *forced* to grant them — so the code
treats "approved without a signer on our chain" as a failed connection (`WalletError: no_account`)
rather than assuming the grant.

### A wallet may refuse the host, not the page

HashPack and Kabila scan the connecting dApp through **Blockaid** before they show it. A tunnel or
mesh-VPN hostname (`*.ts.net`, `*.trycloudflare.com`, `*.ngrok-free.app`) is free and anonymous hosting,
which is exactly what phishing kits use — so those suffixes sit on blocklists, and the wallet answers
with "malicious dApp" and a Cancel button. Nothing in the page can change that verdict.

- **To test a wallet**, use an origin that has a reputation: `localhost` (an SSH port-forward is enough,
  and it is a secure context too) or the real deployment domain.
- `https://<user>.github.io/<repo>/` is the production shape; a custom domain is better still, and can be
  verified in the Reown dashboard (Domain Verification) so wallets show it as verified rather than
  unknown.
- The dApp's `metadata.url` is what the wallet scans, so it must be the page itself, base path included —
  the bare origin serves nothing.

### Content Security Policy

None is set today: GitHub Pages cannot send response headers, so a CSP would have to be a `<meta>` tag.
The wallet flow needs at least `connect-src wss://relay.walletconnect.com
https://explorer-api.walletconnect.com` plus the mirror node, and `img-src` for the registry's logo host.
Worth doing before launch; not done here.

### Testing a wallet without a domain

The wallet libraries need a secure context, and the wallet's own scanner needs an origin with a
reputation — `localhost` is both. If the machine running the dev server is not the one with the browser,
build a static copy and serve it locally:

```bash
VITE_BASE=/ npm run build          # assets at /, so a folder root works
# copy dist/ to the other machine, then:
cd dist && python3 -m http.server 8080
# open http://localhost:8080/
```

No HMR, but it is the real bundle: same network, same topic, same project id.

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
 "letterHash":"<sha-256 of the letter>","signedAt":"2026-11-15T18:00:00.000Z","comment":"",
 "recoveryRate":8.8}
```

- **The message carries the hash, never the letter.** Same primitive as the portal's `termsHash`, and
  small enough that one message always fits.
- **`subject`** is the campaign slug, constant for the whole campaign; **`letterHash`** pins the exact
  version of the text. Both come from the build.
- **Fixed field order** — `accountId`, `subject`, `version`, `letterHash`, `signedAt`, `comment`,
  `recoveryRate` — and no
  whitespace, so the bytes are reproducible. `FIELD_ORDER` in `src/lib/hcs.ts` is the single definition,
  and a test asserts the exact string.
- **`recoveryRate` is the share of the signer's loss that has been recovered, in percent** (0–100, one
  decimal, rounded — finer precision is noise). `null` when the signer does not say; that is stored as a
  real answer, not as a zero. The field was appended to the order, never inserted, so messages written
  before it existed still decode and are told apart by its absence.
- **`comment` is always present**, empty string when the signer writes nothing. Max
  `MAX_COMMENT_BYTES` (512) UTF-8 bytes, trimmed, no control characters other than newlines.
  `buildSignature()` returns the byte count and refuses anything that would exceed HCS's 1 KB cap, so a
  wallet is never asked to sign a message that cannot be submitted.
- **Reader filters** on `version`, `subject` and `letterHash`, so older drafts and foreign messages on
  the same topic are ignored.

Each **transaction** carries its own memo, `bonzo-community-letter:v1:signature-<16 hex of the message's
SHA-256>` — 52 of the 100 bytes the network allows. It names the message the transaction submitted,
so a signature can be matched from the transaction alone: the wallet's confirmation screen and
HashScan both show it. The hash is computed from the exact bytes written to the topic, never from a
re-serialisation, and it is a prefix — 64 bits — because the memo is a label and the message on the
topic is the record.

The **topic's** own memo is set once, when the topic is created, and is not this page's to
document: it was written by whoever created it, and the page never writes to it.

### How a signature is made

`Add your signature`, at the end of the letter, is the only write path on the page — and the letter keeps
nothing but the button. It opens a dialog, because the warning, the comment and the exact bytes belong
where the reader went on purpose, not in the middle of the text they came to read.

1. The reader connects a wallet — from the top bar or from the dialog itself. It is **one session**,
   held in `App`, so the bar and the dialog can never disagree about who is connected.
2. Above the comment field the dialog says what the reader is about to make: a public, permanent record of
   support — signature and optional comment together — and, in the accent stripe, that it cannot be edited
   or deleted, with a line about respectful language and personal information. The field itself stays a
   field, capped at 512 UTF-8 bytes, with the counter turning red past it.
3. `What will be published` shows the exact message, with the timestamp left as a placeholder — it is
   stamped at submission.
4. `buildSignature()` checks everything the contract requires before a wallet is involved, so the page
   never asks for a signature that would fail on chain.
5. `submitTopicMessage()` freezes a `TopicMessageSubmitTransaction` — topic, message, transaction id,
   node ids — and hands it to the wallet through `hedera_signAndExecuteTransaction`. The wallet signs and
   pays; the page never sees a key.
6. **The verdict comes from the mirror, not from the wallet.** The transaction id is generated here and
   read off the frozen transaction *before* the wallet is asked, so the chain can always be asked back.
   The wallet call is given 90 s; if it answers with an error, that is the answer. If it never answers,
   or the wallet app took the browser away and sent it back as a fresh load, `waitForTransactionResult()`
   polls `/transactions/{id}` for up to 45 s and reports `succeeded`, `failed` (with the network's own
   status word) or `unverified`. A signature that landed is never reported as a failure.
7. The result is one block in the treasury page's shape — badge, serif verdict, one sentence, then the
   facts: account, topic, transaction, status, each linked to HashScan. On success it thanks the signer;
   on failure it says the network refused it and offers `Try again`; on `unverified` it says so plainly
   and warns that a second message would also stay on the topic.

The attempt is written to `sessionStorage` before the wallet is asked (`lib/pending.ts`, 15 min). That is
what lets a reload resume the dialog on "reading the network" instead of falling back to "connect a
wallet" — and why the dialog owns its own progress state instead of reading `wallet.status`: a session
being restored is not a missing session.

With no topic configured, the dialog says signing opens at launch and the button signs nothing.

### Testimonials

Open the page with `?demo=1` to see the section filled with ten sample comments, their lengths
spread from 77 to 512 bytes (the field's limit) — the section then says "Sample comments — not
signatures" and the count above the letter still ignores them (`content/demo.ts`).

Each entry opens with a recovery ring (`components/RecoveryRing.tsx`): a disc with the rate
rounded to a whole percent, and an outline whose arc is that same rate, so the number and the
shape cannot disagree. Under the account it says what is still missing — `100 − rate`, as
"91% of net supply lost", or "Losses not stated" when the signer gave no rate. The ring shows
what came back, the line what did not; they are complements of one number and cannot drift
apart. The date sits under the comment, at the card's foot. The colour runs red → amber → green (`lib/recovery.ts`, interpolated in
HSL because a straight RGB blend from red to green passes through grey). No rate at all is
brown with a dash — silence is not "recovered nothing", and the two must not look alike.

Under the letter, `components/Testimonials.tsx` shows what each account wrote: the first comment
that account left, with its account id and the date it signed, as one horizontal band that drifts by
itself and can be scrolled, dragged or stopped on. The rule is the same one the count follows
(`testimonials` → `uniqueSigners`), so an account that signed twice appears once, and an account that
wrote nothing does not appear at all.

The topic is read from the mirror in pages of 100 (the API's maximum — there is no "everything"
call), following the cursor until it is exhausted or `MAX_PAGES` (20 pages, 2 000 messages) is
reached. The first load walks the topic; every later load asks only for `sequenceNumber=gt:<highest
held>` and merges by sequence, so watching a topic with a thousand signatures costs one request a
minute that is usually empty. If a read ever stops at the bound, `DevStatus` says so rather than
showing a quietly short list.

The band never shows an edge: the set of comments is laid out twice, and once the strip has travelled
exactly one set it is rewound by that much, which is invisible because the next copy is identical
(`lib/band.ts`, `nextOffset`). It holds still while hovered or focused and resumes ~2.6 s after the
reader lets go; with `prefers-reduced-motion` it does not drift at all, and scrolling still works.
Long comments are cut at six lines with an ellipsis — a band is a strip, not a page.

### The wall behind the page

`components/Backdrop.tsx` writes the account ids of every signer across the background in Caveat, at
very low opacity, tilted a few degrees each way — texture, not a list.

Two separate draws decide what is on screen. **Where** a mark sits, how big and how tilted comes from a
generator seeded by the accounts, so the wall does not move while someone reads. **Which** account is
written there is reshuffled on every load, so a reload is a different slice of the signatures and every
signer turns up eventually. Positions come from a grid measured against the window (`layoutSlots`), then broken up: one cell in
eight is left empty, each row sits a little off from the last, every mark is jittered by up to a third
of a cell and tilted up to 16°, and the type size is derived from the cell width. The grid keeps ids
from landing on each other — 44 marks at 1280 with no overlap, 22 at 390 — and the disorder keeps it
from reading as a table. A
pointer lifts the id under it: 1.9×, 60% opacity, in the accent. That hover is driven from a
`pointermove` listener rather than `:hover`, because the ids paint behind the page and every section
would otherwise swallow the pointer first; the wall hit-tests itself and measures again once the hand
has loaded (`document.fonts.ready`), since the boxes move when the font arrives.

The letter sheet is opaque, so the wall stops where the paper starts. With no signatures there is no
wall. `?demo=1` uses the sample ids so the effect can be looked at before anyone has signed.

### One signature per account

The page refuses a second one. The connected account is looked up in what the mirror returned, and —
for the few seconds before the mirror has indexed a fresh message — in a record of what this browser
just signed (`lib/signedHere.ts`, keyed by subject and letter hash, so a new letter starts clean).
With a signature already on file the button reads **You have signed** and the dialog names the date
and the comment that are already there instead of offering the form.

The chain cannot enforce this, and the README should not pretend otherwise: a topic is append-only and
the payload carries no nonce, so a second message from the same wallet is possible from any other
client. What the page can do, it does — and the reader dedupes by account (`uniqueSigners`), so a
repeat is visible on the topic without being counted twice.

### What a signature costs

Hedera's fees are dollar-denominated, and the chain proves it. Reading three transaction types back
from the mirror, at the network's own rate of **$0.050831/HBAR** on 24 November 2026:

| transaction | charged | in USD | published | ratio |
|---|---|---|---|---|
| `CryptoTransfer` | 194,037 tinybar | $0.000099 | $0.0001 | 0.99 |
| `CryptoCreateAccount` | 97,269,954 tinybar | $0.0494 | $0.05 | 0.99 |
| `ConsensusSubmitMessage`, 213 B | 469,539 tinybar | $0.000239 | — | — |
| `ConsensusSubmitMessage`, 232 B | 494,115 tinybar | $0.000251 | — | — |

The first two land on the published price to within a percent, so the peg holds: the schedule is
written in tinybar, but it is kept in step with the dollar.

**Why a message costs a fifth of the listed price.** `ConsensusSubmitMessage` is listed at $0.0008,
which is the price of a message at the **1 KB maximum**, not a flat charge. The fee is a base plus a
per-byte component, and the two measured messages pin both down:

```
slope  1,293.5 tinybar/byte   →  $0.000000657 per byte
base     194,029 tinybar      →  $0.000099        (the same $0.0001 base CryptoTransfer charges)
at 1024 bytes: 194,029 + 1024 × 1,293.5 = 1,518,546 tinybar = $0.00077  ≈ the listed $0.0008
```

So a 213-byte signature costs $0.00024 because it is a fifth of a full message, and a longer comment
costs proportionally more. The dialogs quote the HBAR figure (~0.005 HBAR) because that is what the
wallet shows; the dollar figure follows the exchange rate the network publishes.

### The hash is computed at build time

`build/letter-hash.ts` is a Vite plugin: it bundles `src/content/letter.ts` with esbuild, imports it,
and exposes a virtual module (`virtual:letter`) with the text, its id, its byte length and its SHA-256.
There is **no runtime hashing path**, so the hash the page displays and the hash a wallet signs cannot
diverge. Editing the text and rebuilding changes the hash, which invalidates every existing signature by
design — the check is `git diff` on one file.

The plugin warns at build time when the text is empty, because the hash of an empty string would make
every signature meaningless. Signing must stay closed until the text exists.

## Still open

The letter's text, topic creation (the block stays closed until `VITE_HCS_TOPIC_ID_MAINNET` is set), and
the awareness campaign.

**Decided:** comments are shown in full, from everyone, uncensored. Two consequences to build for:

- Comments are permanent and public — HCS has no edit or delete — so the signing UI must say so plainly
  before a wallet is asked to sign.
- Render comments as **text, never HTML**: they are arbitrary strings from strangers on a page we
  control. Length is already capped at 512 bytes by the payload rules.
