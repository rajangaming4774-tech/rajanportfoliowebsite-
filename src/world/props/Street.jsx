import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Matrix4,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { ROADS, SEA_X } from '../zones'
import { cached, createKit, hash, isClear } from './kit'
import { KitMesh } from './KitMesh'
import { Body } from './Landmarks'
import { THIN_PROPS } from '../collision'

const PI = Math.PI
const ROAD = '#3d3d40'
const LINE = '#ecebe6'

// One RigidBody holding many thin cylinder colliders (lamp posts, palm trunks, ...)
function PoleColliders({ poles }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      {poles.map(([x, z, r, h], i) => (
        <CylinderCollider key={i} args={[h / 2, r]} position={[x, h / 2, z]} collisionGroups={THIN_PROPS} />
      ))}
    </RigidBody>
  )
}

/* ---------- roads: asphalt, lane dashes, zebra crossings, ground patches ---------- */

function buildRoads() {
  const k = createKit()
  const flat = [-PI / 2, 0, 0]
  // soft colour variation on the ground
  for (let i = 0; i < 70; i++) {
    const x = -58 + hash(i, 1) * 88
    const z = -54 + hash(i, 2) * 118
    k.circle(['#9c8560', '#b09972', '#a38b64', '#948058'][i % 4], [2 + hash(i, 3) * 5, 10], [x, 0.006, z], { r: flat })
  }
  ROADS.forEach(([x, z, w, l]) => k.plane(ROAD, [w, l], [x, 0.012, z], { r: flat }))
  const inOther = (x, z, self) =>
    ROADS.some(([cx, cz, w, l], i) => i !== self && Math.abs(x - cx) < w / 2 + 0.8 && Math.abs(z - cz) < l / 2 + 0.8)
  const dash = (x, z, w, l, self) => {
    if (!inOther(x, z, self)) k.plane(LINE, [w, l], [x, 0.03, z], { r: flat })
  }
  for (let z = -10; z < 60; z += 4) dash(0, z, 0.25, 1.8, 0)
  for (let x = -62; x < 28; x += 4) dash(x, -16, 1.8, 0.25, 1)
  for (let z = -48; z < 66; z += 4) dash(31, z, 0.25, 1.8, 2)
  for (let x = -34; x < 26; x += 4) dash(x, 28, 1.8, 0.25, 3)
  // zebra crossings
  for (const zc of [-7, 21]) for (let x = -3; x <= 3; x += 0.85) k.plane(LINE, [0.45, 2.2], [x, 0.03, zc], { r: flat })
  for (let z = -18.6; z <= -13.4; z += 0.85) k.plane(LINE, [2.2, 0.45], [-12, 0.03, z], { r: flat })
  return k.build()
}

export function Roads() {
  const kit = cached('roads', buildRoads)
  return <KitMesh kit={kit} shadows={false} />
}

/* ---------- street lamps ---------- */

function lampSpots() {
  const out = []
  const push = (x, z, dx, dz) => {
    if (isClear(x, z, 0.5)) out.push([x, z, dx, dz])
  }
  for (let z = -22; z <= 58; z += 12) {
    push(-4.6, z, 1, 0)
    push(4.6, z, -1, 0)
  }
  for (let x = -58; x <= 26; x += 12) {
    push(x, -20.7, 0, 1)
    push(x, -11.3, 0, -1)
  }
  for (let z = -44; z <= 60; z += 12) {
    push(27.2, z, 1, 0)
    push(34.8, z, -1, 0)
  }
  for (let x = -36; x <= 24; x += 12) {
    push(x, 24.3, 0, 1)
    push(x, 31.7, 0, -1)
  }
  return out
}

const HALO_MAT = new MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
})

function buildLamps() {
  const spots = lampSpots()
  const k = createKit()
  const halo = createKit()
  for (const [x, z, dx, dz] of spots) {
    k.cyl('#2e2a28', [0.07, 0.11, 5.2, 6], [x, 2.6, z])
    k.box('#2e2a28', [0.12, 0.12, 0.12], [x, 5.2, z])
    k.box('#2e2a28', dx ? [0.95, 0.08, 0.08] : [0.08, 0.08, 0.95], [x + dx * 0.47, 5.2, z + dz * 0.47])
    const hx = x + dx * 0.95
    const hz = z + dz * 0.95
    k.sphere('#ffd48a', [0.26, 8, 6], [hx, 5.12, hz], { s: [1, 0.6, 1], layer: 'glow' })
    halo.ico('#ffb86b', [0.7, 1], [hx, 5.15, hz], { layer: 'glow' })
  }
  return { kit: k.build(), halo: halo.build(), poles: spots.map(([x, z]) => [x, z, 0.12, 5.2]) }
}

export function Lamps() {
  const { kit, halo, poles } = cached('lamps', buildLamps)
  return (
    <>
      <KitMesh kit={kit} />
      <mesh geometry={halo.glow} material={HALO_MAT} />
      <PoleColliders poles={poles} />
    </>
  )
}

/* ---------- palms ---------- */

const PALMS = [
  [36, -40], [38, -28], [35, -18], [37, -8], [36, 12], [38, 22], [35, 32], [37, 44], [36, 56],
  [-40, -20], [-44, 4], [-36, 40], [-12, 40], [20, 34], [-30, -8],
  [-14, -8], [-40, -44], [-46, -30], [-18, -44], [18, -44], [26, -46], [-52, 10], [-50, 34],
  [-14, 52], [-30, 56], [-40, 20], [-10, 20], [24, 22], [-52, -10], [46, -50],
]

function palmSpots() {
  const spots = [...PALMS]
  for (let i = 0; i < 24; i++) spots.push([35.8 + hash(i, 5) * 2.8, -52 + i * 4.9 + hash(i, 6) * 2])
  return spots.filter(([x, z]) => isClear(x, z, 1) && Math.hypot(x - 40, z) > 6.5 && x < 40)
}

function buildPalms() {
  const spots = palmSpots()
  const k = createKit()
  spots.forEach(([x, z], i) => {
    const lean = (hash(i, 7) - 0.5) * 0.3
    const h = 5.4 + hash(i, 8) * 1.6
    const sn = Math.sin(lean)
    const cs = Math.cos(lean)
    k.cyl('#8a6a45', [0.17, 0.3, h, 7], [x - sn * (h / 2), (cs * h) / 2, z], { r: [0, 0, lean] })
    const top = [x - sn * h, cs * h, z]
    const yaw0 = hash(i, 9) * PI
    for (let f = 0; f < 9; f++) {
      k.frond(f % 2 ? '#3f7f3b' : '#4f9145', [3.3 - (f % 3) * 0.3, 0.5], top, {
        r: [0.5 + hash(f + i * 9, 10) * 0.45, yaw0 + (f / 9) * PI * 2, 0],
        order: 'YXZ',
      })
    }
    for (let f = 0; f < 3; f++) {
      k.frond('#6aa04a', [2, 0.35], top, { r: [-0.15, yaw0 + f * 2.1, 0], order: 'YXZ' })
    }
    for (let c = 0; c < 3; c++) k.ico('#5a3f26', [0.17, 0], [top[0] + Math.sin(c * 2.1) * 0.25, top[1] - 0.2, top[2] + Math.cos(c * 2.1) * 0.25])
  })
  return { kit: k.build(), poles: spots.map(([x, z]) => [x, z, 0.3, 6]) }
}

export function Palms() {
  const { kit, poles } = cached('palms', buildPalms)
  return (
    <>
      <KitMesh kit={kit} />
      <PoleColliders poles={poles} />
    </>
  )
}

/* ---------- bus stop ---------- */

function buildShelter() {
  const k = createKit()
  k.box('#c9372c', [3.4, 0.14, 1.7], [0, 2.7, 0])
  k.box('#efe3c5', [3.5, 0.08, 1.8], [0, 2.82, 0])
  for (const x of [-1.6, 1.6]) {
    k.cyl('#555', [0.05, 0.05, 2.7, 6], [x, 1.35, -0.7])
    k.cyl('#555', [0.05, 0.05, 2.7, 6], [x, 1.35, 0.7])
    k.box('#9fc4cf', [0.05, 1.7, 1.3], [x, 1.45, 0], { layer: 'glass' })
  }
  k.box('#9fc4cf', [3.2, 1.7, 0.05], [0, 1.45, -0.7], { layer: 'glass' })
  k.box('#7a5236', [2.6, 0.1, 0.45], [0, 0.55, -0.4])
  k.box('#c9372c', [0.7, 0.55, 0.06], [1.9, 2.45, 0.9])
  k.cyl('#555', [0.04, 0.04, 2.6, 6], [1.9, 1.3, 0.9])
  return k.build()
}

export function BusStop({ at, rot }) {
  const kit = cached('shelter', buildShelter)
  return (
    <Body at={at} rot={rot} boxes={[[0, -0.7, 3.4, 2.8, 0.2]]} cyls={[[1.9, 0.9, 0.1, 2.6], [-1.6, 0.7, 0.07, 2.7], [1.6, 0.7, 0.07, 2.7]]}>
      <KitMesh kit={kit} />
    </Body>
  )
}

/* ---------- beach ---------- */

const UMBRELLAS = [
  [40.5, -44], [42, -38], [41, -26], [43, -22], [40, -16], [42, -8], [41.5, 14], [43.5, 20], [40.5, 26], [42.5, 34], [41, 44], [43, 52],
]
const UMBRELLA_COLORS = ['#d8402f', '#f2c230', '#2f9fa8', '#e9e0cf', '#d8643a', '#c8507a']

function buildBeach() {
  const spots = UMBRELLAS.filter(([x, z]) => isClear(x, z, 1) && Math.hypot(x - 40, z) > 6)
  const k = createKit()
  spots.forEach(([x, z], i) => {
    const col = UMBRELLA_COLORS[i % UMBRELLA_COLORS.length]
    k.cyl('#d9d0bf', [0.04, 0.05, 2.5, 5], [x, 1.25, z])
    k.cone(col, [1.7, 0.75, 8], [x, 2.6, z])
    k.cone(i % 2 ? '#f4efe6' : '#2b2b30', [0.8, 0.4, 8], [x, 2.78, z])
    k.sphere('#d9d0bf', [0.07, 6, 4], [x, 3.0, z])
    k.box(col, [0.7, 0.1, 1.5], [x + 1.1, 0.3, z - 0.3], { r: [0.3, 0.3, 0] })
    k.box('#f4efe6', [0.7, 0.1, 1.5], [x - 1.1, 0.3, z + 0.5], { r: [0.3, -0.2, 0] })
  })
  return { kit: k.build(), poles: spots.map(([x, z]) => [x, z, 0.1, 2.5]) }
}

export function BeachDecor() {
  const { kit, poles } = cached('beach', buildBeach)
  return (
    <>
      <KitMesh kit={kit} />
      <PoleColliders poles={poles} />
    </>
  )
}

function buildStall() {
  const k = createKit()
  k.box('#7a5236', [3, 1, 1.2], [0, 0.5, 0])
  k.box('#e8d8a8', [3.1, 0.08, 1.3], [0, 1.04, 0])
  for (const x of [-1.5, 1.5]) for (const z of [-0.6, 0.6]) k.cyl('#5b3b28', [0.05, 0.05, 2.7, 6], [x, 1.35, z])
  for (let i = 0; i < 6; i++) k.box(i % 2 ? '#f4efe6' : '#d8402f', [0.55, 0.08, 1.9], [-1.4 + i * 0.56, 2.75, 0.05], { r: [0.15, 0, 0] })
  k.box('#6b4a33', [3, 1.6, 0.1], [0, 1.8, -0.6])
  ;['#d8402f', '#f2c230', '#2f9fa8', '#c8507a', '#7ac15a'].forEach((c, i) => {
    k.cyl('#444', [0.01, 0.01, 0.9, 4], [-1 + i * 0.5, 1.5, 0.3])
    k.sphere(c, [0.2, 8, 6], [-1 + i * 0.5, 2.05 + (i % 2) * 0.15, 0.3])
    k.box(c, [0.3, 0.22, 0.3], [-1.1 + i * 0.5, 1.2, 0.25])
  })
  return k.build()
}

export function Stalls() {
  const kit = cached('stall', buildStall)
  return [[43, -12], [43, -32], [42.5, 24], [43, 40]]
    .filter(([x, z]) => isClear(x, z, 1.5) && Math.hypot(x - 40, z) > 6)
    .map(([x, z]) => (
      <Body key={`${x}${z}`} at={[x, 0, z]} rot={-PI / 2} boxes={[[0, 0, 3.1, 1.2, 1.3]]} cyls={[[-1.5, -0.6, 0.06, 2.7], [1.5, -0.6, 0.06, 2.7], [-1.5, 0.6, 0.06, 2.7], [1.5, 0.6, 0.06, 2.7]]}>
        <KitMesh kit={kit} />
      </Body>
    ))
}

function buildBoat(hull, stripe) {
  const k = createKit()
  k.box(hull, [1.3, 0.55, 4.4], [0, 0.6, 0])
  k.cone(hull, [0.92, 1.4, 4], [0, 0.6, 2.8], { r: [PI / 2, PI / 4, 0] })
  k.cone(hull, [0.92, 1.4, 4], [0, 0.6, -2.8], { r: [-PI / 2, PI / 4, 0] })
  k.box(stripe, [1.36, 0.14, 4.5], [0, 0.82, 0])
  k.box('#4a3626', [1.0, 0.1, 4.2], [0, 0.88, 0])
  k.cyl('#4a3626', [0.05, 0.06, 2.8, 6], [0, 2.1, 0.4])
  k.box('#f4efe6', [0.04, 1.6, 1.1], [0, 2.2, -0.2])
  return k.build()
}

export function Boats() {
  const a = cached('boatA', () => buildBoat('#2f9fa8', '#f2c230'))
  const b = cached('boatB', () => buildBoat('#d8402f', '#f4efe6'))
  return [[44.3, -20, a], [44.6, 12, b], [43.8, 44, a]]
    .filter(([x, z]) => isClear(x, z, 1) && Math.hypot(x - 40, z) > 8)
    .map(([x, z, kit]) => (
      <Body key={`${x}${z}`} at={[x, 0, z]} rot={((x * z) % 7) * 0.02} boxes={[[0, 0, 1.5, 1.1, 5.2]]}>
        <KitMesh kit={kit} />
      </Body>
    ))
}

// Animated shoreline foam: three strips that roll up the sand and fade.
function makeFoamTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 128, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.15, 'rgba(255,255,255,0.7)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(0,0,0,${0.25 + hash(i, 4) * 0.5})`
    g.beginPath()
    g.arc(hash(i, 5) * 128, hash(i, 6) * 128, 2 + hash(i, 7) * 7, 0, PI * 2)
    g.fill()
  }
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(1, 18)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function Shoreline() {
  const refs = useRef([])
  const tex = useMemo(() => makeFoamTexture(), [])
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      const p = (clock.elapsedTime * 0.1 + i / 3) % 1
      m.position.x = SEA_X + 3.4 - p * 5.2 + (i - 1) * 0.3
      m.material.opacity = Math.sin(p * PI) * 0.85
    })
  })
  return [0, 1, 2].map((i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)} rotation-x={-PI / 2} position={[SEA_X, 0.09 + i * 0.002, 5]}>
      <planeGeometry args={[3.2, 130]} />
      <meshBasicMaterial map={tex} transparent opacity={0} depthWrite={false} toneMapped={false} color="#fff8ee" />
    </mesh>
  ))
}

/* ---------- birds (one InstancedMesh, two wings per bird) ---------- */

const FLOCKS = [
  { c: [34, -8], r: 30, y: 26, n: 4, s: 0.16 },
  { c: [-8, 18], r: 26, y: 31, n: 4, s: -0.13 },
  { c: [6, -28], r: 20, y: 22, n: 3, s: 0.19 },
]
const BIRD_COUNT = FLOCKS.reduce((a, f) => a + f.n, 0)

const dummy = new Object3D()
const wingM = new Matrix4()
const flapM = new Matrix4()
const mirrorM = new Matrix4().makeScale(-1, 1, 1)

export function Birds() {
  const mesh = useRef()
  const [geo, mat] = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0.3, 0, 0, -0.3, 1.3, 0, -0.05], 3))
    g.computeVertexNormals()
    return [g, new MeshStandardMaterial({ color: '#2b2420', roughness: 1, side: DoubleSide })]
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    let i = 0
    FLOCKS.forEach((f, fi) => {
      const dir = Math.sign(f.s)
      for (let b = 0; b < f.n; b++) {
        const a = t * f.s + b * 0.3 + fi
        const rr = f.r + b * 2
        dummy.position.set(f.c[0] + Math.cos(a) * rr, f.y + Math.sin(t * 0.6 + b + fi) * 1.4 + b * 0.8, f.c[1] + Math.sin(a) * rr * 0.8)
        dummy.rotation.set(0, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * 0.8 * dir), Math.sin(a) * 0.1)
        dummy.updateMatrix()
        flapM.makeRotationZ(Math.sin(t * 7 + b * 1.7 + fi * 3) * 0.65)
        wingM.copy(dummy.matrix).multiply(flapM)
        mesh.current.setMatrixAt(i++, wingM)
        wingM.copy(dummy.matrix).multiply(mirrorM).multiply(flapM)
        mesh.current.setMatrixAt(i++, wingM)
      }
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, BIRD_COUNT * 2]} frustumCulled={false} />
}
