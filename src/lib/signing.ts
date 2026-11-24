/**
 * Whether a signature may be taken at all.
 *
 * A topic and a WalletConnect project id are the *plumbing*; they are not the reason
 * to accept a signature. What a signature commits to is the SHA-256 of `letterText`,
 * so with the text empty that hash is the SHA-256 of nothing and the message on the
 * topic says "I signed no letter". The first two signatures on the mainnet topic did
 * exactly that — the plumbing was configured, the letter was not written.
 *
 * One rule, in one place: the dialog that offers the button and the diagnostic panel
 * that reports the state must not be able to disagree.
 */
import { config } from '../config'
import { isDraft, letterBytes } from 'virtual:letter'

export interface SigningGate {
  open: boolean
  /** Why it is closed, for the dialog to say out loud. */
  reason: 'letter_not_final' | 'not_configured' | null
}

export function signingGate(): SigningGate {
  if (letterBytes === 0 || isDraft) return { open: false, reason: 'letter_not_final' }
  if (config.topicId.length === 0 || config.walletConnectProjectId.length === 0) {
    return { open: false, reason: 'not_configured' }
  }
  return { open: true, reason: null }
}
