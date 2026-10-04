import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import RiggedHuman from '../RiggedHuman'
import { cached, hash, isClear } from './kit'

// Chennai pedestrians: ~34 rigged GLB humans (RiggedHuman, recoloured per NPC into
// Chennai outfits). Walkers patrol the pavements, groups queue / chat / sit, and
// anyone within ~1.2 m of `playerPosRef` steps aside. Group transforms are mutated
// every frame (no React state). No colliders.
// playerPosRef.current may be {x, z}, an Object3D position holder or a Rapier body.

const CULL_LANE2 = 80 * 80
const CULL_UPDATE2 = 45 * 45
const CULL_HIDE2 = 55 * 55 // hidden people also skip their skeleton animation
const SIT_DROP = -0.35
const SIT_LEAN = -0.25

/* ---------- palettes ---------- */

const SKINS = ['#8d5a3b', '#7a4a30', '#9a6642', '#6e4129', '#a8754e', '#5e3822', '#b88257', '#845235']
const LIGHT_SKINS = ['#e3b48f', '#d6a07b', '#f0c8a4', '#c98d68']
const SHIRTS = ['#f4efe6', '#ffffff', '#9ec4e0', '#e8b4c4', '#a9d6b0', '#f0d58a', '#c8d8e8', '#d8a07a', '#7fb2c8', '#b8a8d8', '#e9e1c8']
const CHECKS = ['#4f78a8', '#a8523f', '#3f7f6a', '#7a5aa0', '#b8873a']
const TROUSERS = ['#2c3140', '#3a3f4a', '#4a3f35', '#1f2a3a', '#55524a', '#2e3a30']
const LUNGI = ['#2f5f93', '#2f7f5f', '#8a2f3a', '#6a4a8a', '#b8873a', '#e9e4d8']
const SAREES = ['#b3262e', '#1f7f8a', '#d9a21e', '#c2307a', '#2f8f4f', '#e0702a', '#2f4fa8', '#7a2f8a', '#d84a68']
const BLOUSES = ['#f2c230', '#f4efe6', '#2a1a14', '#c2307a', '#2f8f4f', '#d84a68', '#e8d8a8']
const HAIRS = ['#17110e', '#1c1410', '#241913']
const SHOES = ['#d9d2c2', '#6a4a33', '#1a1a1a', '#a8825a']
const BRIGHT = ['#e8b84a', '#d8402f', '#2f9fa8', '#7ac15a', '#c8507a', '#f2f2f2', '#e0702a']
const KHAKI = '#8f7d57'
const NAVY = '#1f2a5a'
const CREAM = '#ece6d8'

const tint = (c, k) => `#${new Color(c).lerp(new Color(k > 0 ? '#ffffff' : '#000000'), Math.abs(k)).getHexString()}`

/* ---------- appearance ---------- */

function makeLook(i, role) {
  const R = (k) => hash(i * 19 + k, 7)
  const pick = (a, k) => a[Math.floor(R(k) * a.length)]
  const c = {
    Skin: pick(SKINS, 2),
    Hair: R(4) < 0.12 ? '#9a958d' : pick(HAIRS, 5),
    Tee: '#ffffff',
    Print: '#ffffff',
    Shorts: '#2c3140',
    Legs: '#2c3140',
    Shoes: pick(SHOES, 3),
  }
  let scale = 0.97 + R(1) * 0.07
  const wear = (top, bottom, print = top) => {
    c.Tee = top
    c.Print = print
    c.Placket = top
    c.Shorts = bottom
    c.Legs = bottom
  }
  const man = () => {
    const checked = R(8) < 0.3
    const shirt = checked ? pick(CHECKS, 9) : pick(SHIRTS, 9)
    if (R(12) < 0.4) {
      const v = R(13) < 0.6 ? (R(14) < 0.5 ? '#f4efe6' : CREAM) : pick(LUNGI, 15)
      wear(shirt, v)
      c.Shoes = R(16) < 0.5 ? '#a8825a' : '#6a4a33'
    } else {
      wear(shirt, pick(TROUSERS, 6))
    }
  }
  const woman = (kind) => {
    scale *= 0.94
    c.Hair = R(26) < 0.12 ? '#9a958d' : pick(HAIRS, 5)
    const si = Math.floor(R(21) * SAREES.length)
    if (kind === 'saree') {
      const saree = SAREES[si]
      let blouse = pick(BLOUSES, 23)
      if (blouse === saree) blouse = '#f4efe6'
      const contrast = SAREES[(si + 3 + Math.floor(R(22) * 3)) % SAREES.length]
      wear(blouse, saree, R(24) < 0.3 ? contrast : blouse)
    } else {
      wear(SAREES[si], pick(['#f4efe6', '#2a2f5a', '#e9e1c8', '#3a3f4a'], 25))
    }
  }
  const child = () => {
    scale = 0.62 + R(30) * 0.12
    if (R(31) < 0.6) {
      wear('#f4efe6', NAVY)
      c.Shoes = '#1a1a1a'
    } else {
      const t = pick(BRIGHT, 33)
      wear(t, pick(TROUSERS, 34), R(35) < 0.4 ? '#ffffff' : t)
    }
  }

  const adult = role === 'adult' ? (R(40) < 0.5 ? 'man' : 'woman') : role
  switch (adult) {
    case 'man':
      man()
      break
    case 'woman':
      woman(R(41) < 0.7 ? 'saree' : 'salwar')
      break
    case 'child':
      child()
      break
    case 'driver':
      wear(KHAKI, KHAKI)
      c.Shoes = '#3a2f28'
      break
    case 'police':
      wear(KHAKI, KHAKI)
      c.Shoes = '#161616'
      scale = 1.03
      break
    case 'fisher': {
      c.Skin = pick(SKINS.slice(3), 42)
      const lungi = pick(LUNGI, 43)
      wear(R(44) < 0.5 ? c.Skin : '#e9e4d8', lungi)
      c.Shoes = c.Skin
      break
    }
    case 'tourist': {
      c.Skin = R(45) < 0.55 ? pick(LIGHT_SKINS, 46) : pick(SKINS, 46)
      const t = pick(BRIGHT, 47)
      wear(t, pick(['#c8b88a', '#2f5f93', '#e9e1c8'], 48), tint(t, R(49) < 0.5 ? 0.55 : -0.5))
      c.Shoes = R(50) < 0.5 ? '#f4efe6' : '#6a4a33'
      if (R(51) < 0.5) {
        scale *= 0.95
        c.Hair = pick(['#17110e', '#6a4a2a', '#c8a050'], 52)
      }
      break
    }
    case 'seller':
      woman('saree')
      scale *= 0.98
      break
    case 'master':
      wear('#f4efe6', CREAM)
      c.Hair = '#9a958d'
      c.Shoes = '#a8825a'
      break
    case 'devotee':
      if (R(54) < 0.5) {
        wear(tint(c.Skin, -0.05), '#f4efe6')
        c.Shoes = '#a8825a'
      } else {
        woman('saree')
      }
      break
    default:
      man()
  }
  return { colors: c, scale }
}

/* ---------- placement: walking lanes ---------- */

// [axis, fixed coordinate, from, to, opts]: pavement lines along the roads
const LANES = [
  ['x', -5.6, -11, 60],
  ['x', 5.6, -11, 60],
  ['x', 26.4, -45, 60],
  ['x', 39.6, -45, 56, { roles: ['tourist', 'adult', 'fisher'] }],
  ['z', -10.9, -48, 30],
  ['z', -21.1, -48, 30],
  ['z', 23.2, -38, 30],
  ['z', 32.8, -38, 30],
  ['z', -26.6, -13, 27],
]
const OBST = [[5.6, -4, 1.6], [-6, 8, 1.9], [24.5, 23, 1.9], [-6, 34, 1.9], [8.8, 14.5, 1.9], [-9, 17, 3], [23, -8, 3.2]]
const RECTS = [[4, 6, 6.8, 10], [7.4, 6.4, 12.6, 11.6], [15.2, 12.4, 26.8, 19.6]]
const UMB = [[40.5, -44], [42, -38], [41, -26], [43, -22], [40, -16], [42, -8], [41.5, 14], [43.5, 20], [40.5, 26], [42.5, 34], [41, 44], [43, 52]]
const openAt = (x, z) =>
  isClear(x, z, 0.6) &&
  Math.hypot(x - 40, z) > 5 &&
  !OBST.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r) &&
  !RECTS.some(([a, b, c, d]) => x > a && x < c && z > b && z < d) &&
  !UMB.some(([ux, uz]) => Math.hypot(x - ux, z - uz) < 1.3)

function lanePieces() {
  const out = []
  for (const [axis, c, a, b, opts] of LANES) {
    const at = (v) => (axis === 'x' ? [c, v] : [v, c])
    let start = null
    for (let v = a; v <= b + 0.01; v += 0.5) {
      const [x, z] = at(v)
      const ok = openAt(x, z)
      if (ok && start === null) start = v
      if (start !== null && (!ok || v + 0.5 > b)) {
        const end = ok ? v : v - 0.5
        if (end - start >= 8) out.push({ a: at(start + 0.8), b: at(end - 0.8), opts: opts || {} })
        start = null
      }
    }
  }
  return out
}

const MAX_WALK_GROUPS = 12
const MAX_WALKERS = 14
const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z)

function buildWorld() {
  const npcs = []
  const lanes = []
  const add = (role, x, z, yaw, mode = 'stand', o = {}) => {
    const i = npcs.length
    const { colors, scale } = makeLook(i, role)
    const idle = mode === 'stand' || mode === 'chat' || mode === 'pray'
    npcs.push({
      i,
      role,
      colors,
      scale,
      animRef: { current: { speed: 0, grounded: true } },
      x,
      z,
      yaw,
      yawOff: idle ? (hash(i, 11) - 0.5) * 0.5 : 0,
      mode,
      mv: 0,
      r: hash(i, 10),
      ax: 0,
      az: 0,
      lane: o.lane || null,
      lat: o.lat || 0,
      lon: o.lon || 0,
    })
  }

  // walkers
  const groups = []
  lanePieces().forEach((p, pi) => {
    const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1])
    const n = len > 30 ? 2 : 1
    for (let j = 0; j < n; j++) groups.push({ p, len, f: (j + 0.2 + hash(pi * 3 + j, 61) * 0.6) / n, pi, j })
  })
  const chosen =
    groups.length > MAX_WALK_GROUPS
      ? Array.from({ length: MAX_WALK_GROUPS }, (_, k) => groups[Math.floor((k * groups.length) / MAX_WALK_GROUPS)])
      : groups
  chosen.forEach((g, gi) => {
    const { p, len } = g
    const ux = (p.b[0] - p.a[0]) / len
    const uz = (p.b[1] - p.a[1]) / len
    const st = {
      ax: p.a[0],
      az: p.a[1],
      ux,
      uz,
      len,
      s: g.f * len,
      dir: hash(gi, 62) < 0.5 ? 1 : -1,
      speed: 1.0 + hash(gi, 63) * 0.45,
      wait: 0,
      hold: 0,
      k: 0,
      id: gi,
      moving: true,
    }
    lanes.push(st)
    const yaw = Math.atan2(ux * st.dir, uz * st.dir)
    const roles = p.opts.roles || ['man', 'woman', 'adult']
    const role = roles[Math.floor(hash(gi, 64) * roles.length)]
    const lat = (hash(gi, 65) - 0.5) * 0.7
    const opt = { lane: st, lat }
    add(role, 0, 0, yaw, 'walk', opt)
    const r = hash(gi, 66)
    if (npcs.length >= MAX_WALKERS) return
    if (r < 0.15) add(hash(gi, 67) < 0.5 ? 'man' : 'woman', 0, 0, yaw, 'walk', { lane: st, lat: lat + 0.6, lon: 0.1 })
    else if (r < 0.28) add('child', 0, 0, yaw, 'walk', { lane: st, lat: lat + 0.5, lon: 0.55 })
  })

  // bus stop queue + bench (shelter at [5.4, 8], front faces west)
  const W = -Math.PI / 2
  add('adult', 4.5, 6.9, W, 'stand')
  add('adult', 4.55, 7.9, W, 'chat')
  add('woman', 5.85, 7.3, W, 'bench')

  // tea kadai at [9, 9] (counter on the east side), bench further east
  add('master', 8.75, 8.3, -W, 'stand')
  add('adult', 10.95, 7.9, W, 'stand')
  add('driver', 10.95, 10.0, W, 'stand')
  add('man', 12.05, 8.2, W, 'bench')

  // gopuram entrance (north face z ~ 13) with devotees and a flower seller
  add('devotee', 18.8, 11.6, 0, 'pray')
  add('devotee', 21.4, 11.9, 0, 'pray')
  add('devotee', 17.2, 10.2, 0.3, 'chat')
  add('seller', 24.6, 11.7, Math.PI, 'sit', { seat: 'ground' })

  // airport forecourt travellers and police
  add('adult', -9.5, -24.5, 2.4, 'chat')
  add('adult', -8.2, -24.0, -0.8, 'chat')
  add('adult', 12.5, -24.8, 0.6, 'stand')
  add('woman', 21.0, -23.6, 0.2, 'stand')
  add('child', 22.0, -24.2, 0.4, 'stand')
  add('police', -12.5, -22.4, 0.5, 'stand')
  add('police', 9.0, -26.2, -0.5, 'stand')

  // beach: families sitting on the sand facing the sea
  const SEA = Math.PI / 2
  add('man', 39.1, -33.4, SEA, 'sit', { seat: 'ground' })
  add('woman', 39.0, -32.2, SEA, 'sit', { seat: 'ground' })
  add('child', 39.7, -32.8, SEA, 'sit', { seat: 'ground' })
  add('woman', 38.6, 19.6, SEA, 'sit', { seat: 'ground' })
  add('child', 39.3, 19.0, SEA, 'sit', { seat: 'ground' })
  add('fisher', 42.6, 10.2, SEA, 'stand')

  // lighthouse promenade tourists (lighthouse at [40, 0])
  add('tourist', 35.8, -4.3, faceTo(35.8, -4.3, 40, 0), 'chat')
  add('tourist', 36.6, -3.5, faceTo(36.6, -3.5, 40, 0), 'chat')
  add('tourist', 44.2, 3.8, faceTo(44.2, 3.8, 40, 0), 'stand')

  // auto drivers by their rickshaws
  add('driver', 7.2, -3.3, 2.4, 'chat')
  add('driver', 10.4, 16.0, -1.2, 'stand')

  return { npcs, lanes }
}

/* ---------- per-frame logic ---------- */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const ease = (cur, target, k) => cur + (target - cur) * k
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

const npcXZ = (n) => (n.lane ? [n.lane.ax + n.lane.ux * n.lane.s, n.lane.az + n.lane.uz * n.lane.s] : [n.x, n.z])

function animate(n, g, t, dt, pl) {
  const st = n.lane
  const seated = n.mode === 'sit' || n.mode === 'bench'

  let x = n.x
  let z = n.z
  let moving = false
  if (st) {
    x = st.ax + st.ux * st.s - st.ux * st.dir * n.lon + st.uz * n.lat
    z = st.az + st.uz * st.s - st.uz * st.dir * n.lon - st.ux * n.lat
    moving = st.moving
    n.yaw += wrapAngle(Math.atan2(st.ux * st.dir, st.uz * st.dir) - n.yaw) * (1 - Math.exp(-7 * dt))
  }

  // step aside when the player gets close
  let tx = 0
  let tz = 0
  if (pl && !seated) {
    const dx = x - pl.x
    const dz = z - pl.z
    const d = Math.hypot(dx, dz)
    if (d < 1.5 && d > 0.01) {
      const push = (1.5 - d) * 0.9
      tx = (dx / d) * push
      tz = (dz / d) * push
    }
    if (st && d < 1.2) st.hold = 0.6
  }
  const ka = 1 - Math.exp(-5 * dt)
  n.ax = ease(n.ax, tx, ka)
  n.az = ease(n.az, tz, ka)
  x += n.ax
  z += n.az

  n.mv = ease(n.mv, moving ? 1 : 0, 1 - Math.exp(-8 * dt))
  const sd = n.r * 20
  const a = n.animRef.current
  a.grounded = true
  a.speed = st && n.mv > 0.3 ? st.speed : 0

  let yaw = n.yaw + n.yawOff
  let y = 0
  let lean = 0
  let roll = 0
  if (seated) {
    y = SIT_DROP
    lean = SIT_LEAN
  } else if (n.mv < 0.3) {
    y = Math.sin(t * 1.4 + sd) * 0.008
    roll = Math.sin(t * 0.8 + sd) * 0.018
    if (n.mode === 'chat') yaw += Math.sin(t * 0.9 + sd) * 0.14
    else if (n.mode === 'pray') lean = 0.08 + Math.sin(t * 0.7 + sd) * 0.03
    if (pl && n.mode !== 'pray') {
      const dx = pl.x - x
      const dz = pl.z - z
      if (dx * dx + dz * dz < 25) yaw += clamp(wrapAngle(Math.atan2(dx, dz) - yaw), -0.6, 0.6) * 0.5
    }
  }
  g.position.set(x, y, z)
  g.rotation.set(lean, yaw, roll)
}

function updateLane(st, dt) {
  if (st.hold > 0) {
    st.hold -= dt
    st.moving = false
    return
  }
  if (st.wait > 0) {
    st.wait -= dt
    st.moving = false
    return
  }
  st.moving = true
  st.s += st.dir * st.speed * dt
  const end = st.s > st.len ? st.len : st.s < 0 ? 0 : null
  if (end !== null) {
    st.s = end
    st.dir = -st.dir
    st.k += 1
    st.wait = 0.8 + hash(st.id * 7 + st.k, 68) * 3.2
  }
}

const playerXZ = (ref) => {
  const o = ref && ref.current
  if (!o) return null
  const v = typeof o.translation === 'function' ? o.translation() : o.position || o
  return typeof v.x === 'number' ? v : null
}

export default function People({ playerPosRef }) {
  const world = useMemo(() => cached('people', buildWorld), [])
  const groups = useRef([])

  useLayoutEffect(() => {
    world.npcs.forEach((n) => {
      const g = groups.current[n.i]
      if (!g) return
      g.rotation.order = 'YXZ'
      animate(n, g, 0, 0, null)
    })
  }, [world])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const cam = state.camera.position
    const pl = playerXZ(playerPosRef)
    for (const st of world.lanes) {
      const px = st.ax + st.ux * st.s
      const pz = st.az + st.uz * st.s
      if ((px - cam.x) ** 2 + (pz - cam.z) ** 2 < CULL_LANE2) updateLane(st, dt)
    }
    for (const n of world.npcs) {
      const g = groups.current[n.i]
      if (!g) continue
      const [nx, nz] = npcXZ(n)
      const d2 = (nx - cam.x) ** 2 + (nz - cam.z) ** 2
      g.visible = d2 <= CULL_HIDE2
      if (d2 > CULL_UPDATE2) continue
      animate(n, g, t, dt, pl)
    }
  })

  return (
    <group>
      {world.npcs.map((n) => (
        <group
          key={n.i}
          ref={(el) => {
            groups.current[n.i] = el
          }}
        >
          <RiggedHuman anim={n.animRef} colors={n.colors} scale={n.scale} castShadow={false} shades={n.shades === true} />
        </group>
      ))}
    </group>
  )
}
