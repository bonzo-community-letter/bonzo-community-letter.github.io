/**
 * Content entry point.
 *
 * `SUBJECT` names the campaign: it goes into every signature. `letterText` is what
 * gets hashed at build time — its SHA-256 is what a signature commits to, so it must
 * be the exact text that is signed.
 *
 * Editing `letterText` after signatures exist invalidates them by design.
 */

import { LETTER_BODY } from './letter-body'

/** Identifies this letter on the topic. Stable for the life of the campaign. */
export const SUBJECT = 'bonzo-communit-letter'

/** The letter, as signed. Its SHA-256 is what every signature commits to. */
export const letterText = LETTER_BODY

/** True while the text is a draft. False: the letter is published. */
export const letterIsDraft = false
