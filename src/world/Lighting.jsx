import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, Sky, Stars } from '@react-three/drei'
import { PRESETS } from './lightingPresets'

// Time-of-day lighting for the city: sky, fog, sun/moon, environment map, lamps.

export default function Lighting({ time = 'morning' }) {
  const preset = PRESETS[time] ?? PRESETS.morning

  return (
    <>
      {import.meta.env.DEV && <DevHandle />}
      <color attach="background" args={[preset.fog[0]]} />
      <fog attach="fog" args={preset.fog} />
      {preset.sky ? (
        <Sky sunPosition={preset.sun} distance={400} {...preset.sky} />
      ) : (
        <Stars radius={300} depth={60} count={2500} factor={5} saturation={0} fade speed={0.4} />
      )}
      {/* Sky + ground baked into an environment map so glass and metal reflect something real. */}
      <Environment key={time} resolution={128} frames={1}>
        {preset.sky ? (
          <Sky sunPosition={preset.sun} distance={400} {...preset.sky} />
        ) : (
          <mesh>
            <sphereGeometry args={[400, 16, 8]} />
            <meshBasicMaterial color="#0d1428" side={1} />
          </mesh>
        )}
        <mesh rotation-x={-Math.PI / 2} position={[0, -2, 0]}>
          <planeGeometry args={[2000, 2000]} />
          <meshBasicMaterial color={time === 'night' ? '#141210' : '#8d8470'} />
        </mesh>
      </Environment>
      <hemisphereLight args={preset.hemi} />
      <directionalLight
        position={preset.sun.map((v) => v * 0.6)}
        intensity={preset.sunIntensity}
        color={preset.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={260}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {time === 'night' && <NightLamps />}
    </>
  )
}

// A few real point lights at the busiest spots so the pools of lamp light read at night
// (the lamp heads themselves glow via unlit materials). Each real light adds shading cost
// to every surface, so keep this list short.
const LAMP_SPOTS = [[0, -16], [0, 8], [16, 6], [-24, -14], [31, 2]]
function NightLamps() {
  return LAMP_SPOTS.map(([x, z]) => (
    <pointLight key={`${x},${z}`} position={[x, 5.2, z]} color="#ffc983" intensity={26} distance={22} decay={2} />
  ))
}

// Dev server only: expose the renderer and scene on window.__r3f for performance checks.
function DevHandle() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    window.__r3f = { gl, scene }
    return () => {
      delete window.__r3f
    }
  }, [gl, scene])
  return null
}
