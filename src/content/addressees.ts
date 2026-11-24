/**
 * Who the letter is addressed to.
 *
 * LOGOS: no third-party logo file is committed here on purpose. Using another
 * company's mark implies nothing by itself, but it does sit under their brand
 * guidelines and can read as endorsement — so the layout falls back to
 * typographic wordmarks until permission exists. To use a real mark, set
 * `logoSrc` to a file under `public/logos/` **after** checking that brand's
 * guidelines (or getting written permission) and keeping it monochrome,
 * unmodified and non-implying. See README → "Logos and trademarks".
 */
export interface Addressee {
  /** full name as it appears in the letter and in the hero's To block */
  name: string
  /** optional path under /logos/, e.g. '/logos/hedera.svg' — leave unset until cleared */
  logoSrc?: string
}

export const addressees: Addressee[] = [
  { name: 'Hedera Foundation' },
  { name: 'Hedera Hashgraph' },
  { name: 'Hashgraph Foundry' },
  { name: 'Bonzo Finance Foundation' },
  { name: 'Bonzo Finance Labs' },
  { name: 'Supra Labs' },
  { name: 'Entropy Foundation' },
]
