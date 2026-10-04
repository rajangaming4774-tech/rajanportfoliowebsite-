import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RickshawModel } from './props/Traffic'

// The player's auto. Driven entirely by rideRef.current:
//   { phase: 'arriving' | 'asking' | 'riding' | 'dropoff' | null, from, stop, route, dist, speed, x, z, yaw, skip, t }
// arriving: pulls up beside the player · asking: waits while the driver asks where to
// riding: follows the planned road route · dropoff: parks briefly after arrival.

const TOP_SPEED = 15
const ACCEL = 9
const BRAKE = 7
const ARRIVE_S = 1.3
const DROPOFF_S = 1.4

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

export default function AutoRide({ rideRef, onPickedUp, onArrive, onGone }) {
  const group = useRef()
  const shell = useRef()
  const wheelSpin = useRef(0)

  useFrame((state, rawDt) => {
    const ride = rideRef.current
    const g = group.current
    if (!ride.phase) {
      g.visible = false
      return
    }
    const dt = Math.min(rawDt, 0.05)
    g.visible = true

    if (ride.phase === 'arriving') {
      ride.t = Math.min(1, ride.t + dt / ARRIVE_S)
      const e = 1 - (1 - ride.t) ** 3
      ride.x = ride.from.x + (ride.stop.x - ride.from.x) * e
      ride.z = ride.from.z + (ride.stop.z - ride.from.z) * e
      if (ride.t >= 1) {
        ride.phase = 'asking'
        onPickedUp()
      }
    } else if (ride.phase === 'riding') {
      const { route } = ride
      if (ride.skip) {
        ride.dist = route.total
        ride.skip = false
      }
      const remaining = route.total - ride.dist
      const brakeCap = Math.sqrt(2 * BRAKE * Math.max(remaining, 0)) + 0.8
      ride.speed = Math.min(ride.speed + ACCEL * dt, TOP_SPEED, brakeCap)
      ride.dist = Math.min(route.total, ride.dist + ride.speed * dt)
      wheelSpin.current += ride.speed * dt
      const p = route.at(ride.dist)
      ride.x = p.x
      ride.z = p.z
      ride.yaw = lerpAngle(ride.yaw, p.yaw, 1 - Math.exp(-8 * dt))
      if (ride.dist >= route.total) {
        ride.phase = 'dropoff'
        ride.t = 0
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
