/**
 * Content entry point.
 *
 * `LETTER_SLUG` names the campaign: it goes into every signature and into the
 * HCS topic memo. `letterText` is what gets hashed at build time — its SHA-256
 * is what a signature commits to, so it must be the exact text that is signed.
 *
 * Editing `letterText` after signatures exist invalidates them by design.
 */

/** Identifies this letter on the topic. Stable for the life of the campaign. */
export const SUBJECT = 'bonzo-exploit-open-letter'

/** Not written yet — keep empty until the text is signed off. */
export const letterText = ''

/** True while the text is a draft. Must block signing once the UI exists. */
export const letterIsDraft = true
