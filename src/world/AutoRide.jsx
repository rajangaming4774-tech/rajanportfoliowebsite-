import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RickshawModel } from './props/Traffic'
import { approach, curveSpeed, resetChassis, towRear, wrapAngle } from './driving'

// The player's auto. Driven entirely by rideRef.current:
//   { phase: 'arriving' | 'asking' | 'riding' | 'dropoff' | null, from, stop, route, dist, speed, x, z, yaw, skip, t }
// arriving: pulls up beside the player · asking: waits while the driver asks where to
// riding: follows the planned road route · dropoff: parks briefly after arrival.

// A Bajaj RE: ~45 km/h flat out in town, modest pick-up, takes bends at a sane pace.
const TOP_SPEED = 12.5
const ACCEL = 2.8
const BRAKE = 4.5
const LAT_ACCEL = 3
// Front wheel / rear axle relative to the body origin (see AUTO_WHEELS in Traffic.jsx).
export const AUTO_FRONT_AXLE = 1.15
const WHEELBASE = 1.9
const ARRIVE_S = 2.6
const DROPOFF_S = 1.4

export default function AutoRide({ rideRef, onPickedUp, onArrive, onGone }) {
  const group = useRef()
  const shell = useRef()
  const wheelSpin = useRef({ front: 0, rear: 0, steer: 0 })
  const chassis = useRef({})

  useFrame((state, rawDt) => {
    const ride = rideRef.current
    const g = group.current
    if (!ride.phase) {
      g.visible = false
      return
    }
    const dt = Math.min(rawDt, 0.05)
    g.visible = true

    const spin = wheelSpin.current
    if (ride.phase === 'arriving') {
      const x0 = ride.x
      const z0 = ride.z
      // Steady braking to a stop beside Rajan (a quadratic ease-out is constant
      // deceleration): ~39 km/h at 14 m out, ~4 m/s² of braking.
      ride.t = Math.min(1, ride.t + dt / ARRIVE_S)
      const e = 1 - (1 - ride.t) ** 2
      ride.x = ride.from.x + (ride.stop.x - ride.from.x) * e
      ride.z = ride.from.z + (ride.stop.z - ride.from.z) * e
      // the wheels roll as it pulls up (they used to stay still)
      const moved = Math.hypot(ride.x - x0, ride.z - z0)
      spin.front += moved
      spin.rear += moved
      spin.steer = 0
      if (ride.t >= 1) {
        ride.phase = 'asking'
        onPickedUp()
      }
    } else if (ride.phase === 'riding') {
      const { route } = ride
      const c = chassis.current
      if (ride.chassisFor !== route) {
        // the route starts at the front wheel; the rear axle is behind it on the auto's heading
        resetChassis(c, ride.x + Math.sin(ride.yaw) * AUTO_FRONT_AXLE, ride.z + Math.cos(ride.yaw) * AUTO_FRONT_AXLE, ride.yaw, WHEELBASE)
        ride.chassisFor = route
      }
      if (ride.skip) {
        ride.dist = route.total
        ride.skip = false
      }
      const remaining = route.total - ride.dist
      const target = Math.min(
        curveSpeed(route, ride.dist, 1, TOP_SPEED, LAT_ACCEL, BRAKE),
        Math.sqrt(2 * BRAKE * Math.max(remaining, 0)) + 0.4,
      )
      ride.speed = approach(ride.speed, target, ACCEL, BRAKE * 1.3, dt)
      const prevDist = ride.dist
      ride.dist = Math.min(route.total, ride.dist + ride.speed * dt)
      const p = route.at(ride.dist)
      // Front wheel on the route, rear axle towed behind: it turns through the bend
      // without sliding sideways.
      const rx0 = c.rx
      const rz0 = c.rz
      ride.yaw = towRear(c, p.x, p.z, WHEELBASE)
      spin.front += ride.dist - prevDist
      spin.rear += Math.hypot(c.rx - rx0, c.rz - rz0)
      spin.steer = Math.max(-0.75, Math.min(0.75, wrapAngle(p.yaw - ride.yaw)))
      ride.x = p.x - Math.sin(ride.yaw) * AUTO_FRONT_AXLE
      ride.z = p.z - Math.cos(ride.yaw) * AUTO_FRONT_AXLE
      if (ride.dist >= route.total) {
        ride.phase = 'dropoff'
        ride.t = 0
        ride.speed = 0
        spin.steer = 0
        onArrive()
      }
    } else if (ride.phase === 'dropoff') {
      ride.t += dt
      if (ride.t >= DROPOFF_S) {
        ride.phase = null
        onGone()
      }
    }

    g.position.set(ride.x, 0, ride.z)
    g.rotation.y = ride.yaw
    // A little engine judder, more when moving.
    const moving = ride.phase === 'riding' ? Math.min(ride.speed / TOP_SPEED, 1) : 0.2
    shell.current.position.y = Math.sin(state.clock.elapsedTime * 38) * 0.012 * (0.4 + moving)
    shell.current.rotation.z = Math.sin(state.clock.elapsedTime * 9) * 0.008 * moving
  })

  return (
    <group ref={group} visible={false}>
      <group ref={shell}>
        <RickshawModel spin={wheelSpin} />
        <Passenger rideRef={rideRef} />
      </group>
    </group>
  )
}

// A simple seated Rajan in the back seat, visible while riding.
function Passenger({ rideRef }) {
  const ref = useRef()
  useFrame(() => {
    const p = rideRef.current.phase
    ref.current.visible = p === 'asking' || p === 'riding'
  })
  return (
    <group ref={ref} position={[0, 0.82, -0.55]}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.56, 0.55, 0.32]} />
        <meshStandardMaterial color="#d3e08f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <boxGeometry args={[0.36, 0.4, 0.34]} />
        <meshStandardMaterial color="#8a5a3c" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.02, -0.03]} castShadow>
        <boxGeometry args={[0.4, 0.2, 0.38]} />
        <meshStandardMaterial color="#15100d" roughness={1} />
      </mesh>
      {[[-0.13, 1.1, 0.1], [0.05, 1.13, 0.12], [0.16, 1.08, -0.02], [0, 1.15, -0.12]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color="#15100d" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}
