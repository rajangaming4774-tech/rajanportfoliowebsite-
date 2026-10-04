import { capture } from '../pointer'
import { useEffect, useRef, useState } from 'react'
import { BEACH_X, ROADS, SEA_X, WORLD_BOUNDS, ZONES } from './zones'
import { PRESETS } from './lightingPresets'

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default function Hud({
  zone,
  moved,
  inputRef,
  camRef,
  playerPosRef,
  riding,
  onHail,
  outfit,
  onOutfit,
  time,
  onTime,
  onTravel,
  onOpen,
  onFirstMove,
  onTerminal,
  onClassic,
}) {
  const [touch] = useState(isTouch)

  return (
    <div className="hud">
      <header className="hud-top">
        <div className="hud-brand">
          <span className="hud-prompt">rajan@chennai</span>
          <span className="hud-where">{zone ? zone.name : 'Exploring'}</span>
        </div>
        <div className="hud-actions">
          <button type="button" className="hud-btn" onClick={onHail} disabled={riding}>
            🛺 Hail an auto{!touch && <kbd className="hud-key">T</kbd>}
          </button>
          <button type="button" className="hud-btn" onClick={onTime} title="Time of day">
            {PRESETS[time]?.icon} {PRESETS[time]?.label}
          </button>
          <button type="button" className="hud-btn" onClick={onOutfit} title="Change outfit">
            👕 {outfit === 'formal' ? 'Formal' : outfit === 'casual' ? 'Casual' : 'Street'}
          </button>
          <button type="button" className="hud-btn" onClick={onTerminal}>
            &gt;_ Terminal
          </button>
          <button type="button" className="hud-btn hud-btn-primary" onClick={onClassic}>
            Classic site
          </button>
        </div>
      </header>

      {!riding && <ZoneBanner zone={zone} touch={touch} onOpen={onOpen} />}

      {!moved && !riding && (
        <div className="hud-help">
          {touch ? (
            <p>Left thumb to move · drag to look · ⤒ to jump · 🛺 to fast travel</p>
          ) : (
            <p>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> open · <kbd>T</kbd> auto · drag to look · scroll to zoom
            </p>
          )}
        </div>
      )}

      <Minimap camRef={camRef} playerPosRef={playerPosRef} activeId={zone?.id} onTravel={onTravel} />

      {touch && <TouchControls inputRef={inputRef} onFirstMove={onFirstMove} />}
    </div>
  )
}

function ZoneBanner({ zone, touch, onOpen }) {
  if (!zone) return null
  const welcome = zone.id === 'spawn'
  return (
    <div className="zone-banner" key={zone.id} role="status">
      <p className="zone-banner-label">{welcome ? 'வணக்கம்! Welcome to' : `📍 ${zone.label}`}</p>
      <p className="zone-banner-name">{zone.name}</p>
      <p className="zone-banner-hint">
        {welcome
          ? 'Follow the glowing rings to explore my work.'
          : !zone.section
            ? 'Watch the planes take off and land ✈'
            : touch
              ? 'Tap to see the details.'
              : 'Press E to open'}
      </p>
      {zone.section && touch && (
        <button type="button" className="hud-btn hud-btn-primary zone-banner-open" onClick={onOpen}>
          Open
        </button>
      )}
    </div>
  )
}

function Minimap({ camRef, playerPosRef, activeId, onTravel }) {
  const arrow = useRef()
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS
  const w = maxX - minX
  const h = maxZ - minZ

  // Update the player arrow straight on the DOM every frame; no React re-renders.
  useEffect(() => {
    let frame
    const tick = () => {
      const cam = camRef.current
      const playerPos = playerPosRef.current
      const deg = (Math.atan2(-Math.cos(cam.yaw), -Math.sin(cam.yaw)) * 180) / Math.PI
      arrow.current?.setAttribute('transform', `translate(${playerPos.x} ${playerPos.z}) rotate(${deg})`)
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [camRef, playerPosRef])

  return (
    <svg className="minimap" viewBox={`${minX} ${minZ} ${w} ${h}`} aria-label="City map">
      <rect x={minX} y={minZ} width={w} height={h} fill="#9b8f78" />
      <rect x={BEACH_X} y={minZ} width={SEA_X - BEACH_X} height={h} fill="#e3d3a8" />
      <rect x={SEA_X} y={minZ} width={maxX - SEA_X} height={h} fill="#1f86a6" />
      <g fill="#3d3d40">
        {ROADS.map(([x, z, rw, rl]) => (
          <rect key={`${x},${z}`} x={x - rw / 2} y={z - rl / 2} width={rw} height={rl} />
        ))}
      </g>
      {ZONES.map((z) => (
        <g
          key={z.id}
          className="minimap-stop"
          transform={`translate(${z.position[0]} ${z.position[2]})`}
          onClick={() => onTravel(z.id)}
        >
          <title>{`Take an auto to ${z.label}`}</title>
          <circle r={7} fill="transparent" />
          <circle r={z.id === activeId ? 5 : 3.6} className={`minimap-zone${z.id === activeId ? ' is-active' : ''}`} />
          <text y={-6} className="minimap-label">
            {z.label}
          </text>
        </g>
      ))}
      <g ref={arrow}>
        <path d="M6 0 L-4 -4 L-2 0 L-4 4 Z" className="minimap-player" />
      </g>
    </svg>
  )
}

function TouchControls({ inputRef, onFirstMove }) {
  const base = useRef()
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const pointer = useRef(null)
  const MAX = 44

  const move = (e) => {
    const rect = base.current.getBoundingClientRect()
    let dx = e.clientX - (rect.left + rect.width / 2)
    let dy = e.clientY - (rect.top + rect.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > MAX) {
      dx = (dx / len) * MAX
      dy = (dy / len) * MAX
    }
    inputRef.current.joyX = dx / MAX
    inputRef.current.joyY = dy / MAX
    setKnob({ x: dx, y: dy })
  }
  const end = () => {
    pointer.current = null
    inputRef.current.joyX = 0
    inputRef.current.joyY = 0
    setKnob({ x: 0, y: 0 })
  }

  return (
    <>
      <div
        ref={base}
        className="joystick"
        onPointerDown={(e) => {
          pointer.current = e.pointerId
          capture(e)
          onFirstMove()
          move(e)
        }}
        onPointerMove={(e) => e.pointerId === pointer.current && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <button
        type="button"
        className="jump-btn"
        aria-label="Jump"
        onPointerDown={() => {
          inputRef.current.jump = true
        }}
        onPointerUp={() => {
          inputRef.current.jump = false
        }}
        onPointerCancel={() => {
          inputRef.current.jump = false
        }}
      >
        ⤒
      </button>
    </>
  )
}
