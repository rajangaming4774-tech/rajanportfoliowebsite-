import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { cached, createKit, makeLabel } from './kit'
import { KitMesh } from './KitMesh'

// Chennai traffic, modelled on photos of the real vehicles:
//  - Bajaj RE auto rickshaw: rounded nose with one headlamp, curved windscreen,
//    canvas hood, open sides, rear box. Chennai livery: yellow body, black hood.
//  - MTC city buses (Ashok Leyland): big curved windscreen with the route board
//    above it. Ordinary fare = white with blue bands; deluxe = cream with a red band.
//  - Call taxis: white sedans with yellow number plates and a roof sign.
//  - A few private hatchbacks for colour.
// Bodies are merged kits; wheels are separate meshes so they can spin.

const PI = Math.PI
const TYRE = '#161616'
const HUB = '#b9bec3'
const GLASS = '#2f4652'

// A closed rounded-rectangle route. at(d) -> position + heading for distance d.
function makeLoop([x0, x1, z0, z1], r) {
  const a = x1 - x0 - 2 * r
  const b = z1 - z0 - 2 * r
  const arc = (PI / 2) * r
  const corner = (cx, cz, th) => [cx + r * Math.cos(th), cz + r * Math.sin(th), Math.sin(th), -Math.cos(th)]
  const segs = [
    [a, (s) => [x1 - r - s, z0, -1, 0]],
    [arc, (s) => corner(x0 + r, z0 + r, -PI / 2 - s / r)],
    [b, (s) => [x0, z0 + r + s, 0, 1]],
    [arc, (s) => corner(x0 + r, z1 - r, PI - s / r)],
    [a, (s) => [x0 + r + s, z1, 1, 0]],
    [arc, (s) => corner(x1 - r, z1 - r, PI / 2 - s / r)],
    [b, (s) => [x1, z1 - r - s, 0, -1]],
    [arc, (s) => corner(x1 - r, z0 + r, -s / r)],
  ]
  const total = segs.reduce((n, [len]) => n + len, 0)
  const base = (d) => {
    let s = ((d % total) + total) % total
    for (const [len, fn] of segs) {
      if (s <= len) return fn(s)
      s -= len
    }
    return segs[0][1](0)
  }
  return {
    total,
    at(d, reverse = false) {
      const [x, z, hx, hz] = base(reverse ? total - d : d)
      return { x, z, yaw: Math.atan2(hx, hz) + (reverse ? PI : 0) }
    },
  }
}

// Lanes sit inside the road rectangles in zones.js; the spawn junction stays clear.
const CITY_LOOP = makeLoop([1.8, 29.6, -14, 26.5], 4)
const MAIN_SOUTH_LOOP = makeLoop([-1.8, 1.8, 34, 58], 1.8)
const LOOPS = { city: CITY_LOOP, south: MAIN_SOUTH_LOOP }

/* ---------- wheels ---------- */

// wheels: [{ x, z, r, w }] — axle centre, radius, tyre width. Rendered as separate meshes so they spin.
function Wheels({ wheels, spin }) {
  const group = useRef()
  useFrame(() => {
    if (!group.current || !spin) return
    const rot = spin.current
    for (const child of group.current.children) child.rotation.x = rot / child.userData.r
  })
  return (
    <group ref={group}>
      {wheels.map((w, i) => (
        <group key={i} position={[w.x, w.r, w.z]} userData={{ r: w.r }}>
          <mesh rotation-z={PI / 2} castShadow>
            <cylinderGeometry args={[w.r, w.r, w.w, 18]} />
            <meshStandardMaterial color={TYRE} roughness={0.95} />
          </mesh>
          <mesh rotation-z={PI / 2}>
            <cylinderGeometry args={[w.r * 0.55, w.r * 0.55, w.w + 0.02, 12]} />
            <meshStandardMaterial color={HUB} metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Vehicle({ loop, speed, start = 0, reverse = false, size, wheels, children }) {
  const body = useRef()
  const dist = useRef(start)
  const spin = useRef(0)
  const init = loop.at(start, reverse)
  useFrame((_, dt) => {
    const b = body.current
    if (!b) return
    const step = speed * Math.min(dt, 0.05)
    dist.current = (dist.current + step) % loop.total
    spin.current += step
    const p = loop.at(dist.current, reverse)
    b.setNextKinematicTranslation({ x: p.x, y: 0, z: p.z })
    b.setNextKinematicRotation({ x: 0, y: Math.sin(p.yaw / 2), z: 0, w: Math.cos(p.yaw / 2) })
  })
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[init.x, 0, init.z]} rotation={[0, init.yaw, 0]}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={[0, size[1] / 2, size[3] || 0]} />
      {children}
      <Wheels wheels={wheels} spin={spin} />
    </RigidBody>
  )
}

/* ---------- MTC bus ---------- */

const BUS_LIVERIES = {
  ordinary: { upper: '#f3f4f2', band: '#1f5fb8', skirt: '#1f5fb8', route: '29C', boardFg: '#ff3b30', boardBg: '#f6f3e8' },
  deluxe: { upper: '#efe8d2', band: '#c8282d', skirt: '#c8282d', route: '21G', boardFg: '#111111', boardBg: '#f6f3e8' },
}

const BUS_WHEELS = [
  { x: -1.12, z: 2.6, r: 0.52, w: 0.32 },
  { x: 1.12, z: 2.6, r: 0.52, w: 0.32 },
  { x: -1.12, z: -2.4, r: 0.52, w: 0.32 },
  { x: 1.12, z: -2.4, r: 0.52, w: 0.32 },
]

function buildBus(livery) {
  const L = BUS_LIVERIES[livery]
  const k = createKit()
  const len = 10.2
  const wid = 2.5
  // Lower body and skirt
  k.box(L.skirt, [wid, 0.95, len], [0, 0.95, 0])
  k.box(L.upper, [wid, 1.0, len], [0, 1.95, 0])
  k.box(L.band, [wid + 0.02, 0.18, len + 0.02], [0, 1.52, 0])
  // Window belt: dark glass with thin pillars, then the roof with a slight crown
  k.box(GLASS, [wid - 0.04, 1.05, len - 1.6], [0, 2.98, -0.3], { layer: 'glass' })
  for (let z = -4.3; z <= 3.9; z += 1.25) k.box(L.upper, [wid, 1.05, 0.1], [0, 2.98, z])
  k.box(L.upper, [wid, 0.12, len], [0, 2.45, 0])
  k.box(L.upper, [wid, 0.5, len], [0, 3.75, 0])
  k.box(L.band, [wid + 0.02, 0.1, len + 0.02], [0, 3.55, 0])
  k.box(L.upper, [wid - 0.4, 0.16, len - 0.6], [0, 4.06, 0])
  // Front: big curved windscreen (two angled panes), route board, grille, bumper, lights
  k.box(GLASS, [wid - 0.3, 1.7, 0.06], [0, 2.85, len / 2 + 0.02], { layer: 'glass', r: [-0.08, 0, 0] })
  k.box(L.boardBg, [wid - 0.5, 0.45, 0.06], [0, 3.95, len / 2 + 0.03])
  k.box('#1d1b1a', [wid, 0.35, 0.25], [0, 0.6, len / 2 + 0.08])
  k.box('#2b2b30', [1.6, 0.5, 0.06], [0, 1.1, len / 2 + 0.03])
  for (const sx of [-1, 1]) {
    k.box('#fff2c8', [0.45, 0.28, 0.06], [sx * 0.9, 1.05, len / 2 + 0.05], { layer: 'glow' })
    k.box('#ff9f1c', [0.22, 0.14, 0.06], [sx * 1.1, 0.78, len / 2 + 0.05], { layer: 'glow' })
    k.box('#ff3b30', [0.3, 0.42, 0.06], [sx * 0.95, 1.1, -len / 2 - 0.04], { layer: 'glow' })
    // Mirrors on stalks
    k.box('#1d1b1a', [0.06, 0.4, 0.22], [sx * 1.42, 2.9, len / 2 - 0.3])
    k.box('#1d1b1a', [0.35, 0.05, 0.05], [sx * 1.3, 3.1, len / 2 - 0.3])
  }
  // Doorways (front and rear, left side), rear bumper, roof vents, number plates
  for (const z of [3.2, -3.4]) {
    k.box('#15161a', [0.08, 2.0, 1.1], [-wid / 2 - 0.02, 2.0, z])
    k.box(L.upper, [0.1, 2.0, 0.08], [-wid / 2 - 0.03, 2.0, z + 0.58])
  }
  k.box('#1d1b1a', [wid, 0.3, 0.2], [0, 0.6, -len / 2 - 0.06])
  for (const z of [2.2, -0.2, -2.6]) k.box('#dedad0', [0.8, 0.14, 0.9], [0, 4.0, z])
  k.box('#f2c230', [0.6, 0.16, 0.04], [0, 0.45, len / 2 + 0.22])
  k.box('#f2c230', [0.6, 0.16, 0.04], [0, 0.45, -len / 2 - 0.18])
  // MTC roundel on the side
  k.circle('#1f5fb8', [0.22, 16], [wid / 2 + 0.02, 2.0, 3.5], { r: [0, PI / 2, 0] })
  k.circle('#1f5fb8', [0.22, 16], [-wid / 2 - 0.02, 2.0, 3.5], { r: [0, -PI / 2, 0] })
  return k.build()
}

export function MtcBus({ livery = 'ordinary', loop = 'city', speed = 6.5, start = 8, reverse = false }) {
  const L = BUS_LIVERIES[livery]
  const kit = cached(`bus-${livery}`, () => buildBus(livery))
  const tex = useMemo(() => makeLabel(L.route, { bg: L.boardBg, fg: L.boardFg, w: 256, h: 64, font: '700 44px sans-serif' }), [L])
  return (
    <Vehicle loop={LOOPS[loop]} speed={speed} start={start} reverse={reverse} size={[2.5, 4.1, 10.2]} wheels={BUS_WHEELS}>
      <KitMesh kit={kit} />
      <mesh position={[0, 3.95, 5.17]}>
        <planeGeometry args={[1.4, 0.34]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </Vehicle>
  )
}

/* ---------- Bajaj RE auto rickshaw ---------- */

const AUTO_WHEELS = [
  { x: 0, z: 1.15, r: 0.26, w: 0.12 },
  { x: -0.62, z: -0.75, r: 0.26, w: 0.14 },
  { x: 0.62, z: -0.75, r: 0.26, w: 0.14 },
]

function buildRickshaw() {
  const Y = '#f2c230'
  const Y_D = '#d9a81c'
  const B = '#1c1c1c'
  const CANVAS = '#1e1e1e'
  const k = createKit()
  // Floor pan and the passenger tub (rear box), with the rounded tail
  k.box(B, [1.3, 0.1, 2.2], [0, 0.32, -0.2])
  k.box(Y, [1.3, 0.75, 1.5], [0, 0.72, -0.45])
  k.cyl(Y, [0.375, 0.375, 1.3, 16, 1, false, PI / 2, PI], [0, 0.72, -1.2], { r: [0, 0, PI / 2], s: [1, 1, 0.6] })
  k.box(Y_D, [1.32, 0.08, 1.52], [0, 1.1, -0.45])
  // Driver's nose: rounded front cowl over the single wheel, with the headlamp and a yellow mudguard
  k.sphere(Y, [0.48, 16, 12, 0, PI * 2, 0, PI / 2], [0, 0.55, 1.05], { r: [PI / 2, 0, 0], s: [1.2, 1, 1.15] })
  k.box(Y, [1.05, 0.5, 0.9], [0, 0.72, 0.65])
  k.cyl(Y, [0.34, 0.34, 0.28, 16, 1, false, 0, PI], [0, 0.4, 1.15], { r: [0, 0, PI / 2] })
  k.sphere('#fff6dc', [0.11, 10, 8], [0, 0.92, 1.33], { layer: 'glow' })
  k.circle('#8a8a8a', [0.15, 14], [0, 0.92, 1.31])
  // Windscreen: curved pane leaning back, in a black frame
  k.box(GLASS, [1.0, 0.72, 0.04], [0, 1.52, 0.86], { r: [-0.22, 0, 0], layer: 'glass' })
  k.box(B, [1.06, 0.04, 0.06], [0, 1.86, 0.78], { r: [-0.22, 0, 0] })
  k.box(B, [1.06, 0.04, 0.06], [0, 1.18, 0.93], { r: [-0.22, 0, 0] })
  // Hood: black canvas roof with a slight dome, on four slim rails, plus the side rails
  k.box(CANVAS, [1.36, 0.08, 2.05], [0, 1.96, -0.25])
  k.sphere(CANVAS, [0.7, 16, 10, 0, PI * 2, 0, PI / 2], [0, 1.96, -0.25], { s: [0.95, 0.12, 1.45] })
  for (const sx of [-1, 1]) {
    k.cyl(B, [0.025, 0.025, 0.9, 6], [sx * 0.62, 1.52, -1.15])
    k.cyl(B, [0.025, 0.025, 0.9, 6], [sx * 0.62, 1.52, 0.55])
    k.cyl(B, [0.02, 0.02, 1.7, 6], [sx * 0.64, 1.25, -0.3], { r: [PI / 2, 0, 0] }) // grab rail
    k.box(Y, [0.06, 0.5, 1.5], [sx * 0.66, 0.98, -0.45]) // side panels below the opening
    k.box('#ff3b30', [0.18, 0.1, 0.04], [sx * 0.42, 0.98, -1.58], { layer: 'glow' })
  }
  // Interior: driver seat, handlebar, meter, passenger bench; black mudguards over rear wheels
  k.box('#4a3b2e', [0.5, 0.25, 0.4], [0, 0.88, 0.1])
  k.box(B, [0.7, 0.04, 0.04], [0, 1.2, 0.72])
  k.cyl(B, [0.03, 0.03, 0.35, 6], [0, 1.05, 0.72], { r: [0.3, 0, 0] })
  k.box('#222', [0.14, 0.12, 0.14], [0.42, 1.28, 0.75])
  k.box('#3b2d23', [1.1, 0.3, 0.5], [0, 1.0, -0.75])
  k.box('#3b2d23', [1.1, 0.5, 0.12], [0, 1.3, -1.0])
  for (const sx of [-1, 1]) k.cyl(B, [0.36, 0.36, 0.2, 14, 1, false, 0, PI], [sx * 0.62, 0.3, -0.75], { r: [0, 0, PI / 2] })
  // Number plates and exhaust
  k.box(Y, [0.4, 0.14, 0.03], [0, 0.6, 1.4])
  k.box(Y, [0.44, 0.16, 0.03], [0, 0.72, -1.62])
  k.cyl('#555', [0.04, 0.04, 0.4, 6], [0.4, 0.2, -1.3], { r: [PI / 2, 0, 0] })
  return k.build()
}

const RICKSHAW_SIZE = [1.4, 2.0, 2.9, -0.1]

export function DrivingRickshaw({ loop = 'city', start = 0, reverse = false, speed = 6.5 }) {
  const kit = cached('rickshaw', buildRickshaw)
  return (
    <Vehicle loop={LOOPS[loop]} speed={speed} start={start} reverse={reverse} size={RICKSHAW_SIZE} wheels={AUTO_WHEELS}>
      <KitMesh kit={kit} />
    </Vehicle>
  )
}

export function ParkedRickshaw({ position, rotation }) {
  const kit = cached('rickshaw', buildRickshaw)
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotation, 0]}>
      <CuboidCollider args={[0.7, 1, 1.45]} position={[0, 1, -0.1]} />
      <KitMesh kit={kit} />
      <Wheels wheels={AUTO_WHEELS} />
    </RigidBody>
  )
}

// Visual-only auto for the player's ride; faces +z. `spin` is a ref holding distance travelled.
export function RickshawModel({ spin }) {
  const kit = cached('rickshaw', buildRickshaw)
  return (
    <>
      <KitMesh kit={kit} />
      <Wheels wheels={AUTO_WHEELS} spin={spin} />
    </>
  )
}

/* ---------- cars ---------- */

const CAR_WHEELS = [
  { x: -0.72, z: 1.3, r: 0.3, w: 0.2 },
  { x: 0.72, z: 1.3, r: 0.3, w: 0.2 },
  { x: -0.72, z: -1.3, r: 0.3, w: 0.2 },
  { x: 0.72, z: -1.3, r: 0.3, w: 0.2 },
]

// A sedan (taxi) or hatchback body in the given paint colour.
function buildCar({ paint, sedan, taxi }) {
  const k = createKit()
  const len = sedan ? 4.4 : 3.8
  // Lower body with a bonnet, cabin with pillars, boot or tailgate
  k.box(paint, [1.72, 0.55, len], [0, 0.6, 0])
  k.box(paint, [1.68, 0.12, len - 0.3], [0, 0.9, 0])
  k.box(paint, [1.6, 0.04, 1.3], [0, 0.94, len / 2 - 0.9]) // bonnet line
  const cabL = sedan ? 2.0 : 2.4
  const cabZ = sedan ? -0.1 : -0.3
  k.box(paint, [1.55, 0.62, cabL], [0, 1.25, cabZ])
  k.box(paint, [1.5, 0.1, cabL - 0.3], [0, 1.6, cabZ]) // roof
  k.box(GLASS, [1.57, 0.5, cabL - 0.5], [0, 1.27, cabZ], { layer: 'glass' })
  k.box(GLASS, [1.3, 0.5, 0.06], [0, 1.25, cabZ + cabL / 2 + 0.1], { r: [-0.55, 0, 0], layer: 'glass' })
  k.box(GLASS, [1.3, 0.45, 0.06], [0, 1.25, cabZ - cabL / 2 - 0.08], { r: [sedan ? 0.6 : 0.25, 0, 0], layer: 'glass' })
  if (sedan) k.box(paint, [1.66, 0.3, 0.9], [0, 0.95, -len / 2 + 0.5])
  // Lights, grille, plates, mirrors
  for (const sx of [-1, 1]) {
    k.box('#fff2c8', [0.42, 0.16, 0.05], [sx * 0.55, 0.78, len / 2 + 0.02], { layer: 'glow' })
    k.box('#ff3b30', [0.4, 0.14, 0.05], [sx * 0.55, 0.78, -len / 2 - 0.02], { layer: 'glow' })
    k.box('#1a1a1a', [0.2, 0.1, 0.16], [sx * 0.92, 1.12, cabZ + cabL / 2 - 0.1])
  }
  k.box('#1a1a1a', [0.9, 0.18, 0.04], [0, 0.78, len / 2 + 0.02])
  k.box('#2a2a2a', [1.7, 0.18, 0.1], [0, 0.42, len / 2 + 0.02])
  k.box('#2a2a2a', [1.7, 0.18, 0.1], [0, 0.42, -len / 2 - 0.02])
  const plate = taxi ? '#f2c230' : '#f4f4f4'
  k.box(plate, [0.5, 0.12, 0.03], [0, 0.55, len / 2 + 0.08])
  k.box(plate, [0.5, 0.12, 0.03], [0, 0.55, -len / 2 - 0.05])
  if (taxi) {
    k.box('#f2c230', [0.55, 0.16, 0.26], [0, 1.73, cabZ + 0.2])
    k.box('#1a1a1a', [0.36, 0.08, 0.27], [0, 1.73, cabZ + 0.2])
  }
  for (const sx of [-1, 1]) {
    for (const z of [1.3, -1.3]) k.cyl('#1a1a1a', [0.36, 0.36, 0.26, 12, 1, false, 0, PI], [sx * 0.72, 0.3, z], { r: [0, 0, PI / 2] })
  }
  return k.build()
}

const CARS = {
  taxi: { paint: '#f5f5f2', sedan: true, taxi: true },
  silver: { paint: '#b8bcc2', sedan: false },
  red: { paint: '#b3262b', sedan: false },
  blue: { paint: '#2a4f8f', sedan: true },
}

export function ParkedCar({ kind = 'taxi', position, rotation }) {
  const kit = cached(`car-${kind}`, () => buildCar(CARS[kind]))
  const len = CARS[kind].sedan ? 4.4 : 3.8
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotation, 0]}>
      <CuboidCollider args={[0.9, 0.85, len / 2]} position={[0, 0.85, 0]} />
      <KitMesh kit={kit} />
      <Wheels wheels={CAR_WHEELS} />
    </RigidBody>
  )
}

export function DrivingCar({ kind = 'silver', loop = 'city', start = 0, reverse = false, speed = 8 }) {
  const kit = cached(`car-${kind}`, () => buildCar(CARS[kind]))
  const len = CARS[kind].sedan ? 4.4 : 3.8
  return (
    <Vehicle loop={LOOPS[loop]} speed={speed} start={start} reverse={reverse} size={[1.8, 1.7, len]} wheels={CAR_WHEELS}>
      <KitMesh kit={kit} />
    </Vehicle>
  )
}

export const CITY_LOOP_LENGTH = CITY_LOOP.total
