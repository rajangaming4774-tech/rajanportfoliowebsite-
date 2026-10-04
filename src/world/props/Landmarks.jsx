import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AdditiveBlending, Shape } from 'three'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { THIN_PROPS, THIN_RADIUS } from '../collision'
import { archShape, archWin, cached, createKit, createSigns, glassMaterial, hash, MATS, onFace, patternTexture, roundRectShape } from './kit'
import { KitMesh } from './KitMesh'
import { ParkedCar } from './Traffic'
import { stripLightsAndCameras } from './gltf'

// Chennai landmarks, modelled from photos of the real buildings. Each one is baked
// into a few merged meshes (see kit.js) with real glass where it matters; colliders
// are hand-placed boxes.

const WHITE = '#f4f2ec'
const DARK = '#2a1812'
const GOLD = '#e8c35a'
const PI = Math.PI
const FACES = ['+z', '-z', '+x', '-x']

// boxes: [centreX, centreZ, width, height, depth], standing on the ground
export function Body({ at, rot = 0, boxes = [], cyls = [], children }) {
  return (
    <RigidBody type="fixed" colliders={false} position={at} rotation={[0, rot, 0]}>
      {boxes.map(([x, z, w, h, d], i) => (
        <CuboidCollider key={i} args={[w / 2, h / 2, d / 2]} position={[x, h / 2, z]} />
      ))}
      {cyls.map(([x, z, r, h], i) => (
        <CylinderCollider
          key={i}
          args={[h / 2, r]}
          position={[x, h / 2, z]}
          collisionGroups={r < THIN_RADIUS ? THIN_PROPS : undefined}
        />
      ))}
      {children}
    </RigidBody>
  )
}

/* ---------- shared bits ---------- */

const GLASS_BLUE = glassMaterial('#2f5f8c', 0.5)
const GLASS_CLEAR = glassMaterial('#6fa6bf', 0.42)

// A kit rendered with real physical glass on its glass layer
function BuildingMesh({ kit, glass = GLASS_CLEAR, shadows = true }) {
  return (
    <>
      {kit.solid && <mesh geometry={kit.solid} material={MATS.solid} castShadow={shadows} receiveShadow />}
      {kit.glass && <mesh geometry={kit.glass} material={glass} renderOrder={2} />}
      {kit.glow && <mesh geometry={kit.glow} material={MATS.glow} />}
    </>
  )
}

function SignMesh({ sign }) {
  return <mesh geometry={sign.geometry} material={sign.material} />
}

const GROUND = {
  lawn: (c, s) => {
    c.fillStyle = '#5f8b47'
    c.fillRect(0, 0, s, s)
    for (let i = 0; i < 3200; i++) {
      c.globalAlpha = 0.3
      c.fillStyle = ['#6a984f', '#4f7b3c', '#739f55', '#5a8443'][i % 4]
      c.fillRect(hash(i, 1) * s, hash(i, 2) * s, 2, 3 + hash(i, 3) * 5)
    }
    c.globalAlpha = 1
  },
  paving: (c, s) => {
    c.fillStyle = '#c9c1b0'
    c.fillRect(0, 0, s, s)
    c.strokeStyle = 'rgba(90,80,65,0.45)'
    c.lineWidth = 2
    for (let i = 0; i <= 4; i++) {
      c.beginPath()
      c.moveTo((i * s) / 4, 0)
      c.lineTo((i * s) / 4, s)
      c.moveTo(0, (i * s) / 4)
      c.lineTo(s, (i * s) / 4)
      c.stroke()
    }
    for (let i = 0; i < 500; i++) {
      c.globalAlpha = 0.12
      c.fillStyle = i % 2 ? '#8d8472' : '#e6dfcf'
      c.fillRect(hash(i, 4) * s, hash(i, 5) * s, 3, 3)
    }
    c.globalAlpha = 1
  },
  asphalt: (c, s) => {
    c.fillStyle = '#48484c'
    c.fillRect(0, 0, s, s)
    for (let i = 0; i < 2500; i++) {
      c.globalAlpha = 0.25
      c.fillStyle = ['#5a5a5f', '#38383b', '#6a6a6e'][i % 3]
      c.fillRect(hash(i, 6) * s, hash(i, 7) * s, 2, 2)
    }
    c.globalAlpha = 1
  },
}

// Flat textured ground patch (local x/z), a hair above the terrain and below the zone rings (0.03)
function Decal({ kind, at, size, y = 0.014, per = 3 }) {
  const rep = [Math.max(1, Math.round(size[0] / per)), Math.max(1, Math.round(size[1] / per))]
  const map = cached(`gtex-${kind}-${rep}`, () => patternTexture(GROUND[kind], { repeat: rep }))
  return (
    <mesh rotation-x={-PI / 2} position={[at[0], y, at[1]]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial map={map} roughness={1} />
    </mesh>
  )
}

const tree = (k, x, z, s = 1, shade = 0) => {
  const greens = ['#4a7f3b', '#5d8f45', '#3f6f33', '#6a9a4c']
  k.cyl('#6b4a33', [0.16 * s, 0.24 * s, 2.4 * s, 6], [x, 1.2 * s, z])
  k.ico(greens[shade % 4], [1.25 * s, 0], [x, 3.1 * s, z])
  k.ico(greens[(shade + 1) % 4], [0.95 * s, 0], [x + 0.7 * s, 2.7 * s, z + 0.3 * s])
  k.ico(greens[(shade + 2) % 4], [0.9 * s, 0], [x - 0.6 * s, 2.8 * s, z - 0.5 * s])
  k.ico(greens[(shade + 3) % 4], [0.8 * s, 0], [x + 0.1 * s, 3.9 * s, z - 0.2 * s])
}

const hedge = (k, x, z, w, d, h = 0.7) => {
  k.box('#3f7a38', [w, h, d], [x, h / 2, z])
  k.box('#4f8d44', [w * 0.96, 0.12, d * 0.9], [x, h + 0.04, z])
}

// Rail + balusters along x at height y, z fixed
const balustrade = (k, x0, x1, y, z, color = WHITE, h = 0.78, step = 0.34) => {
  k.box(color, [x1 - x0, 0.1, 0.2], [(x0 + x1) / 2, y + h, z])
  k.box(color, [x1 - x0, 0.1, 0.22], [(x0 + x1) / 2, y + 0.05, z])
  for (let x = x0 + step / 2; x < x1; x += step) k.cyl(color, [0.04, 0.045, h - 0.1, 5], [x, y + h / 2, z])
}

// Clock face with hands on one side of a tower
function clock(k, face, c, d, r) {
  const rim = onFace(face, c, 0, 0, d)
  k.circle(DARK, [r + 0.2, 28], rim.p, { r: rim.r })
  const disc = onFace(face, c, 0, 0, d + 0.02)
  k.circle('#fff6dc', [r, 28], disc.p, { r: disc.r, layer: 'glow' })
  ;[
    [5.3, r * 0.55, 0.12],
    [1.05, r * 0.85, 0.08],
  ].forEach(([a, len, w], i) => {
    const h = onFace(face, c, Math.sin(a) * len * 0.5, Math.cos(a) * len * 0.5, d + 0.05 + i * 0.01)
    k.box(DARK, [w, len, 0.02], h.p, { r: [0, h.r[1], -a] })
  })
}

// A storey of arched bays: a wall slab with real arch openings cut through it,
// paired slender columns in front, and the floor deck above.
function arcade(k, { xa, xb, z, y, h, pitch, wall = WHITE, depth = 0.55, colZ = 1.1, hole = 0.64, sill = 0.8, deck = true, dark = '#3a302b' }) {
  const n = Math.max(1, Math.round((xb - xa) / pitch))
  const p = (xb - xa) / n
  const s = new Shape()
  s.moveTo(xa, 0)
  s.lineTo(xb, 0)
  s.lineTo(xb, h)
  s.lineTo(xa, h)
  s.closePath()
  const hh = h - sill - 0.55
  for (let i = 0; i < n; i++) s.holes.push(archShape(p * hole, hh, xa + (i + 0.5) * p, sill, true))
  k.extrude(wall, s, depth, [0, y, z])
  k.box(dark, [xb - xa, h, 0.04], [(xa + xb) / 2, y + h / 2, z + 0.02])
  for (let i = 0; i < n; i++) {
    const cx = xa + (i + 0.5) * p
    k.box('#d9d2c0', [0.06, hh - 0.3, 0.05], [cx, y + sill + (hh - 0.3) / 2, z + 0.06])
    k.box('#d9d2c0', [p * hole * 0.9, 0.06, 0.05], [cx, y + sill + hh * 0.55, z + 0.06])
  }
  for (let i = 0; i <= n; i++) {
    const x = xa + i * p
    for (const dx of [-0.11, 0.11]) {
      k.cyl(WHITE, [0.07, 0.08, h - 0.1, 8], [x + dx, y + h / 2, z + depth + colZ])
      k.box(WHITE, [0.26, 0.1, 0.26], [x + dx, y + h - 0.02, z + depth + colZ])
      k.box('#e0d8c6', [0.24, 0.1, 0.24], [x + dx, y + 0.06, z + depth + colZ])
    }
  }
  if (deck) k.box(WHITE, [xb - xa + 0.1, 0.4, depth + colZ + 0.35], [(xa + xb) / 2, y + h + 0.2, z + (depth + colZ + 0.35) / 2])
}

/* ---------- Ripon Building ---------- */

function buildRipon() {
  const SHADE = '#ddd6c4'
  const TILE = '#b0502f'
  const TILE2 = '#97402a'
  const k = createKit()
  // body, plinth, steps
  k.box(WHITE, [15, 8.6, 6.5], [0, 4.3, -0.25])
  k.box(WHITE, [6.6, 8.6, 7.4], [0, 4.3, -0.3])
  for (const sx of [-1, 1]) k.box(WHITE, [3, 8.6, 7.6], [sx * 9, 4.3, 0.3])
  k.box('#cfc6b0', [21.4, 0.8, 7.9], [0, 0.4, 0.2])
  for (let i = 0; i < 3; i++) k.box('#d6cdb8', [6.6, 0.18, 0.9 - i * 0.2], [0, 0.1 + i * 0.18, 7.2 + i * 0.3 - 0.6])
  // wings and the centre bay: two storeys of arches
  const bays = [
    [-7.5, -3, 3.0, 1.1],
    [3, 7.5, 3.0, 1.1],
    [-3, 3, 3.0, 1.1],
    [-10.5, -7.5, 4.1, 0.6],
    [7.5, 10.5, 4.1, 0.6],
  ]
  for (const [xa, xb, z, colZ] of bays) {
    arcade(k, { xa, xb, z, y: 0.8, h: 3.5, pitch: 1.5, colZ, sill: 0.15 })
    arcade(k, { xa, xb, z, y: 4.7, h: 3.5, pitch: 1.5, colZ, sill: 0.75, deck: false })
    k.box(WHITE, [xb - xa + 0.3, 0.4, 0.9], [(xa + xb) / 2, 8.4, z + 0.55 + colZ - 0.1])
  }
  // porch (porte-cochere): arcaded front on slender paired columns, terrace on top
  arcade(k, { xa: -3.3, xb: 3.3, z: 5.2, y: 0.8, h: 3.5, pitch: 2.2, colZ: 0.9, sill: 0.15, hole: 0.7 })
  k.box(WHITE, [7, 0.4, 3.6], [0, 4.5, 5.1])
  balustrade(k, -3.4, 3.4, 4.7, 6.85)
  // balustrades along the wing terraces and the roof parapet
  for (const [xa, xb] of [[-7.5, -3.1], [3.1, 7.5]]) balustrade(k, xa, xb, 4.7, 4.95)
  balustrade(k, -10.5, 10.5, 8.6, 3.5, WHITE, 0.8, 0.38)
  balustrade(k, -10.5, 10.5, 8.6, -3.5, WHITE, 0.8, 0.38)
  // pediment over the porch and cornices
  k.tri(WHITE, [6.8, 1.5, 0.6], [0, 8.6, 3.2])
  k.tri(SHADE, [5.6, 1.15, 0.1], [0, 8.75, 3.52])
  k.circle('#cfc6b0', [0.32, 14], [0, 9.55, 3.58])
  k.box(WHITE, [21.6, 0.4, 0.5], [0, 8.4, 3.4])
  // clay-tile pitched roofs with ribs, pyramid roofs on the pavilions
  k.tri(TILE, [7.4, 2.6, 15], [0, 8.6, -0.25], { r: [0, PI / 2, 0] })
  for (let x = -7.2; x <= 7.2; x += 0.5) {
    for (const [dz, tilt] of [[1.85, 0.626], [-1.85, -0.626]]) {
      k.box(Math.round(x * 2) % 2 ? TILE2 : '#c05d38', [0.1, 0.07, 4.4], [x, 9.95, -0.25 + dz], { r: [tilt, 0, 0] })
    }
  }
  k.box(TILE2, [15.2, 0.16, 0.22], [0, 11.25, -0.25])
  for (const sx of [-1, 1]) {
    k.cone(TILE, [2.45, 1.9, 4], [sx * 9, 9.55, 0.3], { r: [0, PI / 4, 0] })
    k.cone(TILE2, [2.5, 0.12, 4], [sx * 9, 8.65, 0.3], { r: [0, PI / 4, 0] })
    k.sphere(GOLD, [0.2, 8, 6], [sx * 9, 10.6, 0.3])
    k.cone(GOLD, [0.07, 0.8, 6], [sx * 9, 11.2, 0.3])
  }
  // central clock tower
  const tc = [0, 0, -0.6]
  k.box(WHITE, [4.5, 5.4, 4.5], [0, 11.3, tc[2]])
  for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) k.box(SHADE, [0.4, 5.4, 0.4], [dx, 11.3, tc[2] + dz])
  for (const face of FACES) {
    archWin(k, face, tc, 0, 9.4, 0.95, 2.4, 2.26, '#3a302b')
    archWin(k, face, tc, 0, 12.6, 0.8, 1.3, 2.26, '#3a302b')
  }
  k.box(WHITE, [5, 0.4, 5], [0, 14.2, tc[2]])
  k.box(WHITE, [4.9, 4.4, 4.9], [0, 16.6, tc[2]])
  for (const face of FACES) clock(k, face, [0, 16.5, tc[2]], 2.47, 1.35)
  k.box(WHITE, [5.4, 0.45, 5.4], [0, 19, tc[2]])
  k.box(WHITE, [4.2, 3.2, 4.2], [0, 20.8, tc[2]])
  for (const face of FACES) {
    for (const u of [-0.9, 0.9]) archWin(k, face, tc, u, 19.7, 0.85, 2.0, 2.12, '#2a2320', SHADE)
  }
  k.box(WHITE, [4.7, 0.4, 4.7], [0, 22.6, tc[2]])
  for (const [dx, dz] of [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]]) {
    k.cyl(WHITE, [0.14, 0.14, 0.8, 8], [dx, 23.2, tc[2] + dz])
    k.sphere(WHITE, [0.2, 8, 6], [dx, 23.7, tc[2] + dz])
  }
  k.cyl(WHITE, [1.7, 1.9, 1.7, 8], [0, 23.65, tc[2]])
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * PI * 2 + PI / 8
    k.box('#2a2320', [0.3, 0.9, 0.04], [Math.sin(ang) * 1.82, 23.7, tc[2] + Math.cos(ang) * 1.82], { r: [0, ang, 0] })
  }
  k.cyl(SHADE, [1.9, 1.9, 0.18, 8], [0, 24.55, tc[2]])
  k.sphere('#e6dfcd', [1.75, 18, 10, 0, PI * 2, 0, PI / 2], [0, 24.6, tc[2]])
  k.cyl(WHITE, [0.4, 0.5, 0.7, 8], [0, 26.5, tc[2]])
  k.sphere(GOLD, [0.34, 8, 6], [0, 27.05, tc[2]])
  k.cone(GOLD, [0.12, 1.6, 6], [0, 28, tc[2]])
  // lawn furniture: statue, flagpole, hedges, trees
  k.box('#cfc6b0', [1.5, 0.5, 1.5], [-12, 0.25, 9])
  k.box('#e1d9c6', [1, 1.6, 1], [-12, 1.3, 9])
  k.cyl('#5c4a30', [0.22, 0.3, 1.1, 8], [-12, 2.65, 9])
  k.sphere('#5c4a30', [0.2, 8, 6], [-12, 3.35, 9])
  k.cyl('#b8b2a3', [0.09, 0.12, 9, 8], [11.5, 4.5, 9])
  ;[['#e8862e', 8.6], ['#f4f2ec', 8.18], ['#2f8a4a', 7.76]].forEach(([c, y]) => {
    k.plane(c, [1.8, 0.42], [12.4, y, 9])
    k.plane(c, [1.8, 0.42], [12.4, y, 8.99], { r: [0, PI, 0] })
  })
  k.sphere(GOLD, [0.14, 6, 4], [11.5, 9.1, 9])
  for (const sx of [-1, 1]) {
    hedge(k, sx * 9.6, 6.4, 5.6, 0.7)
    for (let i = 0; i < 3; i++) tree(k, sx * (14 + (i % 2) * 0.6), 4 + i * 4.5, 0.8, i + (sx > 0 ? 1 : 0))
  }
  return k.build()
}

export function RiponBuilding({ position }) {
  const kit = cached('ripon', buildRipon)
  return (
    <Body
      at={position}
      boxes={[
        [0, -0.25, 15, 9.2, 7],
        [0, -0.3, 6.6, 9.2, 7.4],
        [-9, 0.3, 3.1, 9.2, 8.6],
        [9, 0.3, 3.1, 9.2, 8.6],
        [-5.25, 3.9, 4.6, 5, 1.9],
        [5.25, 3.9, 4.6, 5, 1.9],
        [0, 5.2, 6.8, 5, 3.6],
        [0, -0.6, 4.7, 24, 4.7],
        [-9.6, 6.4, 5.6, 0.7, 0.7],
        [9.6, 6.4, 5.6, 0.7, 0.7],
      ]}
      cyls={[[-12, 9, 0.9, 3.4], [11.5, 9, 0.12, 9]]}
    >
      <BuildingMesh kit={kit} />
      <Decal kind="lawn" at={[0, 9.5]} size={[27, 13]} />
      <mesh rotation-x={-PI / 2} position={[0, 0.018, 10.3]} receiveShadow>
        <ringGeometry args={[4.4, 7, 56]} />
        <meshStandardMaterial color="#bfb7a4" roughness={1} />
      </mesh>
      <mesh rotation-x={-PI / 2} position={[0, 0.018, 6.4]} receiveShadow>
        <planeGeometry args={[4.2, 3.6]} />
        <meshStandardMaterial color="#bfb7a4" roughness={1} />
      </mesh>
    </Body>
  )
}

/* ---------- Kapaleeshwarar-style gopuram, temple wall, flower stall, scooters ---------- */

const FIG = ['#e8433a', '#2f8fd0', '#f0c030', '#2faa6a', '#e86aa8', '#f4efe6', '#8a54c8', '#f08a30']
const TIER = ['#3f8fb5', '#d1607f', '#e3b53f', '#4aa070', '#e0703a', '#7a5ab0', '#46a6a0']
const PANEL = ['#f3e6c4', '#f6c9d4', '#bfe0ee', '#cfe8c4', '#f8d9a0']
const SKIN = ['#e8c9a0', '#c9976a', '#f4efe6', '#7fb6d8']

function buildGopuram() {
  const GRANITE = '#8e8a84'
  const GRANITE_D = '#6f6b66'
  const CREAM = '#f1e9d8'
  const RED = '#c4452d'
  const k = createKit()
  const D0 = 7
  const H0 = 5.8
  for (const sx of [-1, 1]) k.box('#a39d92', [4.2, 0.45, 8.0], [sx * 3.5, 0.22, 0])
  // adhishthana: grey granite base with a through passage and carved niches
  for (const sx of [-1, 1]) k.box(GRANITE, [3.9, H0, D0], [sx * 3.35, H0 / 2 + 0.2, 0])
  k.box(GRANITE, [3, 1.5, D0], [0, 5.2, 0])
  for (const sx of [-1, 1]) {
    k.box(GRANITE_D, [3.95, 0.3, D0 + 0.5], [sx * 3.47, 0.55, 0])
    k.box(GRANITE_D, [3.95, 0.25, D0 + 0.4], [sx * 3.47, 3.2, 0])
  }
  k.box(GRANITE_D, [11, 0.35, D0 + 0.6], [0, H0 + 0.1, 0])
  k.box(CREAM, [11.2, 0.18, D0 + 0.8], [0, H0 + 0.35, 0])
  for (const face of ['-z', '+z']) {
    // door frame
    for (const sx of [-1, 1]) {
      const j = onFace(face, [0, 0, 0], sx * 1.6, 2.5, D0 / 2 + 0.12)
      k.box('#d9a63c', [0.28, 4.7, 0.3], j.p, { r: j.r })
    }
    const l = onFace(face, [0, 0, 0], 0, 4.85, D0 / 2 + 0.12)
    k.box('#d9a63c', [3.5, 0.32, 0.3], l.p, { r: l.r })
    const l2 = onFace(face, [0, 0, 0], 0, 5.35, D0 / 2 + 0.1)
    k.box(RED, [3.2, 0.5, 0.26], l2.p, { r: l2.r })
    for (let j = 0; j < 5; j++) {
      const f = onFace(face, [0, 0, 0], (j - 2) * 0.6, 5.35, D0 / 2 + 0.26)
      k.sphere(GOLD, [0.14, 6, 4], f.p)
    }
    // pilasters and niches either side
    for (const sx of [-1, 1]) {
      for (let c = 0; c < 3; c++) {
        const u = sx * (2.55 + c * 1.35)
        for (const [yy, hh] of [[1.7, 1.3], [3.9, 1.3]]) {
          const n = onFace(face, [0, 0, 0], u, yy, D0 / 2 + 0.04)
          k.box('#2b1e16', [0.8, hh, 0.12], n.p, { r: n.r })
          const f = onFace(face, [0, 0, 0], u, yy - 0.2, D0 / 2 + 0.14)
          k.box(FIG[(c * 3 + (yy > 3 ? 2 : 0)) % 8], [0.3, 0.6, 0.12], f.p, { r: f.r })
          const hd = onFace(face, [0, 0, 0], u, yy + 0.25, D0 / 2 + 0.14)
          k.sphere('#d9c9a0', [0.12, 6, 4], hd.p)
        }
        const pi = onFace(face, [0, 0, 0], u + sx * 0.68, 2.9, D0 / 2 + 0.07)
        k.box(GRANITE_D, [0.16, 5.2, 0.14], pi.p, { r: pi.r })
      }
    }
  }
  // seven tapering stucco tiers crowded with painted figures
  let y = H0 + 0.5
  const tops = []
  for (let i = 0; i < 7; i++) {
    const w = 9.6 * Math.pow(0.86, i)
    const d = 6.3 * Math.pow(0.87, i)
    const h = 1.95 - i * 0.06
    const col = TIER[i % TIER.length]
    k.box(col, [w, h, d], [0, y + h / 2, 0])
    k.box(CREAM, [w + 0.5, 0.16, d + 0.5], [0, y + 0.08, 0])
    k.box('#e0b84a', [w + 0.3, 0.07, d + 0.3], [0, y + 0.2, 0])
    k.box(CREAM, [w + 0.62, 0.22, d + 0.62], [0, y + h + 0.1, 0])
    k.box(RED, [w + 0.72, 0.08, d + 0.72], [0, y + h + 0.25, 0])
    const n = Math.max(3, Math.floor(w / 0.55))
    const step = w / n
    for (const sg of [-1, 1]) {
      const z0 = sg * (d / 2)
      for (let j = 0; j < n; j++) {
        const u = (j - (n - 1) / 2) * step
        const mid = j === Math.floor(n / 2)
        const a = i * 7 + j * 3 + (sg > 0 ? 5 : 0)
        k.box(mid ? '#e0b84a' : PANEL[a % PANEL.length], [step * (mid ? 1.5 : 0.86), h * 0.76, 0.08], [u, y + h * 0.55, z0 + sg * 0.04])
        k.box(FIG[a % 8], [step * 0.36, h * 0.34, 0.1], [u, y + h * 0.45, z0 + sg * 0.12])
        k.sphere(SKIN[a % 4], [step * 0.15, 6, 4], [u, y + h * 0.7, z0 + sg * 0.12])
        k.cone(GOLD, [step * 0.12, h * 0.16, 5], [u, y + h * 0.84, z0 + sg * 0.12])
        if (hash(a, 3) > 0.45) k.sphere(FIG[(a + 3) % 8], [step * 0.09, 5, 4], [u + step * 0.28, y + h * 0.36, z0 + sg * 0.13])
        k.box(CREAM, [0.06, h * 0.82, 0.12], [u + step / 2, y + h * 0.52, z0 + sg * 0.07])
      }
    }
    const m = Math.max(2, Math.floor(d / 0.6))
    const st = d / m
    for (const sg of [-1, 1]) {
      const x0 = sg * (w / 2)
      for (let j = 0; j < m; j++) {
        const u = (j - (m - 1) / 2) * st
        const a = i * 5 + j * 2 + (sg > 0 ? 3 : 0)
        k.box(PANEL[(a + 2) % PANEL.length], [0.08, h * 0.76, st * 0.84], [x0 + sg * 0.04, y + h * 0.55, u])
        k.box(FIG[(a + 1) % 8], [0.1, h * 0.34, st * 0.36], [x0 + sg * 0.12, y + h * 0.45, u])
        k.sphere(SKIN[a % 4], [st * 0.15, 6, 4], [x0 + sg * 0.12, y + h * 0.7, u])
      }
    }
    // miniature shrines at the corners and the ends of every tier
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cx = sx * (w / 2 + 0.08)
        const cz = sz * (d / 2 + 0.08)
        k.box(TIER[(i + 2) % TIER.length], [0.5, 0.46, 0.5], [cx, y + h + 0.52, cz])
        k.cone(GOLD, [0.4, 0.5, 4], [cx, y + h + 1.0, cz], { r: [0, PI / 4, 0] })
        k.sphere(RED, [0.07, 5, 4], [cx, y + h + 1.3, cz])
      }
    }
    tops.push([w, d, y + h + 0.3])
    y += h + 0.3
  }
  // flat barrel-vault shala with lion-face ends and golden kalasams
  const w = 9.6 * Math.pow(0.86, 7)
  const d = 6.3 * Math.pow(0.87, 7)
  k.box('#d8643a', [w * 1.05, 0.5, d * 0.7], [0, y + 0.25, 0])
  k.cyl('#e9b44c', [d * 0.34, d * 0.34, w * 1.12, 16], [0, y + 0.55, 0], { r: [0, 0, PI / 2], s: [1, 1, 1] })
  for (const sx of [-1, 1]) {
    const ex = sx * (w * 0.56 + 0.04)
    k.circle('#b8321f', [d * 0.34, 18], [ex, y + 0.55, 0], { r: [0, sx * PI / 2, 0] })
    k.circle('#e8b540', [d * 0.2, 16], [ex + sx * 0.02, y + 0.55, 0], { r: [0, sx * PI / 2, 0] })
    k.sphere('#2a1a10', [0.09, 5, 4], [ex + sx * 0.05, y + 0.72, -0.2])
    k.sphere('#2a1a10', [0.09, 5, 4], [ex + sx * 0.05, y + 0.72, 0.2])
    k.cone('#2a1a10', [0.06, 0.2, 4], [ex + sx * 0.06, y + 0.5, 0], { r: [PI / 2, 0, 0] })
  }
  for (let j = 0; j < 7; j++) {
    const x = (j - 3) * (w * 0.15)
    const big = j === 3 ? 1.3 : 1
    k.cyl(GOLD, [0.08 * big, 0.22 * big, 0.4, 8], [x, y + 1.65, 0])
    k.sphere(GOLD, [0.27 * big, 8, 6], [x, y + 2.0 * big + 0.1, 0])
    k.cone(GOLD, [0.1 * big, 0.55 * big, 6], [x, y + 2.5 * big + 0.25, 0])
  }
  return { ...k.build(), top: y }
}

// Temple compound wall: the red and white vertical stripes of Tamil temples
function buildWall() {
  const k = createKit()
  k.box('#f1ebe0', [10, 2.1, 0.6], [0, 1.05, 0])
  for (let x = -4.8; x <= 4.8; x += 0.6) k.box('#c4452d', [0.3, 1.9, 0.64], [x, 1.05, 0])
  k.box('#e0b84a', [10.1, 0.12, 0.7], [0, 2.14, 0])
  k.box('#f1ebe0', [10.1, 0.2, 0.74], [0, 2.3, 0])
  for (let x = -4.5; x <= 4.5; x += 1.5) {
    k.cone('#f1ebe0', [0.2, 0.34, 4], [x, 2.57, 0], { r: [0, PI / 4, 0] })
  }
  return k.build()
}

function buildShrine() {
  const k = createKit()
  k.box('#cfc7b8', [3.4, 0.5, 3.4], [0, 0.25, 0])
  k.box('#efe4cc', [2.4, 2.2, 2.4], [0, 1.6, 0])
  for (let t = 0; t < 4; t++) {
    k.box(TIER[t], [2.2 - t * 0.45, 0.5, 2.2 - t * 0.45], [0, 3.0 + t * 0.55, 0])
    k.box('#f1e9d8', [2.4 - t * 0.45, 0.1, 2.4 - t * 0.45], [0, 3.28 + t * 0.55, 0])
  }
  k.sphere(GOLD, [0.28, 8, 6], [0, 5.45, 0])
  k.cone(GOLD, [0.1, 0.7, 6], [0, 5.95, 0])
  k.box('#2a1810', [0.9, 1.3, 0.1], [0, 1.2, 1.22])
  // flagstaff (kodimaram)
  k.cyl('#c99a3a', [0.1, 0.16, 7, 8], [4, 3.5, 0])
  k.sphere(GOLD, [0.18, 8, 6], [4, 7.1, 0])
  k.box('#cfc7b8', [1, 0.5, 1], [4, 0.25, 0])
  return k.build()
}

function buildFlowerStall() {
  const k = createKit()
  k.box('#7a5236', [2.4, 0.9, 0.9], [0, 0.45, 0])
  k.box('#e8d8a8', [2.5, 0.07, 1.0], [0, 0.93, 0])
  for (const x of [-1.15, 1.15]) for (const z of [-0.5, 0.5]) k.cyl('#5b3b28', [0.04, 0.04, 2.3, 6], [x, 1.15, z])
  for (let i = 0; i < 6; i++) k.box(['#f2c230', '#e8e0cf', '#e8643a'][i % 3], [0.45, 0.05, 1.5], [-1.1 + i * 0.44, 2.3, 0], { r: [0.1, 0, 0] })
  const flowers = ['#f4a012', '#fbfbf4', '#e84a7a', '#f4a012', '#fff4c0']
  for (let i = 0; i < 12; i++) {
    const c = flowers[i % 5]
    k.sphere(c, [0.17, 6, 5], [-1 + (i % 6) * 0.4, 1.02, -0.2 + Math.floor(i / 6) * 0.35], { s: [1.2, 0.6, 1.2] })
  }
  for (let i = 0; i < 5; i++) {
    k.cyl('#d9d2c0', [0.01, 0.01, 0.8, 4], [-0.8 + i * 0.4, 1.85, 0.5])
    for (let j = 0; j < 5; j++) k.sphere(flowers[(i + j) % 5], [0.07, 5, 4], [-0.8 + i * 0.4, 1.55 - j * 0.13, 0.5])
  }
  for (const x of [-0.7, 0.7]) k.cyl('#2f7fb8', [0.22, 0.18, 0.4, 8], [x, 0.2, 0.9])
  return k.build()
}

const SCOOTERS = [
  ['#c8302a', '#1c1c20'],
  ['#2f6aa8', '#1c1c20'],
]
function buildScooter(body, dark) {
  const k = createKit()
  k.box(body, [0.5, 0.35, 1.2], [0, 0.55, 0])
  k.box(body, [0.46, 0.5, 0.35], [0, 0.85, 0.5], { r: [-0.3, 0, 0] })
  k.box(dark, [0.4, 0.12, 0.7], [0, 0.82, -0.2])
  k.box(body, [0.6, 0.1, 0.5], [0, 0.34, 0.2])
  k.cyl(dark, [0.03, 0.03, 0.8, 5], [0, 0.85, 0.7], { r: [-0.5, 0, 0] })
  k.box(dark, [0.7, 0.06, 0.06], [0, 1.22, 0.55])
  k.sphere('#fff4c0', [0.09, 6, 5], [0, 1.05, 0.72], { layer: 'glow' })
  for (const z of [-0.5, 0.7]) k.cyl('#16161a', [0.22, 0.22, 0.14, 12], [0, 0.22, z], { r: [0, 0, PI / 2] })
  k.box('#cfcfcf', [0.3, 0.2, 0.04], [0, 0.6, -0.62])
  return k.build()
}

// The temple is a GLB modelled in Higgsfield 3D (Blender) from photos of the real
// Kapaleeshwarar gopuram: public/models/kapaleeshwarar-temple.glb. Same layout as
// the kit version below (gate at the origin facing -z, courtyard behind to the west),
// so the colliders are shared.
const TEMPLE_MODEL = '/models/kapaleeshwarar-temple.glb'

export function Gopuram({ at }) {
  const { scene } = useGLTF(TEMPLE_MODEL)
  const model = useMemo(() => {
    const root = stripLightsAndCameras(scene.clone(true))
    root.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      if (o.material?.metalness > 0.5) o.material.envMapIntensity = 1.2
    })
    return root
  }, [scene])
  return (
    <Body
      at={at}
      boxes={[
        [-3.35, 0, 3.9, 6, 7],
        [3.35, 0, 3.9, 6, 7],
        [-10.35, 0, 9.3, 2.2, 0.6],
        [6.15, 0, 0.9, 2.2, 0.6],
        [-15, 3.7, 0.6, 2.2, 7.4],
        [6.6, 3.7, 0.6, 2.2, 7.4],
        [-4.2, 7.4, 22.2, 2.2, 0.6],
        [-4, -5.8, 2.6, 1, 1],
        [3.8, -5.6, 0.6, 1, 1.3],
        [5, -5.8, 0.6, 1, 1.3],
        [-8, 5, 3.4, 7, 3.4],
      ]}
      cyls={[[-4, 5, 0.2, 7]]}
    >
      <primitive object={model} position-y={0.02} />
      <CuboidCollider args={[1.6, 0.4, 3.5]} position={[0, 5.6, 0]} />
      <CuboidCollider args={[4.8, 9.2, 3.3]} position={[0, 15.2, 0]} />
      <pointLight position={[-10, 1.2, 1.2]} color="#ffb347" intensity={3} distance={8} />
    </Body>
  )
}

useGLTF.preload(TEMPLE_MODEL)

// Kit version kept for reference / fallback.
export function GopuramKit({ at }) {
  const kit = cached('gopuram', buildGopuram)
  const wall = cached('wall', buildWall)
  const shrine = cached('shrine', buildShrine)
  const stall = cached('flower-stall', buildFlowerStall)
  const scooters = SCOOTERS.map(([b, d], i) => cached(`scooter-${i}`, () => buildScooter(b, d)))
  return (
    <Body
      at={at}
      boxes={[
        [-3.35, 0, 3.9, 6, 7],
        [3.35, 0, 3.9, 6, 7],
        [-10.35, 0, 9.3, 2.2, 0.6],
        [6.15, 0, 0.9, 2.2, 0.6],
        [-15, 3.7, 0.6, 2.2, 7.4],
        [6.6, 3.7, 0.6, 2.2, 7.4],
        [-4.2, 7.4, 22.2, 2.2, 0.6],
        [-4, -5.8, 2.5, 1, 1],
        [3.8, -5.6, 0.6, 1, 1.3],
        [5, -5.8, 0.6, 1, 1.3],
      ]}
      cyls={[[-8, 5, 1.6, 6.2], [-4, 5, 0.18, 7]]}
    >
      <KitMesh kit={kit} />
      <CuboidCollider args={[1.5, 0.85, 3.5]} position={[0, 5.5, 0]} />
      <CuboidCollider args={[4.8, 7.4, 3.2]} position={[0, 13.3, 0]} />
      <KitMesh kit={wall} position={[-10.35, 0, 0]} scale={[0.93, 1, 1]} />
      <KitMesh kit={wall} position={[6.15, 0, 0]} scale={[0.09, 1, 1]} />
      <KitMesh kit={wall} position={[-15, 0, 3.7]} rotation={[0, PI / 2, 0]} scale={[0.74, 1, 1]} />
      <KitMesh kit={wall} position={[6.6, 0, 3.7]} rotation={[0, PI / 2, 0]} scale={[0.74, 1, 1]} />
      <KitMesh kit={wall} position={[-4.2, 0, 7.4]} scale={[2.22, 1, 1]} />
      <KitMesh kit={shrine} position={[-8, 0, 5]} />
      <KitMesh kit={stall} position={[-4, 0, -5.8]} rotation={[0, 0.1, 0]} />
      <KitMesh kit={scooters[0]} position={[3.8, 0, -5.6]} rotation={[0, 1.3, 0]} />
      <KitMesh kit={scooters[1]} position={[5, 0, -5.8]} rotation={[0, 1.8, 0]} />
      <Decal kind="paving" at={[-4.2, 3.7]} size={[22, 7.4]} y={0.016} />
      <Decal kind="paving" at={[0, -5.8]} size={[10, 5]} y={0.016} />
    </Body>
  )
}

/* ---------- roadside tea kadai ---------- */

function buildKadai() {
  const WOOD = '#6b4a33'
  const k = createKit()
  // back wall of planks and sheet, painted brand panels
  k.box(WOOD, [4.4, 2.9, 0.18], [0, 1.45, -1.6])
  for (let i = 0; i < 11; i++) k.box(i % 2 ? '#5d3f2b' : '#76533a', [0.04, 2.8, 0.2], [-2 + i * 0.4, 1.45, -1.5])
  k.box('#c8301f', [1.2, 0.8, 0.02], [-1.5, 2.3, -1.49])
  k.box('#2f7f5f', [0.9, 0.7, 0.02], [1.6, 2.3, -1.49])
  for (const [x, z, h] of [[-2.15, 1.9, 2.6], [2.15, 1.9, 2.6], [-2.15, -1.5, 2.9], [2.15, -1.5, 2.9]]) {
    k.cyl('#4a3626', [0.07, 0.07, h, 6], [x, h / 2, z])
  }
  // corrugated tin roof: ribbed sheets, rusty edges, a few rocks holding it down
  k.box('#7d8489', [4.9, 0.05, 3.9], [0, 2.8, 0.2], { r: [0.1, 0, 0] })
  for (let i = 0; i < 17; i++) {
    k.box(i % 2 ? '#aab1b5' : '#8e969b', [0.17, 0.07, 3.95], [-2.35 + i * 0.295, 2.84, 0.2], { r: [0.1, 0, 0] })
  }
  k.box('#8a5a3a', [4.95, 0.06, 0.12], [0, 2.66, 2.12], { r: [0.1, 0, 0] })
  for (const x of [-1.6, 0.4, 1.9]) k.ico('#7a7a78', [0.17, 0], [x, 2.98, 0.9])
  // counter, stove, kettle
  k.box(WOOD, [3.6, 1.05, 1], [0, 0.525, 0.6])
  k.box('#8a6446', [3.8, 0.1, 1.2], [0, 1.1, 0.6])
  k.box('#2a2522', [0.9, 0.8, 0.7], [-0.9, 0.4, -0.6])
  k.cyl('#cfd4d8', [0.2, 0.26, 0.42, 14], [-0.9, 1.0, -0.6], { layer: 'glass' })
  k.cyl('#cfd4d8', [0.1, 0.2, 0.08, 14], [-0.9, 1.25, -0.6], { layer: 'glass' })
  k.sphere('#cfd4d8', [0.05, 8, 6], [-0.9, 1.32, -0.6], { layer: 'glass' })
  k.cyl('#cfd4d8', [0.03, 0.07, 0.34, 6], [-0.62, 1.2, -0.6], { r: [0, 0, -0.9], layer: 'glass' })
  k.torus('#8a8f94', [0.2, 0.025, 6, 14, PI], [-0.9, 1.2, -0.6], { layer: 'glass' })
  k.cone('#ff8a2a', [0.18, 0.22, 6], [-0.9, 0.84, -0.3], { layer: 'glow' })
  k.cyl('#d8dde0', [0.16, 0.2, 0.3, 10], [-0.2, 1.3, -0.5], { layer: 'glass' })
  // shelves and glass jars of biscuits
  k.box(WOOD, [3.2, 0.08, 0.4], [0.2, 1.6, -1.35])
  k.box(WOOD, [3.2, 0.08, 0.4], [0.2, 2.1, -1.35])
  for (let j = 0; j < 7; j++) {
    const x = -1.2 + j * 0.42
    k.cyl(j % 2 ? '#e8d8a8' : '#d99a4a', [0.12, 0.12, 0.3, 8], [x, 1.79, -1.35], { layer: 'glass' })
    k.cyl(GOLD, [0.1, 0.1, 0.05, 8], [x, 1.96, -1.35])
    if (j < 5) k.cyl(j % 2 ? '#c8301f' : '#e8d8a8', [0.1, 0.1, 0.26, 8], [x + 0.1, 2.3, -1.35], { layer: 'glass' })
  }
  for (const x of [0.6, 1.1, 1.6]) {
    k.cyl('#e9dcb5', [0.17, 0.17, 0.34, 10], [x, 1.32, 0.95], { layer: 'glass' })
    k.cyl(GOLD, [0.16, 0.16, 0.05, 10], [x, 1.52, 0.95])
  }
  for (let j = 0; j < 4; j++) k.cyl('#e8f1f0', [0.06, 0.05, 0.12, 8], [-1.6 + j * 0.18, 1.21, 0.9], { layer: 'glass' })
  // bench
  k.box('#7a5236', [2.6, 0.12, 0.55], [0.2, 0.5, 3.1])
  for (const x of [-0.9, 1.3]) k.box('#5b3b28', [0.12, 0.5, 0.45], [x, 0.25, 3.1])
  k.cyl('#2f7fb8', [0.12, 0.1, 0.22, 8], [1.9, 0.11, 2.6])
  // a bunch of plantains hanging from the front beam
  k.cyl('#4a3626', [0.012, 0.012, 0.35, 4], [-1.5, 2.45, 2.0])
  k.cyl('#5a7a2a', [0.03, 0.03, 0.5, 5], [-1.5, 2.1, 2.0])
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2
    const r = 0.1 + (i % 3) * 0.02
    k.sphere(i % 3 ? '#e2c23a' : '#c9b035', [0.07, 6, 5], [-1.5 + Math.cos(a) * r, 1.75 - (i % 3) * 0.12, 2.0 + Math.sin(a) * r], { s: [1, 3, 1] })
  }
  // newspaper rack with clipped papers
  k.box('#5b3b28', [0.9, 1.2, 0.06], [2.0, 1.55, 2.0])
  for (let i = 0; i < 4; i++) {
    k.box(['#e8e0cf', '#f1d9a8', '#dfe6ea', '#f3e0d0'][i], [0.4, 0.5, 0.02], [1.8 + (i % 2) * 0.22, 1.85 - Math.floor(i / 2) * 0.55, 2.04], { r: [0, 0, (i - 1.5) * 0.04] })
    k.box('#2a1a14', [0.3, 0.05, 0.022], [1.8 + (i % 2) * 0.22, 1.98 - Math.floor(i / 2) * 0.55, 2.05])
  }
  // hanging bulb
  k.sphere('#ffe2a0', [0.12, 8, 6], [0.6, 2.4, 1.3], { layer: 'glow' })
  return k.build()
}

function Steam({ origin }) {
  const refs = useRef([])
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return
      const t = (clock.elapsedTime * 0.4 + i / 5) % 1
      m.position.set(origin[0] + Math.sin(t * 5 + i) * 0.1 + t * 0.15, origin[1] + t * 1.5, origin[2])
      m.scale.setScalar(0.1 + t * 0.35)
      m.material.opacity = (1 - t) * 0.45
    })
  })
  return Array.from({ length: 5 }, (_, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent depthWrite={false} opacity={0} />
    </mesh>
  ))
}

export function TeaKadai({ at, rot }) {
  const kit = cached('kadai', buildKadai)
  const sign = cached('kadai-sign', () => createSigns([{ text: 'TEA KADAI', sub: 'டீ கடை', bg: '#a8281c', fg: '#ffe9b0', p: [0, 0, 0], ry: 0, w: 2.0, h: 0.5 }], { cols: 1 }))
  const board = useRef()
  useFrame(({ clock }) => {
    if (board.current) board.current.rotation.z = Math.sin(clock.elapsedTime * 1.3) * 0.03
  })
  return (
    <Body
      at={at}
      rot={rot}
      boxes={[
        [0, 0.6, 3.8, 1.2, 1.2],
        [0.2, 3.1, 2.6, 0.6, 0.55],
        [-2.15, 1.9, 0.2, 2.6, 0.2],
        [2.15, 1.9, 0.2, 2.6, 0.2],
        [0, -1.6, 4.4, 2.9, 0.3],
      ]}
    >
      <KitMesh kit={kit} />
      <Steam origin={[-0.62, 1.45, -0.6]} />
      <group ref={board} position={[0, 2.2, 2.24]}>
        <SignMesh sign={sign} />
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[2.1, 0.6, 0.05]} />
          <meshStandardMaterial color="#2a1a10" />
        </mesh>
      </group>
      <pointLight position={[0.6, 2.2, 1.6]} color="#ffe0b0" intensity={4} distance={12} />
    </Body>
  )
}

/* ---------- Anna Centenary Library ---------- */

function buildLibrary() {
  const CONC = '#f1f0ec'
  const SLAB = '#bdbab2'
  const k = createKit()
  const ring = (w, d, y, t = 0.5, ext = 0.2) => {
    for (const sz of [-1, 1]) k.box(CONC, [w + ext * 2, t, 0.5], [0, y, sz * (d / 2 + 0.1)])
    for (const sx of [-1, 1]) k.box(CONC, [0.5, t, d], [sx * (w / 2 + 0.1), y, 0])
  }
  // ground lobby, recessed behind the colonnade
  k.box(SLAB, [14.4, 0.3, 13.4], [0, 0.15, 0])
  k.box('#9aa3a8', [11.6, 0.1, 10.4], [0, 0.35, 0])
  k.box('#24405e', [13.2, 4.2, 11.8], [0, 2.5, 0], { layer: 'glass' })
  k.box('#cfc7b4', [4, 1, 1.2], [0, 0.85, 3], {})
  k.box('#7a5236', [4.2, 0.1, 1.3], [0, 1.4, 3])
  for (let i = 0; i < 6; i++) k.box(['#8a5a3a', '#4a6a8a', '#c8b48a', '#a84a3a'][i % 4], [1.2, 2, 0.4], [-4.5 + i * 1.8, 1.3, -4.4])
  for (let i = 0; i < 6; i++) k.box('#fff5dc', [1.6, 0.06, 0.3], [-4.5 + i * 1.8, 4.1, 0.5], { layer: 'glow' })
  // projecting-top: grey-white slabs with fins, tinted glass, shelves seen through it
  const floors = [
    // y of each slab, block half sizes [x, z], height of glass above
    { y: 4.4, x: 7, z: 6.5, h: 9.8 },
    { y: 14.2, x: 9, z: 8, h: 7.2 },
  ]
  for (const b of floors) {
    const w = b.x * 2
    const d = b.z * 2
    k.box('#1b2a3d', [w - 0.1, b.h, d - 0.1], [0, b.y + b.h / 2, 0], { layer: 'glass' })
    const n = Math.round(b.h / 3.3)
    const step = b.h / n
    for (let i = 0; i <= n; i++) {
      const y = b.y + i * step
      ring(w, d, y, i === n && b.y > 10 ? 0.9 : 0.45)
      if (i < n) {
        k.box(SLAB, [w - 0.3, 0.22, d - 0.3], [0, y + 0.25, 0])
        k.box('#fff5dc', [w * 0.7, 0.05, 0.3], [-0.5, y + step - 0.2, 1.2], { layer: 'glow' })
        k.box('#fff5dc', [w * 0.7, 0.05, 0.3], [0.5, y + step - 0.2, -2.4], { layer: 'glow' })
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 3; c++) {
            const col = ['#8a5a3a', '#4a6a8a', '#c8b48a', '#a84a3a', '#5a7a5a'][(r + c + i) % 5]
            k.box(col, [w * 0.22, step * 0.6, 0.45], [-w * 0.3 + c * w * 0.3, y + 0.35 + step * 0.3, -d * 0.3 + r * d * 0.2])
          }
        }
      }
    }
    for (let x = -b.x + 1; x < b.x; x += 2) {
      for (const sz of [-1, 1]) k.box(CONC, [0.16, b.h, 0.36], [x, b.y + b.h / 2, sz * (d / 2 + 0.12)])
    }
    for (let z = -b.z + 1; z < b.z; z += 2.2) {
      for (const sx of [-1, 1]) k.box(CONC, [0.36, b.h, 0.16], [sx * (w / 2 + 0.12), b.y + b.h / 2, z])
    }
  }
  // concrete piers carrying the projecting top block, plus the lobby colonnade
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(CONC, [0.9, 14.4, 0.9], [sx * 8.2, 7.2, sz * 7.3])
  for (let x = -5.5; x <= 5.5; x += 2.2) {
    for (const sz of [-1, 1]) k.cyl(CONC, [0.3, 0.32, 4.4, 12], [x, 2.2, sz * 6.9])
  }
  for (const sx of [-1, 1]) for (const z of [-3.6, 0, 3.6]) k.cyl(CONC, [0.3, 0.32, 4.4, 12], [sx * 7.6, 2.2, z])
  k.box(CONC, [4.2, 0.3, 2.2], [0, 4.0, 8.2])
  // louvred white grid canopy on the roof
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(CONC, [0.25, 1.6, 0.25], [sx * 8.5, 22.4, sz * 7.4])
  for (let z = -7.4; z <= 7.4; z += 0.7) k.box(CONC, [17.4, 0.05, 0.3], [0, 23.35, z], { r: [0, 0, 0.12] })
  for (let x = -8.5; x <= 8.5; x += 2.85) k.box(CONC, [0.16, 0.22, 15.2], [x, 23.05, 0])
  k.box(SLAB, [8, 0.3, 4], [-2, 21.65, 0])
  k.box('#5f8f4a', [6, 0.2, 3], [3, 21.55, -3])
  return k.build()
}

function LibrarySigns() {
  const sign = cached('library-sign', () =>
    createSigns([{ text: 'ANNA CENTENARY LIBRARY', bg: '#f6f6f2', fg: '#17356a', p: [0, 19.7, 8.36], ry: 0, w: 11, h: 1.05 }], { cw: 1024, ch: 96, cols: 1 }),
  )
  return <SignMesh sign={sign} />
}

function buildLibraryGrounds() {
  const k = createKit()
  // car park bays and kerbs, planting
  const flat = [-PI / 2, 0, 0]
  for (let i = 0; i < 4; i++) k.plane('#efefe8', [0.12, 4.6], [-18.9 + i * 3.4, 0.03, 4.2], { r: flat })
  k.box('#cfc9b8', [7.6, 0.18, 0.3], [-14, 0.09, 7.4])
  for (const [x, z] of [[-17.6, -6.5], [-10.4, -6.5], [-17.6, 7.2], [-10.4, 7.2]]) tree(k, x, z, 0.85, Math.floor(x + z))
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) hedge(k, sx * (4.6 + i * 2.4), 9.1, 1.9, 0.7)
    tree(k, sx * 10.5, 10.5, 0.9, sx > 0 ? 1 : 0)
    tree(k, sx * 12.6, 3, 0.9, 2)
  }
  for (let i = 0; i < 4; i++) k.ico(['#c8507a', '#e8b030', '#e8643a', '#e9e0cf'][i], [0.28, 0], [-6.4 + i * 1.5, 0.4, 8.5], { s: [1.4, 1, 1.4] })
  k.box('#cfc9b8', [1.4, 0.3, 1.4], [-9, 0.15, 8])
  return k.build()
}

export function Library({ position }) {
  const kit = cached('library', buildLibrary)
  const grounds = cached('library-grounds', buildLibraryGrounds)
  return (
    <>
    <Body
      at={position}
      boxes={[
        [0, 0, 14.4, 22, 13.4],
        [-8.2, -7.3, 0.9, 14.4, 0.9],
        [8.2, -7.3, 0.9, 14.4, 0.9],
        [-8.2, 7.3, 0.9, 14.4, 0.9],
        [8.2, 7.3, 0.9, 14.4, 0.9],
        [-4.6, 9.1, 7.4, 0.7, 0.7],
        [4.6, 9.1, 7.4, 0.7, 0.7],
      ]}
      cyls={[
        [-17.6, -6.5, 0.4, 3],
        [-10.4, -6.5, 0.4, 3],
        [-17.6, 7.2, 0.4, 3],
        [-10.4, 7.2, 0.4, 3],
        [-10.5, 10.5, 0.4, 3],
        [10.5, 10.5, 0.4, 3],
        [-12.6, 3, 0.4, 3],
        [12.6, 3, 0.4, 3],
      ]}
    >
      <BuildingMesh kit={kit} glass={GLASS_BLUE} />
      <KitMesh kit={grounds} />
      <LibrarySigns />
      <Decal kind="lawn" at={[0, 11]} size={[26, 6]} />
      <Decal kind="paving" at={[0, 8]} size={[3.2, 6]} y={0.017} />
      <Decal kind="asphalt" at={[-14.2, 0]} size={[10, 15.6]} y={0.015} />
    </Body>
    <ParkedCar kind="silver" position={[position[0] - 17.2, 0, position[2] + 4.2]} rotation={0} />
    <ParkedCar kind="red" position={[position[0] - 13.8, 0, position[2] + 4.2]} rotation={0.03} />
    <ParkedCar kind="blue" position={[position[0] - 10.4, 0, position[2] + 4.2]} rotation={-0.02} />
    </>
  )
}

/* ---------- OMR IT corridor ---------- */

const GLASS_OMR = glassMaterial('#5d8aa5', 0.5)

// Curtain-wall tower: reflective glass skin on a rounded plan, pale spandrel bands at every
// floor, slabs and a dark core visible through the glass, lit ceiling strips.
function glassTower(k, { cx, cz, w, d, rs, y0 = 0, h, step = 3.25 }) {
  const shape = (e, grow = 1) => roundRectShape(w + e, d + e, 0.01, rs.map((r) => (r > 0.5 ? Math.max(0.3, r + (e / 2) * grow) : r)))
  k.prism('#3d6580', shape(-0.1), h, [cx, y0, cz], { layer: 'glass' })
  const n = Math.round(h / step)
  const st = h / n
  for (let i = 0; i <= n; i++) {
    const y = y0 + i * st
    k.prism('#dde4e6', shape(0.22), 0.8, [cx, i === 0 ? y : y - 0.4, cz])
    if (i < n) {
      k.prism('#a9aeb2', shape(-0.6), 0.2, [cx, y + 0.85, cz])
      k.box('#fff5dc', [w * 0.5, 0.05, 0.3], [cx, y + st - 0.95, cz - d * 0.15], { layer: 'glow' })
      k.box('#6c6f73', [w * 0.18, 0.7, d * 0.3], [cx + w * 0.1, y + 1.3, cz + d * 0.15])
    }
  }
  k.box('#868b90', [w * 0.3, h, d * 0.3], [cx, y0 + h / 2, cz + d * 0.05])
}

function roofPlant(k, cx, cz, y, w) {
  k.box('#cfd5d8', [w, 0.4, w], [cx, y + 0.2, cz])
  k.box('#b9bfc3', [w * 0.5, 2.4, w * 0.45], [cx - w * 0.15, y + 1.6, cz])
  for (let i = 0; i < 6; i++) k.box('#8d9398', [w * 0.5, 0.05, 0.05], [cx - w * 0.15, y + 0.9 + i * 0.3, cz + w * 0.23])
  for (const dx of [0.28, 0.58]) {
    k.box('#d8dde0', [0.9, 0.9, 0.9], [cx + w * dx, y + 0.85, cz + w * 0.15])
    k.cyl('#2a2d30', [0.34, 0.34, 0.05, 10], [cx + w * dx, y + 1.33, cz + w * 0.15])
  }
}

function buildOmr() {
  const k = createKit()
  // tower A: curved NE corner, stepped crown with plant room
  glassTower(k, { cx: -5.2, cz: 0, w: 7.6, d: 7.6, rs: [0.2, 0.2, 3.4, 0.2], h: 26 })
  glassTower(k, { cx: -5.4, cz: 0.2, w: 5.2, d: 5.2, rs: [0.2, 0.2, 2, 0.2], y0: 26.4, h: 3.2 })
  roofPlant(k, -5.4, 0.2, 29.6, 5)
  k.box('#dde4e6', [8, 0.6, 8], [-5.2, 26.2, 0], {})
  // tower B: tall, back corners rounded, setback upper tier, mast
  glassTower(k, { cx: 7, cz: -1, w: 7, d: 7, rs: [2.6, 2.6, 0.4, 0.4], h: 20 })
  glassTower(k, { cx: 7, cz: -0.6, w: 5, d: 5, rs: [1.8, 1.8, 0.3, 0.3], y0: 20.4, h: 11, step: 3.6 })
  roofPlant(k, 7, -0.6, 31.4, 4)
  k.box('#dde4e6', [7.6, 0.5, 7.6], [7, 20.2, -1])
  k.cyl('#dfe5e7', [0.07, 0.11, 4.5, 6], [7.4, 34.4, -0.2])
  // tower C: wide, glass barrel-vault roof, coloured band
  glassTower(k, { cx: 1, cz: 10, w: 12, d: 6.2, rs: [0.2, 0.2, 0.2, 0.2], h: 19.5, step: 3.25 })
  k.extrude('#8fb5c7', archShape(6, 3.1, 0, 0), 11.6, [-4.8, 19.6, 10], { r: [0, PI / 2, 0], s: [1, 0.5, 1], layer: 'glass' })
  k.box('#d96c2a', [12.5, 0.9, 6.7], [1, 6.9, 10])
  k.box('#cfd5d8', [11.8, 0.3, 6], [1, 19.55, 10])
  // tower D: cylinder with slab rings
  k.cyl('#6f98b0', [2.5, 2.5, 14, 20], [11.2, 7, 6], { layer: 'glass' })
  for (let y = 0; y <= 14; y += 3.5) k.cyl('#dde4e6', [2.65, 2.65, 0.6, 20], [11.2, y + 0.3, 6])
  k.cyl('#868b90', [0.9, 0.9, 14, 8], [11.2, 7, 6])
  roofPlant(k, 11.2, 6, 14.2, 3.4)
  // glazed skybridge between A and B, and the entrance canopy
  k.box('#3d6580', [5.4, 2.2, 2.4], [1.5, 12.8, -0.3], { layer: 'glass' })
  k.box('#dde4e6', [5.4, 0.3, 2.6], [1.5, 11.6, -0.3])
  k.box('#dde4e6', [5.4, 0.3, 2.6], [1.5, 14.1, -0.3])
  k.box('#dde4e6', [5.5, 0.3, 3.2], [-5.2, 3.4, -5.2])
  for (const sx of [-1, 1]) k.cyl('#dde4e6', [0.1, 0.1, 3.2, 8], [-5.2 + sx * 2.4, 1.6, -6.6])
  k.box('#dde4e6', [4.6, 0.3, 2.8], [7, 3.4, -5.9])
  for (const sx of [-1, 1]) k.cyl('#dde4e6', [0.1, 0.1, 3.2, 8], [7 + sx * 2, 1.6, -7.1])
  // compound wall, gate pillars, gatehouse and boom barrier
  const wallZ = -8.5
  for (const [x0, x1] of [[-8.6, -3], [3.4, 13.4]]) {
    k.box('#efe9dc', [x1 - x0, 1.3, 0.5], [(x0 + x1) / 2, 0.65, wallZ])
    k.box('#2a5e8a', [x1 - x0, 0.3, 0.56], [(x0 + x1) / 2, 1.15, wallZ])
    for (let x = x0 + 0.2; x <= x1; x += 3.4) {
      k.box('#e2dac8', [0.5, 1.7, 0.6], [x, 0.85, wallZ])
      k.box('#cfc7b4', [0.7, 0.14, 0.8], [x, 1.75, wallZ])
    }
  }
  for (const x of [-0.8, 3.4]) {
    k.box('#e2dac8', [0.6, 2.2, 0.6], [x, 1.1, wallZ])
    k.box('#cfc7b4', [0.8, 0.16, 0.8], [x, 2.28, wallZ])
    k.sphere('#fff5dc', [0.2, 8, 6], [x, 2.6, wallZ], { layer: 'glow' })
  }
  k.box('#f1ede2', [2.1, 2.6, 1.8], [-1.95, 1.3, -8.4])
  k.box('#2a5e8a', [2.3, 0.2, 2.0], [-1.95, 2.7, -8.4])
  k.box('#3d6580', [1.5, 1, 0.05], [-1.95, 1.6, -9.32], { layer: 'glass' })
  k.box('#3d6580', [0.05, 1, 1.2], [-0.88, 1.6, -8.4], { layer: 'glass' })
  k.box('#4a4d52', [0.3, 1.1, 0.3], [2.7, 0.55, -8.0])
  for (let i = 0; i < 5; i++) {
    const t = 0.5 + i * 0.64
    k.box(i % 2 ? '#f4f1ea' : '#c8302a', [0.64, 0.1, 0.1], [2.7 - Math.sin(1.0) * t, 1.1 + Math.cos(1.0) * t, -8.0], { r: [0, 0, PI - 0.571] })
  }
  // gate and sign posts
  for (const x of [6.0, 10.8]) k.box('#8a8f94', [0.15, 1.8, 0.15], [x, 2.2, wallZ])
  // forecourt: fountain basin, potted palms, beds
  const fx = 1.3
  const fz = -5.4
  k.cyl('#e2dac8', [1.7, 1.8, 0.5, 20], [fx, 0.25, fz])
  k.cyl('#5ec3e0', [1.5, 1.5, 0.52, 20], [fx, 0.26, fz], { layer: 'glass' })
  k.cyl('#e2dac8', [0.35, 0.45, 0.9, 10], [fx, 0.85, fz])
  k.cyl('#e2dac8', [0.9, 0.35, 0.18, 14], [fx, 1.35, fz])
  k.cyl('#5ec3e0', [0.82, 0.82, 0.2, 14], [fx, 1.4, fz], { layer: 'glass' })
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = sx * (4.2 + i * 0.1) + 1.3
      k.cyl('#7a5236', [0.28, 0.2, 0.5, 8], [x, 0.25, -3.1 + i * 0.01])
      k.cyl('#5b3b28', [0.06, 0.07, 1.2, 5], [x, 1.0, -3.1])
      for (let f = 0; f < 6; f++) {
        k.frond('#4f9145', [1.1, 0.25], [x, 1.55, -3.1], { r: [0.8, (f / 6) * PI * 2, 0], order: 'YXZ' })
      }
    }
  }
  for (const x of [-8, -6.4, 9.2, 10.8]) {
    k.box('#4f8d44', [1.2, 0.55, 0.9], [x, 0.28, -7.4])
    k.ico('#e8643a', [0.2, 0], [x - 0.3, 0.7, -7.4])
    k.ico('#f2c230', [0.18, 0], [x + 0.2, 0.68, -7.4])
  }
  return k.build()
}

function omrSigns() {
  const sf = PI
  return createSigns(
    [
      { text: 'RAJAN TECH PARK', bg: '#12324f', fg: '#ffffff', p: [-6.9, 22.4, -3.95], ry: sf, w: 4, h: 1 },
      { text: 'NOVA SOFT', bg: '#0f5f7a', fg: '#ffe9b0', p: [7, 16.5, -4.6], ry: sf, w: 4.4, h: 1.1 },
      { text: 'BLUEWAVE', bg: '#e8e8e2', fg: '#1b4a8a', p: [7.2, 13, 10], ry: PI / 2, w: 5, h: 1.25 },
      { text: 'RAJAN TECH PARK', sub: 'ஐடி பூங்கா', bg: '#12324f', fg: '#ffffff', p: [8.4, 2.35, -8.62], ry: sf, w: 5, h: 1.25 },
      { text: 'SECURITY', bg: '#1e4d2b', fg: '#ffffff', p: [-1.95, 2.95, -9.45], ry: sf, w: 1.6, h: 0.4 },
      { text: 'IT PARK', bg: '#e8e8e2', fg: '#a8281c', p: [11.2, 9.6, 8.56], ry: 0, w: 2.4, h: 0.6 },
    ],
    { cols: 2 },
  )
}

function BlinkLight({ position }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    ref.current.material.opacity = Math.sin(clock.elapsedTime * 3) > 0.4 ? 1 : 0.15
  })
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.28, 8, 6]} />
      <meshBasicMaterial color="#ff3b30" transparent toneMapped={false} />
    </mesh>
  )
}

function Fountain({ at }) {
  const refs = useRef([])
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return
      const a = (i / 10) * PI * 2
      const t = (clock.elapsedTime * 0.9 + i * 0.37) % 1
      const r = t * 0.9
      m.position.set(at[0] + Math.cos(a) * r, at[1] + 1.6 + Math.sin(t * PI) * 1.1 - t * 0.9, at[2] + Math.sin(a) * r)
      m.material.opacity = 0.7 * (1 - t * 0.6)
    })
  })
  return Array.from({ length: 10 }, (_, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)}>
      <sphereGeometry args={[0.07, 6, 5]} />
      <meshBasicMaterial color="#e8fbff" transparent depthWrite={false} />
    </mesh>
  ))
}

export function OmrCorridor({ position }) {
  const kit = cached('omr', buildOmr)
  const signs = cached('omr-signs', omrSigns)
  const [px, , pz] = position
  return (
    <>
      <Body
        at={position}
        boxes={[
          [-5.2, 0, 7.8, 27, 7.8],
          [7, -1, 7.2, 33, 7.2],
          [1, 10, 12.2, 20, 6.4],
          [-5.8, -8.5, 5.6, 1.3, 0.5],
          [8.4, -8.5, 10, 1.3, 0.5],
          [-1.95, -8.4, 2.1, 2.7, 1.8],
          [-0.8, -8.5, 0.6, 2.2, 0.6],
          [3.4, -8.5, 0.6, 2.2, 0.6],
        ]}
        cyls={[[11.2, 6, 2.6, 14.4], [1.3, -5.4, 1.75, 0.55]]}
      >
        <BuildingMesh kit={kit} glass={GLASS_OMR} />
        <SignMesh sign={signs} />
        <BlinkLight position={[7.4, 36.9, -0.2]} />
        <Fountain at={[1.3, 0, -5.4]} />
        <Decal kind="lawn" at={[2.5, -6.2]} size={[22, 4.6]} />
        <Decal kind="paving" at={[1.3, -6.1]} size={[4.8, 5.4]} y={0.017} />
        <Decal kind="paving" at={[1.1, 1.2]} size={[4.8, 9]} y={0.016} />
        <Decal kind="asphalt" at={[9.9, -6.7]} size={[9.4, 3.3]} y={0.016} />
        <Decal kind="asphalt" at={[-6.4, -6.6]} size={[5.6, 3.3]} y={0.016} />
      </Body>
      <ParkedCar kind="silver" position={[px + 6.9, 0, pz - 6.7]} rotation={PI / 2} />
      <ParkedCar kind="blue" position={[px + 11.3, 0, pz - 6.6]} rotation={-PI / 2} />
      <ParkedCar kind="red" position={[px - 6.4, 0, pz - 6.6]} rotation={PI / 2} />
    </>
  )
}

/* ---------- Marina lighthouse ---------- */

function buildLighthouse() {
  const RED = '#c53a2e'
  const LWHITE = '#f3f0e8'
  const k = createKit()
  // plinth and the tapering square tower in bold red and white bands
  k.box('#cfc7b4', [9.4, 0.5, 9.4], [0, 0.25, 0])
  const H = 24
  const bands = 8
  const hs = (t) => 3.1 + (2.1 - 3.1) * (t / H)
  for (let i = 0; i < bands; i++) {
    const bh = H / bands
    const y0 = i * bh
    k.cyl(i % 2 ? LWHITE : RED, [hs(y0 + bh) * Math.SQRT2, hs(y0) * Math.SQRT2, bh, 4], [0, 0.5 + y0 + bh / 2, 0], { r: [0, PI / 4, 0] })
  }
  for (let y = 4; y < H; y += 4.5) {
    const half = hs(y) + 0.02
    for (const face of FACES) {
      const w = onFace(face, [0, 0, 0], 0, 0.5 + y, half)
      k.box('#2a1a14', [0.45, 0.95, 0.06], w.p, { r: w.r })
    }
  }
  for (const face of ['+z', '-x']) {
    const d = onFace(face, [0, 0, 0], 0, 1.8, 3.1)
    k.box('#2a1a14', [1.1, 2.3, 0.14], d.p, { r: d.r })
  }
  // wide gallery and a white viewing room
  const GY = 0.5 + H
  k.box('#2d2a28', [6.6, 0.5, 6.6], [0, GY + 0.25, 0])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('#2d2a28', [0.35, 0.8, 0.35], [sx * 2.5, GY - 0.3, sz * 2.5], { r: [sz * 0.5, 0, sx * -0.5] })
  for (const sx of [-1, 1]) {
    k.box('#f3f0e8', [0.06, 0.1, 6.5], [sx * 3.2, GY + 1.25, 0])
    k.box('#f3f0e8', [6.5, 0.1, 0.06], [0, GY + 1.25, sx * 3.2])
  }
  for (let i = 0; i <= 10; i++) {
    const u = -3.2 + i * 0.64
    for (const sg of [-1, 1]) {
      k.cyl('#f3f0e8', [0.03, 0.03, 1, 4], [u, GY + 0.75, sg * 3.2])
      k.cyl('#f3f0e8', [0.03, 0.03, 1, 4], [sg * 3.2, GY + 0.75, u])
    }
  }
  k.box(LWHITE, [4.8, 2.4, 4.8], [0, GY + 1.7, 0])
  for (const face of FACES) {
    const g = onFace(face, [0, 0, 0], 0, GY + 1.9, 2.42)
    k.box('#2f4a60', [3.6, 1, 0.08], g.p, { r: g.r, layer: 'glass' })
    for (const u of [-1.2, 0, 1.2]) {
      const m = onFace(face, [0, 0, 0], u, GY + 1.9, 2.46)
      k.box(LWHITE, [0.08, 1.05, 0.06], m.p, { r: m.r })
    }
  }
  k.box('#2d2a28', [5.5, 0.4, 5.5], [0, GY + 3.1, 0])
  // lantern room with lens, red cap, and the radar mast on top
  k.cyl('#2d2a28', [1.5, 1.6, 0.3, 14], [0, GY + 3.45, 0])
  k.cyl('#fff3c4', [1.05, 1.05, 1.7, 14], [0, GY + 4.4, 0], { layer: 'glow' })
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * PI * 2
    k.box('#2d2a28', [0.1, 1.8, 0.1], [Math.sin(ang) * 1.12, GY + 4.4, Math.cos(ang) * 1.12])
  }
  k.cyl('#2d2a28', [1.25, 1.25, 0.2, 14], [0, GY + 5.35, 0])
  k.cone(RED, [1.4, 1.1, 14], [0, GY + 6, 0])
  k.cyl('#9aa0a6', [0.06, 0.08, 1.8, 6], [0, GY + 7.2, 0])
  return k.build()
}

function buildLighthouseHouse() {
  const k = createKit()
  const W = '#f4f1ea'
  k.box(W, [5.8, 6.4, 6], [0.5, 3.2, 7.3])
  k.box('#c53a2e', [5.9, 0.3, 6.1], [0.5, 3.4, 7.3])
  k.box('#e3ded1', [6.2, 0.35, 6.4], [0.5, 6.55, 7.3])
  k.box(W, [5.8, 0.6, 0.25], [0.5, 6.85, 4.4])
  k.box(W, [5.8, 0.6, 0.25], [0.5, 6.85, 10.2])
  for (const sx of [-1, 1]) k.box(W, [0.25, 0.6, 5.8], [0.5 + sx * 2.8, 6.85, 7.3])
  k.box('#cfc7b4', [2.2, 1.4, 2.2], [1.8, 7.3, 8.4])
  k.box('#3a3d42', [1.6, 0.9, 1.6], [-0.7, 7.0, 6])
  k.cyl('#2a2d30', [0.34, 0.34, 0.05, 10], [-0.7, 7.5, 6])
  k.windows({ origin: [-2.42, 1.9, 7.3], face: '-x', cols: 3, rows: 2, gap: [1.7, 3.2], size: [0.9, 1.4], color: '#3d6580' })
  k.windows({ origin: [0.5, 1.9, 10.32], face: '+z', cols: 3, rows: 2, gap: [1.7, 3.2], size: [0.9, 1.4], color: '#3d6580' })
  k.box('#2a1a14', [0.1, 2.1, 1.1], [-2.42, 1.15, 5.4])
  k.box('#c53a2e', [1.6, 0.14, 1.6], [-3.1, 2.5, 5.4])
  k.box('#9aa0a6', [1.4, 0.7, 0.4], [3.05, 0.35, 8.8])
  for (const sz of [-1, 1]) k.box('#2e2a28', [0.1, 3.8, 0.1], [0.5, 3.4, 7.3 + sz * 3.05], {})
  return k.build()
}

function Radar({ position }) {
  const ref = useRef()
  useFrame((_, dt) => {
    ref.current.rotation.y += dt * 1.8
  })
  return (
    <group ref={ref} position={position}>
      <mesh>
        <boxGeometry args={[3.2, 0.28, 0.12]} />
        <meshStandardMaterial color="#d8dcde" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.4]} />
        <meshStandardMaterial color="#2d2a28" />
      </mesh>
    </group>
  )
}

function Beam({ y }) {
  const ref = useRef()
  useFrame((_, dt) => {
    ref.current.rotation.y += dt * 0.7
  })
  return (
    <group ref={ref} position={[0, y, 0]}>
      {[0, PI].map((ry) => (
        <group key={ry} rotation-y={ry}>
          <mesh position={[22, 0, 0]} rotation-z={PI / 2}>
            <coneGeometry args={[5, 44, 14, 1, true]} />
            <meshBasicMaterial color="#fff6dc" transparent opacity={0.1} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Lighthouse({ position }) {
  const kit = cached('lighthouse', buildLighthouse)
  const house = cached('lighthouse-house', buildLighthouseHouse)
  const lamp = 0.5 + 24 + 4.4
  return (
    <Body
      at={position}
      boxes={[
        [0, 0, 6.6, 28, 6.6],
        [0.5, 7.3, 5.9, 7, 6.1],
      ]}
    >
      <BuildingMesh kit={kit} glass={GLASS_CLEAR} />
      <BuildingMesh kit={house} glass={GLASS_BLUE} />
      <mesh rotation-x={-PI / 2} position={[0, 0.02, 3]} receiveShadow>
        <circleGeometry args={[8.5, 40]} />
        <meshStandardMaterial color="#d6ccb4" roughness={1} />
      </mesh>
      <Radar position={[0, 0.5 + 24 + 8.3, 0]} />
      <Beam y={lamp} />
      <pointLight position={[0, lamp, 0]} color="#fff0c8" intensity={25} distance={30} />
    </Body>
  )
}
