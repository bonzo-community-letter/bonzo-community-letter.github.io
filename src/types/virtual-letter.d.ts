/**
 * Injected by the `letter-hash` Vite plugin (build/letter-hash.ts).
 * The hash is computed from src/content/letter.ts at build time.
 */
declare module 'virtual:letter' {
  export const letterId: string
  export const letterText: string
  /** SHA-256 of letterText, lowercase hex — the value a signature commits to */
  export const letterHash: string
  export const letterBytes: number
  export const isDraft: boolean
}
