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
/**
 * Close every open tip.
 *
 * A dialog is opened by the same click that opens the tip on its trigger, and the panel is
 * portalled above everything — so it would hang in front of the dialog it just opened. Any
 * control that opens something above the page calls this first.
 */
/**
 * Whether the last thing the reader did was use the keyboard. A tip opens on focus only when
 * it was — after a dialog closes, focus returns to the button that opened it, and a panel
 * there would be the one the reader just dismissed. `:focus-visible` is not reliable enough
 * inside the focus event itself, so the input that caused the focus is remembered instead.
 */
let focusedByKeyboard = false
if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab' || event.key.startsWith('Arrow')) focusedByKeyboard = true
    },
    true,
  )
  window.addEventListener('pointerdown', () => (focusedByKeyboard = false), true)
}

export function closeTips() {
  window.dispatchEvent(new Event('letter:close-tips'))
}

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

  // Listening whether or not it is open: a tip that is closed has nothing to do.
  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('letter:close-tips', close)
    return () => window.removeEventListener('letter:close-tips', close)
  }, [])

  useEffect(() => {
    if (!open) return
    // the sheet scrolls and the window can resize while the panel is open; either would
    // leave it pointing at where the anchor used to be
    const follow = () => place()
    // A tap opens the panel; a tap anywhere else closes it. Toggling on the trigger itself
    // does not work on a phone: the tap first fires `mouseenter`, which opens the panel,
    // and the click that follows would close it again in the same gesture.
    const away = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <>
      <span
        ref={anchor}
        className="inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          if (focusedByKeyboard) setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
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
