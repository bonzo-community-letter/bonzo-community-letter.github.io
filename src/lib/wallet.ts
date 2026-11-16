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
  | 'rejected'
  | 'no_account'
  | 'wrong_network'
  | 'load_failed'
  | 'unknown'

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
 */
const EXPLORER_URL = 'https://explorer-api.walletconnect.com/v3/wallets'
const EXPLORER_IDS: Partial<Record<WalletKind, string>> = { hashpack: 'hashpack', kabila: 'kabila' }

interface ExplorerListing {
  mobile?: { native?: string; universal?: string }
}

/** The wallet's mobile link, or null when the registry cannot be read. */
export async function walletLink(
  kind: WalletKind,
  projectId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const id = EXPLORER_IDS[kind]
  if (!id || !projectId) return null
  try {
    const url = `${EXPLORER_URL}?projectId=${encodeURIComponent(projectId)}&entries=1&ids=${encodeURIComponent(id)}`
    const res = await fetchImpl(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const body = (await res.json()) as { listings?: Record<string, ExplorerListing> }
    const listing = body.listings?.[id]
    const link = listing?.mobile?.universal || listing?.mobile?.native
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

  const metadata = {
    name: 'Open letter — Bonzo Lend recovery',
    description: 'An open letter to Hedera, the HBAR Foundation, Supra Labs and the Bonzo Finance Foundation.',
    // The wallet shows this origin; it must be the page the reader is on, not a guess.
    url: typeof location === 'undefined' ? 'https://localhost' : location.origin,
    icons: [
      typeof location === 'undefined'
        ? 'https://localhost/icon-256.png'
        : `${location.origin}${import.meta.env.BASE_URL}icon-256.png`,
    ],
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
  if (!config.walletConnectProjectId) return
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

/** Whether a stored session exists, without starting the connector. */
export function hasStoredSession(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return Object.keys(localStorage).some((key) => key.startsWith('wc@2:client:0.0'))
  } catch {
    return false
  }
}

export interface ConnectOptions {
  /** Overridable for tests. */
  userAgent?: string
  fetchImpl?: typeof fetch
  /** Called with the `wc:` pairing string when a wallet is deep-linked. */
  onPairing?: (uri: string) => void
}

/**
 * Open a session. Returns the account the wallet approved, or throws a
 * `WalletError` with a sentence that can be shown to a reader.
 */
export async function connect(kind: WalletKind, options: ConnectOptions = {}): Promise<WalletSession> {
  const instance = await connector()

  const existing = sessionOf(instance)
  if (existing) return existing

  try {
    if (kind === 'walletconnect') {
      await instance.openModal()
    } else {
      const link = await walletLink(kind, config.walletConnectProjectId, options.fetchImpl ?? fetch)
      const target = isMobileWalletTarget(options.userAgent)
      if (link && target) {
        await instance.connect((uri) => {
          options.onPairing?.(uri)
          window.location.href = deepLinkFor(link, uri)
        })
      } else {
        // Desktop, or no deep link known: the pairing dialog shows the code the
        // wallet's extension pastes, which is the documented flow for both.
        await instance.openModal()
      }
    }
  } catch (error) {
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
