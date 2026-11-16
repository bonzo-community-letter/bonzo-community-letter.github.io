/**
 * Wallet connection for the letter.
 *
 * Everything here goes through **Hedera Wallet Connect** — the HIP-820
 * implementation of the WalletConnect v2 protocol — so the page never talks to
 * a wallet's internals and never holds a key. HashPack and Kabila are reached
 * by deep-linking the pairing they would otherwise get from a QR code;
 * "WalletConnect" opens the pairing dialog itself, for every other wallet.
 *
 * Three rules this file exists to keep:
 *
 * 1. **No key, ever.** The wallet signs and pays. The page only sees an account
 *    id, and only after the user approved the session.
 * 2. **Least privilege.** The session asks for exactly one method,
 *    `hedera_signAndExecuteTransaction`, on exactly one chain — the one the
 *    build was configured for. A wallet session that can do more is a session
 *    that can be abused if the page is ever compromised.
 * 3. **Nothing is loaded until it is needed.** The connector, the SDK and the
 *    WalletConnect client together are several hundred kilobytes; a reader who
 *    only reads the letter should never pay for them. Every import below is
 *    dynamic and happens on the first "Connect".
 */
import { config } from '../config'
import type { HederaNetwork } from './hcs'

/**
 * Deep imports, not the package root: the root entry also exports the
 * *wallet*-side code, which pulls `@reown/walletkit`, `@reown/appkit` and
 * `ethers` into the bundle for a dApp that uses none of them. The package
 * publishes no `exports` map, so these paths are stable for as long as the
 * version is pinned (see package.json).
 */
type ConnectorModule = typeof import('@hashgraph/hedera-wallet-connect/dist/lib/dapp/index.js')
type SharedModule = typeof import('@hashgraph/hedera-wallet-connect/dist/lib/shared/index.js')
type SdkModule = typeof import('@hiero-ledger/sdk')
type DAppConnector = import('@hashgraph/hedera-wallet-connect/dist/lib/dapp/index.js').DAppConnector

export type WalletKind = 'hashpack' | 'kabila' | 'walletconnect'

export interface WalletOption {
  kind: WalletKind
  label: string
  note: string
}

/** The three the button offers, in the order they are shown. */
export const WALLET_OPTIONS: readonly WalletOption[] = [
  { kind: 'hashpack', label: 'HashPack', note: 'Hedera wallet — app or extension' },
  { kind: 'kabila', label: 'Kabila', note: 'Hedera wallet — app or extension' },
  { kind: 'walletconnect', label: 'WalletConnect', note: 'Any other wallet, by QR code' },
]

export interface WalletSession {
  accountId: string
  network: HederaNetwork
}

export type WalletErrorCode =
  | 'not_configured'
  | 'insecure_context'
  | 'rejected'
  | 'no_account'
  | 'wrong_network'
  | 'load_failed'
  | 'unknown'

/**
 * The WalletConnect handshake generates an X25519 key pair with WebCrypto. The
 * browser only exposes `crypto.subtle` in a **secure context** — HTTPS, or
 * `localhost`/`127.0.0.1`. Served over plain HTTP from a hostname (a tailnet
 * name, a LAN address), `crypto.subtle` is `undefined` and the SDK's
 * `connect()` never settles: the button sits on "Connecting…" forever.
 *
 * So the page checks first and says why, instead of hanging.
 */
export function hasWebCrypto(): boolean {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle
  return typeof subtle?.generateKey === 'function'
}

export const INSECURE_CONTEXT_MESSAGE =
  'Wallets need a secure connection. This page is served over plain HTTP, where the browser disables the cryptography WalletConnect uses — open it over HTTPS, or on localhost.'

export class WalletError extends Error {
  readonly code: WalletErrorCode

  constructor(code: WalletErrorCode, message: string) {
    super(message)
    this.name = 'WalletError'
    this.code = code
  }
}

/** Shown to the reader — never a stack trace, never a raw SDK message. */
export function describeWalletError(error: unknown): string {
  if (error instanceof WalletError) return error.message
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (/user rejected|user canceled|user cancelled|rejected by user|denied/i.test(raw)) {
    return 'The request was rejected in your wallet.'
  }
  if (/session (not found|does not exist)|no matching key|session topic doesn't exist/i.test(raw)) {
    return 'The wallet session expired. Please connect again.'
  }
  if (/timed out|timeout/i.test(raw)) {
    return 'The wallet did not answer in time. Please try again.'
  }
  if (/network|fetch|offline/i.test(raw)) {
    return 'Could not reach the wallet relay. Check your connection and try again.'
  }
  return 'The wallet connection failed. Please try again.'
}

/**
 * The WalletConnect explorer lists each wallet's own deep link. We do not
 * hardcode `hashpack://…` or a universal link: the registry is where a wallet
 * publishes the one it keeps working, and guessing it is how a "Connect" button
 * silently stops opening the app.
 *
 * The registry is keyed by a hex id, and its `ids` filter takes those ids — a
 * slug returns an empty list. So: search by name, then pick the listing by slug
 * (Kabila's is `kabila-wallet`, not `kabila`), falling back to the display name.
 */
const EXPLORER_URL = 'https://explorer-api.walletconnect.com/v3/wallets'

interface ExplorerListing {
  name?: string
  slug?: string
  mobile?: { native?: string; universal?: string }
}

const REGISTRY: Partial<Record<WalletKind, { search: string; slug: string; name: string }>> = {
  hashpack: { search: 'hashpack', slug: 'hashpack', name: 'hashpack' },
  kabila: { search: 'kabila', slug: 'kabila-wallet', name: 'kabila' },
}

/** The wallet's mobile link, or null when the registry cannot be read. */
export async function walletLink(
  kind: WalletKind,
  projectId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const entry = REGISTRY[kind]
  if (!entry || !projectId) return null
  try {
    const url = `${EXPLORER_URL}?projectId=${encodeURIComponent(projectId)}&entries=10&search=${encodeURIComponent(entry.search)}`
    const res = await fetchImpl(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const body = (await res.json()) as { listings?: Record<string, ExplorerListing> }
    const listings = Object.values(body.listings ?? {})
    const match =
      listings.find((listing) => listing.slug === entry.slug) ??
      listings.find((listing) => listing.name?.toLowerCase() === entry.name)
    const link = match?.mobile?.universal || match?.mobile?.native
    return typeof link === 'string' && link.length > 0 ? link : null
  } catch {
    return null
  }
}

/**
 * `wc:<topic>@2?…` handed to a wallet. Same shape the WalletConnect clients
 * themselves build: `<universal>/wc?uri=…` for https links, and
 * `<scheme>//wc?uri=…` for native schemes (`hashpack:` → `hashpack://wc?uri=…`).
 */
export function deepLinkFor(link: string, uri: string): string {
  const encoded = encodeURIComponent(uri)
  if (/^https?:/i.test(link)) return `${link.replace(/\/+$/, '')}/wc?uri=${encoded}`
  return `${link}${link.endsWith(':') ? '//' : '/'}wc?uri=${encoded}`
}

/**
 * Whether to deep-link or to show the pairing code. A phone has the wallet app;
 * a desktop browser has an extension that pastes the code, which is the flow
 * both HashPack and Kabila document.
 */
export function isMobileWalletTarget(userAgent?: string): boolean {
  const ua =
    userAgent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent)
  return /android|iphone|ipad|ipod/i.test(ua)
}

const ACCOUNT_ID = /^\d+\.\d+\.\d+$/

/** The account id as the payload contract wants it, or null if it is not one. */
export function normalizeAccountId(value: string): string | null {
  const trimmed = value.trim()
  return ACCOUNT_ID.test(trimmed) ? trimmed : null
}

/**
 * A browser-extension wallet announces itself through the Hedera extension
 * handshake: the connector posts `hedera-extension-query` and whoever answers is
 * pushed into `connector.extensions`. Connecting to one of those is a direct
 * `postMessage` handshake — no QR, no pairing dialog — which is the closest thing
 * to "the HashPack API" that still exists (HashConnect, the old injected one, was
 * removed in HashPack 14.3.0).
 */
export function findExtension(
  instance: Pick<DAppConnector, 'extensions'>,
  kind: WalletKind,
): { id: string } | null {
  const pattern = kind === 'hashpack' ? /hashpack/i : kind === 'kabila' ? /kabila/i : null
  if (!pattern) return null
  const match = instance.extensions.find(
    (extension) => pattern.test(extension.id) || pattern.test(extension.name ?? ''),
  )
  return match ? { id: match.id } : null
}

/**
 * Discovery is asynchronous: the query goes out 200 ms after the connector is
 * built and answers trickle in. Poll briefly rather than sending the reader to a
 * QR code while their extension was about to answer.
 */
async function waitForExtension(
  instance: DAppConnector,
  kind: WalletKind,
  budgetMs = 450,
): Promise<{ id: string } | null> {
  const deadline = Date.now() + budgetMs
  for (;;) {
    const found = findExtension(instance, kind)
    if (found || Date.now() >= deadline) return found
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

let pending: Promise<DAppConnector> | null = null

async function loadModules(): Promise<{ connector: ConnectorModule; shared: SharedModule; sdk: SdkModule }> {
  try {
    const [connector, shared, sdk] = await Promise.all([
      import('@hashgraph/hedera-wallet-connect/dist/lib/dapp/index.js'),
      import('@hashgraph/hedera-wallet-connect/dist/lib/shared/index.js'),
      import('@hiero-ledger/sdk'),
    ])
    return { connector, shared, sdk }
  } catch (error) {
    throw new WalletError(
      'load_failed',
      `The wallet library could not be loaded. ${describeWalletError(error)}`,
    )
  }
}

async function createConnector(): Promise<DAppConnector> {
  const projectId = config.walletConnectProjectId
  if (!projectId) {
    throw new WalletError(
      'not_configured',
      'Wallet connection is not configured for this build (VITE_WALLETCONNECT_PROJECT_ID is empty).',
    )
  }

  const [{ connector, shared, sdk }] = await Promise.all([loadModules()])

  // The wallet shows this URL, and scans it: it has to be the page the reader is
  // actually on — base path included — not the bare origin, which serves nothing.
  const pageUrl =
    typeof location === 'undefined'
      ? 'http://localhost/'
      : new URL(import.meta.env.BASE_URL, location.origin).toString()

  const metadata = {
    name: 'Open letter — Bonzo Lend recovery',
    description: 'An open letter to Hedera, the HBAR Foundation, Supra Labs and the Bonzo Finance Foundation.',
    url: pageUrl,
    icons: [new URL('icon-256.png', pageUrl).toString()],
  }

  const ledgerId = config.network === 'mainnet' ? sdk.LedgerId.MAINNET : sdk.LedgerId.TESTNET

  const instance = new connector.DAppConnector(
    metadata,
    ledgerId,
    projectId,
    // Least privilege: submit is all a signature needs.
    [shared.HederaJsonRpcMethod.SignAndExecuteTransaction],
    [shared.HederaSessionEvent.AccountsChanged, shared.HederaSessionEvent.ChainChanged],
    // One chain only — the one this build is switched to.
    [config.profile.chainId],
  )

  await instance.init({ logger: 'error' })
  return instance
}

function connector(): Promise<DAppConnector> {
  pending ??= createConnector().catch((error: unknown) => {
    // A failed load must not be cached as a broken promise.
    pending = null
    throw error
  })
  return pending
}

/**
 * Warm the wallet chunks while the pointer is on the button. It only fetches
 * code — no connector is created, no relay connection is opened, nothing is
 * sent anywhere — so hovering a button is not a privacy event.
 */
export function prefetchWallet(): void {
  if (!config.walletConnectProjectId || !hasWebCrypto()) return
  void loadModules().catch(() => {
    // A failed prefetch costs nothing; the click will report it.
  })
}

/** The signer for this network, if a session is already open. */
export function sessionOf(instance: DAppConnector): WalletSession | null {
  const signer = instance.signers.find((candidate) => {
    const ledger = candidate.getLedgerId().toString()
    return ledger === config.network
  })
  if (!signer) return null
  const accountId = normalizeAccountId(signer.getAccountId().toString())
  return accountId ? { accountId, network: config.network } : null
}

/**
 * Whether a stored session exists, without starting the connector.
 *
 * The WalletConnect client keeps its state in localStorage under
 * `wc@2:client:` (sessions, pairings, history) — nothing else on this page uses
 * that prefix, so its presence means this browser has connected before.
 */
export function hasStoredSession(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return Object.keys(localStorage).some((key) => key.startsWith('wc@2:client:'))
  } catch {
    return false
  }
}

/**
 * How long a pairing may stay unanswered. A wallet that never answers leaves the
 * promise pending forever — the UI must not sit on "Connecting…" without a way out.
 */
export const CONNECT_TIMEOUT_MS = 120_000

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WalletError('unknown', message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}

export interface ConnectOptions {
  /** Overridable for tests. */
  userAgent?: string
  fetchImpl?: typeof fetch
  /** Called with the `wc:` pairing string when a wallet is deep-linked. */
  onPairing?: (uri: string) => void
  /**
   * Which road the pairing took. `dialog` on a HashPack/Kabila click means no
   * extension answered the handshake — worth saying out loud in the UI, because
   * a QR code after clicking "HashPack" otherwise looks like a bug.
   */
  onRoute?: (route: ConnectRoute) => void
}

export type ConnectRoute = 'extension' | 'deep-link' | 'dialog'

/**
 * Open a session. Returns the account the wallet approved, or throws a
 * `WalletError` with a sentence that can be shown to a reader.
 */
export async function connect(kind: WalletKind, options: ConnectOptions = {}): Promise<WalletSession> {
  if (!hasWebCrypto()) {
    throw new WalletError('insecure_context', INSECURE_CONTEXT_MESSAGE)
  }

  const instance = await connector()

  const existing = sessionOf(instance)
  if (existing) return existing

  try {
    // 1. An extension that answers the Hedera handshake connects directly.
    const extension = kind === 'walletconnect' ? null : await waitForExtension(instance, kind)
    if (extension) {
      options.onRoute?.('extension')
      await withTimeout(
        instance.connectExtension(extension.id),
        CONNECT_TIMEOUT_MS,
        'The wallet did not answer in time. Please try again.',
      )
    } else if (kind === 'walletconnect') {
      options.onRoute?.('dialog')
      await withTimeout(
        // `true` = reject when the pairing dialog is closed, so closing it is an
        // answer ("rejected") instead of a wait that only the timeout ends.
        instance.openModal(undefined, true),
        CONNECT_TIMEOUT_MS,
        'The wallet did not answer in time. Please try again.',
      )
    } else {
      // 2. No extension: hand the pairing to the wallet's own app on a phone…
      const link = await walletLink(kind, config.walletConnectProjectId, options.fetchImpl ?? fetch)
      const target = isMobileWalletTarget(options.userAgent)
      if (link && target) {
        options.onRoute?.('deep-link')
        await withTimeout(
          instance.connect((uri) => {
            options.onPairing?.(uri)
            window.location.href = deepLinkFor(link, uri)
          }),
          CONNECT_TIMEOUT_MS,
          'The wallet did not answer in time. Please try again.',
        )
      } else {
        // 3. …and on a desktop without the extension, the pairing dialog is the
        // only path left: it shows the code the wallet pastes or scans.
        options.onRoute?.('dialog')
        await withTimeout(
          instance.openModal(undefined, true),
          CONNECT_TIMEOUT_MS,
          'The wallet did not answer in time. Please try again.',
        )
      }
    }
  } catch (error) {
    // A pairing that timed out leaves the WalletConnect dialog open; close it so
    // the reader is not left with two overlapping panels.
    instance.walletConnectModal.closeModal()
    if (error instanceof WalletError) throw error
    throw new WalletError('rejected', describeWalletError(error))
  }

  const session = sessionOf(instance)
  if (!session) {
    throw new WalletError(
      'no_account',
      `The wallet connected without a Hedera account on ${config.network}.`,
    )
  }
  return session
}

/** Close every session and pairing this page opened. */
export async function disconnect(): Promise<void> {
  if (!pending) return
  const instance = await pending
  await instance.disconnectAll()
}

/**
 * Pick up a session this browser already holds, without showing anything. Only
 * called when a WalletConnect session is in storage, so a reader who never
 * connected never downloads the connector.
 */
export async function restore(): Promise<WalletSession | null> {
  if (!hasStoredSession()) return null
  try {
    return sessionOf(await connector())
  } catch {
    return null
  }
}

export interface SubmittedMessage {
  transactionId: string
  status: string
}

/**
 * Submit one HCS message from the connected account. The wallet signs and
 * pays; the page only builds the transaction.
 *
 * The transaction is frozen here (transaction id + node ids) because the wallet
 * executes exactly the bytes it was given — an unfrozen transaction cannot be
 * serialised, and a transaction the wallet had to finish itself would be one the
 * page did not build.
 */
export async function submitTopicMessage(opts: {
  topicId: string
  message: string
  accountId: string
}): Promise<SubmittedMessage> {
  const accountId = normalizeAccountId(opts.accountId)
  if (!accountId) throw new WalletError('no_account', 'The connected account id is not a Hedera account id.')
  if (!opts.topicId) throw new WalletError('not_configured', 'No HCS topic is configured for this network.')

  const [instance, { shared, sdk }] = await Promise.all([connector(), loadModules()])
  const session = sessionOf(instance)
  if (!session) throw new WalletError('no_account', 'Connect a wallet first.')

  const transaction = new sdk.TopicMessageSubmitTransaction()
    .setTopicId(sdk.TopicId.fromString(opts.topicId))
    .setMessage(opts.message)
    .setTransactionId(sdk.TransactionId.generate(sdk.AccountId.fromString(accountId)))

  transaction.freezeWith(sdk.Client.forName(config.network))

  const response = await instance.signAndExecuteTransaction({
    signerAccountId: `${config.profile.chainId}:${accountId}`,
    transactionList: shared.transactionToBase64String(transaction),
  })

  const result = response.result as { transactionId?: string; status?: string }
  return {
    transactionId: result.transactionId ?? '',
    status: result.status ?? 'UNKNOWN',
  }
}

/** Test seam: drop the cached connector between cases. */
export function resetConnectorForTests(): void {
  pending = null
}
