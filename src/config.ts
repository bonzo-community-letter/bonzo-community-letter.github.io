import { HASHSCAN_BASE, MIRROR_BASE, type HederaNetwork } from './lib/hcs'

const read = (key: string): string => {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * ── The network switch ───────────────────────────────────────────────────────
 *
 * One value decides the whole project: which chain a wallet session is opened
 * for, which mirror node signatures are read from, which explorer the topic
 * link points at, and which HCS topic is written to.
 *
 * Set `VITE_HEDERA_NETWORK` in `.env.local` (`testnet` | `mainnet`), or flip
 * `DEFAULT_NETWORK` below. There is deliberately no runtime toggle: a reader
 * must never be able to sign on a network the letter was not published on.
 */
export const DEFAULT_NETWORK: HederaNetwork = 'testnet'

const requested = read('VITE_HEDERA_NETWORK').toLowerCase()

/**
 * A typo must not fall back silently — that is how a signature ends up on the
 * wrong network. It fails loudly, at load, in dev and in the build.
 */
if (requested !== '' && requested !== 'mainnet' && requested !== 'testnet') {
  throw new Error(`VITE_HEDERA_NETWORK must be "mainnet" or "testnet", got "${requested}"`)
}

export const network: HederaNetwork = requested === '' ? DEFAULT_NETWORK : (requested as HederaNetwork)

export interface NetworkProfile {
  id: HederaNetwork
  /** CAIP-2 chain id the wallet session is opened for (HIP-820). */
  chainId: `hedera:${HederaNetwork}`
  /** Public mirror node REST base — reading signatures needs no key. */
  mirrorBase: string
  /** Block explorer base for the topic link. */
  hashscanBase: string
  /** HCS topic that collects signatures on this network. Empty = signing closed. */
  topicId: string
}

/**
 * Everything that differs between the two networks, in one table. Adding a
 * network means adding a row here, not hunting for string literals.
 */
export const NETWORKS: Record<HederaNetwork, NetworkProfile> = {
  testnet: {
    id: 'testnet',
    chainId: 'hedera:testnet',
    mirrorBase: MIRROR_BASE.testnet,
    hashscanBase: HASHSCAN_BASE.testnet,
    topicId: read('VITE_HCS_TOPIC_ID_TESTNET'),
  },
  mainnet: {
    id: 'mainnet',
    chainId: 'hedera:mainnet',
    mirrorBase: MIRROR_BASE.mainnet,
    hashscanBase: HASHSCAN_BASE.mainnet,
    topicId: read('VITE_HCS_TOPIC_ID_MAINNET'),
  },
}

export const profile = NETWORKS[network]

export const config = {
  network,
  profile,
  /** Empty until the topic exists — the page then shows the "opens at launch" state. */
  topicId: profile.topicId,
  /** WalletConnect Cloud project id; without it the wallet handshake cannot start. */
  walletConnectProjectId: read('VITE_WALLETCONNECT_PROJECT_ID'),
  contactUrl: read('VITE_CONTACT_URL'),
}

export const signingOpen = config.topicId.length > 0 && config.walletConnectProjectId.length > 0
