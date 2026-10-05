import { Color } from 'three'
import { ROADS, ZONES } from '../zones'
import { addFootprints, cached, createKit, createSigns, FOOTPRINTS, hash } from './kit'
import { KitMesh } from './KitMesh'
import { Body } from './Landmarks'

// Filler for the empty blocks: typical Chennai street frontage. Concrete 2-4 storey shop
// houses in pastel paints with flat roofs, parapets, Sintex tanks, balconies with grills,
// AC units, ground-floor shops with roll-up shutters and signboards, plus a few 6-8 storey
// apartment blocks, bungalows behind compound walls and neem trees. Everything is merged:
// one kit (solid / glass / glow), one sign atlas mesh, one collider body.

const PI = Math.PI

// Parked props placed by CityMap that lots must not cover ([x0, x1, z0, z1])
const OBSTACLES = [
  [-11.8, -6.2, 15.4, 18.6], // blue car
  [21.2, 24.8, -11, -5], // silver car
  [4.2, 7, -6.4, -1.6], // rickshaws
  [-8, -4, 5.8, 10.2],
  [-8, -4, 31.6, 36.4],
  [11, 15, 10.4, 14.4],
  [22, 26, 7.5, 11.5],
]
const AIRPORT = [-36, 38, -130, -24]
const TOWER = [-54, -38, -74, -56]
const BOUNDS = [-69, 51, -54, 64]

// Rows of lots. front = coordinate of the street-facing side; face = direction the front looks.
const STRIPS = [
  { a: [-57, -9], front: 33, face: '-z', depth: 8, tall: 0.1, kind: 'shop' },
  { a: [-57, -7], front: 43.5, face: '-z', depth: 9, tall: 0.75, kind: 'shop' },
  { a: [-68, -6], front: -10.5, face: '-z', depth: 7, tall: 0.1, kind: 'shop' },
  { a: [8, 27.5], front: -10.5, face: '-z', depth: 7, tall: 0.2, kind: 'shop' },
  // behind (north of) the Ripon Building, and a row along its west side
  { a: [-68, -40], front: -42.5, face: '+z', depth: 8, tall: 0.2, kind: 'house' },
  { a: [-41, -21.5], front: -64.8, face: '+x', depth: 4, tall: 0.15, kind: 'shop' },
  { a: [-9, 23], front: -8, face: '+x', depth: 5.5, tall: 0.1, kind: 'shop' },
  { a: [-58, -44.5], front: 23.2, face: '+z', depth: 6, tall: 0, kind: 'house' },
  { a: [-8, 16], front: -44.5, face: '+x', depth: 6.5, tall: 0.2, kind: 'house' },
  { a: [-8, 16], front: -53, face: '+x', depth: 5, tall: 0.8, kind: 'shop' },
]

const YAW = { '+z': 0, '-z': PI, '+x': PI / 2, '-x': -PI / 2 }

const PASTELS = ['#eadcae', '#e3a9a4', '#a8c6d9', '#ebd079', '#eeebe3', '#ecbf9d', '#b8d6bc', '#d9cdb2', '#e9c3c8']
const APT = ['#e7dcc4', '#d9c7b0', '#c9d6dc', '#e5d1c5', '#dadcd0']
const SHOPS = [
  ['ANNA STORES', 'அண்ணா ஸ்டோர்ஸ்'],
  ['KUMAR MEDICALS', 'குமார் மெடிக்கல்ஸ்'],
  ['AMMA MESS', 'அம்மா மெஸ்'],
  ['LAKSHMI TEXTILES', 'லட்சுமி டெக்ஸ்டைல்ஸ்'],
  ['VELAN MOBILES'],
  ['SELVI BEAUTY PARLOUR'],
  ['MURUGAN HARDWARE', 'முருகன் ஹார்டுவேர்'],
  ['BHARATHI BOOKS'],
  ['RAJA TAILORS', 'ராஜா டெய்லர்ஸ்'],
  ['KAVERI FANCY STORE'],
  ['THENDRAL BAKERY', 'தென்றல் பேக்கரி'],
  ['SRI VEL CYCLES'],
  ['NALLA CHAI', 'நல்ல சாய்'],
  ['PONNI RICE MART', 'பொன்னி அரிசி கடை'],
  ['MEENA JEWELLERS'],
  ['ARUN ELECTRICALS'],
  ['GANGA PHOTO STUDIO'],
  ['KANNAN TRADERS'],
  ['SUN DENTAL CLINIC'],
  ['AARTHI FLOWERS', 'ஆர்த்தி பூக்கடை'],
]
const SIGN_COLORS = [
  ['#c8301f', '#fff3d0'],
  ['#1f6f8b', '#ffffff'],
  ['#f2c230', '#2b1a10'],
  ['#2f7f5f', '#ffffff'],
  ['#e8e0cf', '#7a1a1a'],
  ['#6a2d7a', '#ffe9b0'],
  ['#d8643a', '#ffffff'],
  ['#1b3a5c', '#ffe28a'],
]
const AWNING = ['#c8301f', '#f2c230', '#2f7fb8', '#2f7f5f', '#e8e0cf']

/* ---------- lot placement ---------- */

const overlap = (a, b, pad) => a[0] < b[1] + pad && a[1] > b[0] - pad && a[2] < b[3] + pad && a[3] > b[2] - pad

function blocked(r, placed) {
  if (r[0] < BOUNDS[0] || r[1] > BOUNDS[1] || r[2] < BOUNDS[2] || r[3] > BOUNDS[3]) return true
  for (const [cx, cz, w, l] of ROADS) if (overlap(r, [cx - w / 2, cx + w / 2, cz - l / 2, cz + l / 2], 1.2)) return true
  for (const z of ZONES) {
    const [zx, , zz] = z.position
    const nx = Math.max(r[0], Math.min(zx, r[1]))
    const nz = Math.max(r[2], Math.min(zz, r[3]))
    if (Math.hypot(nx - zx, nz - zz) < 4.4) return true
  }
  for (const f of FOOTPRINTS) if (overlap(r, f, 0.8)) return true
  for (const o of OBSTACLES) if (overlap(r, o, 0.4)) return true
  if (overlap(r, AIRPORT, 0.8) || overlap(r, TOWER, 0.8)) return true
  for (const p of placed) if (overlap(r, p.rect, 0.3)) return true
  return false
}

function lotRect(s, c, w, depth) {
  switch (s.face) {
    case '-z':
      return [c, c + w, s.front, s.front + depth]
    case '+z':
      return [c, c + w, s.front - depth, s.front]
    case '+x':
      return [s.front - depth, s.front, c, c + w]
    default:
      return [s.front, s.front + depth, c, c + w]
  }
}

function planLots() {
  const lots = []
  const trees = []
  STRIPS.forEach((s, si) => {
    let c = s.a[0]
    let n = 0
    while (c < s.a[1] - 4.6 && n < 40) {
      n++
      const seed = si * 53 + n * 7 + c
      const tall = hash(seed, 1) < s.tall
      let w = (tall ? 7.2 : 5.4) + hash(seed, 2) * 3.2
      if (c + w > s.a[1]) w = s.a[1] - c
      if (w < 4.4) break
      const depth = s.depth - hash(seed, 3) * 1.1
      const rect = lotRect(s, c, w, depth)
      if (blocked(rect, lots)) {
        c += 1.5
        continue
      }
      const floors = tall ? 6 + Math.floor(hash(seed, 4) * 3) : 2 + Math.floor(hash(seed, 5) * 2.4)
      lots.push({
        rect,
        w,
        d: depth,
        face: s.face,
        kind: tall ? 'apt' : s.kind,
        floors: s.kind === 'house' && !tall ? Math.min(floors, 3) : floors,
        color: tall ? APT[Math.floor(hash(seed, 6) * APT.length)] : PASTELS[Math.floor(hash(seed, 6) * PASTELS.length)],
        seed,
      })
      c += w + (hash(seed, 7) < 0.55 ? 0 : 1.2 + hash(seed, 8) * 1.4)
    }
    // leftover gaps get a neem tree
    for (let t = s.a[0] + 1.6; t < s.a[1] - 1; t += 3.6) {
      const r = lotRect(s, t - 1.4, 2.8, Math.min(s.depth, 3.6))
      if (hash(si * 91 + t, 9) < 0.55 && !blocked(r, [...lots, ...trees.map((q) => ({ rect: q.rect }))])) {
        trees.push({ rect: r, x: (r[0] + r[1]) / 2, z: (r[2] + r[3]) / 2, seed: si * 91 + t })
      }
    }
  })
  return { lots, trees }
}

/* ---------- building drawing (local space: front faces +z, centred on the lot) ---------- */

const shade = (hex, f) => new Color(hex).multiplyScalar(f)

function drawBuilding(k, b, signs, origin, yaw) {
  const { w, d, floors, color, kind, seed } = b
  const yard = kind === 'house' ? 1.9 : 0
  const bd = d - yard
  const cz = -yard / 2 // body centre
  const hz = cz + bd / 2 // front face z
  const FH = 3.2
  const G = kind === 'shop' ? 3.7 : 3.3
  const H = G + (floors - 1) * FH
  const trim = shade(color, 0.86)
  const dark = shade(color, 0.7)
  const rnd = (i, s = 0) => hash(seed + i * 13.7, s)
  const loc = (lx, ly, lz) => [origin[0] + lx * Math.cos(yaw) + lz * Math.sin(yaw), ly, origin[1] - lx * Math.sin(yaw) + lz * Math.cos(yaw)]

  k.box(color, [w, H, bd], [0, H / 2, cz])
  k.box(shade(color, 0.62), [w + 0.08, 0.4, bd + 0.08], [0, 0.2, cz])
  for (let f = 1; f < floors; f++) k.box(trim, [w + 0.14, 0.16, bd + 0.14], [0, G + (f - 1) * FH, cz])
  // flat roof, parapet with cap
  k.box('#8a867d', [w - 0.2, 0.1, bd - 0.2], [0, H + 0.05, cz])
  const pH = 0.9
  k.box(color, [w + 0.1, pH, 0.18], [0, H + pH / 2, hz])
  k.box(color, [w + 0.1, pH, 0.18], [0, H + pH / 2, cz - bd / 2])
  for (const sx of [-1, 1]) k.box(color, [0.18, pH, bd], [sx * (w / 2 + 0.05), H + pH / 2, cz])
  k.box(trim, [w + 0.26, 0.1, 0.32], [0, H + pH + 0.02, hz])
  for (const sx of [-1, 1]) k.box(trim, [0.32, 0.1, bd + 0.2], [sx * (w / 2 + 0.05), H + pH + 0.02, cz])

  // ground floor
  if (kind === 'shop') {
    const n = Math.max(1, Math.floor((w - 0.4) / 3))
    const sw = (w - 0.4) / n
    for (let s = 0; s < n; s++) {
      const u = -w / 2 + 0.2 + sw * (s + 0.5)
      const open = rnd(s, 1) < 0.55
      if (open) {
        k.box('#241d1a', [sw - 0.5, 2.55, 0.1], [u, 1.55, hz + 0.02])
        k.box('#ffd9a0', [sw - 0.9, 0.9, 0.05], [u, 1.9, hz - 0.02], { layer: 'glow' })
        for (let g = 0; g < 3; g++) k.box(AWNING[(s + g) % 5], [0.5, 0.5, 0.3], [u - 0.6 + g * 0.6, 0.85, hz + 0.25])
        k.box('#6b4a33', [sw - 0.7, 0.9, 0.5], [u, 0.45, hz + 0.3])
        const ac = AWNING[Math.floor(rnd(s, 2) * 5)]
        for (let st = 0; st < 4; st++) {
          k.box(st % 2 ? '#f4efe6' : ac, [(sw - 0.3) / 4, 0.06, 0.95], [u - (sw - 0.3) / 2 + ((sw - 0.3) / 4) * (st + 0.5), 2.78, hz + 0.45], { r: [0.28, 0, 0] })
        }
      } else {
        k.box('#8d949a', [sw - 0.5, 2.55, 0.12], [u, 1.55, hz + 0.04])
        for (let r = 0; r < 8; r++) k.box('#767d83', [sw - 0.5, 0.04, 0.15], [u, 0.45 + r * 0.3, hz + 0.045])
        k.box('#5b6167', [0.14, 0.14, 0.06], [u, 0.35, hz + 0.12])
      }
      k.box(trim, [0.3, G, 0.3], [u - sw / 2, G / 2, hz + 0.05])
      const name = SHOPS[Math.floor(rnd(s, 3) * SHOPS.length)]
      const [bg, fg] = SIGN_COLORS[Math.floor(rnd(s, 4) * SIGN_COLORS.length)]
      const sgw = Math.min(sw - 0.3, 4.2)
      k.box('#2a2724', [sgw + 0.1, sgw / 4 + 0.1, 0.1], [u, G - 0.4, hz + 0.1])
      signs.push({ text: name[0], sub: name[1], bg, fg, p: loc(u, G - 0.4, hz + 0.16), ry: yaw, w: sgw, h: sgw / 4 })
    }
    k.box(trim, [0.3, G, 0.3], [w / 2 - 0.2, G / 2, hz + 0.05])
  } else {
    // residential ground floor: car porch and gate
    k.box('#2a2724', [w * 0.3, 2.3, 0.1], [-w * 0.2, 1.2, hz + 0.02])
    k.box('#7b8187', [w * 0.22, 2.0, 0.08], [w * 0.28, 1.1, hz + 0.03])
    k.box(trim, [w + 0.1, 0.18, 1.1], [0, G - 0.1, hz + 0.5])
  }

  // upper floors: windows with sunshades, grills, balconies, AC units, laundry
  const cols = Math.max(2, Math.floor((w - 0.8) / 1.9))
  const pitch = (w - 0.8) / cols
  const balcony = kind === 'apt' || rnd(0, 5) < 0.45
  const grills = rnd(0, 6) < 0.55
  for (let f = 1; f < floors; f++) {
    const y0 = G + (f - 1) * FH
    for (let c = 0; c < cols; c++) {
      const u = -w / 2 + 0.4 + pitch * (c + 0.5)
      const hasBalcony = balcony && (kind === 'apt' || c === Math.floor(cols / 2))
      k.box(trim, [1.2, 1.6, 0.06], [u, y0 + 1.5, hz + 0.01])
      k.box('#35424d', [1.0, 1.4, 0.06], [u, y0 + 1.5, hz + 0.03], { layer: 'glass' })
      k.box(trim, [1.5, 0.08, 0.5], [u, y0 + 2.4, hz + 0.25])
      if (hasBalcony) {
        k.box(trim, [pitch * 0.9, 0.16, 1.1], [u, y0 + 0.5, hz + 0.55])
        k.box('#2a2d32', [pitch * 0.9, 0.06, 0.06], [u, y0 + 1.4, hz + 1.08])
        for (let r = 0; r <= 4; r++) k.box('#2a2d32', [0.04, 0.9, 0.04], [u - pitch * 0.4 + (r * pitch * 0.8) / 4, y0 + 0.95, hz + 1.08])
        if (rnd(f * 7 + c, 7) < 0.4) {
          k.box('#555a60', [pitch * 0.85, 0.02, 0.02], [u, y0 + 2.2, hz + 1.0])
          for (let l = 0; l < 3; l++) k.box(['#d8402f', '#2f7fb8', '#f2c230', '#f4efe6', '#e86aa8'][(f + c + l) % 5], [0.32, 0.55, 0.02], [u - 0.5 + l * 0.5, y0 + 1.9, hz + 1.0])
        }
      } else if (grills) {
        for (let g = 0; g < 3; g++) k.box('#2a2d32', [0.03, 1.4, 0.03], [u - 0.3 + g * 0.3, y0 + 1.5, hz + 0.08])
      }
      if (rnd(f * 11 + c, 8) < 0.3) {
        k.box('#e8ebec', [0.75, 0.5, 0.4], [u + 0.95, y0 + 0.9, hz + 0.22])
        k.cyl('#3a3d42', [0.17, 0.17, 0.04, 10], [u + 0.95, y0 + 0.9, hz + 0.43], { r: [PI / 2, 0, 0] })
      }
    }
    for (const sx of [-1, 1]) {
      k.box('#35424d', [0.06, 1.3, 0.9], [sx * (w / 2 + 0.02), y0 + 1.5, cz + (rnd(f, 9) - 0.5) * bd * 0.5], { layer: 'glass' })
    }
    k.box('#35424d', [1.0, 1.3, 0.06], [(rnd(f, 10) - 0.5) * w * 0.5, y0 + 1.5, cz - bd / 2 - 0.02], { layer: 'glass' })
  }
  // grime streaks under the parapet
  for (let i = 0; i < 3; i++) k.box(dark, [0.28, H * 0.5, 0.02], [-w / 2 + 0.8 + rnd(i, 11) * (w - 1.6), H - H * 0.25, hz + 0.012])

  // roof: Sintex tanks, headroom, dishes, TV aerial
  const tanks = 1 + Math.floor(rnd(0, 12) * 3)
  for (let t = 0; t < tanks; t++) {
    const tx = -w / 2 + 1.2 + t * 1.45
    const tz = cz - bd / 2 + 1.3
    k.box('#8a867d', [1.0, 0.3, 1.0], [tx, H + 0.25, tz])
    k.cyl('#1d2024', [0.62, 0.62, 1.05, 12], [tx, H + 0.95, tz])
    k.sphere('#2a2d32', [0.62, 12, 4, 0, PI * 2, 0, PI / 2], [tx, H + 1.48, tz])
    k.cyl('#1d2024', [0.18, 0.18, 0.1, 8], [tx, H + 2.1, tz])
  }
  k.box(trim, [1.9, 2.4, 2.2], [w / 2 - 1.4, H + 1.2, cz + bd / 2 - 1.6])
  k.box('#2a2724', [0.8, 1.9, 0.06], [w / 2 - 1.4, H + 1.0, cz + bd / 2 - 0.47])
  const dishes = rnd(0, 13) < 0.7 ? 1 + Math.floor(rnd(0, 14) * 2) : 0
  for (let q = 0; q < dishes; q++) {
    const dx = -w / 2 + 0.8 + q * 1.2 + rnd(q, 15) * 0.5
    k.cyl('#6b7075', [0.03, 0.03, 1.2, 5], [dx, H + 1.2, hz - 0.3])
    k.cone('#d8dadc', [0.42, 0.2, 14], [dx, H + 1.9, hz - 0.3], { r: [PI * 0.62, 0, 0.2], s: [1, 1, 1] })
  }
  if (rnd(0, 16) < 0.5) {
    k.cyl('#6b7075', [0.025, 0.025, 3, 5], [w / 2 - 0.5, H + 1.5, cz])
    for (let q = 0; q < 3; q++) k.box('#6b7075', [1.1 - q * 0.25, 0.03, 0.03], [w / 2 - 0.5, H + 1.6 + q * 0.5, cz])
  }

  // bungalow compound wall and gate
  if (kind === 'house') {
    const wz = d / 2 - 0.1
    for (const sx of [-1, 1]) {
      const wl = (w - 1.6) / 2
      k.box(shade(color, 0.95), [wl, 1.3, 0.22], [sx * (0.8 + wl / 2), 0.65, wz])
      k.box(trim, [wl + 0.1, 0.12, 0.3], [sx * (0.8 + wl / 2), 1.34, wz])
      k.box(trim, [0.4, 1.7, 0.4], [sx * 0.8, 0.85, wz])
      k.sphere('#fff3d0', [0.12, 6, 5], [sx * 0.8, 1.85, wz], { layer: 'glow' })
    }
    k.box('#3a4a44', [1.2, 1.4, 0.06], [0, 0.75, wz])
    k.cyl('#6b4a33', [0.12, 0.18, 1.6, 6], [w / 2 - 1.2, 0.8, d / 2 - 1.0])
    k.ico('#4f8a3f', [0.9, 0], [w / 2 - 1.2, 2.2, d / 2 - 1.0])
    k.ico('#5f9a4a', [0.65, 0], [w / 2 - 0.8, 2.6, d / 2 - 1.2])
  }
}

function tree(k, x, z, s, shade0) {
  const greens = ['#4a7f3b', '#5d8f45', '#3f6f33', '#6a9a4c']
  k.cyl('#6b4a33', [0.17 * s, 0.26 * s, 2.5 * s, 6], [x, 1.25 * s, z])
  k.ico(greens[shade0 % 4], [1.3 * s, 0], [x, 3.2 * s, z])
  k.ico(greens[(shade0 + 1) % 4], [1.0 * s, 0], [x + 0.75 * s, 2.8 * s, z + 0.3 * s])
  k.ico(greens[(shade0 + 2) % 4], [0.95 * s, 0], [x - 0.65 * s, 2.9 * s, z - 0.5 * s])
  k.ico(greens[(shade0 + 3) % 4], [0.8 * s, 0], [x + 0.1 * s, 4.0 * s, z - 0.2 * s])
}

function buildStreetscape() {
  const { lots, trees } = planLots()
  const k = createKit()
  const signs = []
  const boxes = []
  const cyls = []
  for (const b of lots) {
    const cx = (b.rect[0] + b.rect[1]) / 2
    const cz = (b.rect[2] + b.rect[3]) / 2
    const yaw = YAW[b.face]
    k.place([cx, 0, cz], yaw, (kk) => drawBuilding(kk, b, signs, [cx, cz], yaw))
    const FH = 3.2
    const G = b.kind === 'shop' ? 3.7 : 3.3
    const H = G + (b.floors - 1) * FH + 1
    const yard = b.kind === 'house' ? 1.9 : 0
    const sideways = b.face === '+x' || b.face === '-x'
    // body only (the yard in front of a bungalow stays walkable, its wall gets a collider)
    const bw = b.w
    const bd = b.d - yard
    const off = yard / 2 // body shifts toward the back
    const back = { '+z': [0, -off], '-z': [0, off], '+x': [-off, 0], '-x': [off, 0] }[b.face]
    boxes.push([cx + back[0], cz + back[1], sideways ? bd : bw, H, sideways ? bw : bd])
  }
  for (const t of trees) {
    const s = 0.9 + hash(t.seed, 3) * 0.5
    tree(k, t.x, t.z, s, Math.floor(hash(t.seed, 4) * 4))
    cyls.push([t.x, t.z, 0.35, 3])
  }
  addFootprints([...lots.map((l) => l.rect), ...trees.map((t) => t.rect)])
  return { kit: k.build(), signs: createSigns(signs, { cw: 384, ch: 96, cols: 4 }), boxes, cyls }
}

export default function Streetscape() {
  const { kit, signs, boxes, cyls } = cached('streetscape', buildStreetscape)
  return (
    <Body at={[0, 0, 0]} boxes={boxes} cyls={cyls}>
      <KitMesh kit={kit} />
      <mesh geometry={signs.geometry} material={signs.material} />
    </Body>
  )
}
