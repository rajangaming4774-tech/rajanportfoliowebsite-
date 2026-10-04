import { MATS } from './kit'

/** Renders a built kit as up to three meshes (solid, glass, glow). */
export function KitMesh({ kit, shadows = true, ...props }) {
  return (
    <group {...props}>
      {kit.solid && <mesh geometry={kit.solid} material={MATS.solid} castShadow={shadows} receiveShadow />}
      {kit.glass && <mesh geometry={kit.glass} material={MATS.glass} castShadow={shadows} receiveShadow />}
      {kit.glow && <mesh geometry={kit.glow} material={MATS.glow} />}
    </group>
  )
}
