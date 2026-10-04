import { useEffect, useRef, useState } from 'react'
import { ZONES } from '../zones'
import './AutoDialog.css'

const DRIVER = 'Murugan anna'
const QUESTION = 'Vanakkam saar! 🙏 Enga poganum? Where shall we go?'

const TEASERS = {
  spawn: 'Back to the airport where it all started',
  about: 'Chai and the story of who I am',
  skills: 'Shelves full of the tech I use',
  projects: 'Where I build things: my work',
  experience: 'My journey, floor by floor',
  contact: "By the sea. Let's talk!",
  runway: 'Watch the planes take off ✈',
}

const CHATTER = [
  'Hold on tight saar! 🛺',
  'Shortcut theriyum, don’t worry!',
  'First time in Chennai-aa? Filter coffee try pannunga ☕',
  'Rajan sir’s work-a paakka poreengala? Super choice!',
  'Meter podala. Free ride for portfolio visitors 😄',
  'Marina side traffic-u konjam jaasthi today…',
]

/** The driver asks where to go and lists every place on the site. */
export function AutoDialog({ currentId, onPick, onCancel }) {
  const root = useRef()
  const [typed, setTyped] = useState('')

  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i += 2
      setTyped(QUESTION.slice(0, i))
      if (i >= QUESTION.length) clearInterval(id)
    }, 28)
    root.current?.querySelector('.auto-option:not(:disabled)')?.focus()
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      const n = Number(e.key)
      if (n >= 1 && n <= ZONES.length && ZONES[n - 1].id !== currentId) {
        e.preventDefault()
        onPick(ZONES[n - 1].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentId, onPick, onCancel])

  const onArrows = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const items = [...root.current.querySelectorAll('.auto-option:not(:disabled)')]
    const i = items.indexOf(document.activeElement)
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
    items[(i + step + items.length) % items.length]?.focus()
  }

  return (
    <div className="auto-dialog" ref={root} role="dialog" aria-modal="true" aria-labelledby="auto-question" onKeyDown={onArrows}>
      <div className="auto-dialog-head">
        <span className="auto-avatar" aria-hidden="true">
          👨🏾
        </span>
        <div>
          <p className="auto-driver">{DRIVER} · auto driver</p>
          <p className="auto-question" id="auto-question" aria-label={QUESTION}>
            {typed}
            <span className="auto-caret" aria-hidden="true" />
          </p>
        </div>
      </div>

      <div className="auto-options">
        {ZONES.map((z, i) => {
          const here = z.id === currentId
          return (
            <button key={z.id} type="button" className="auto-option" disabled={here} onClick={() => onPick(z.id)}>
              <kbd>{i + 1}</kbd>
              <span className="auto-option-text">
                <strong>{z.label}</strong>
                <span className="auto-option-place">{z.name}</span>
                <span className="auto-option-teaser">{here ? "You're here" : TEASERS[z.id]}</span>
              </span>
            </button>
          )
        })}
      </div>

      <button type="button" className="auto-cancel" onClick={onCancel}>
        Never mind, I’ll walk <kbd>Esc</kbd>
      </button>
    </div>
  )
}

/** While riding: destination, live progress, driver small talk and a skip button. */
export function RideStatus({ rideRef, target, onSkip }) {
  const bar = useRef()
  const [line, setLine] = useState(0)

  useEffect(() => {
    let frame
    const tick = () => {
      const r = rideRef.current
      if (r.route && bar.current) bar.current.style.transform = `scaleX(${r.dist / r.route.total})`
      frame = requestAnimationFrame(tick)
    }
    tick()
    const id = setInterval(() => setLine((l) => (l + 1) % CHATTER.length), 2600)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(id)
    }
  }, [rideRef])

  return (
    <>
      <div className="ride-status" role="status">
        <p className="ride-status-to">
          🛺 Riding to <strong>{target.name}</strong>
        </p>
        <div className="ride-status-track">
          <span ref={bar} />
        </div>
        <button type="button" className="ride-skip" onClick={onSkip}>
          Skip ride <kbd>Space</kbd>
        </button>
      </div>
      <p className="driver-bubble" key={line} aria-live="polite">
        <span aria-hidden="true">👨🏾</span> {CHATTER[line]}
      </p>
    </>
  )
}

export function ArrivalToast({ target }) {
  return (
    <p className="driver-bubble driver-bubble-arrive" role="status">
      <span aria-hidden="true">👨🏾</span> Vandhachu! We’ve reached <strong>{target.name}</strong>. Enjoy! 🙏
    </p>
  )
}
