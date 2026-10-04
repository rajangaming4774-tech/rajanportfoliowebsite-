// Adaptive quality for the 3D world. Self-contained; place inside <Canvas>.
//
// If the frame rate stays low, it lowers the pixel ratio a step at a time (down to 1),
// and never raises it again in the same session. It deliberately does NOT drop the
// resolution while the camera moves or bounce the resolution up and down: both show
// up as flickering while walking.
import { useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'

const MIN_DPR = 1

export default function PerfMonitor() {
  const setDpr = useThree((s) => s.setDpr)
  const dpr = useThree((s) => s.viewport.dpr)
  const current = useRef(null)

  const lower = () => {
    const from = current.current ?? dpr
    const next = Math.max(MIN_DPR, from - 0.25)
    if (next === from) return
    current.current = next
    setDpr(next)
  }

  return <PerformanceMonitor bounds={() => [40, 120]} flipflops={Infinity} onDecline={lower} onFallback={lower} />
}
