import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Where a tooltip panel goes, given the element it explains.
 *
 * Portalled and `fixed`, so it is not clipped by a scrolling dialog or a three-pixel bar;
 * clamped to the window, so it cannot run off either side or off the top. Shared by the
 * circled-i in the sign dialog and the marker on the progress bar — two copies of this
 * arithmetic would drift apart at the first edge case.
 */
export function useTipPlacement({
  anchor,
  panel,
  open,
  side = 'below',
  align = 'left',
  width = 240,
}: {
  anchor: RefObject<HTMLElement | null>
  panel: RefObject<HTMLElement | null>
  open: boolean
  side?: 'above' | 'below'
  align?: 'left' | 'right'
  width?: number
}): { top: number; left: number } | null {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return

    const place = (): void => {
      const box = anchor.current?.getBoundingClientRect()
      if (!box) return
      const panelWidth = panel.current?.getBoundingClientRect().width ?? width
      const panelHeight = panel.current?.getBoundingClientRect().height ?? 0
      const gap = 8
      const margin = 8

      let left = align === 'left' ? box.left : box.right - panelWidth
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin))

      let top = side === 'below' ? box.bottom + gap : box.top - panelHeight - gap
      if (top < margin) top = box.bottom + gap // no room above: open downwards instead

      setAt({ top, left })
    }

    place()
    // The dialog scrolls and the window can resize while the panel is open; either would
    // leave it pointing at where the trigger used to be.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, side, align, width, anchor, panel])

  return at
}
