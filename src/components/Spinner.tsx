/**
 * A turning ring for a wait the page owns — the label stays, the ring says the
 * page is working. Inherits `currentColor`, so it takes the tone of whatever
 * it sits in.
 */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 animate-spin rounded-full border border-current border-t-transparent ${className}`}
    />
  )
}
