/**
 * Page copy — the words around the letter, not the letter itself.
 * The letter text lives in `letter.ts` because its hash is what gets signed;
 * this file is free to change without invalidating anything.
 */
export const page = {
  eyebrow: 'Supra Oracle & Bonzo Lend Exploit',

  title: 'An Open Letter',

  /**
   * The hero is a letter's address block: who writes, and to whom.
   * `from.note` replaces the old standfirst — same words, better placed.
   */
  from: {
    name: 'Affected Users of the Exploit',
    note:
      'After Hedera’s multi-million-dollar oracle exploit: A critical community letter on what was promised and what was delivered.',
  },

  letterhead: {
    date: '27 November 2026',
    // Legal names, one per line — a brand is not an entity, and a letter that drops the
    // suffix ("SEZC", "LLC", "FZCO") can be answered with "no such entity".
    // Verified 2026-11-21: Hedera Foundation SEZC (Cayman), Hedera Hashgraph, LLC
    // (Delaware), Hashgraph Foundry Inc. (Delaware), Bonzo Finance Foundation (Cayman),
    // Bonzo Finance Labs FZCO (UAE, Dubai Silicon Oasis), Entropy Stiftung operating as
    // Supra (Switzerland, Zug).
    to: [
      'Hedera Foundation SEZC',
      'Hedera Hashgraph, LLC',
      'Hashgraph Foundry Inc.',
      'Bonzo Finance Foundation',
      'Bonzo Finance Labs FZCO',
      'Supra Labs, Inc.',
      'Entropy Foundation',
    ],
    subject: 'Supra Oracle & Bonzo Lend Exploit',
    salutation: 'To the companies and institutions named above,',
  },

  /** Shown inside the sheet while `letterText` is still empty. */
  emptyLetterNotice:
    'The letter text is not written yet. Whatever is placed in src/content/letter.ts renders here, and its SHA-256 is what every signature commits to.',
}
