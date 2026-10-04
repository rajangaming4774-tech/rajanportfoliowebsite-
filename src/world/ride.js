import { ROADS } from './zones'

// Auto-rickshaw routing: drive along the road centre lines from zones.js,
// shortest path through the junctions, keeping to the left lane like in India.

const LANE = 1.6 // metres left of the centre line

// Each road rectangle becomes a centre line running along its long side.
const LINES = ROADS.map(([cx, cz, w, l]) =>
  l > w ? { axis: 'z', fixed: cx, min: cz - l / 2, max: cz + l / 2 } : { axis: 'x', fixed: cz, min: cx - w / 2, max: cx + w / 2 },
)

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const onLine = (line, p) =>
  line.axis === 'z'
    ? Math.abs(p.x - line.fixed) < 0.01 && p.z >= line.min - 0.01 && p.z <= line.max + 0.01
    : Math.abs(p.z - line.fixed) < 0.01 && p.x >= line.min - 0.01 && p.x <= line.max + 0.01

function snap(p) {
  let best = null
  for (const line of LINES) {
    const q = line.axis === 'z' ? { x: line.fixed, z: clamp(p.z, line.min, line.max) } : { x: clamp(p.x, line.min, line.max), z: line.fixed }
    const d = dist(p, q)
    if (!best || d < best.d) best = { d, q }
  }
  return best.q
}

const JUNCTIONS = []
for (const a of LINES) {
  for (const b of LINES) {
    if (a.axis !== 'z' || b.axis !== 'x') continue
    const p = { x: a.fixed, z: b.fixed }
    if (onLine(a, p) && onLine(b, p)) JUNCTIONS.push(p)
  }
}

// Shortest road path between two snapped points (Dijkstra over a tiny graph).
function roadPath(start, end) {
  const nodes = [start, end, ...JUNCTIONS]
  const edges = nodes.map(() => [])
  for (const line of LINES) {
    const key = line.axis === 'z' ? 'z' : 'x'
    const on = nodes.map((p, i) => [p, i]).filter(([p]) => onLine(line, p)).sort((a, b) => a[0][key] - b[0][key])
    for (let k = 1; k < on.length; k++) {
      const [pa, ia] = on[k - 1]
      const [pb, ib] = on[k]
      const w = dist(pa, pb)
      edges[ia].push([ib, w])
      edges[ib].push([ia, w])
    }
  }
  const cost = nodes.map(() => Infinity)
  const prev = nodes.map(() => -1)
  const done = nodes.map(() => false)
  cost[0] = 0
  for (;;) {
    let u = -1
    for (let i = 0; i < nodes.length; i++) if (!done[i] && cost[i] < Infinity && (u < 0 || cost[i] < cost[u])) u = i
    if (u < 0 || u === 1) break
    done[u] = true
    for (const [v, w] of edges[u]) {
      if (cost[u] + w < cost[v]) {
        cost[v] = cost[u] + w
        prev[v] = u
      }
    }
  }
  if (cost[1] === Infinity) return [start, end]
  const path = []
  for (let i = 1; i >= 0; i = prev[i]) path.unshift(nodes[i])
  return path
}

const left = (a, b) => {
  const d = dist(a, b) || 1
  return { x: (b.z - a.z) / d, z: -(b.x - a.x) / d }
}

// Shift the road part of the path into the left lane, mitring the corners.
function keepLeft(points) {
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p
    const n1 = left(points[i - 1], p)
    const n2 = left(p, points[i + 1])
    const s = { x: n1.x + n2.x, z: n1.z + n2.z }
    const len2 = s.x * s.x + s.z * s.z
    if (len2 < 0.1) return { x: p.x + n1.x * LANE, z: p.z + n1.z * LANE }
    const k = (LANE * 2) / len2
    return { x: p.x + s.x * k, z: p.z + s.z * k }
  })
}

/**
 * Route from `from` to `to` ({x, z}) via the roads, then through optional off-road
 * waypoints `via` ([[x, z], ...]) for places the road network doesn't reach.
 * at(d) → { x, z, yaw }.
 */
export function planRoute(from, to, via = []) {
  const stops = via.map(([x, z]) => ({ x, z }))
  const first = stops[0] ?? to
  const raw = [from, ...roadPath(snap(from), snap(first)), ...stops, to].filter(
    (p, i, arr) => i === 0 || dist(p, arr[i - 1]) > 0.05,
  )
  const points = keepLeft(raw)
  const cumulative = [0]
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + dist(points[i - 1], points[i]))
  const total = cumulative[cumulative.length - 1]

  return {
    points,
    total,
    at(d) {
      const s = clamp(d, 0, total)
      let i = 1
      while (i < points.length - 1 && cumulative[i] < s) i++
      const a = points[i - 1]
      const b = points[i] ?? a
      const seg = cumulative[i] - cumulative[i - 1] || 1
      const t = (s - cumulative[i - 1]) / seg
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) }
    },
  }
}
