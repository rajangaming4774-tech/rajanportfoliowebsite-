import { useCallback, useEffect, useRef, useState } from 'react'

const FILL_MS = 1600 // time to fill while holding
const DRAIN_MS = 700 // time to empty after letting go

/**
 * Press-and-hold progress (0 → 1). Fills while holding, drains when released,
 * and calls onComplete once when it reaches 1.
 */
export function useHoldProgress({ enabled, onComplete }) {
  const [progress, setProgress] = useState(0)
  const holdingRef = useRef(false)
  const progressRef = useRef(0)
  const doneRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const setHolding = useCallback((value) => {
    holdingRef.current = value
  }, [])

  useEffect(() => {
    if (!enabled) {
      holdingRef.current = false
      return
    }
    let frame
    let last = performance.now()

    const tick = (now) => {
      const dt = now - last
      last = now
      const prev = progressRef.current
      const next = holdingRef.current
        ? Math.min(1, prev + dt / FILL_MS)
        : Math.max(0, prev - dt / DRAIN_MS)

      if (next !== prev) {
        progressRef.current = next
        setProgress(next)
      }
      if (next >= 1 && !doneRef.current) {
        doneRef.current = true
        onCompleteRef.current?.()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled])

  return { progress, setHolding }
}
