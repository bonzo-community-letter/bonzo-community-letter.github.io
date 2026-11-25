import { useState, type ReactNode } from 'react'

/**
 * A small circled i that explains the thing next to it.
 *
 * Opens on hover, on focus and on tap, and stays out of the way: the panel is
 * `pointer-events-none`, so it never blocks the control underneath while it is open.
 *
 * State rather than `group-hover`: the Tailwind variant lost to `opacity-0` in the built
 * sheet, and a tooltip that may not open is worse than no tooltip.
 */
export function InfoTip({
  id,
  label,
  side = 'below',
  align = 'left',
  width = '15rem',
  children,
}: {
  /** Id of the panel; the button points at it with `aria-describedby`. */
  id: string
  /** What the button says to a screen reader — the panel is the description. */
  label: string
  /** Which way the panel opens from the icon. */
  side?: 'above' | 'below'
  /**
   * `right` hangs the panel from the icon's right edge — but only where there is room;
   * on a phone it would be pushed off the screen, so there it falls back to the left.
   */
  align?: 'left' | 'right'
  width?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex align-baseline">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((was) => !was)}
        className="inline-flex h-[1.0625rem] w-[1.0625rem] items-center justify-center rounded-full border border-accent font-serif text-[0.625rem] italic leading-none text-accent transition-colors hover:bg-accent/15 focus:outline-none focus-visible:bg-accent/15"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        style={{ width }}
        className={`pointer-events-none absolute z-30 max-w-[70vw] rounded-sm border border-rule bg-page px-3 py-2 text-left text-[0.6875rem] font-normal normal-case leading-relaxed tracking-normal text-ink-soft shadow-xl transition-opacity duration-150 ${
          side === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'
        } ${align === 'left' ? 'left-0' : 'left-0 sm:left-auto sm:right-0'} ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {children}
      </span>
    </span>
  )
}
