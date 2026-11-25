/**
 * Sample comments, for looking at the testimonials section before it has signers.
 *
 * Shown only when the page is opened with `?demo=1`, and labelled as samples where they
 * appear — nothing here is a signature, and the count above the letter ignores them.
 *
 * The lengths are spread across the range the comment field allows (77 to 512 bytes,
 * the limit) and deliberately interleaved shortest-longest, because a grid that only
 * ever sees three lines of text is not designed, it is guessed at: the pairing that
 * breaks a layout is the one where one cell is a line and its neighbour is a page.
 */
import type { Signature } from '../lib/hcs'

const samples: string[] = [
  // 77 bytes
  'I held 41,000 HBAR in the pool for eleven months. One oracle print erased it.',
  // 512 bytes — the longest comment the field accepts
  'I have spent five weeks being told that the situation is complex and that I should be patient, while the people responsible for the complexity publish nothing at all. I deposited HBAR into a pool that advertised a liquidation mechanism backed by an oracle. The oracle reported a price that did not exist, the pool accepted it, the collateral was taken, and the debt remained. Every party in that sentence is a company with a name, a registration number and a legal address. I am asking for the record to be kept.',
  // 88 bytes
  'The recovery plan reads well until the page where nobody is named as responsible for it.',
  // 339 bytes
  'I have signed because a letter with names and dates is harder to ignore than a thread on X. I do not expect an apology, and I would not know what to do with one. What I expect is the thing that was promised in July, delivered on the terms it was promised, and a public account of where the shortfall went if it cannot be delivered in full.',
  // 109 bytes
  'I am not asking for sympathy. I am asking for the distribution schedule in writing, with dates that are kept.',
  // 310 bytes
  'Eleven days between the exploit and the first public statement. In that time the only communication was a banner on the app telling us to wait. Whatever was happening internally, the people holding the loss were told nothing, and some of us made decisions in that silence that we would not have made otherwise.',
  // 126 bytes
  'Three weeks of silence, then a portal that asks us to prove a debt we never disputed. That is not a process, that is a filter.',
  // 224 bytes
  'There is a version of this story where the protocol pays what it promised, publishes who decided what, and treats the people who lost money as counterparties rather than as a support queue. I would like to read that version.',
  // 213 bytes
  'What struck me most was how quickly the language changed: from \u201cfully covered\u201d to \u201csubject to available resources\u201d in the space of a single post, with no explanation of what had been discovered in between.',
  // 234 bytes
  'I ran a small vault for four friends. We read the audit, we read the docs, we accepted the risk we were shown. None of that documentation mentioned that a single price feed could empty the pool while liquidations ran on the same feed.',
]

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
      // the samples carry a spread of rates, as the real topic will
      recoveryRate: [null, 0, 4.2, 8.8, 12.5, 0, 21, 8.8, 3.1, 100][index % 10] ?? null,
    }
  })
}
