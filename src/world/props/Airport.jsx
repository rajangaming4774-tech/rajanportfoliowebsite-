import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider } from '@react-three/rapier'
import { cached, createKit } from './kit'
import { KitMesh } from './KitMesh'
import { Body } from './Landmarks'
import { ParkedCar } from './Traffic'
import { stripLightsAndCameras } from './gltf'

// Chennai International Airport (MAA). The terminal, departures deck, trusses,
// jet bridges, apron with aircraft, taxiway, runway, hangar and the chequered ATC
// tower are one GLB modelled in Higgsfield 3D (Blender) from photos of the real
// airport: public/models/chennai-airport.glb. Model origin = centre of the hall,
// landside (city) faces +z, airside (runway) is -z. Metres.

const MODEL = '/models/chennai-airport.glb'
const PI = Math.PI

// Must match the Blender script that built the model.
const W = 56
const D = 24
const H = 16
const DECK_Y = 6
const DECK_FRONT = D / 2 + 7 // z of the deck edge (landside)
const RAMP_LEN = 11
const GATES = [-18, 0, 18]
const TOWER = [-55, 0, -8]
const HANGAR = [-85, 0, -40]

export function Airport({ position }) {
  const { scene } = useGLTF(MODEL)
  const model = useMemo(() => {
    const root = stripLightsAndCameras(scene.clone(true))
    root.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      const m = o.material
      if (!m) return
      if (m.transparent) {
        // the glass: let the sky reflect in it and don't block what's behind
        m.depthWrite = false
        m.envMapIntensity = 1.6
        m.roughness = 0.06
        o.renderOrder = 2
        o.castShadow = false
      } else if (m.metalness > 0.5) {
        m.envMapIntensity = 1.2
      }
    })
    return root
  }, [scene])

  const [x, , z] = position
  const pillars = []
  for (let px = -W / 2 + 4; px <= W / 2 - 3; px += 6) pillars.push([px, DECK_FRONT - 1.6, 0.6, DECK_Y])
  const rampHyp = Math.hypot(RAMP_LEN, DECK_Y)

  return (
    <>
      <Body
        at={position}
        boxes={[
          [0, 0, W, H + 1.2, D], // the hall
          [TOWER[0] - 9, TOWER[2] - 2, 12, 5, 8], // tower services block
          [HANGAR[0], HANGAR[2], 40, 14, 30],
        ]}
        cyls={[...pillars, [TOWER[0], TOWER[2], 2.1, 27]]}
      >
        {/* Lifted 3 cm so the apron and forecourt plates don't z-fight with the ground. */}
        <primitive object={model} position-y={0.03} />
        {/* Departures deck and its two ramps are walkable */}
        <CuboidCollider args={[W / 2 - 1, 0.45, (DECK_FRONT - D / 2) / 2]} position={[0, DECK_Y - 0.15, D / 2 + (DECK_FRONT - D / 2) / 2]} />
        {[-1, 1].map((sx) => (
          <CuboidCollider
            key={sx}
            args={[2, 0.4, rampHyp / 2]}
            position={[sx * (W / 2 - 3), DECK_Y / 2, DECK_FRONT + RAMP_LEN / 2]}
            rotation={[Math.atan2(DECK_Y, RAMP_LEN), 0, 0]}
          />
        ))}
        {/* Jet bridges and the aircraft on the stands */}
        {GATES.map((gx) => (
          <group key={gx}>
            <CuboidCollider args={[1.3, 1.4, 5]} position={[gx + 1.5, DECK_Y + 1.4, -D / 2 - 6.5]} rotation={[0, -0.3, 0]} />
            <CuboidCollider args={[2.2, 2.2, 19]} position={[gx, 4.4, -D / 2 - 26]} />
            <CuboidCollider args={[19, 0.3, 2.2]} position={[gx, 3.5, -D / 2 - 24.5]} />
          </group>
        ))}
        <pointLight position={[0, DECK_Y - 1.4, DECK_FRONT - 3]} color="#ffe9c4" intensity={10} distance={22} />
        <pointLight position={[0, H - 1.5, 0]} color="#fff3dc" intensity={16} distance={34} />
      </Body>

      {[
        [x - 6, z + 23.5, 0.02],
        [x - 2.5, z + 23.9, -0.04],
        [x + 1, z + 23.5, 0.03],
        [x + 14, z + 23.6, -0.02],
      ].map(([tx, tz, rot], i) => (
        <ParkedCar key={i} kind="taxi" position={[tx, 0, tz]} rotation={rot + PI / 2} />
      ))}

      <Floodlight position={[x + 30, 0, z + 21]} />
      <Floodlight position={[x - 30, 0, z + 21]} />
    </>
  )
}

useGLTF.preload(MODEL)

function Floodlight({ position }) {
  return (
    <Body at={position} cyls={[[0, 0, 0.25, 14]]}>
      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.3, 14, 8]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 14.2, 0]}>
        <boxGeometry args={[1.8, 0.5, 0.5]} />
        <meshStandardMaterial color="#fff6dc" emissive="#fff1c9" emissiveIntensity={1.2} />
      </mesh>
    </Body>
  )
}

/* ---------- planes on approach over the city ---------- */

function buildPlane() {
  const k = createKit()
  const WHITE = '#f4f6f8'
  const TAIL = '#1d4f8f'
  k.cyl(WHITE, [1.1, 1.1, 18, 14], [0, 0, 0], { r: [PI / 2, 0, 0] })
  k.sphere(WHITE, [1.1, 14, 8, 0, PI * 2, 0, PI / 2], [0, 0, 9], { r: [PI / 2, 0, 0] })
  k.cone(WHITE, [1.1, 4, 14], [0, 0.25, -11], { r: [-PI / 2, 0, 0], s: [1, 1, 0.75] })
  k.box(WHITE, [26, 0.3, 3.6], [0, -0.4, 0.5])
  k.box(WHITE, [9, 0.2, 1.8], [0, 0.4, -10.5])
  k.box(TAIL, [0.3, 4.2, 3], [0, 2.6, -10.8], { r: [-0.35, 0, 0] })
  for (const sx of [-1, 1]) k.cyl('#b8bec4', [0.6, 0.55, 2.6, 10], [sx * 5, -1.2, 1.6], { r: [PI / 2, 0, 0] })
  k.box('#2f4652', [1.6, 0.4, 0.3], [0, 0.45, 9.6], { layer: 'glass' })
  for (let i = -6; i <= 6; i += 1.2) k.box('#2f4652', [2.25, 0.25, 0.4], [0, 0.35, i], { layer: 'glass' })
  k.sphere('#ff3b30', [0.25, 6, 4], [-13, -0.4, 0.5], { layer: 'glow' })
  k.sphere('#3bff6b', [0.25, 6, 4], [13, -0.4, 0.5], { layer: 'glow' })
  return k.build()
}

// The runway in world space (the GLB's runway, centred 90 m airside of the hall).
const RUNWAY_Z = -146
const RUNWAY_X0 = -150 // west threshold (the east end, towards the sea, is at x ≈ 166)
const GEAR_Y = 3.6 // fuselage centre height when on the wheels (plane kit scaled ×1.9)
const PLANE_SCALE = 1.9
const smooth = (t) => t * t * (3 - 2 * t)

// Takeoff: line up at the west end, roll east accelerating, rotate, climb out over the sea.
function takeoffPose(t, out) {
  if (t < 0.12) {
    out.set(RUNWAY_X0 + 6, GEAR_Y, RUNWAY_Z, 0) // holding at the threshold
  } else if (t < 0.45) {
    const p = (t - 0.12) / 0.33
    out.set(RUNWAY_X0 + 6 + 190 * p * p, GEAR_Y, RUNWAY_Z, 0)
  } else {
    const p = (t - 0.45) / 0.55
    const x = RUNWAY_X0 + 196 + 420 * p + 160 * p * p
    out.set(x, GEAR_Y + 150 * p * p + 12 * p, RUNWAY_Z - 20 * p, Math.min(0.22, p * 1.6))
  }
  return out
}

// Landing: descend from over the sea (east) onto the runway, flare, roll out and slow down.
function landingPose(t, out) {
  if (t < 0.55) {
    const p = t / 0.55
    const x = 520 - 450 * p
    out.set(x, GEAR_Y + (1 - smooth(p)) * 110, RUNWAY_Z + (1 - p) * 30, 0.05 - p * 0.09)
  } else if (t < 0.9) {
    const p = (t - 0.55) / 0.35
    out.set(70 - 190 * (1 - (1 - p) * (1 - p)), GEAR_Y, RUNWAY_Z, 0)
  } else {
    out.set(-120, GEAR_Y, RUNWAY_Z, 0) // taxied off: parked at the west end until the next loop
  }
  return out
}

const pose = { x: 0, y: 0, z: 0, pitch: 0, set(x, y, z, pitch) { this.x = x; this.y = y; this.z = z; this.pitch = pitch; return this } }

// One plane taking off (westbound threshold → east, over the sea) and one landing
// (from the sea, rolling west), offset so there's always something on the runway.
export function Planes() {
  const kit = cached('plane', buildPlane)
  const a = useRef()
  const b = useRef()
  useFrame(({ clock }) => {
    const T = 38
    const t = (clock.elapsedTime % T) / T
    takeoffPose(t, pose)
    a.current.position.set(pose.x, pose.y, pose.z)
    a.current.rotation.set(-pose.pitch, PI / 2, 0, 'YXZ')
    a.current.visible = pose.x < 700

    const u = ((clock.elapsedTime + T * 0.5) % T) / T
    landingPose(u, pose)
    b.current.position.set(pose.x, pose.y, pose.z - 10)
    b.current.rotation.set(-pose.pitch, -PI / 2, 0, 'YXZ')
  })
  return (
    <>
      <group ref={a} scale={PLANE_SCALE}>
        <KitMesh kit={kit} shadows={false} />
      </group>
      <group ref={b} scale={PLANE_SCALE}>
        <KitMesh kit={kit} shadows={false} />
      </group>
    </>
  )
}
