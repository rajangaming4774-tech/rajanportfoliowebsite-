import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { AdditiveBlending } from 'three'
import { BEACH_X, SEA_X, WORLD_BOUNDS, ZONES } from './zones'
import { Gopuram, Library, Lighthouse, OmrCorridor, RiponBuilding, TeaKadai } from './props/Landmarks'
import { Birds, BeachDecor, Boats, BusStop, Lamps, Palms, Roads, Shoreline, Stalls } from './props/Street'
import { DrivingCar, DrivingRickshaw, MtcBus, ParkedCar, ParkedRickshaw } from './props/Traffic'
import { Airport, Planes } from './props/Airport'
import Streetscape from './props/Streetscape'
import Ambience from './audio/Ambience'
import People from './props/People'

// Stylised low-poly Chennai in natural daylight. Landmarks, street furniture and traffic
// live in ./props (merged, vertex-coloured meshes to keep draw calls low);
// ./audio adds the WebAudio ambience and its mute button.

const COLORS = {
  ground: '#9b8f78',
  sand: '#e3d3a8',
  sea: '#1f86a6',
}

export default function CityMap() {
  return (
    <>
      <Ground />
      <Streetscape />
      <Roads />
      <Lamps />
      <Palms />

      <Airport position={[8, 0, -56]} />
      <Planes />
      <RiponBuilding position={[-27, 0, -36]} />
      <Gopuram at={[21, 0, 16]} />
      <TeaKadai at={[9, 0, 9]} rot={Math.PI / 2} />
      <BusStop at={[5.4, 0, 8]} rot={-Math.PI / 2} />
      <Library position={[-24, 0, 11]} />
      <OmrCorridor position={[14, 0, 50]} />
      <Lighthouse position={[43, 0, -1]} />

      <BeachDecor />
      <Stalls />
      <Boats />
      <Shoreline />

      <MtcBus livery="ordinary" start={8} />
      <MtcBus livery="deluxe" start={90} speed={6} />
      <DrivingRickshaw loop="city" start={50} />
      <DrivingRickshaw loop="south" reverse speed={5} />
      <DrivingCar kind="silver" loop="city" start={30} speed={7.5} />
      <DrivingCar kind="red" loop="city" start={120} speed={7} />
      <DrivingCar kind="taxi" loop="south" start={20} speed={6} />
      <ParkedCar kind="blue" position={[-9, 0, 17]} rotation={1.5} />
      <ParkedCar kind="silver" position={[23, 0, -8]} rotation={0.1} />
      <ParkedRickshaw position={[5.6, 0, -4]} rotation={0.05} />
      <ParkedRickshaw position={[-6, 0, 8]} rotation={-1.2} />
      <ParkedRickshaw position={[24, 0, 9.5]} rotation={1.2} />
      <ParkedRickshaw position={[-6, 0, 34]} rotation={0.1} />
      <ParkedRickshaw position={[13, 0, 12.4]} rotation={2.7} />

      <Birds />

      {ZONES.map((z) => (
        <ZoneMarker key={z.id} zone={z} />
      ))}
      <People />
      <Ambience />
    </>
  )
}

/* ---------- terrain ---------- */

function Ground() {
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const hx = (maxX - minX) / 2
  const hz = (maxZ - minZ) / 2

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[200, 0.5, 200]} position={[0, -0.5, 0]} />
        {/* Invisible walls at the edge of the playable area */}
        <CuboidCollider args={[0.5, 10, hz]} position={[minX, 10, cz]} />
        <CuboidCollider args={[0.5, 10, hz]} position={[maxX, 10, cz]} />
        <CuboidCollider args={[hx, 10, 0.5]} position={[cx, 10, minZ]} />
        <CuboidCollider args={[hx, 10, 0.5]} position={[cx, 10, maxZ]} />
      </RigidBody>

      <mesh rotation-x={-Math.PI / 2} position={[(minX - 80 + BEACH_X) / 2, 0, cz]} receiveShadow>
        <planeGeometry args={[BEACH_X - minX + 80, 300]} />
        <meshStandardMaterial color={COLORS.ground} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[(BEACH_X + SEA_X) / 2 + 1, 0.005, cz]} receiveShadow>
        <planeGeometry args={[SEA_X - BEACH_X + 2, 300]} />
        <meshStandardMaterial color={COLORS.sand} roughness={1} />
      </mesh>
      <Sea />
    </>
  )
}

function Sea() {
  const ref = useRef()
  useFrame(({ clock }) => {
    ref.current.position.y = 0.06 + Math.sin(clock.elapsedTime * 0.8) * 0.04
  })
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[SEA_X + 100, 0.06, 5]} receiveShadow>
      <planeGeometry args={[200, 300]} />
      <meshStandardMaterial color={COLORS.sea} roughness={0.25} metalness={0.15} transparent opacity={0.92} />
    </mesh>
  )
}

/* ---------- zone markers ---------- */

// Signs show only at mid range: far-off ones would clutter the screen (Html draws
// through buildings), and up close the zone banner in the HUD takes over.
const SIGN_NEAR = 9
const SIGN_FAR = 38

function ZoneMarker({ zone }) {
  const ring = useRef()
  const ripple = useRef()
  const sign = useRef()
  const signVisible = useRef(null)
  useFrame(({ clock, camera }) => {
    const d = Math.hypot(camera.position.x - zone.position[0], camera.position.z - zone.position[2])
    const visible = d > SIGN_NEAR && d < SIGN_FAR
    if (sign.current && visible !== signVisible.current) {
      signVisible.current = visible
      sign.current.style.opacity = visible ? '1' : '0'
    }

    const t = clock.elapsedTime
    ring.current.material.opacity = 0.35 + Math.sin(t * 2 + zone.position[0]) * 0.15
    const p = (t * 0.5 + zone.position[2] * 0.1) % 1
    ripple.current.scale.setScalar(0.45 + p * 0.55)
    ripple.current.material.opacity = (1 - p) * 0.4
  })
  return (
    <group position={zone.position}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[2.2, 2.6, 48]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.4} />
      </mesh>
      <mesh ref={ripple} rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
        <ringGeometry args={[2.3, 2.6, 48]} />
        <meshBasicMaterial color="#ffd48a" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 6, 32, 1, true]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.06} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <Html position={[0, 3.6, 0]} center zIndexRange={[10, 0]} className="zone-sign-wrap">
        <div className="zone-sign" ref={sign}>
          <span className="zone-sign-label">{zone.label}</span>
          <span className="zone-sign-name">{zone.name}</span>
        </div>
      </Html>
    </group>
  )
}
