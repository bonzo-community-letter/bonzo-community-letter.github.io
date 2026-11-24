import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { config, signingOpen } from '../config'
import type { WalletApi } from '../hooks/useWallet'
import {
  MAX_COMMENT_BYTES,
  PAYLOAD_VERSION,
  buildSignature,
  commentByteLength,
  hashscanTopicUrl,
  hashscanTransactionUrl,
  prettyPayload,
} from '../lib/hcs'
import { describeWalletError, submitTopicMessage } from '../lib/wallet'
import { Spinner } from './Spinner'
import { subject } from 'virtual:letter'

type SigningState =
  | { status: 'idle' }
  | { status: 'signing' }
  | { status: 'done'; transactionId: string }
  | { status: 'error'; message: string }

/**
 * Where a signature is actually made. The letter itself keeps only the button —
 * the warning, the comment and the exact bytes belong in a dialog the reader
 * opened on purpose, not in the middle of the text they came to read.
 *
 * What goes on chain is the payload from `lib/hcs` — account, campaign, hash,
 * timestamp, comment — never the letter itself, and never anything the wallet
 * keeps. A message on HCS is permanent and public: it cannot be edited or
 * deleted, which is what the warning above the field says before anyone types.
 */
export function SignDialog({
  open,
  onClose,
  wallet,
  letterHash,
  count,
  onConnect,
  onSigned,
}: {
  open: boolean
  onClose: () => void
  wallet: WalletApi
  letterHash: string
  count: number | null
  onConnect: () => void
  onSigned: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<SigningState>({ status: 'idle' })

  useEffect(() => {
    if (!open) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    const overflow = document.body.style.overflow

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('textarea, button, a[href]')?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

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

  // Portalled to the body: the letter sheet sits in its own stacking context
  // (z-20), and a dialog rendered inside it would be painted *under* the
  // envelope overlay at z-30, which is pointer-events-none and would cover the
  // buttons without blocking them.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-page/80 backdrop-blur-sm"
        tabIndex={-1}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-dialog-title"
        className="relative m-3 w-full max-w-md border border-rule bg-hero p-6 shadow-2xl shadow-black/60 sm:m-0"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="eyebrow">
            {count === null ? 'Signature' : `${count} ${count === 1 ? 'signature' : 'signatures'}`} ·{' '}
            {config.network}
          </p>
          {/* the topic a signature lands on: the one fact a signer can check afterwards */}
          {config.topicId ? (
            <a
              href={hashscanTopicUrl(config.network, config.topicId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[0.6875rem] text-ink-faint underline decoration-rule underline-offset-4 hover:text-ink-soft"
            >
              topic {config.topicId} ↗
            </a>
          ) : null}
        </div>
        <h2 id="sign-dialog-title" className="mt-2 font-serif text-2xl leading-tight text-ink">
          {signed ? 'Signature submitted' : 'Add your signature'}
        </h2>

        {!signingOpen ? (
          <>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Signing opens at launch. The letter is still a draft — its text, and with it the hash every
              signature would commit to, is not final.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint hover:text-ink-soft"
            >
              Close
            </button>
          </>
        ) : signed ? (
          <>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Your signature is on the topic. It appears in the count once the mirror node has it — usually
              a few seconds.
            </p>
            {state.transactionId ? (
              <a
                href={hashscanTransactionUrl(config.network, state.transactionId)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block break-all font-mono text-[0.75rem] text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink"
              >
                {state.transactionId} ↗
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-sm border border-rule px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-accent hover:text-ink"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 border-l-2 border-accent pl-3 text-[0.8125rem] leading-relaxed text-ink-soft">
              Your comment is public and permanent. It is written to the Hedera Consensus Service, cannot be
              edited or deleted, and stays visible forever. Insults and abuse are not helpful – please stay
              critical, but respectful!
            </p>

            <label
              htmlFor="sign-comment"
              className="mt-5 block text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint"
            >
              Comment <span className="normal-case tracking-normal">— optional</span>
            </label>
            <textarea
              id="sign-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              spellCheck
              className="mt-2 w-full resize-y rounded-sm border border-rule bg-page/40 px-3 py-2 font-serif text-[0.9375rem] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              placeholder="Why you are signing."
            />
            <div className="mt-1 flex justify-end">
              <span className={`font-mono text-[0.6875rem] ${tooLong ? 'text-red-400' : 'text-ink-faint'}`}>
                {bytes} / {MAX_COMMENT_BYTES} bytes
              </span>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint hover:text-ink-soft">
                What will be published
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-sm border border-rule bg-page/40 px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-ink-soft">
                {preview}
              </pre>
            </details>

            {state.status === 'error' ? (
              <p role="alert" className="mt-4 border-l-2 border-accent pl-3 text-xs leading-relaxed text-ink-soft">
                {state.message}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              {connected ? (
                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={busy || tooLong}
                  className="inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-5 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-page transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? <Spinner /> : null}
                  {busy ? 'Waiting for your wallet…' : 'Add signature'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConnect}
                  className="rounded-sm border border-accent bg-accent px-5 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-page transition-opacity hover:opacity-85"
                >
                  Connect a wallet
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint hover:text-ink-soft"
              >
                Cancel
              </button>
            </div>
            <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-faint">
              {connected
                ? `Signing as ${wallet.accountId}. Your wallet pays the network fee (~0.0001 HBAR).`
                : 'HashPack, Kabila or WalletConnect. Your wallet pays the network fee (~0.0001 HBAR).'}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
