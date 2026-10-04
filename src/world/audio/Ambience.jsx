import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import { createAmbience } from './engine'
import './audio.css'

function MuteButton({ engine }) {
  const muted = useSyncExternalStore(engine.subscribe, engine.getMuted)
  return (
    <button
      type="button"
      className="world-audio-btn"
      aria-pressed={muted}
      aria-label={muted ? 'Turn ambient sound on' : 'Mute ambient sound'}
      onClick={engine.toggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  )
}

// Rendered inside the Canvas. The audio only starts after a user gesture, and the
// mute button lives in its own React root on document.body (a DOM portal cannot
// be created from inside the three.js reconciler).
export default function Ambience() {
  const camera = useThree((s) => s.camera)
  const engineRef = useRef(null)

  useEffect(() => {
    const engine = createAmbience()
    engineRef.current = engine
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    root.render(<MuteButton engine={engine} />)

    const unlock = () => engine.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    if (navigator.userActivation?.hasBeenActive) engine.unlock()

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      engine.dispose()
      engineRef.current = null
      setTimeout(() => {
        root.unmount()
        host.remove()
      }, 0)
    }
  }, [])

  useFrame(() => {
    engineRef.current?.update(camera.position.x, camera.position.z)
  })
  return null
}
