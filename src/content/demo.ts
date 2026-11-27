/**
 * Sample comments, for looking at the testimonials section before it has signers.
 *
 * Shown only when the page is opened with `?demo=1`, and labelled as samples where they
 * appear — nothing here is a signature, and the count above the letter ignores them.
 *
 * Two things shape what is written here.
 *
 * The sentiment follows the rate. An account at 56 % is at the bottom of the published range
 * and speaks like it; an account at 100 % got everything back and is still critical, because
 * the complaint in this letter was never only about the money — it is about a promise made in
 * public and then quietly narrowed. Nothing here is a slogan: each comment names something
 * that happened (the eleven days of silence, the banner, the liquidation window, the release,
 * the fixed July prices, the 658 accounts still short).
 *
 * The lengths are spread across the range the comment field allows (77 to 512 bytes, the
 * limit) and deliberately interleaved shortest-longest, because a grid that only ever sees
 * three lines of text is not designed, it is guessed at: the pairing that breaks a layout is
 * the one where one cell is a line and its neighbour is a page.
 *
 * The facts are the letter's own, from Bonzo's posts, the Supra incident report and the Bonzo
 * Finance Discord (#general-chat, Jul–Nov 2026): the 16 July promise of "advances covering the
 * full value of the losses", eleven days before the first public statement, liquidations that
 * ran during the exploit window, the portal's netting at fixed 11 July prices, the 56.1 %
 * floor for accounts that supplied only HBAR or USDC, 658 of 2,466 accounts short, $1,065,255.68
 * outstanding, and the release every claimant signs to collect.
 */
import type { Signature } from '../lib/hcs'

/**
 * One entry per card, in the order the reel shows them. The rate on each line is what that
 * card displays; `null` is a card that states no rate — a supporter, or an account that did
 * not say. Testimonials marks every third card (index 1, 4, 7) as a supporter, so those carry
 * no rate at all.
 */
const samples: string[] = [
  // index 0 · affected, no rate · 145 bytes
  'I did not state a rate because I still cannot work out what mine is: the portal nets a position I never agreed to net, at prices from the day everything broke.',
  // index 1 · supporter · 105 bytes
  'I never held a position here. I signed because a promise made in public should be kept in public, whoever made it.',
  // index 2 · affected, 56.1 % · 445 bytes — the bottom of the published range
  'Fifty-six percent. I supplied HBAR and USDC, so I sit at the floor of the range published in November, and I am told this is the recovery. In July the commitment was "the full value of the losses to their affected positions", endorsed on Hedera\'s own account. Four months later the same campaign pays me half of it and calls the difference a rate. Nobody has put the arithmetic in writing.',
  // index 3 · affected, 62 % · 291 bytes
  'Eleven days of silence after the exploit, then a banner telling us to wait. I can forgive a slow week. I cannot forgive a promise of full value that became a range without anyone saying so, and a portal that values my position at prices from the morning it broke.',
  // index 4 · supporter · 235 bytes
  'I lost nothing here, which is why I am signing. I watched friends find out from a Discord message what had happened to their collateral. A chain that sells itself as a trust layer cannot leave its users to reconstruct the damage from a thread.',
  // index 5 · affected, 68.4 % · 332 bytes
  'The number is not my complaint — it was published, with a range, and I can check it against the snapshot. My complaint is that the July statement was edited and approved by the foundation and then narrowed without an explanation. Say what changed, and on what date, and I will stop arguing about the percentage.',
  // index 6 · affected, 81.39 % · 300 bytes
  'Eighty-one percent aggregate sounds like a rescue until you read which accounts make up the rest. 658 of 2,466 are still short, and the shortfall is $1,065,255.68 — small enough that the parties who promised full value could close it this week and end this.',
  // index 7 · supporter · 122 bytes
  'Hedera pushed this oracle and endorsed the recovery promise. Both of those were public. Being public is the whole point of a trust layer.',
  // index 8 · affected, 96.5 % · 479 bytes — nearly whole, still critical
  'I am almost whole and I am still signing. To collect my own assets the portal made me sign a release that gave up my claim on the part that was not returned, in a document long enough that the scroll gate failed on my phone the day it opened. A recovery that requires you to waive your rights to receive it is not a recovery; it is a settlement nobody negotiated. Four months of work by the people who built the protocol deserves thanks; the decision to narrow it was made by people who never spoke to us.',
  // index 9 · affected, 100 % · 337 bytes — fully covered, and still critical
  'I got everything back. It took four months, eleven days of silence at the start, and a promise that was rewritten while we waited. I am signing for the 658 accounts that did not get everything back, because "full value" was the word used in July, and it is still the word I am asking to be honoured.',
]

/** The rate each card shows, in the same order. `null` = no rate stated. */
const rates: (number | null)[] = [null, null, 56.1, 62, null, 68.4, 81.39, null, 96.5, 100]

/** Ten signatures that never happened, in the shape the page already reads. */
export function sampleSignatures(subject: string, letterHash: string): Signature[] {
  return samples.map((comment, index) => {
    const accountId = `0.0.9${String(index + 1).padStart(6, '0')}`
    const signedAt = new Date(Date.UTC(2026, 10, 15 + index, 9 + index, 14, 0)).toISOString()
    return {
      accountId,
      subject,
      letterHash,
      signedAt,
      version: 1,
      comment,
      sequence: 9001 + index,
      consensusTimestamp: `17955${String(10000 + index * 37)}.${String(100000000 + index * 1234567)}`,
      payerAccountId: accountId,
      // A spread across the range the portal actually pays — 56.1 % to 100 %. Nothing lower:
      // a sample that shows 8 % would put a number on the page that the recovery does not
      // support, and a demo is not a licence to invent a worse outcome than the real one.
      recoveryRate: rates[index] ?? null,
    }
  })
}
