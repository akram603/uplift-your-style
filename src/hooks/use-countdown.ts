import { useEffect, useRef, useState } from 'react'

/**
 * Seconds remaining until `endsAt`, driven by requestAnimationFrame.
 *
 * The rAF loop is throttled to whole-second changes, so it renders at most
 * once per second and pauses automatically when the tab is hidden — far
 * lighter than a 250 ms interval on low-end phones.
 */
export function useCountdown(endsAt: number, active: boolean): number {
  const [left, setLeft] = useState(() => remaining(endsAt))
  const leftRef = useRef(left)

  useEffect(() => {
    const value = remaining(endsAt)
    leftRef.current = value
    setLeft(value)
    if (!active) return

    let raf = 0
    const loop = () => {
      const next = remaining(endsAt)
      if (next !== leftRef.current) {
        leftRef.current = next
        setLeft(next)
      }
      if (next > 0) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [endsAt, active])

  return left
}

function remaining(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}