import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import Terminal from './terminal/Terminal'
import ClassicSite from './classic/ClassicSite'
import ErrorBoundary from './ErrorBoundary'

// The 3D world (three.js + physics) is the heavy part, so it loads only when needed.
const World = lazy(() => import('./world/World'))

// Stages: 'terminal' → 'world' (the game), or 'classic' (plain site).
// #classic in the URL opens the classic site directly, handy for sharing with recruiters.
const initialStage = () => (window.location.hash === '#classic' ? 'classic' : 'terminal')

const TERMINAL_EXIT_MS = 900 // matches the crt-off animation

export default function App() {
  const [stage, setStage] = useState(initialStage)

  useEffect(() => {
    const hash = stage === 'classic' ? '#classic' : ''
    if (window.location.hash !== hash) {
      history.replaceState(null, '', `${window.location.pathname}${hash}`)
    }
    window.scrollTo(0, 0)
  }, [stage])

  const enterWorld = useCallback(() => {
    // Start downloading the world while the terminal animation plays.
    import('./world/World').catch(() => {})
    setTimeout(() => setStage('world'), TERMINAL_EXIT_MS)
  }, [])
  const openClassic = useCallback(() => setStage('classic'), [])
  const openTerminal = useCallback(() => setStage('terminal'), [])

  if (stage === 'classic') return <ClassicSite onTerminal={openTerminal} />
  if (stage === 'world') {
    return (
      <ErrorBoundary onClassic={openClassic} onTerminal={openTerminal}>
        <Suspense fallback={<div className="app-loading">Boarding the flight…</div>}>
          <World onTerminal={openTerminal} onClassic={openClassic} />
        </Suspense>
      </ErrorBoundary>
    )
  }
  return <Terminal onEnter={enterWorld} onClassic={openClassic} />
}
