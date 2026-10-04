import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import CharacterModel from './CharacterModel'
import { SPAWN, findZone } from './zones'
import { CAMERA_RAY } from './collision'

const WALK_SPEED = 2.4 // brisk walk; the Walk clip plays at ~1.6x
const RUN_SPEED = 6.5 // Shift: running
const JUMP_VELOCITY = 6.8
const HALF_HEIGHT = 0.5
const RADIUS = 0.35
const FOOT = HALF_HEIGHT + RADIUS // centre → bottom of capsule
const CAM_MARGIN = 0.35 // keep the camera this far in front of whatever it hits
const MIN_CAM_DIST = 0.8

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

export default function Player({ inputRef, camRef, uiRef, rideRef, playerPosRef, onZoneChange, outfit }) {
  const body = useRef()
  const model = useRef()
  const anim = useRef({ speed: 0, grounded: true })
  const jumpHeld = useRef(false)
  const zoneId = useRef(undefined)
  const facing = useRef(0)

  const { rapier, world } = useRapier()
  const EXCLUDE_SENSORS = rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const rays = useRef(null)
  const camTarget = useMemo(() => new Vector3(SPAWN[0], SPAWN[1] + 1, SPAWN[2]), [])
  const camDist = useRef(7)

  useFrame((state, rawDt) => {
    const b = body.current
    if (!b) return
    const dt = Math.min(rawDt, 0.05)
    const input = inputRef.current
    const cam = camRef.current
    const ui = uiRef.current

    // Fast travel request from the HUD.
    const tp = ui.teleport
    if (tp) {
      ui.teleport = null
      b.setTranslation({ x: tp.x, y: tp.y, z: tp.z }, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      camTarget.set(tp.x, tp.y + 1.1, tp.z)
      cam.yaw = tp.yaw
      facing.current = tp.yaw + Math.PI
      camDist.current = 2
    }

    // Sitting in the auto: the (hidden) body rides along with it and the camera chases from behind.
    const ride = rideRef.current
    const seated = ride.phase === 'asking' || ride.phase === 'riding'
    model.current.visible = !seated
    if (seated) {
      b.setTranslation({ x: ride.x, y: FOOT + 0.05, z: ride.z }, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      if (ride.phase === 'riding') cam.yaw = lerpAngle(cam.yaw, ride.yaw + Math.PI, 1 - Math.exp(-2.5 * dt))
    }

    rays.current ??= {
      ground: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
      cam: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
    }
    const { ground: ray, cam: camRay } = rays.current

    const t = b.translation()
    const v = b.linvel()

    // Fell off the world? Back to the airport.
    if (t.y < -15) {
      b.setTranslation({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      return
    }

    // Ground check: short ray from the capsule centre straight down.
    ray.origin = { x: t.x, y: t.y, z: t.z }
    const hit = world.castRay(ray, FOOT + 0.25, true, undefined, undefined, undefined, b)
    const toi = hit ? (hit.timeOfImpact ?? hit.toi) : Infinity
    const grounded = toi < FOOT + 0.12 && v.y < 1

    // Input → direction relative to where the camera looks.
    const locked = ui.locked
    const joyX = locked ? 0 : input.joyX
    const joyY = locked ? 0 : input.joyY
    let f = locked ? 0 : (input.forward ? 1 : 0) - (input.back ? 1 : 0) - joyY
    let r = locked ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0) + joyX
    const len = Math.hypot(f, r)
    if (len > 1) {
      f /= len
      r /= len
    }
    const speed = (!locked && input.run) || Math.hypot(joyX, joyY) > 0.95 ? RUN_SPEED : WALK_SPEED
    const sin = Math.sin(cam.yaw)
    const cos = Math.cos(cam.yaw)
    const targetX = (-sin * f + cos * r) * speed
    const targetZ = (-cos * f - sin * r) * speed

    // Ease towards the target velocity: snappy on the ground, floaty in the air.
    const accel = 1 - Math.exp(-(grounded ? 14 : 3) * dt)
    const vx = v.x + (targetX - v.x) * accel
    const vz = v.z + (targetZ - v.z) * accel
    let vy = v.y

    const wantsJump = !locked && input.jump
    if (wantsJump && !jumpHeld.current && grounded) vy = JUMP_VELOCITY
    jumpHeld.current = wantsJump

    b.setLinvel({ x: vx, y: vy, z: vz }, true)

    // Face the direction of travel.
    const horizontal = Math.hypot(vx, vz)
    if (horizontal > 0.4) facing.current = lerpAngle(facing.current, Math.atan2(vx, vz), 1 - Math.exp(-12 * dt))
    model.current.rotation.y = facing.current
    anim.current.speed = horizontal
    anim.current.grounded = grounded

    // Third-person camera: orbit around a smoothed point above the player.
    camTarget.lerp({ x: t.x, y: t.y + 1.1, z: t.z }, 1 - Math.exp(-10 * dt))
    const dirX = Math.sin(cam.yaw) * Math.cos(cam.pitch)
    const dirY = Math.sin(cam.pitch)
    const dirZ = Math.cos(cam.yaw) * Math.cos(cam.pitch)

    // Pull the camera in front of anything between it and the player.
    camRay.origin = { x: camTarget.x, y: camTarget.y, z: camTarget.z }
    camRay.dir = { x: dirX, y: dirY, z: dirZ }
    const camHit = world.castRay(camRay, cam.distance + CAM_MARGIN, true, EXCLUDE_SENSORS, CAMERA_RAY, undefined, b)
    const hitToi = camHit ? (camHit.timeOfImpact ?? camHit.toi) : Infinity
    const wanted = Math.max(MIN_CAM_DIST, Math.min(cam.distance, hitToi - CAM_MARGIN))
    // Pull in fast enough not to sit inside a wall, ease back out slowly so it doesn't jitter at corners.
    const rate = wanted < camDist.current ? 12 : 2
    camDist.current += (wanted - camDist.current) * (1 - Math.exp(-rate * dt))
    const d = camDist.current
    state.camera.position.set(camTarget.x + dirX * d, camTarget.y + dirY * d, camTarget.z + dirZ * d)
    state.camera.lookAt(camTarget)

    playerPosRef.current.x = t.x
    playerPosRef.current.z = t.z

    const zone = findZone(t.x, t.z)
    const id = zone?.id ?? null
    if (id !== zoneId.current) {
      zoneId.current = id
      onZoneChange(zone)
    }
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={SPAWN}
      enabledRotations={[false, false, false]}
      friction={0}
      canSleep={false}
      ccd
    >
      <CapsuleCollider args={[HALF_HEIGHT, RADIUS]} />
      <group ref={model}>
        <CharacterModel anim={anim} outfit={outfit} />
      </group>
    </RigidBody>
  )
}
