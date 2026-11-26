import { useId } from 'react'
import { Tip } from './Tip'
import { RecoveryRing } from './RecoveryRing'
import { lossLine } from '../lib/recovery'
import { signedWhen } from '../lib/format'
import { standingOf, type SignerStanding } from '../lib/affected'

/**
 * The badge that says which side of the loss a signer is on.
 *
 * Affected users are the accounts Bonzo's own recovery dataset pays; everyone else is a
 * supporter. It is not a claim anyone makes about themselves — the set is fixed by the
 * position snapshot and committed to a Merkle root, so the badge is a fact about an
 * account id, not a mood.
 */
function StandingBadge({ standing }: { standing: SignerStanding }) {
  // one id per badge: the band draws one of these per signature, and an id shared by all of
  // them would point every description at the first panel
  const tipId = useId()
  const affected = standing === 'affected'
  // The badge makes a claim about an account, so it says where the claim comes from: nobody
  // declares this, it is read off the chain. Tab-focusable, because a tooltip that only
  // answers a mouse leaves the keyboard with a word it cannot question.
  return (
    <Tip
      id={tipId}
      side="above"
      panel={
        affected
          ? 'Recognised automatically from on-chain data: the account held a position in the 11 July snapshot and is on Bonzo\'s own recovery list. Nobody declares this.'
          : 'Not on Bonzo\'s recovery list for the 11 July snapshot, so this signer speaks as a supporter. Recognised from on-chain data, not declared.'
      }
    >
      <span
        tabIndex={0}
        aria-describedby={tipId}
        className={`shrink-0 rounded-full border px-2 py-[0.125rem] text-[0.5625rem] font-semibold uppercase tracking-[0.1em] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
          affected ? 'border-accent/50 text-accent' : 'border-rule text-ink-faint'
        }`}
      >
        {affected ? 'Affected User' : 'Supporter'}
      </span>
    </Tip>
  )
}

/**
 * One signer and what they said — the same card in the comment band and in the
 * "You have signed" dialog.
 *
 * The dialog used to describe the signature in a definition list; a signer's own
 * signature is a comment like any other, and showing it the way the band shows one
 * means the reader recognises it. It also means there is one piece of markup to keep
 * right instead of two that drift.
 *
 * A supporter has no recovery rate to report and no loss to describe: the dataset has
 * no position for that account. Whatever an older message may carry, the card shows the
 * rate as absent — a rate from a supporter would be a number about a loss they never had.
 */
export function SignerComment({
  accountId,
  comment,
  signedAt,
  recoveryRate,
  /** Which side of the loss the signer is on; defaults to the committed affected set. */
  standing = standingOf(accountId),
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
  standing?: SignerStanding
  signeeNumber?: number
  withTime?: boolean
  className?: string
}) {
  const affected = standing === 'affected'
  const rate = affected ? recoveryRate : null

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-3 pb-3">
        <RecoveryRing rate={rate} size={44} />
        <div className="min-w-0">
          <p className="whitespace-nowrap font-mono text-[0.6875rem] text-ink-soft">{accountId}</p>
          <p className="whitespace-nowrap text-[0.625rem] leading-snug text-ink-faint">
            {affected ? lossLine(rate) : 'Not in the recovery list'}
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
          the one fact that ties a comment to a position in the count. The badge shares
          that line, at the far edge, where it labels the whole card rather than the id. */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <p className="whitespace-nowrap font-mono text-[0.625rem] text-ink-faint">
          {signeeNumber ? <>Signee #{signeeNumber} · </> : null}
          {signedWhen(signedAt, { time: withTime })}
        </p>
        <StandingBadge standing={standing} />
      </div>
    </div>
  )
}
