import { ROADS } from './zones'

// Traffic signals at every junction of the road network in zones.js.
//
// A junction is where a north–south road crosses an east–west one; its box is the
// overlap of the two road rectangles. The two directions take turns:
//   north–south: green → amber → red, then east–west: green → amber → red,
// with a short all-red between them. Neighbouring junctions are offset a little.

export const GREEN = 9
export const AMBER = 3 // long enough to clear the box at town speed if it's too late to stop
export const ALL_RED = 1.5
const CYCLE = 2 * (GREEN + AMBER + ALL_RED)
const APPROACH_MIN = 3 // a road must continue this far past the box to have an approach
const APPROACH_LOOK = 6 // metres before the box where the approach direction is read

export const JUNCTIONS = (() => {
  const rect = ([cx, cz, w, l]) => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - l / 2, z1: cz + l / 2 })
  const ns = ROADS.filter(([, , w, l]) => l > w).map(rect)
  const ew = ROADS.filter(([, , w, l]) => w >= l).map(rect)
  const out = []
  for (const a of ns) {
    for (const b of ew) {
      const box = { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) }
      if (box.x1 - box.x0 < 1 || box.z1 - box.z0 < 1) continue
      // Approaches: the side of the junction a road comes in from, and the heading of
      // traffic arriving from there.
      const approaches = []
      if (a.z1 > box.z1 + APPROACH_MIN) approaches.push({ axis: 'ns', hx: 0, hz: -1 }) // from +z, heading −z
      if (a.z0 < box.z0 - APPROACH_MIN) approaches.push({ axis: 'ns', hx: 0, hz: 1 })
      if (b.x1 > box.x1 + APPROACH_MIN) approaches.push({ axis: 'ew', hx: -1, hz: 0 })
      if (b.x0 < box.x0 - APPROACH_MIN) approaches.push({ axis: 'ew', hx: 1, hz: 0 })
      out.push({ ...box, cx: (box.x0 + box.x1) / 2, cz: (box.z0 + box.z1) / 2, approaches })
    }
  }
  out.forEach((j, i) => {
    j.offset = i * 5
  })
  return out
})()

/** 'green' | 'amber' | 'red' for traffic along `axis` ('ns' | 'ew') at junction j, time t (s). */
export function signal(j, axis, t) {
  const p = (((t + j.offset) % CYCLE) + CYCLE) % CYCLE
  const half = GREEN + AMBER + ALL_RED
  const q = axis === 'ns' ? p : (p + half) % CYCLE
  if (q < GREEN) return 'green'
  if (q < GREEN + AMBER) return 'amber'
  return 'red'
}

const inBox = (j, x, z) => x > j.x0 && x < j.x1 && z > j.z0 && z < j.z1

/**
 * Where a path (driven in direction dir = ±1) enters each junction box.
 * Returns [{ d, j, axis }] with d in the path's own distance coordinate.
 */
export function junctionEntries(path, dir = 1) {
  const STEP = 0.4
  const out = []
  const n = Math.ceil(path.total / STEP)
  let prev = null
  for (let i = 0; i <= n; i++) {
    const s = Math.min(path.total, i * STEP)
    const d = dir > 0 ? s : path.total - s
    const p = path.at(d)
    const cur = JUNCTIONS.findIndex((j) => inBox(j, p.x, p.z))
    if (cur >= 0 && cur !== prev) {
      // Which signal applies is decided by the straight approach a few metres before
      // the box: rounded corners may already be turning where the path enters it.
      const back = path.closed ? d - dir * APPROACH_LOOK : Math.min(path.total, Math.max(0, d - dir * APPROACH_LOOK))
      const yaw = path.at(back).yaw + (dir < 0 ? Math.PI : 0)
      const axis = Math.abs(Math.sin(yaw)) > Math.abs(Math.cos(yaw)) ? 'ew' : 'ns'
      out.push({ d, j: JUNCTIONS[cur], axis })
    }
    prev = cur
  }
  return out
}

/**
 * Highest speed that respects the signals ahead: stop at the line on red, and on amber
 * when the vehicle can still stop comfortably (otherwise it carries on through).
 * `ahead` is front axle → front bumper; `d` is the front axle's path position.
 */
export function signalSpeed(entries, path, d, dir, ahead, v, brake, t) {
  let limit = Infinity
  for (const e of entries) {
    let dist = (e.d - d) * dir
    if (path.closed) dist = ((dist % path.total) + path.total) % path.total
    const gap = dist - ahead - 1 // stop the bumper 1 m short of the box
    if (dist < 0 || gap > 45) continue
    if (gap < -1) continue // bumper already in the junction: clear it
    const light = signal(e.j, e.axis, t)
    if (light === 'green') continue
    // Between the stop line and the box: only a vehicle still moving (it went on amber)
    // carries on; one that's crawling or waiting holds there.
    if (gap < 0 && v > 1.5) continue
    const needed = (v * v) / (2 * Math.max(gap, 0.01))
    if (light === 'amber' && needed > brake) continue // too late to stop: go
    // aim 0.3 m short of the line so the last creep to a halt stays behind it
    limit = Math.min(limit, Math.sqrt(2 * brake * Math.max(0, gap - 0.3)))
  }
  return limit
}
