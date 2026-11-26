import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * A panel that explains the control it wraps, opening on hover, on focus and on tap.
 *
 * The same mechanics as `InfoTip` — portalled to `document.body`, positioned `fixed`
 * against the anchor and clamped to the window — because inside the letter sheet a panel
 * laid out in the flow is clipped the moment it reaches an edge. State rather than
 * `group-hover`, for the same reason: a tooltip that may not open is worse than none.
 *
 * The trigger keeps its own aria wiring. The caller passes the panel's `id` to whatever is
 * focusable inside, so the explanation is read as a description rather than a label.
 */
export function Tip({
  id,
  side = 'above',
  width = 250,
  panel,
  children,
}: {
  /** Id of the panel; the caller points `aria-describedby` at it. */
  id: string
  /** Which way the panel opens from the anchor. Falls back to the other side at the edge. */
  side?: 'above' | 'below'
  width?: number
  panel: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement | null>(null)
  const box = useRef<HTMLSpanElement | null>(null)
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)

  const place = () => {
    const target = anchor.current?.getBoundingClientRect()
    if (!target) return
    const measured = box.current?.getBoundingClientRect()
    const panelWidth = measured?.width ?? width
    const panelHeight = measured?.height ?? 0
    const gap = 8
    const margin = 8

    // centred on the anchor, then pulled back inside the window — on a phone a centred
    // panel over a button near the edge would otherwise hang off the screen
    let left = target.left + target.width / 2 - panelWidth / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin))

    let top = side === 'below' ? target.bottom + gap : target.top - panelHeight - gap
    if (top < margin) top = target.bottom + gap // no room above: open downwards instead
    if (top + panelHeight > window.innerHeight - margin) top = Math.max(margin, target.top - panelHeight - gap)

    setAt({ top, left })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open])

  useEffect(() => {
    if (!open) return
    // the sheet scrolls and the window can resize while the panel is open; either would
    // leave it pointing at where the anchor used to be
    const follow = () => place()
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [open])

  return (
    <>
      <span
        ref={anchor}
        className="inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((was) => !was)}
      >
        {children}
      </span>
      {createPortal(
        <span
          ref={box}
          id={id}
          role="tooltip"
          style={{ position: 'fixed', top: at?.top ?? -9999, left: at?.left ?? -9999, width }}
          className={`pointer-events-none z-[60] max-w-[calc(100vw-1rem)] rounded-sm border border-rule bg-page px-3 py-2 text-left text-[0.6875rem] font-normal normal-case leading-relaxed tracking-normal text-ink-soft shadow-xl transition-opacity duration-150 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {panel}
        </span>,
        document.body,
      )}
    </>
  )
}
