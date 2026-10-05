import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ROADS, ZONES } from '../zones'

// A tiny "kit" for building low-poly props: every part is baked into one merged,
// vertex-coloured geometry per layer (solid / glass / glow), so a whole landmark
// costs ~3 draw calls however many boxes it is made of.

const M = new Matrix4()
const Q = new Quaternion()
const E = new Euler()
const V = new Vector3()
const S = new Vector3()

export const MATS = {
  solid: new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  glass: new MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.45 }),
  glow: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
}

const cache = {}
export const cached = (key, fn) => (cache[key] ??= fn())

export const hash = (i, seed = 0) => {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const FACES = {
  '+z': { rot: 0, axis: 0, dir: [0, 0, 1] },
  '-z': { rot: Math.PI, axis: 0, dir: [0, 0, -1] },
  '+x': { rot: Math.PI / 2, axis: 2, dir: [1, 0, 0] },
  '-x': { rot: -Math.PI / 2, axis: 2, dir: [-1, 0, 0] },
}

// Position + rotation of a point on one face of a box centred at c: u along the
// face, y up, d out of the face.
export function onFace(face, c, u, y, d) {
  const ry = FACES[face].rot
  const sn = Math.sin(ry)
  const cs = Math.cos(ry)
  return { p: [c[0] + sn * d + cs * u, c[1] + y, c[2] + cs * d - sn * u], r: [0, ry, 0] }
}

// Arched window with a pale frame, sitting on a facade.
export function archWin(k, face, c, u, y, w, h, d, dark = '#2a1812', trim = '#f1e7d4') {
  const a = onFace(face, c, u, y + h / 2, d + 0.02)
  k.plane(trim, [w + 0.45, h + 0.2], a.p, { r: a.r })
  const b = onFace(face, c, u, y + h + 0.1, d + 0.02)
  k.circle(trim, [(w + 0.45) / 2, 12, 0, Math.PI], b.p, { r: b.r })
  const f = onFace(face, c, u, y + h / 2, d + 0.045)
  k.arch(dark, w, h, f.p, { r: f.r })
}

export function createKit() {
  const layers = { solid: [], glass: [], glow: [] }
  let G = null // group transform (see kit.place)

  const add = (geo, color, p = [0, 0, 0], o = {}) => {
    const g = geo.index ? geo.toNonIndexed() : geo
    g.deleteAttribute('uv')
    const r = o.r || [0, 0, 0]
    const s = o.s || [1, 1, 1]
    M.compose(V.set(p[0], p[1], p[2]), Q.setFromEuler(E.set(r[0], r[1], r[2], o.order || 'XYZ')), S.set(s[0], s[1], s[2]))
    if (G) M.premultiply(G)
    g.applyMatrix4(M)
    const n = g.attributes.position.count
    const c = new Color(color)
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new BufferAttribute(arr, 3))
    layers[o.layer || 'solid'].push(g)
  }

  const kit = {
    box: (color, size, p, o) => add(new BoxGeometry(...size), color, p, o),
    cyl: (color, args, p, o) => add(new CylinderGeometry(...args), color, p, o),
    cone: (color, args, p, o) => add(new ConeGeometry(...args), color, p, o),
    sphere: (color, args, p, o) => add(new SphereGeometry(...args), color, p, o),
    ico: (color, args, p, o) => add(new IcosahedronGeometry(...args), color, p, o),
    torus: (color, args, p, o) => add(new TorusGeometry(...args), color, p, o),
    plane: (color, size, p, o) => add(new PlaneGeometry(...size), color, p, o),
    circle: (color, args, p, o) => add(new CircleGeometry(...args), color, p, o),
    // Palm frond: a flat kite along +z, `droop` tilts the tip down
    frond: (color, [len, wid], p, o) => {
      const shape = new Shape()
      shape.moveTo(0, 0)
      shape.lineTo(wid * 0.7, len * 0.18)
      shape.lineTo(wid, len * 0.45)
      shape.lineTo(0, len)
      shape.lineTo(-wid, len * 0.45)
      shape.lineTo(-wid * 0.7, len * 0.18)
      const g = new ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false })
      g.rotateX(Math.PI / 2)
      add(g, color, p, o)
    },
    // Any 2D shape extruded along +z by `depth`
    extrude: (color, shape, depth, p, o) => add(new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 }), color, p, o),
    // Plan shape (x, y) extruded upwards by `h`: y of the shape maps to -z
    prism: (color, shape, h, p, o) => {
      const g = new ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 12 })
      g.rotateX(-Math.PI / 2)
      add(g, color, p, o)
    },
    // Everything added inside fn is moved to (x, y, z) and turned by yaw
    place: (p, yaw, fn) => {
      const prev = G
      const t = new Matrix4().compose(new Vector3(p[0], p[1], p[2]), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), new Vector3(1, 1, 1))
      G = prev ? prev.clone().multiply(t) : t
      fn(kit)
      G = prev
    },
    // Triangular prism: base width, height, depth (along z), apex up
    tri: (color, [w, h, d], p, o) => {
      const shape = new Shape()
      shape.moveTo(-w / 2, 0)
      shape.lineTo(w / 2, 0)
      shape.lineTo(0, h)
      const g = new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false })
      g.translate(0, 0, -d / 2)
      add(g, color, p, o)
    },
    // Grid of window quads on a facade. `origin` is the middle of the bottom row.
    windows: ({ origin, face = '+z', cols, rows, gap, size = [0.8, 1.2], color = '#2c2a30', lit = '#ffd48a', litProb = 0, seed = 1, layer = 'glass' }) => {
      const f = FACES[face]
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const off = (c - (cols - 1) / 2) * gap[0]
          const p = [origin[0], origin[1] + r * gap[1], origin[2]]
          p[f.axis] += off
          const isLit = litProb > 0 && hash(c * 31 + r * 17 + origin[0] * 3 + origin[1], seed) < litProb
          add(new PlaneGeometry(size[0], size[1]), isLit ? lit : color, p, {
            r: [0, f.rot, 0],
            layer: isLit ? 'glow' : layer,
          })
        }
      }
    },
    // Little square-on-arch window (dark opening + rounded top)
    arch: (color, w, h, p, o = {}) => {
      const r = o.r || [0, 0, 0]
      const layer = o.layer || 'solid'
      add(new PlaneGeometry(w, h), color, p, { r, layer })
      const top = [p[0], p[1] + h / 2, p[2]]
      if (r[1] === 0) add(new CircleGeometry(w / 2, 10, 0, Math.PI), color, top, { layer })
      else add(new CircleGeometry(w / 2, 10, 0, Math.PI), color, top, { r, layer })
    },
    build: () => {
      const out = {}
      for (const key of Object.keys(layers)) {
        out[key] = layers[key].length ? mergeGeometries(layers[key]) : null
        layers[key].forEach((g) => g.dispose())
      }
      return out
    },
  }
  return kit
}

// Rectangle with a semicircular top, as a Shape (or a hole Path when `hole`)
export function archShape(w, h, x = 0, y = 0, hole = false) {
  const p = hole ? new Path() : new Shape()
  const r = w / 2
  p.moveTo(x - r, y)
  p.lineTo(x + r, y)
  p.lineTo(x + r, y + h - r)
  p.absarc(x, y + h - r, r, 0, Math.PI, false)
  p.lineTo(x - r, y)
  return p
}

export function rectShape(w, h, x = 0, y = 0) {
  const s = new Shape()
  s.moveTo(x - w / 2, y)
  s.lineTo(x + w / 2, y)
  s.lineTo(x + w / 2, y + h)
  s.lineTo(x - w / 2, y + h)
  s.closePath()
  return s
}

// Plan outline with rounded corners (radius r), centred on the origin
export function roundRectShape(w, d, r, rs = [r, r, r, r]) {
  const s = new Shape()
  const x = w / 2
  const y = d / 2
  s.moveTo(-x + rs[0], -y)
  s.lineTo(x - rs[1], -y)
  s.quadraticCurveTo(x, -y, x, -y + rs[1])
  s.lineTo(x, y - rs[2])
  s.quadraticCurveTo(x, y, x - rs[2], y)
  s.lineTo(-x + rs[3], y)
  s.quadraticCurveTo(-x, y, -x, y - rs[3])
  s.lineTo(-x, -y + rs[0])
  s.quadraticCurveTo(-x, -y, -x + rs[0], -y)
  return s
}

// Real glass for the big buildings (same recipe as the airport hall)
export function glassMaterial(color = '#7fb3c6', opacity = 0.42) {
  return new MeshPhysicalMaterial({
    color,
    metalness: 0.1,
    roughness: 0.06,
    transparent: true,
    opacity,
    envMapIntensity: 1.6,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  })
}

export function patternTexture(draw, { size = 256, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.colorSpace = SRGBColorSpace
  return tex
}

const TAMIL = '"Nirmala UI","Latha","Noto Sans Tamil","Segoe UI",sans-serif'

// Many shop signs in ONE texture atlas + ONE merged quad mesh (1 draw call).
// items: { text, sub?, bg, fg, p: [x, y, z], ry, w, h, rx? }
export function createSigns(items, { cw = 512, ch = 128, cols = 2 } = {}) {
  const rows = Math.ceil(items.length / cols)
  const canvas = document.createElement('canvas')
  canvas.width = cw * cols
  canvas.height = ch * rows
  const ctx = canvas.getContext('2d')
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const m = new Matrix4()
  items.forEach((it, i) => {
    const ox = (i % cols) * cw
    const oy = Math.floor(i / cols) * ch
    ctx.fillStyle = it.bg
    ctx.fillRect(ox, oy, cw, ch)
    ctx.strokeStyle = it.fg
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 5
    ctx.strokeRect(ox + 7, oy + 7, cw - 14, ch - 14)
    ctx.globalAlpha = 1
    ctx.fillStyle = it.fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const fit = (text, px, weight, family, y) => {
      let size = px
      ctx.font = `${weight} ${size}px ${family}`
      while (ctx.measureText(text).width > cw - 36 * (ch / 128) && size > 10) {
        size -= 2
        ctx.font = `${weight} ${size}px ${family}`
      }
      ctx.fillText(text, ox + cw / 2, oy + y)
    }
    const sc = ch / 128
    if (it.sub) {
      fit(it.text, 50 * sc, 800, 'Arial, sans-serif', ch * 0.33)
      fit(it.sub, 42 * sc, 700, TAMIL, ch * 0.72)
    } else {
      fit(it.text, 64 * sc, 800, it.family || 'Arial, sans-serif', ch / 2 + 2)
    }
    const u0 = ox / canvas.width
    const u1 = (ox + cw) / canvas.width
    const v1 = 1 - oy / canvas.height
    const v0 = 1 - (oy + ch) / canvas.height
    m.compose(new Vector3(...it.p), new Quaternion().setFromEuler(new Euler(it.rx || 0, it.ry || 0, 0, 'YXZ')), new Vector3(1, 1, 1))
    const base = pos.length / 3
    for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      const v = new Vector3(x * it.w, y * it.h, 0).applyMatrix4(m)
      pos.push(v.x, v.y, v.z)
      const n = new Vector3(0, 0, 1).transformDirection(m)
      nor.push(n.x, n.y, n.z)
    }
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setIndex(idx)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false })
  return { geometry, material }
}

export function makeLabel(text, { bg = '#14100c', fg = '#ffcf6b', w = 256, h = 96, font = '700 54px monospace' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = fg
  ctx.lineWidth = 4
  ctx.strokeRect(5, 5, w - 10, h - 10)
  ctx.fillStyle = fg
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 3)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/* ---------- placement helpers ---------- */

// Airport terminal, roof overhang, deck and ramps (see Airport.jsx).
const AIRPORT = { minX: -36, maxX: 38, minZ: -130, maxZ: -24 }

// Landmark and streetscape footprints [minX, maxX, minZ, maxZ] that props must keep out of.
// Streetscape registers its lots here before the palms and lamps are placed.
export const FOOTPRINTS = [
  [-64, -34, -41, -21], // Ripon Building and its lawn
  [6.2, 28, 10.5, 23.8], // temple compound
  [6.5, 11.5, 6, 12.5], // tea kadai
  [-34, -14.5, 3.5, 19.5], // library
  [-43, -33, 3, 19], // library car park
  [39, 47, -6, 10.5], // lighthouse and its building
  [5.3, 29, 41, 64], // OMR corridor
]
export const addFootprints = (rects) => FOOTPRINTS.push(...rects)

// Is (x, z) free of roads, zone markers, the airport and the spawn point (with padding)?
export function isClear(x, z, pad = 1) {
  if (x > AIRPORT.minX - pad && x < AIRPORT.maxX + pad && z > AIRPORT.minZ - pad && z < AIRPORT.maxZ + pad) return false
  for (const [cx, cz, w, l] of ROADS) {
    if (Math.abs(x - cx) < w / 2 + pad && Math.abs(z - cz) < l / 2 + pad) return false
  }
  for (const [x0, x1, z0, z1] of FOOTPRINTS) {
    if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) return false
  }
  for (const zone of ZONES) {
    if (Math.hypot(x - zone.position[0], z - zone.position[2]) < 2.6 + pad + 1) return false
  }
  return Math.hypot(x, z + 16) > 4 + pad
}
