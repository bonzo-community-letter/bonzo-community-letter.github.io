import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTipPlacement } from '../hooks/useTipPlacement'

/**
 * A small circled i that explains the thing next to it.
 *
 * The panel is portalled to `document.body` and positioned `fixed` against the button.
 * Inside the dialog it was clipped the moment it reached the edge of the scrolling
 * content — a tooltip that is cut off is worse than none. Fixed positioning takes it out
 * of that box; the placement is clamped to the window, so it cannot run off either side
 * or off the top.
 *
 * It opens on hover, on focus and on tap, and is `pointer-events-none`, so it never
 * blocks the control it covers. State rather than `group-hover`: the variant lost to
 * `opacity-0` in the built sheet, and a tooltip that may not open is worse than none.
 */
export function InfoTip({
  id,
  label,
  side = 'below',
  align = 'left',
  width = 240,
  children,
}: {
  /** Id of the panel; the button points at it with `aria-describedby`. */
  id: string
  /** What the button says to a screen reader — the panel is the description. */
  label: string
  /** Which way the panel opens from the icon. */
  side?: 'above' | 'below'
  /** `right` hangs it from the icon's right edge; both are clamped to the window. */
  align?: 'left' | 'right'
  width?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement | null>(null)
  const panel = useRef<HTMLSpanElement | null>(null)
  const at = useTipPlacement({ anchor: button, panel, open, side, align, width })

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((was) => !was)}
        className="inline-flex h-[1.0625rem] w-[1.0625rem] shrink-0 items-center justify-center rounded-full border border-accent font-serif text-[0.625rem] italic leading-none text-accent transition-colors hover:bg-accent/15 focus:outline-none focus-visible:bg-accent/15"
      >
        i
      </button>
      {createPortal(
        <span
          ref={panel}
          id={id}
          role="tooltip"
          style={{
            position: 'fixed',
            top: at?.top ?? -9999,
            left: at?.left ?? -9999,
            width,
          }}
          className={`pointer-events-none z-[60] max-w-[calc(100vw-1rem)] rounded-sm border border-rule bg-page px-3 py-2 text-left text-[0.6875rem] font-normal normal-case leading-relaxed tracking-normal text-ink-soft shadow-xl transition-opacity duration-150 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {children}
        </span>,
        document.body,
      )}
    </>
  )
}
