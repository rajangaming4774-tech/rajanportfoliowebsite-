import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { MeshBasicMaterial } from 'three'
import { cached, createKit } from './kit'
import { KitMesh } from './KitMesh'
import { JUNCTIONS, signal } from '../trafficLights'
import { THIN_PROPS } from '../collision'

// Signal posts at every junction. One post per approach, on the driver's near-left
// corner (Chennai keeps left), its three-lamp head facing the oncoming traffic, with a
// white stop line across the approach lane. Lamps of the same colour and direction at a
// junction share one mesh, so changing a light is just a colour change.

const COLORS = ['red', 'amber', 'green']
const ON = { red: '#ff2a1a', amber: '#ffb000', green: '#20e070' }
const OFF = { red: '#3a0d0a', amber: '#3a2a08', green: '#0b2a16' }
const LAMP_Y = { red: 3.32, amber: 3.02, green: 2.72 }

function approachFrame(j, a) {
  const alongHalf = a.axis === 'ns' ? (j.z1 - j.z0) / 2 : (j.x1 - j.x0) / 2
  const acrossHalf = a.axis === 'ns' ? (j.x1 - j.x0) / 2 : (j.z1 - j.z0) / 2
  const lx = a.hz // driver's left: (hz, -hx)
  const lz = -a.hx
  return { alongHalf, acrossHalf, lx, lz, yaw: Math.atan2(-a.hx, -a.hz) }
}

function buildSignals() {
  const k = createKit()
  const lamps = {} // `${junction}:${axis}:${colour}` -> kit
  const poles = []
  JUNCTIONS.forEach((j, ji) => {
    for (const a of j.approaches) {
      const f = approachFrame(j, a)
      // post on the near-left corner, just off the road
      const px = j.cx - a.hx * (f.alongHalf + 0.9) + f.lx * (f.acrossHalf + 0.9)
      const pz = j.cz - a.hz * (f.alongHalf + 0.9) + f.lz * (f.acrossHalf + 0.9)
      poles.push([px, pz])
      k.place([px, 0, pz], f.yaw, (q) => {
        q.cyl('#2a2c2e', [0.06, 0.075, 3.0, 8], [0, 1.5, 0])
        q.box('#f2c230', [0.2, 0.5, 0.2], [0, 0.25, 0]) // painted base
        q.box('#1b1c1e', [0.36, 1.0, 0.24], [0, 3.02, 0.02]) // head
        q.box('#f4f4f2', [0.42, 1.06, 0.03], [0, 3.02, -0.11]) // white backboard
        for (const c of COLORS) q.box('#141516', [0.26, 0.04, 0.16], [0, LAMP_Y[c] + 0.13, 0.19]) // visors
      })
      for (const c of COLORS) {
        const key = `${ji}:${a.axis}:${c}`
        lamps[key] ??= createKit()
        lamps[key].place([px, 0, pz], f.yaw, (q) => q.sphere('#ffffff', [0.095, 12, 8], [0, LAMP_Y[c], 0.14]))
      }
      // stop line across the approach (left) lane, 0.4 m before the junction box
      const sx = j.cx - a.hx * (f.alongHalf + 0.4) + f.lx * (f.acrossHalf / 2)
      const sz = j.cz - a.hz * (f.alongHalf + 0.4) + f.lz * (f.acrossHalf / 2)
      k.place([sx, 0, sz], f.yaw, (q) => q.box('#f2f1ec', [f.acrossHalf - 0.25, 0.02, 0.35], [0, 0.013, 0]))
    }
  })
  const built = {}
  const mats = {} // one material per lamp mesh; its colour switches between lit and dark
  for (const [key, lk] of Object.entries(lamps)) {
    built[key] = lk.build().solid
    mats[key] = new MeshBasicMaterial({ color: OFF[key.split(':')[2]], toneMapped: false })
  }
  return { kit: k.build(), lamps: built, mats, poles }
}

export default function TrafficLights() {
  const { kit, lamps, mats, poles } = cached('signals', buildSignals)
  const last = useRef({})

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    JUNCTIONS.forEach((j, ji) => {
      for (const axis of ['ns', 'ew']) {
        const light = signal(j, axis, t)
        const id = `${ji}:${axis}`
        if (last.current[id] === light) continue
        last.current[id] = light
        for (const c of COLORS) {
          const m = mats[`${id}:${c}`]
          if (m) m.color.set(c === light ? ON[c] : OFF[c])
        }
      }
    })
  })

  return (
    <>
      <KitMesh kit={kit} />
      {Object.entries(lamps).map(([key, geo]) => (
        <mesh key={key} geometry={geo} material={mats[key]} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {poles.map(([x, z], i) => (
          <CylinderCollider key={i} args={[1.5, 0.12]} position={[x, 1.5, z]} collisionGroups={THIN_PROPS} />
        ))}
      </RigidBody>
    </>
  )
}
