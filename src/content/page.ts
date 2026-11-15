/**
 * Page copy — the words around the letter, not the letter itself.
 * The letter text lives in `letter.ts` because its hash is what gets signed;
 * this file is free to change without invalidating anything.
 */
export const page = {
  eyebrow: '11 July 2026 · Bonzo Lend oracle exploit',

  /** Working title — still to be decided. */
  title: 'Open community letter',

  subtitle:
    'From the users who lost funds when the oracle failed: what was promised, what was delivered, and the questions that still have no answer.',

  status: 'Draft — not yet published',

  letterhead: {
    from: 'Affected users of Bonzo Lend',
    date: '15 November 2026',
    to: 'Hedera, the HBAR Foundation, Supra Labs and the Bonzo Finance Foundation',
    subject: 'On the Bonzo Lend recovery — the commitment, the distribution, and what remains unanswered',
    salutation: 'To the addressees above,',
  },

  /** Shown inside the sheet while `letterText` is still empty. */
  emptyLetterNotice:
    'The letter text is not written yet. Whatever is placed in src/content/letter.ts renders here, and its SHA-256 is what every signature commits to.',
}
