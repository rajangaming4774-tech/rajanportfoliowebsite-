import { zones } from '../data/portfolio'

// World layout, loosely following real Chennai geography:
// Chennai Airport + Ripon Building up north, Marina Beach on the east coast,
// Mylapore and the library to the south, the OMR IT corridor furthest south.
// +x = east (sea), +z = south.

export const SPAWN = [0, 2, -16]
export const SPAWN_YAW = Math.PI // camera behind the player, looking south into the city

export const WORLD_BOUNDS = { minX: -70, maxX: 54, minZ: -125, maxZ: 66 }
export const BEACH_X = 34
export const SEA_X = 46

// [centerX, centerZ, width (x), length (z)]
export const ROADS = [
  [0, 18, 7, 88], // main north–south road
  [-17, -16, 98, 7], // road outside the airport, west to the Ripon Building
  [31, 8, 6, 120], // beach road along the Marina
  [-4, 28, 70, 6], // cross road to the library
]

// position = the marker spot in front of each landmark (also the zone centre).
export const ZONES = [
  { id: 'spawn', section: null, name: 'Chennai Airport', label: 'Welcome', position: [0, 0, -21], radius: 9 },
  { id: 'experience', section: 'experience', name: zones.experience, label: 'Experience', position: [-49, 0, -24], radius: 8, landing: { x: -49, z: -17.5, yaw: 0 } },
  { id: 'about', section: 'about', name: zones.about, label: 'About', position: [16, 0, 6], radius: 8 },
  { id: 'skills', section: 'skills', name: zones.skills, label: 'Skills', position: [-24, 0, 24], radius: 8 },
  { id: 'projects', section: 'projects', name: zones.projects, label: 'Projects', position: [12, 0, 38], radius: 9 },
  { id: 'contact', section: 'contact', name: zones.contact, label: 'Contact', position: [37, 0, 7], radius: 8 },
  // Airside viewpoint at the far edge of the apron, looking over the runway. The auto
  // gets there round the east side of the terminal (via), clear of the gates.
  {
    id: 'runway',
    section: null,
    name: 'Airside · Runway',
    label: 'Runway View',
    // East end of the apron, past the gate aircraft's wingtips: the runway ahead to the
    // north-west, the terminal's airside with the parked planes behind to the south.
    position: [44, 0, -110],
    radius: 9,
    landing: { x: 43, z: -106, yaw: 0.46 },
    via: [[38.5, -40], [45, -80], [44, -100]],
  },
]

export function findZone(x, z) {
  let best = null
  let bestDist = Infinity
  for (const zone of ZONES) {
    const d = Math.hypot(x - zone.position[0], z - zone.position[2])
    if (d < zone.radius && d < bestDist) {
      best = zone
      bestDist = d
    }
  }
  return best
}

// Where fast travel drops the player: a few metres in front of the ring sign,
// towards the middle of the map, facing the sign.
export function landingSpot(zone) {
  if (zone.landing) return { y: 1.5, ...zone.landing }
  const [x, , z] = zone.position
  let dx = -x
  let dz = -z
  const len = Math.hypot(dx, dz) || 1
  dx /= len
  dz /= len
  return { x: x + dx * 4, y: 1.5, z: z + dz * 4, yaw: Math.atan2(dx, dz) }
}
