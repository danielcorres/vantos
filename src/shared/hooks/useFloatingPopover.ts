import { useEffect, useState } from 'react'

const PANEL_WIDTH = 160
const PANEL_HEIGHT_ESTIMATE = 220
const OFFSET = 8

export type Placement = 'bottom' | 'top'

export function useFloatingPopover(
  anchorRect: DOMRect | null,
  isOpen: boolean
): { style: React.CSSProperties; placement: Placement } {
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [placement, setPlacement] = useState<Placement>('bottom')

  useEffect(() => {
    if (!isOpen || !anchorRect || typeof window === 'undefined') return

    const spaceBelow = window.innerHeight - anchorRect.bottom - OFFSET
    const spaceAbove = anchorRect.top - OFFSET
    const openUpward = spaceBelow < PANEL_HEIGHT_ESTIMATE && spaceAbove >= spaceBelow

    const leftClamped = Math.max(
      8,
      Math.min(anchorRect.left, window.innerWidth - PANEL_WIDTH - 8)
    )

    if (openUpward) {
      setPlacement('top')
      setStyle({
        position: 'fixed',
        left: leftClamped,
        bottom: window.innerHeight - anchorRect.top + OFFSET,
        minWidth: PANEL_WIDTH,
        zIndex: 1000,
      })
    } else {
      setPlacement('bottom')
      setStyle({
        position: 'fixed',
        left: leftClamped,
        top: anchorRect.bottom + OFFSET,
        minWidth: PANEL_WIDTH,
        zIndex: 1000,
      })
    }
  }, [isOpen, anchorRect])

  return { style, placement }
}
