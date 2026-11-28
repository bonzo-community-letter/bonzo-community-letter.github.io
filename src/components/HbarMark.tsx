/**
 * The HBAR currency symbol, as published by Hedera in their brand library
 * (hedera.com/brand → "HBAR Symbol", `HBar-Currency-Symbol-Black.svg`).
 *
 * The path is used unchanged; only its colour comes from the page, so it can sit on the
 * accent disc. Typing U+210F instead would mean trusting every visitor's font to have the
 * glyph — most do not, and a fallback box inside a twenty-pixel circle is worse than no
 * symbol at all.
 */
const HBAR_PATH =
  'M445.3,522.4c-18.4,30.2-40.1,54.4-65.3,72.8-25.2,18.4-49.1,27.5-71.8,27.5s-30.8-5-42.6-15.1c-11.9-10.1-17.8-23.4-17.8-39.9s10.1-49.3,30.2-94.5l45.9-102.5c21.2-47,31.8-76.6,31.8-88.8s-2.4-12.9-7.3-16.6c-4.9-3.7-12.3-5.6-22.4-5.6-16.2,0-35.3,5.4-57.2,16.2-21.9,10.8-44.8,28.9-68.5,54.1-23.7,25.3-41.1,49-52.1,71.2-11,22.2-25.3,57.5-42.9,106.1l-41,109.6H0L156.2,194.4l-101.5,26.6-9.5-36.2,126.9-33.3,17.5-47.3c10.8-29,16.2-45.9,16.2-50.6,0-6.8-2.4-11.7-7.3-14.6-4.9-3-16.8-4.4-35.9-4.4h-17.3l6.5-18.7c57.2-1.2,99.7-6.5,127.4-16h13.5l-49.2,132.8,145.6-38.2,9.5,36.2-171,44.8-57.5,155.4c64.8-64.5,123.8-96.8,177-96.8s42.1,4.1,54,12.4c11.9,8.3,17.8,20.9,17.8,37.7s-10.6,45-31.8,95l-47.5,111.4c-18.4,43.5-27.5,68.6-27.5,75.5s1.8,13,5.4,16.9,9,5.8,16.2,5.8c13,0,27.5-6.4,43.7-19.1,16.2-12.7,30-28.5,41.6-47.5h26.4,0Z'

export function HbarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 445.3 622.7" aria-hidden="true" className={className} fill="currentColor">
      <path d={HBAR_PATH} />
    </svg>
  )
}
