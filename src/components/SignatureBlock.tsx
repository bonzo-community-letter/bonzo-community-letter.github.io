import { useState } from 'react'
import { config, signingOpen } from '../config'
import type { WalletApi } from '../hooks/useWallet'
import {
  MAX_COMMENT_BYTES,
  PAYLOAD_VERSION,
  buildSignature,
  commentByteLength,
  hashscanTransactionUrl,
  prettyPayload,
} from '../lib/hcs'
import { describeWalletError, submitTopicMessage } from '../lib/wallet'
import { subject } from 'virtual:letter'

type SigningState =
  | { status: 'idle' }
  | { status: 'signing' }
  | { status: 'done'; transactionId: string }
  | { status: 'error'; message: string }

/**
 * The signature, at the end of the letter where a signature belongs.
 *
 * What goes on chain is the payload from `lib/hcs` — account, campaign, hash,
 * timestamp, comment — never the letter itself, and never anything the wallet
 * keeps. The reader sees the exact bytes before a wallet is involved, because a
 * message on HCS is permanent and public and cannot be edited or deleted.
 */
export function SignatureBlock({
  wallet,
  letterHash,
  count,
  onConnect,
  onSigned,
}: {
  wallet: WalletApi
  letterHash: string
  count: number | null
  onConnect: () => void
  onSigned: () => void
}) {
  const [comment, setComment] = useState('')
  const [state, setState] = useState<SigningState>({ status: 'idle' })

  const trimmed = comment.trim()
  const bytes = commentByteLength(trimmed)
  const tooLong = bytes > MAX_COMMENT_BYTES
  const connected = wallet.status === 'connected' && wallet.accountId !== null
  const busy = state.status === 'signing'
  const signed = state.status === 'done'

  const preview = prettyPayload({
    accountId: wallet.accountId ?? '0.0.x',
    subject,
    version: PAYLOAD_VERSION,
    letterHash,
    signedAt: '<set when you sign>',
    comment: trimmed,
  })

  const sign = async (): Promise<void> => {
    if (!wallet.accountId) return
    const built = buildSignature({
      accountId: wallet.accountId,
      subject,
      letterHash,
      comment: trimmed,
    })
    if (!built.ok) {
      setState({ status: 'error', message: built.errors.join('. ') })
      return
    }

    setState({ status: 'signing' })
    try {
      const result = await submitTopicMessage({
        topicId: config.topicId,
        message: built.encoded,
        accountId: wallet.accountId,
      })
      setState({ status: 'done', transactionId: result.transactionId })
      setComment('')
      onSigned()
    } catch (error) {
      setState({ status: 'error', message: describeWalletError(error) })
    }
  }

  return (
    <section aria-labelledby="sign-title" className="mt-10 border-t border-sheet-rule pt-6">
      <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
        {count === null ? 'Signatures' : `${count} ${count === 1 ? 'signature' : 'signatures'}`}
      </p>

      <h2 id="sign-title" className="mt-2 font-serif text-[1.25rem] leading-snug text-sheet-ink">
        {signed ? 'Signature submitted' : 'Add your signature'}
      </h2>

      {!signingOpen ? (
        <p className="mt-3 font-serif text-[0.9375rem] leading-relaxed text-sheet-ink-soft">
          Signing opens at launch. The letter is still a draft — its text, and with it the hash every
          signature would commit to, is not final.
        </p>
      ) : signed ? (
        <div className="mt-3">
          <p className="font-serif text-[0.9375rem] leading-relaxed text-sheet-ink-soft">
            Your signature is on the topic. It appears in the count once the mirror node has it — usually a
            few seconds.
          </p>
          {state.transactionId ? (
            <a
              href={hashscanTransactionUrl(config.network, state.transactionId)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block font-mono text-[0.75rem] text-sheet-ink underline decoration-sheet-rule underline-offset-4 hover:decoration-sheet-ink"
            >
              {state.transactionId} ↗
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setState({ status: 'idle' })}
            className="mt-4 block text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint hover:text-sheet-ink"
          >
            Sign again
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-[62ch] font-serif text-[0.9375rem] leading-relaxed text-sheet-ink-soft">
            Your wallet submits one message to the Hedera Consensus Service and pays the network fee
            (~0.0001 HBAR). It carries your account, this letter&apos;s hash, a timestamp and — if you write
            one — your comment. Not the letter. Nothing leaves your wallet but the signature.
          </p>

          <label htmlFor="sign-comment" className="mt-6 block text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
            Comment <span className="normal-case tracking-normal">— optional, public, permanent</span>
          </label>
          <textarea
            id="sign-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            spellCheck
            className="mt-2 w-full resize-y rounded-[2px] border border-sheet-rule bg-transparent px-3 py-2 font-serif text-[0.9375rem] leading-relaxed text-sheet-ink outline-none placeholder:text-sheet-ink-faint focus:border-sheet-ink-soft"
            placeholder="Why you are signing. Published in full, uncensored, and impossible to edit or delete."
          />
          <div className="mt-1 flex justify-end">
            <span className={`font-mono text-[0.6875rem] ${tooLong ? 'text-red-700' : 'text-sheet-ink-faint'}`}>
              {bytes} / {MAX_COMMENT_BYTES} bytes
            </span>
          </div>

          <details className="mt-5">
            <summary className="cursor-pointer text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint hover:text-sheet-ink-soft">
              What will be published
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-[2px] border border-sheet-rule bg-sheet-back px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-sheet-ink-soft">
              {preview}
            </pre>
          </details>

          {state.status === 'error' ? (
            <p role="alert" className="mt-4 border-l-2 border-red-700 pl-3 text-[0.8125rem] leading-relaxed text-sheet-ink-soft">
              {state.message}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            {connected ? (
              <button
                type="button"
                onClick={() => void sign()}
                disabled={busy || tooLong}
                className="rounded-sm border border-sheet-ink bg-sheet-ink px-5 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-sheet transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Waiting for your wallet…' : 'Add signature'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="rounded-sm border border-sheet-ink bg-sheet-ink px-5 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-sheet transition-opacity hover:opacity-85"
              >
                Connect a wallet
              </button>
            )}
            <span className="text-[0.75rem] text-sheet-ink-faint">
              {connected ? `Signing as ${wallet.accountId}` : 'HashPack, Kabila or WalletConnect'}
            </span>
          </div>
        </>
      )}
    </section>
  )
}
