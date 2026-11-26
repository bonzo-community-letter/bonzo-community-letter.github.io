import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { config, signingOpen } from '../config'
import type { WalletApi } from '../hooks/useWallet'
import {
  MAX_COMMENT_BYTES,
  MAX_RECOVERY_RATE,
  PAYLOAD_VERSION,
  buildSignature,
  commentByteLength,
  fetchTransactionResult,
  hashscanTopicUrl,
  signeeNumbers,
  hashscanTransactionUrl,
  prettyPayload,
  signatureBy,
  waitForTransactionResult,
  type Signature,
} from '../lib/hcs'
import { clearPending, readPending, savePending } from '../lib/pending'
import { localSignature, rememberSignature } from '../lib/signedHere'
import { SignerComment } from './SignerComment'
import { InfoTip } from './InfoTip'
import { describeWalletError, submitTopicMessage, type SubmitOutcome } from '../lib/wallet'
import { Spinner } from './Spinner'
import { subject } from 'virtual:letter'

type SigningState =
  | { status: 'idle' }
  /** The wallet has been asked and has not answered yet. */
  | { status: 'signing'; transactionId: string }
  /** The wallet is done, or quiet, and the mirror is being asked. */
  | { status: 'verifying'; transactionId: string }
  /** The network's verdict — the only place a result is claimed. */
  | { status: 'result'; outcome: SubmitOutcome }
  | { status: 'error'; message: string }

/** Turn a mirror answer into the same verdict shape the submit returns. */
function outcomeOf(transactionId: string, status: string | null): SubmitOutcome {
  if (!status) return { kind: 'unverified', transactionId }
  if (status !== 'SUCCESS') return { kind: 'failed', transactionId, status }
  return { kind: 'succeeded', transactionId, status }
}

/**
 * Where a signature is actually made. The letter itself keeps only the button —
 * the warning, the comment and the exact bytes belong in a dialog the reader
 * opened on purpose, not in the middle of the text they came to read.
 *
 * What goes on chain is the payload from `lib/hcs` — account, campaign, hash,
 * timestamp, comment — never the letter itself, and never anything the wallet
 * keeps. A message on HCS is permanent and public: it cannot be edited or
 * deleted, which is what the warning above the field says before anyone types.
 *
 * The dialog is deliberately not a mirror of the wallet's state. Once a
 * submission starts, its progress is owned here: the wallet app takes the
 * browser away to approve and can send it back as a fresh load, and a page that
 * read "connected" off a session still being restored would answer "connect a
 * wallet" while the signature was already on the topic.
 */
export function SignDialog({
  open,
  onClose,
  wallet,
  letterHash,
  count,
  signatures,
  onConnect,
  onSigned,
}: {
  open: boolean
  onClose: () => void
  wallet: WalletApi
  letterHash: string
  count: number | null
  signatures: readonly Signature[]
  onConnect: () => void
  onSigned: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [comment, setComment] = useState('')
  const [recoveryRate, setRecoveryRate] = useState('')
  const [state, setState] = useState<SigningState>({ status: 'idle' })
  /** Shown above the form after a wait the reader stopped themselves. */
  const [notice, setNotice] = useState<string | null>(null)
  /**
   * Bumped whenever the reader takes the dialog back. An answer that arrives for an
   * older attempt must not overwrite the view — the wallet can still reply long after
   * nobody is waiting for it.
   */
  const attempt = useRef(0)
  const stopped = useRef(false)
  /**
   * The account the attempt belongs to. Kept here, not read off the wallet: on
   * a resumed attempt the session may still be restoring, and the record is the
   * only thing that knows whose signature this was.
   */
  const [attemptAccount, setAttemptAccount] = useState<string | null>(null)

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

  // A submission started in this tab is written down before the wallet is
  // asked. If the wallet app took the page away and sent it back as a fresh
  // load, this is how the dialog picks the attempt up again instead of
  // forgetting it — and asks the chain, not the wallet, how it ended.
  useEffect(() => {
    if (!open) return
    const pending = readPending(config.network)
    if (!pending) return

    let cancelled = false
    const resumedAt = attempt.current
    setAttemptAccount(pending.accountId)
    setState({ status: 'verifying', transactionId: pending.transactionId })
    void waitForTransactionResult(config.network, pending.transactionId, {
      aborted: () => cancelled || stopped.current || attempt.current !== resumedAt,
    }).then((status) => {
      // A reader who pressed "Stop waiting" owns the view now, and the record stays for
      // the next open.
      if (cancelled || stopped.current || attempt.current !== resumedAt) return
      clearPending()
      setState({ status: 'result', outcome: outcomeOf(pending.transactionId, status) })
      if (status === 'SUCCESS') onSigned()
    })
    return () => {
      cancelled = true
    }
  }, [open, onSigned])

  if (!open) return null

  const trimmed = comment.trim()
  const bytes = commentByteLength(trimmed)
  const tooLong = bytes > MAX_COMMENT_BYTES

  // Empty is an answer — "I would rather not say" — and is stored as null.
  const rateText = recoveryRate.trim().replace(',', '.')
  const rateValue = rateText === '' ? null : Number(rateText)
  const rateValid =
    rateValue === null ||
    (Number.isFinite(rateValue) && rateValue >= 0 && rateValue <= MAX_RECOVERY_RATE)
  const connected = wallet.status === 'connected' && wallet.accountId !== null
  const busy = state.status === 'signing' || state.status === 'verifying'
  const settled = state.status === 'result'

  // One signature per account. The topic is append-only, so this is the only place a
  // second one can be refused: the mirror knows what landed, and the local record
  // covers the few seconds before the mirror has it.
  const onChain = signatureBy(signatures, wallet.accountId)
  const kept = localSignature(wallet.accountId, subject, letterHash, config.network)
  const already = onChain ?? kept
  const alreadySigned = already !== null

  const preview = prettyPayload({
    accountId: wallet.accountId ?? '0.0.x',
    subject,
    version: PAYLOAD_VERSION,
    letterHash,
    signedAt: '<set when you sign>',
    comment: trimmed,
    recoveryRate: rateValue,
  })

  const sign = async (): Promise<void> => {
    if (!wallet.accountId || alreadySigned || !rateValid) return
    const current = ++attempt.current
    stopped.current = false
    setNotice(null)
    const accountId = wallet.accountId
    const built = buildSignature({
      accountId,
      subject,
      letterHash,
      comment: trimmed,
      recoveryRate: rateValue,
    })
    if (!built.ok) {
      setState({ status: 'error', message: built.errors.join('. ') })
      return
    }

    setState({ status: 'signing', transactionId: '' })
    let transactionId = ''
    try {
      const outcome = await submitTopicMessage({
        topicId: config.topicId,
        message: built.encoded,
        accountId,
        aborted: () => stopped.current || attempt.current !== current,
        stages: {
          onBuilt: (id) => {
            transactionId = id
            setAttemptAccount(accountId)
            savePending({
              transactionId: id,
              accountId,
              topicId: config.topicId,
              network: config.network,
              startedAt: Date.now(),
            })
            setState({ status: 'signing', transactionId: id })
          },
          onVerifying: (id) => setState({ status: 'verifying', transactionId: id }),
        },
      })
      if (attempt.current !== current) return
      clearPending()
      // Written down here as well: the mirror needs a few seconds, and until it has
      // the message this browser must not offer the button again.
      rememberSignature({
        accountId,
        subject,
        letterHash,
        signedAt: built.payload.signedAt,
        network: config.network,
      })
      setState({ status: 'result', outcome })
      if (outcome.kind !== 'failed') {
        setComment('')
        onSigned()
      }
    } catch (error) {
      // A refusal in the wallet is a verdict, but a session that died mid-flight
      // is not: ask the chain once before saying the signature did not happen.
      const status =
        transactionId && !stopped.current
          ? await fetchTransactionResult(config.network, transactionId).catch(() => null)
          : null
      if (attempt.current !== current) return
      clearPending()
      if (status) {
        const outcome = outcomeOf(transactionId, status)
        setState({ status: 'result', outcome })
        if (outcome.kind !== 'failed') {
          setComment('')
          onSigned()
        }
      } else {
        setState({ status: 'error', message: describeWalletError(error) })
      }
    }
  }

  /**
   * Take the dialog back. The wallet may still answer — a request already sent cannot
   * be recalled — so nothing is claimed about the outcome: the count picks up a
   * signature by itself if one lands.
   */
  const stopWaiting = (): void => {
    stopped.current = true
    attempt.current += 1
    setState({ status: 'idle' })
    setNotice(
      'Stopped waiting. Your wallet may still submit it — the count above picks a signature up by itself if it does. Nothing is lost either way, but check the explorer before signing again.',
    )
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
        className="relative m-3 max-h-[85dvh] w-full max-w-md overflow-y-auto border border-rule bg-hero p-6 shadow-2xl shadow-black/60 sm:m-0"
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
              className="font-mono text-[0.6875rem] text-ink-faint underline decoration-rule underline-offset-4 transition-colors hover:text-ink-soft hover:decoration-accent"
            >
              topic {config.topicId} ↗
            </a>
          ) : null}
        </div>
        <h2 id="sign-dialog-title" className="mt-2 font-serif text-2xl leading-tight text-ink">
          {alreadySigned ? 'You have signed' : 'Add your signature'}
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
        ) : settled ? (
          <>
            <Confirmation outcome={state.outcome} accountId={wallet.accountId ?? attemptAccount} />
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-sm border border-rule px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-accent hover:text-ink"
              >
                Close
              </button>
              {state.outcome.kind === 'failed' ? (
                <button
                  type="button"
                  onClick={() => setState({ status: 'idle' })}
                  className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint hover:text-ink-soft"
                >
                  Try again
                </button>
              ) : null}
            </div>
          </>
        ) : busy ? (
          <div className="mt-4 border border-rule bg-page px-4 py-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-rule text-accent"
              >
                <Spinner />
              </span>
              <div className="min-w-0">
                <h3 className="font-serif text-xl leading-tight text-ink">
                  {state.status === 'signing' ? 'Waiting for your wallet' : 'Reading the network'}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {state.status === 'signing'
                    ? 'Approve the message in your wallet. Nothing else is asked of it, and this page never sees a key.'
                    : 'The wallet is done. The mirror node is being asked what the network did with it — this takes a few seconds.'}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-y-2 border-t border-rule/60 pt-4 text-xs">
              <Fact label="Account">{wallet.accountId ?? attemptAccount ?? '—'}</Fact>
              <Fact label="Topic">{config.topicId}</Fact>
              {state.transactionId ? <Fact label="Transaction">{state.transactionId}</Fact> : null}
            </dl>
            <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-faint">
              If the wallet app takes you away and brings you back, this dialog picks the attempt up again —
              the transaction id was written down before your wallet was asked.
            </p>
            <button
              type="button"
              onClick={stopWaiting}
              className="mt-4 rounded-sm border border-rule px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-accent hover:text-ink"
            >
              Stop waiting
            </button>
          </div>
        ) : alreadySigned ? (
          <>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              The connected account has already signed this letter. Multiple signatures are ignored, only
              the first counts.
            </p>
            {/* The same card the comment band uses: this is a signer's own comment, and
                it should look like one. */}
            {already ? (
              <SignerComment
                accountId={already.accountId}
                // a local record written before the topic answered carries no comment
                comment={'comment' in already ? already.comment : ''}
                signedAt={already.signedAt}
                recoveryRate={'recoveryRate' in already ? (already.recoveryRate ?? null) : null}
                signeeNumber={signeeNumbers(signatures).get(already.accountId.trim().toLowerCase())}
                withTime
                className="mt-5 rounded-sm border border-rule/70 bg-page/40 px-4 py-4"
              />
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
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Your signature and your (optional) comment are recorded on the hashgraph as a public and
              permanent record of support for this open letter.
            </p>



            {/* The count sits above the field, where it can be seen while typing and
                where it cannot be mistaken for a second field. */}
            <div className="mt-5 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2">
                <label
                  htmlFor="sign-comment"
                  className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint"
                >
                  Comment <span className="normal-case tracking-normal">— optional</span>
                </label>
                {/* The warning belongs to the comment: it is the comment that cannot be
                    edited, deleted, and should not carry anything private. */}
                <InfoTip id="sign-permanence-hint" label="What cannot be undone" side="below">
                  Neither the signature nor the comment can be edited or deleted. It will stay
                  permanently and visible to everyone on the hashgraph. Insults are not helpful –
                  please use respectful language and don’t disclose any personal information for your
                  own safety!
                </InfoTip>
              </span>
              <span
                className={`whitespace-nowrap font-mono text-[0.6875rem] ${tooLong ? 'text-red-400' : 'text-ink-faint'}`}
              >
                {bytes} / {MAX_COMMENT_BYTES} bytes
              </span>
            </div>
            <textarea
              id="sign-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              spellCheck
              className="mt-2 w-full resize-y rounded-sm border border-rule bg-page/40 px-3 py-2 font-serif text-[0.9375rem] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              placeholder="Your personal message to the recipients …"
            />

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="sign-recovery"
                  className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint"
                >
                  Recovery rate <span className="normal-case tracking-normal">— optional</span>
                </label>
                {/* opens upward, so it never covers the field the reader is about to fill */}
                <InfoTip id="sign-recovery-hint" label="What the recovery rate means" side="above">
                  How much of what you lost has been recovered so far? Leave it empty if you would
                  rather not say.
                </InfoTip>
              </div>
              {/* The unit sits inside the field, right-aligned: the input is then one
                  box from border to border, and `pr-9` keeps the value clear of it. */}
              <div className="relative mt-2">
                <input
                  id="sign-recovery"
                  type="text"
                  inputMode="decimal"
                  value={recoveryRate}
                  onChange={(event) => setRecoveryRate(event.target.value)}
                  aria-invalid={rateValid ? undefined : true}
                  aria-describedby="sign-recovery-hint"
                  placeholder="e.g. 8.8"
                  className={`w-full rounded-sm border bg-page/40 py-2 pl-3 pr-9 font-mono text-[0.9375rem] text-ink outline-none placeholder:text-ink-faint ${
                    rateValid ? 'border-rule focus:border-accent' : 'border-accent'
                  }`}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.8125rem] text-ink-faint"
                >
                  %
                </span>
              </div>
            </div>

            {/* Only the rule, and only when it is broken: the explanation is in the tooltip. */}
            {rateValid ? null : (
              <p className="mt-1.5 text-[0.75rem] leading-relaxed text-red-400">
                A number between 0 and {MAX_RECOVERY_RATE}, or nothing at all.
              </p>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint hover:text-ink-soft">
                What will be published
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-sm border border-rule bg-page/40 px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-ink-soft">
                {preview}
              </pre>
            </details>

            {notice ? (
              <p role="status" className="mt-4 border-l-2 border-rule pl-3 text-xs leading-relaxed text-ink-faint">
                {notice}
              </p>
            ) : null}

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
                  disabled={tooLong || !rateValid}
                  className="inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-5 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-page transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add signature
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
              The signing wallet pays the network fee for this signature.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * The receipt, in the treasury page's shape: one verdict, then the facts it is
 * made of. Nothing here is assumed — the status word is the network's own, read
 * back from the mirror.
 */
function Confirmation({ outcome, accountId }: { outcome: SubmitOutcome; accountId: string | null }) {
  const succeeded = outcome.kind === 'succeeded'
  const failed = outcome.kind === 'failed'

  const verdict = succeeded
    ? 'Thank you — it is on the record'
    : failed
      ? 'The network refused it'
      : 'Not confirmed yet'
  const badge = succeeded ? 'Confirmed' : failed ? 'Failed' : 'Unconfirmed'
  const badgeTone = succeeded
    ? 'border-accent text-accent'
    : failed
      ? 'border-accent bg-accent text-page'
      : 'border-rule text-ink-soft'

  const note = succeeded
    ? 'Your signature is on the topic. It joins the count once the mirror has indexed it — usually a few seconds.'
    : failed
      ? `The network answered ${outcome.status}. Nothing was written to the topic.`
      : 'Your wallet is done, but the mirror has not indexed the transaction yet. Check the explorer before signing again — a second message would stay on the topic too.'

  return (
    <section
      aria-live="polite"
      className={`mt-4 border ${succeeded ? 'border-accent/60 bg-accent/[0.05]' : 'border-rule bg-page'}`}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border ${
            succeeded
              ? 'border-accent text-accent'
              : failed
                ? 'border-accent bg-accent text-page'
                : 'border-rule text-ink-faint'
          }`}
        >
          {succeeded ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
              <path d="M2.5 8.5l3.5 3.5 7-8" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          ) : failed ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
              <path d="M8 4v4.5M8 11.5v.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          )}
        </span>

        <div className="min-w-0">
          <span
            className={`inline-block border px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.14em] ${badgeTone}`}
          >
            {badge}
          </span>
          <h3 className="mt-2 font-serif text-xl leading-tight text-ink">{verdict}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{note}</p>
        </div>
      </div>

      <dl className="grid gap-y-2 border-t border-rule/60 px-4 py-4 text-xs">
        {accountId ? <Fact label="Account">{accountId}</Fact> : null}
        <Fact label="Topic">
          <a
            href={hashscanTopicUrl(config.network, config.topicId)}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-rule underline-offset-2 hover:decoration-accent"
          >
            {config.topicId}
          </a>
        </Fact>
        <Fact label="Transaction">
          <a
            href={hashscanTransactionUrl(config.network, outcome.transactionId)}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-rule underline-offset-2 hover:decoration-accent"
          >
            {outcome.transactionId}
          </a>
        </Fact>
        <Fact label="Status">
          {failed ? outcome.status : succeeded ? outcome.status : 'not indexed yet'}
        </Fact>
      </dl>
    </section>
  )
}

/**
 * A label and its value, on one line if they fit.
 *
 * The value never breaks mid-string: a date that ends with "UTC" on a line of its own
 * reads as two facts, and a transaction id cut in half cannot be copied. When the row
 * is too narrow the value drops to its own line — whole.
 */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-rule/40 pb-1.5 last:border-b-0">
      <dt className="shrink-0 text-[0.5625rem] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-right font-mono text-[0.6875rem] whitespace-nowrap text-ink-soft">
        {children}
      </dd>
    </div>
  )
}
