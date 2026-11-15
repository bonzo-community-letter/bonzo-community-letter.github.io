import type { HederaNetwork } from './lib/hcs'

const read = (key: string): string => {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

export const config = {
  network: (read('VITE_HEDERA_NETWORK') === 'mainnet' ? 'mainnet' : 'testnet') as HederaNetwork,
  /** Empty until the topic exists — the page then shows the "opens at launch" state. */
  topicId: read('VITE_HCS_TOPIC_ID'),
  /** WalletConnect Cloud project id; without it the wallet handshake cannot start. */
  walletConnectProjectId: read('VITE_WALLETCONNECT_PROJECT_ID'),
  contactUrl: read('VITE_CONTACT_URL'),
}

export const signingOpen = config.topicId.length > 0 && config.walletConnectProjectId.length > 0
