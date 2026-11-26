import { RecoveryRing } from './RecoveryRing'
import { lossLine } from '../lib/recovery'
import { signedWhen } from '../lib/format'

/**
 * One signer and what they said — the same card in the comment band and in the
 * "You have signed" dialog.
 *
 * The dialog used to describe the signature in a definition list; a signer's own
 * signature is a comment like any other, and showing it the way the band shows one
 * means the reader recognises it. It also means there is one piece of markup to keep
 * right instead of two that drift.
 */
export function SignerComment({
  accountId,
  comment,
  signedAt,
  recoveryRate,
  /** Place in the signing order, 1 for the first; omitted where it is not known. */
  signeeNumber,
  /** The dialog gives the exact moment; the band is a strip and only needs the day. */
  withTime = false,
  className = '',
}: {
  accountId: string
  comment: string
  signedAt: string
  recoveryRate: number | null
  signeeNumber?: number
  withTime?: boolean
  className?: string
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-3 pb-3">
        <RecoveryRing rate={recoveryRate} size={44} />
        <div className="min-w-0">
          <p className="whitespace-nowrap font-mono text-[0.6875rem] text-ink-soft">{accountId}</p>
          <p className="whitespace-nowrap text-[0.625rem] leading-snug text-ink-faint">
            {lossLine(recoveryRate)}
          </p>
        </div>
      </div>

      {/* Never cut: a signer wrote this to be read, and the page has no business
          deciding which half of it matters. */}
      {comment ? (
        <blockquote className="font-serif text-[1rem] leading-relaxed text-ink">{comment}</blockquote>
      ) : null}

      {/* mt-auto: the date sits at the card's foot, so dates line up whatever the
          comment's length. The number before it is the signer's place in the order —
          the one fact that ties a comment to a position in the count. */}
      <p className="mt-auto pt-3 whitespace-nowrap font-mono text-[0.625rem] text-ink-faint">
        {signeeNumber ? <>Signee #{signeeNumber} · </> : null}
        {signedWhen(signedAt, { time: withTime })}
      </p>
    </div>
  )
}
