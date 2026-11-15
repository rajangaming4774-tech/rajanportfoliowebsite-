// Shared vehicle kinematics for the traffic and the player's auto.
//
// - Paths are made of straight runs and circular arcs, so the curvature (1 / radius)
//   is known everywhere and vehicles can slow down before a bend.
// - The front axle follows the lane exactly; the rear axle is towed behind it at the
//   wheelbase (a tractrix), so the rear wheels never slide sideways and cut the inside
//   of a bend like a real vehicle. The front wheels steer towards the lane.
// - Speed changes through acceleration and braking limits.

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * Turn a polyline into straight segments joined by circular arcs (fillets).
 * Each corner gets radius `radius`, reduced where the neighbouring segments are short.
 * Returns { total, closed, at(d) -> { x, z, yaw, curv } }.
 */
export function filletPath(points, radius, closed = false) {
  const n = points.length
  const pts = points
  const pieces = []
  const corners = []
  // For every interior corner, how far back/forward along the segments the arc starts.
  for (let i = 0; i < n; i++) {
    const isEnd = !closed && (i === 0 || i === n - 1)
    if (isEnd) {
      corners.push(null)
      continue
    }
    const p = pts[i]
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const ux = p.x - a.x
    const uz = p.z - a.z
    const vx = b.x - p.x
    const vz = b.z - p.z
    const la = Math.hypot(ux, uz)
    const lb = Math.hypot(vx, vz)
    if (la < 1e-6 || lb < 1e-6) {
      corners.push(null)
      continue
    }
    const h1 = Math.atan2(ux, uz)
    const turn = wrapAngle(Math.atan2(vx, vz) - h1)
    if (Math.abs(turn) < 1e-3) {
      corners.push(null)
      continue
    }
    const tanHalf = Math.tan(Math.abs(turn) / 2)
    // Leave at least 45% of each neighbouring segment to its own corners.
    const r = Math.min(radius, (0.45 * Math.min(la, lb)) / tanHalf)
    const cut = r * tanHalf
    corners.push({ i, r, cut, h1, turn, la, lb })
  }
  const cutAt = (i) => corners[i]?.cut ?? 0
  const segCount = closed ? n : n - 1
  for (let s = 0; s < segCount; s++) {
    const i = s
    const j = (s + 1) % n
    const a = pts[i]
    const b = pts[j]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const dx = (b.x - a.x) / len
    const dz = (b.z - a.z) / len
    const c0 = cutAt(i)
    const c1 = cutAt(j)
    const lineLen = Math.max(0, len - c0 - c1)
    const sx = a.x + dx * c0
    const sz = a.z + dz * c0
    const yaw = Math.atan2(dx, dz)
    pieces.push({ len: lineLen, at: (t) => ({ x: sx + dx * t, z: sz + dz * t, yaw, curv: 0 }) })
    const c = corners[j]
    if (c) {
      // Arc from the end of this straight around corner j.
      const ex = b.x - dx * c.cut
      const ez = b.z - dz * c.cut
      const side = Math.sign(c.turn) // +1: turning towards +yaw
      // centre is perpendicular to the heading, on the inside of the turn
      const nx = Math.cos(yaw) * side
      const nz = -Math.sin(yaw) * side
      const cx = ex + nx * c.r
      const cz = ez + nz * c.r
      const arcLen = c.r * Math.abs(c.turn)
      const curv = side / c.r
      pieces.push({
        len: arcLen,
        at: (t) => {
          const h = yaw + (t / c.r) * side
          return { x: cx - Math.cos(h) * side * c.r, z: cz + Math.sin(h) * side * c.r, yaw: h, curv }
        },
      })
    }
  }
  const starts = []
  let total = 0
  for (const p of pieces) {
    starts.push(total)
    total += p.len
  }
  return {
    total,
    closed,
    at(d) {
      let s = closed ? ((d % total) + total) % total : Math.min(Math.max(d, 0), total)
      let k = pieces.length - 1
      for (let q = 0; q < pieces.length; q++) {
        if (s <= starts[q] + pieces[q].len) {
          k = q
          break
        }
      }
      return pieces[k].at(Math.max(0, s - starts[k]))
    },
  }
}

const LOOKAHEAD_STEP = 1.5

/**
 * Highest speed at distance `d` that still lets the vehicle get round every bend in
 * the next stretch at lateral acceleration `aLat`, braking at `aBrake`.
 */
export function curveSpeed(path, d, dir, cruise, aLat, aBrake) {
  let limit = cruise
  const range = (cruise * cruise) / (2 * aBrake) + 4
  for (let s = 0; s <= range; s += LOOKAHEAD_STEP) {
    const dd = d + dir * s
    if (!path.closed && (dd < 0 || dd > path.total)) break
    const k = Math.abs(path.at(dd).curv)
    if (k < 1e-4) continue
    const vc = Math.sqrt(aLat / k)
    limit = Math.min(limit, Math.sqrt(vc * vc + 2 * aBrake * s))
  }
  return limit
}

/** Move speed `v` towards `target` with the given acceleration / braking limits. */
export function approach(v, target, accel, brake, dt) {
  if (target > v) return Math.min(target, v + accel * dt)
  return Math.max(target, v - brake * dt)
}

/**
 * Rear axle towed behind the front axle at `wheelbase` (no sideways slip).
 * chassis: { fx, fz, rx, rz } mutated in place. Returns body yaw.
 */
export function towRear(chassis, fx, fz, wheelbase) {
  let dx = fx - chassis.rx
  let dz = fz - chassis.rz
  const len = Math.hypot(dx, dz) || 1
  dx /= len
  dz /= len
  chassis.rx = fx - dx * wheelbase
  chassis.rz = fz - dz * wheelbase
  chassis.fx = fx
  chassis.fz = fz
  return Math.atan2(dx, dz)
}

/** Place the rear axle straight behind the front axle along `yaw`. */
export function resetChassis(chassis, fx, fz, yaw, wheelbase) {
  chassis.fx = fx
  chassis.fz = fz
  chassis.rx = fx - Math.sin(yaw) * wheelbase
  chassis.rz = fz - Math.cos(yaw) * wheelbase
  return chassis
}
