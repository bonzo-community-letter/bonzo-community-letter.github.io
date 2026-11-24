/**
 * Page copy — the words around the letter, not the letter itself.
 * The letter text lives in `letter.ts` because its hash is what gets signed;
 * this file is free to change without invalidating anything.
 */
export const page = {
  eyebrow: 'Bonzo Lend & Supra Exploit',

  /** Working title — still to be decided. */
  title: 'Open Letter',

  /**
   * The hero is a letter's address block: who writes, and to whom.
   * `from.note` replaces the old standfirst — same words, better placed.
   */
  from: {
    name: 'Affected users of the Bonzo Lend and Supra exploit',
    note: 'What happened, what was promised, what was delivered, and what questions remain unanswered.',
  },

  status: 'Draft — not yet published',

  letterhead: {
    date: '15 November 2026',
    to: 'Hedera Foundation, Hedera Hashgraph, Hashgraph Foundry, Supra, Bonzo Finance Foundation and Bonzo Finance Labs',
    subject: 'On the Bonzo Lend recovery — the commitment, the distribution, and what remains unanswered',
    salutation: 'To the addressees above,',
  },

  /** Shown inside the sheet while `letterText` is still empty. */
  emptyLetterNotice:
    'The letter text is not written yet. Whatever is placed in src/content/letter.ts renders here, and its SHA-256 is what every signature commits to.',
}
