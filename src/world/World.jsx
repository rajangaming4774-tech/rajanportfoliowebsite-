import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import Lighting from './Lighting'
import { PRESETS, TIMES } from './lightingPresets'
import CityMap from './CityMap'
import Player from './Player'
import Hud from './Hud'
import Panel from './ui/Panel'
import { AutoDialog, ArrivalToast, RideStatus } from './ui/AutoDialog'
import AutoRide from './AutoRide'
import { OUTFITS } from './outfits'
import { planRoute } from './ride'
import PerfMonitor from './PerfMonitor'
import { createCamera, createInput, useKeyboard, useOrbit } from './input'
import { SPAWN, SPAWN_YAW, ZONES, landingSpot } from './zones'
import './World.css'

// Opening shot: low and in front of Rajan, the airport behind him; then the camera
// swings round behind him to face the city.
const INTRO = { yaw: 0, pitch: 0.1, distance: 9.5, delay: 1200, duration: 2800 }
const PLAY_CAM = { yaw: SPAWN_YAW, pitch: 0.32, distance: 7 }

const loadPref = (key, options) => {
  try {
    const saved = localStorage.getItem(key)
    return options.includes(saved) ? saved : options[0]
  } catch {
    return options[0]
  }
}
const savePref = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable (private mode); the choice just won't persist
  }
}
const loadOutfit = () => loadPref('rajan-outfit', OUTFITS)

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function World({ onTerminal, onClassic }) {
  // Mutable per-frame state lives in refs so reading/writing it never re-renders React.
  const inputRef = useRef(createInput())
  const camRef = useRef({ ...createCamera(INTRO.yaw), pitch: INTRO.pitch, distance: INTRO.distance })
  const playerPosRef = useRef({ x: SPAWN[0], z: SPAWN[2] })
  const uiRef = useRef({ locked: false, teleport: null })
  const rideRef = useRef({ phase: null })
  const timers = useRef([])
  const orbit = useOrbit(camRef)
  const [webgl] = useState(hasWebGL)
  const [ready, setReady] = useState(false)
  const [zone, setZone] = useState(null)
  const [moved, setMoved] = useState(false)
  const [panel, setPanel] = useState(null)
  // Auto ride UI: null | { phase: 'arriving' | 'asking' | 'riding' | 'arrived', target? }
  const [ride, setRide] = useState(null)
  const [outfit, setOutfit] = useState(loadOutfit)
  const toggleOutfit = useCallback(() => {
    setOutfit((o) => {
      const next = OUTFITS[(OUTFITS.indexOf(o) + 1) % OUTFITS.length]
      savePref('rajan-outfit', next)
      return next
    })
  }, [])
  const [time, setTime] = useState(() => loadPref('rajan-time', TIMES))
  const toggleTime = useCallback(() => {
    setTime((t) => {
      const next = TIMES[(TIMES.indexOf(t) + 1) % TIMES.length]
      savePref('rajan-time', next)
      return next
    })
  }, [])

  const onFirstMove = useCallback(() => setMoved(true), [])
  useKeyboard(inputRef, uiRef, onFirstMove)

  // Freeze the player while a panel is open or they're with the auto.
  useEffect(() => {
    const locked = !!panel || (!!ride && ride.phase !== 'arrived')
    uiRef.current.locked = locked
    if (locked) Object.assign(inputRef.current, createInput())
  }, [panel, ride])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  // Play the opening camera swing once the city has loaded; stop if the player grabs the camera.
  useEffect(() => {
    if (!ready) return
    const cam = camRef.current
    let expected = cam.yaw
    let start
    let frame
    const tick = (now) => {
      if (Math.abs(cam.yaw - expected) > 1e-6) return
      start ??= now
      const t = Math.min(1, Math.max(0, (now - start - INTRO.delay) / INTRO.duration))
      const e = t * t * (3 - 2 * t)
      cam.yaw = INTRO.yaw + (PLAY_CAM.yaw - INTRO.yaw) * e
      cam.pitch = INTRO.pitch + (PLAY_CAM.pitch - INTRO.pitch) * e
      cam.distance = INTRO.distance + (PLAY_CAM.distance - INTRO.distance) * e
      expected = cam.yaw
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ready])

  const openPanel = useCallback(() => {
    if (zone?.section) setPanel(zone)
  }, [zone])

  const startRide = useCallback((id) => {
    const target = ZONES.find((z) => z.id === id)
    const r = rideRef.current
    if (!target || r.phase !== 'asking') return
    const route = planRoute({ x: r.x, z: r.z }, landingSpot(target), target.via)
    Object.assign(r, { phase: 'riding', route, dist: 0, speed: 0, skip: false, target })
    setRide({ phase: 'riding', target })
  }, [])

  // Hail an auto: it pulls up from the side, Rajan hops in, the driver asks where to.
  // With a destination (minimap click) it skips the question and drives straight there.
  const hail = useCallback((destinationId) => {
    const r = rideRef.current
    if (r.phase) return
    setPanel(null)
    setMoved(true)
    const p = playerPosRef.current
    const yaw = camRef.current.yaw
    const side = { x: Math.cos(yaw), z: -Math.sin(yaw) } // camera's right-hand side
    Object.assign(r, {
      phase: 'arriving',
      t: 0,
      from: { x: p.x + side.x * 14, z: p.z + side.z * 14 },
      stop: { x: p.x, z: p.z },
      x: p.x + side.x * 14,
      z: p.z + side.z * 14,
      yaw: Math.atan2(-side.x, -side.z),
      preset: destinationId ?? null,
      route: null,
    })
    setRide({ phase: 'arriving' })
  }, [])

  const cancelRide = useCallback(() => {
    if (rideRef.current.phase !== 'asking') return
    rideRef.current.phase = null
    setRide(null)
  }, [])

  // Called from the render loop (AutoRide) as the ride progresses.
  const onPickedUp = useCallback(() => {
    const { preset } = rideRef.current
    if (preset) startRide(preset)
    else setRide({ phase: 'asking' })
  }, [startRide])

  const onArrive = useCallback(() => {
    const r = rideRef.current
    const { target } = r
    // Step out on the passenger (left) side of the auto, facing the landmark.
    const spot = landingSpot(target)
    const leftSide = { x: Math.cos(r.yaw), z: -Math.sin(r.yaw) }
    uiRef.current.teleport = { ...spot, x: spot.x + leftSide.x * 1.8, z: spot.z + leftSide.z * 1.8 }
    setRide({ phase: 'arrived', target })
    if (target.section) timers.current.push(setTimeout(() => setPanel(target), 900))
  }, [])

  const onGone = useCallback(() => {
    timers.current.push(setTimeout(() => setRide((s) => (s?.phase === 'arrived' ? null : s)), 1600))
  }, [])

  const skipRide = useCallback(() => {
    rideRef.current.skip = true
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const phase = rideRef.current.phase
      if (phase === 'riding' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault()
        skipRide()
      } else if (e.code === 'Escape' && panel) {
        setPanel(null)
      } else if (e.code === 'KeyE' && !phase) {
        if (panel) setPanel(null)
        else openPanel()
      } else if (e.code === 'KeyT' && !panel) {
        if (!phase) hail()
        else if (phase === 'asking') cancelRide()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, openPanel, hail, cancelRide, skipRide])

  if (!webgl) {
    return (
      <div className="world-fallback">
        <p>Your browser can't run the 3D city (WebGL is unavailable).</p>
        <button type="button" className="hud-btn hud-btn-primary" onClick={onClassic}>
          Open the classic site
        </button>
      </div>
    )
  }

  return (
    <div className="world-root">
      <div className="world-canvas" {...orbit}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ fov: 55, near: 0.3, far: 700, position: [0, 6, -24] }}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: PRESETS[time].exposure }}
        >
          <PerfMonitor />
          <Lighting time={time} />

          <Suspense fallback={null}>
            <Physics gravity={[0, -20, 0]}>
              <CityMap />
              <Player
                inputRef={inputRef}
                camRef={camRef}
                uiRef={uiRef}
                rideRef={rideRef}
                playerPosRef={playerPosRef}
                onZoneChange={setZone}
                outfit={outfit}
              />
            </Physics>
            <AutoRide rideRef={rideRef} onPickedUp={onPickedUp} onArrive={onArrive} onGone={onGone} />
            <Ready onReady={setReady} />
          </Suspense>
        </Canvas>
      </div>

      <Hud
        zone={zone}
        moved={moved}
        inputRef={inputRef}
        camRef={camRef}
        playerPosRef={playerPosRef}
        riding={!!ride}
        onHail={() => hail()}
        outfit={outfit}
        onOutfit={toggleOutfit}
        time={time}
        onTime={toggleTime}
        onTravel={hail}
        onOpen={openPanel}
        onFirstMove={onFirstMove}
        onTerminal={onTerminal}
        onClassic={onClassic}
      />

      {panel && <Panel zone={panel} onClose={() => setPanel(null)} />}

      {ride?.phase === 'asking' && <AutoDialog currentId={zone?.id} onPick={startRide} onCancel={cancelRide} />}
      {ride?.phase === 'riding' && <RideStatus rideRef={rideRef} target={ride.target} onSkip={skipRide} />}
      {ride?.phase === 'arrived' && <ArrivalToast target={ride.target} />}

      <div className={`world-loading${ready ? ' is-done' : ''}`} aria-hidden={ready}>
        <p className="world-loading-title">Landing at Chennai Airport… ✈</p>
        <p className="world-loading-sub">loading physics · building the city</p>
        <div className="world-loading-bar">
          <span />
        </div>
      </div>
    </div>
  )
}

// Renders once everything inside the Suspense boundary (incl. Rapier's WASM) has loaded.
// Before lifting the loading screen, compile every material's shader once, so nothing
// stalls the first time a new building or person comes into view.
function Ready({ onReady }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    let cancelled = false
    const finish = () => !cancelled && onReady(true)
    const id = setTimeout(() => {
      const done = gl.compileAsync ? gl.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera))
      done.then(finish, finish)
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [onReady, gl, scene, camera])
  return null
}
