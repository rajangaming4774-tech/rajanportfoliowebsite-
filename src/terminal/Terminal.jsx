import { capture } from '../pointer'
import { useCallback, useEffect, useRef, useState } from 'react'
import { runCommand, autocomplete } from './commands'
import { profile } from '../data/portfolio'
import { useHoldProgress } from './useHoldProgress'
import { playClick } from './sound'
import './Terminal.css'

const PROMPT = `${profile.handle}@chennai:~$`

const ASCII_NAME = [
  '██████╗  █████╗      ██╗ █████╗ ███╗   ██╗',
  '██╔══██╗██╔══██╗     ██║██╔══██╗████╗  ██║',
  '██████╔╝███████║     ██║███████║██╔██╗ ██║',
  '██╔══██╗██╔══██║██   ██║██╔══██║██║╚██╗██║',
  '██║  ██║██║  ██║╚█████╔╝██║  ██║██║ ╚████║',
  '╚═╝  ╚═╝╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝',
]

// [delay before line in ms, line]
const BOOT_SEQUENCE = [
  [200, { text: 'Chennai OS v1.0 — tty1', tone: 'dim' }],
  [500, { text: `${PROMPT} ./boot_portfolio.sh`, tone: 'accent' }],
  [450, { text: '[ OK ] Mounting /dev/marina-beach', tone: 'ok' }],
  [260, { text: '[ OK ] Spawning auto rickshaws (247 active)', tone: 'ok' }],
  [260, { text: '[ OK ] Brewing filter coffee ☕', tone: 'ok' }],
  [260, { text: '[ OK ] Loading portfolio: projects, skills, experience', tone: 'ok' }],
  [320, { text: '[WARN] Chennai heat detected: 38°C. Hydrate.', tone: 'warn' }],
  [300, { text: '[ OK ] City ready.', tone: 'ok' }],
]

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let nextId = 0
const entry = (lines, command) => ({ id: nextId++, lines, command })

export default function Terminal({ onEnter, onClassic }) {
  const [skipBoot] = useState(prefersReducedMotion)
  const [bootLines, setBootLines] = useState(() => (skipBoot ? BOOT_SEQUENCE.map(([, l]) => l) : []))
  const [booted, setBooted] = useState(skipBoot)
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [leaving, setLeaving] = useState(false)

  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const timersRef = useRef([])

  const leavingRef = useRef(false)
  const enter = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    onEnter()
  }, [onEnter])

  const { progress, setHolding } = useHoldProgress({ enabled: booted && !leaving, onComplete: enter })

  // Boot sequence: lines appear one by one. Any key / click skips it.
  const finishBoot = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setBootLines(BOOT_SEQUENCE.map(([, l]) => l))
    setBooted(true)
  }, [])

  useEffect(() => {
    if (skipBoot) return
    let elapsed = 0
    BOOT_SEQUENCE.forEach(([delay, l], i) => {
      elapsed += delay
      timersRef.current.push(
        setTimeout(() => {
          setBootLines((prev) => [...prev, l])
          if (i === BOOT_SEQUENCE.length - 1) setBooted(true)
        }, elapsed),
      )
    })
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      setBootLines([])
    }
  }, [skipBoot])

  // Keep the newest output in view.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [bootLines, history, booted])

  useEffect(() => {
    if (booted) inputRef.current?.focus({ preventScroll: true })
  }, [booted])

  // SPACE held = hold to enter, but only when the user isn't mid-command.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!booted) {
        finishBoot()
        return
      }
      if (e.code !== 'Space') return
      if (inputRef.current?.value) return
      e.preventDefault()
      if (!e.repeat) setHolding(true)
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') setHolding(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [booted, finishBoot, setHolding])

  const submit = (e) => {
    e.preventDefault()
    const value = input.trim()
    setInput('')
    setHistoryIndex(-1)
    if (value) setCmdHistory((h) => [value, ...h].slice(0, 50))

    const result = runCommand(value)
    if (result.action === 'clear') {
      setHistory([])
      return
    }
    setHistory((h) => [...h, entry(result.lines ?? [], value)])
    if (result.action === 'enter') setTimeout(enter, 500)
    if (result.action === 'classic') setTimeout(onClassic, 400)
    if (result.action === 'open') window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  const onInputKeyDown = (e) => {
    if (e.key.length === 1 || e.key === 'Backspace') playClick()
    if (e.key === 'Tab') {
      e.preventDefault()
      setInput((v) => autocomplete(v))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const i = Math.min(historyIndex + 1, cmdHistory.length - 1)
      if (i >= 0) {
        setHistoryIndex(i)
        setInput(cmdHistory[i])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const i = historyIndex - 1
      setHistoryIndex(Math.max(i, -1))
      setInput(i >= 0 ? cmdHistory[i] : '')
    }
  }

  const pct = Math.round(progress * 100)

  return (
    <div className={`term-screen${leaving ? ' is-leaving' : ''}`}>
      <div className="term-window" onClick={() => (booted ? inputRef.current?.focus() : finishBoot())}>
        <header className="term-titlebar">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
          <span className="term-title">{PROMPT.replace('$', '')} — zsh</span>
          <button
            type="button"
            className="term-skip"
            onClick={(e) => {
              e.stopPropagation()
              onClassic()
            }}
          >
            Skip to classic site →
          </button>
        </header>

        <div className="term-body" ref={scrollRef}>
          {bootLines.map((l, i) => (
            <Line key={`boot-${i}`} line={l} />
          ))}

          {booted && (
            <>
              <pre className="term-ascii" aria-label={profile.name}>
                {ASCII_NAME.join('\n')}
              </pre>
              <p className="term-line tone-title">{profile.role}</p>
              <p className="term-line tone-dim">📍 {profile.location} · வணக்கம்! Type “help” or just hold SPACE.</p>

              <div className="hold" aria-live="polite">
                <p className="hold-label">
                  {pct === 0 ? '> HOLD [SPACE] TO ENTER THE CITY' : pct < 100 ? '> KEEP HOLDING…' : '> ENTERING…'}
                </p>
                <div className="hold-row">
                  <span className="hold-bar" aria-hidden="true">
                    [{'█'.repeat(Math.round(progress * 24)).padEnd(24, '░')}]
                  </span>
                  <span className="hold-pct">{String(pct).padStart(3, ' ')}%</span>
                </div>
              </div>

              {history.map((h) => (
                <div key={h.id}>
                  <p className="term-line">
                    <span className="term-prompt">{PROMPT}</span> {h.command}
                  </p>
                  {h.lines.map((l, i) => (
                    <Line key={i} line={l} />
                  ))}
                </div>
              ))}

              <form className="term-input-row" onSubmit={submit}>
                <label htmlFor="term-input" className="term-prompt">
                  {PROMPT}
                </label>
                <input
                  id="term-input"
                  ref={inputRef}
                  className="term-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  aria-label="Terminal command"
                />
              </form>
            </>
          )}

          {!booted && <p className="term-line tone-dim term-skiphint">press any key to skip</p>}
        </div>

        {booted && (
          <button
            type="button"
            className="hold-button"
            style={{ '--p': progress }}
            onPointerDown={(e) => {
              e.preventDefault()
              capture(e)
              setHolding(true)
            }}
            onPointerUp={() => setHolding(false)}
            onLostPointerCapture={() => setHolding(false)}
            onPointerCancel={() => setHolding(false)}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => e.key === 'Enter' && enter()}
          >
            <span className="hold-button-fill" />
            <span className="hold-button-text">{pct > 0 ? `Hold… ${pct}%` : 'Press & hold to enter'}</span>
          </button>
        )}
      </div>
    </div>
  )
}

function Line({ line }) {
  const { text, tone, href } = typeof line === 'string' ? { text: line } : line
  const className = `term-line${tone ? ` tone-${tone}` : ''}`
  if (href) {
    return (
      <p className={className}>
        <a href={href} target="_blank" rel="noreferrer">
          {text}
        </a>
      </p>
    )
  }
  return <p className={className}>{text || ' '}</p>
}
