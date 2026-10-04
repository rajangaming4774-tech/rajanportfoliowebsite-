import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SkinnedMesh,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stripLightsAndCameras } from './props/gltf'

// The rigged human modelled in Higgsfield 3D (public/models/rajan-v5.glb): 16 bones, ~3.4k triangles,
// origin at the feet, faces +z, 1.75 m. Parts are named by material: Skin, Hair, Tee
// (open shirt), Print (tee underneath), Placket, Shorts (thighs), Legs (shins), Shoes,
// Shades, Eyes, EyeWhite, Lips. Every instance gets its own skeleton.
//
// Performance: the GLB splits the body into one skinned mesh per material (12 draw
// calls). Unless a shirt texture is needed (`plaid`, the player), the parts are merged
// into ONE skinned mesh with per-vertex colours, so a pedestrian costs a single draw
// call and recolouring just rewrites the colour buffer.
//
// The walk/run/idle/jump motion is generated here, bone by bone, from the movement
// speed (the exported GLB carries no usable animation clips), without allocating per
// frame. It's skipped entirely while the character is hidden.

export const HUMAN_MODEL = '/models/rajan-v5.glb'

const LEG = 0.83 // hip to ankle, metres
const DEG = Math.PI / 180

// GLTFLoader strips '.' from node names: 'UpperLeg.L' → 'UpperLegL'.
const BONES = ['Hips', 'Spine', 'Neck', 'Head', 'UpperArmL', 'LowerArmL', 'HandL', 'UpperArmR', 'LowerArmR', 'HandR',
  'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR']

const BODY_MATERIAL = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })

/**
 * anim: ref holding { speed, grounded } updated by whoever moves the body.
 * colors: { [materialName]: '#hex' } overrides. plaid: [base, line] check pattern on the
 * shirt (keeps the parts separate). shades: show the sunglasses. scale: size multiplier.
 */
export default function RiggedHuman({ anim, colors, plaid, shades = true, scale = 1, castShadow = true }) {
  const { scene } = useGLTF(HUMAN_MODEL)
  const root = useRef()
  const merge = !plaid

  const model = useMemo(() => {
    const clone = stripLightsAndCameras(SkeletonUtils.clone(scene))
    const parts = []
    clone.traverse((o) => {
      if (o.isSkinnedMesh) parts.push(o)
    })
    for (const o of parts) {
      o.castShadow = castShadow
      o.receiveShadow = true
      o.frustumCulled = false
      ensureUVs(o.geometry)
      o.material = o.material.clone()
    }
    if (merge && parts.length > 1) mergeParts(clone, parts, castShadow)
    return clone
  }, [scene, castShadow, merge])

  useEffect(() => {
    if (model.userData.ranges) {
      recolourMerged(model, colors, shades)
      return
    }
    model.traverse((o) => {
      if (!o.isSkinnedMesh) return
      const m = o.material
      const hex = colors?.[m.name]
      if (hex) m.color = new Color(hex)
      if (m.name === 'Tee') {
        m.map = plaid ? plaidTexture(plaid[0], plaid[1]) : null
        if (plaid) m.color = new Color('#ffffff')
        m.needsUpdate = true
      }
      if (m.name === 'Shades') o.visible = shades
    })
  }, [model, colors, plaid, shades])

  // Per-instance rig: rest pose + the character's X/Y/Z axes expressed in each bone's frame.
  const rig = useRef(null)
  useEffect(() => {
    model.updateMatrixWorld(true)
    const rootInv = new Quaternion()
    model.getWorldQuaternion(rootInv).invert()
    const toModel = (obj) => rootInv.clone().multiply(obj.getWorldQuaternion(new Quaternion())) // obj → model orientation
    const bones = {}
    for (const name of BONES) {
      const bone = model.getObjectByName(name)
      if (!bone) continue
      const inv = toModel(bone).invert() // model space → bone space
      const p = model.worldToLocal(bone.getWorldPosition(new Vector3()))
      bones[name] = {
        bone,
        rest: bone.quaternion.clone(),
        restPos: bone.position.clone(),
        ax: new Vector3(1, 0, 0).applyQuaternion(inv),
        ay: new Vector3(0, 1, 0).applyQuaternion(inv),
        az: new Vector3(0, 0, 1).applyQuaternion(inv),
        // +1 if the bone sits on the model's +x side: raising it "outward" means +Z rotation there
        outSign: p.x >= 0 ? 1 : -1,
        // model "up" expressed in the parent's frame, for moving the hips up/down
        up: bone.parent ? new Vector3(0, 1, 0).applyQuaternion(toModel(bone.parent).invert()) : new Vector3(0, 1, 0),
      }
    }
    rig.current = { bones, q: new Quaternion(), phase: Math.random() * Math.PI * 2, run: 0, air: 0, airTime: 0, move: 0, t: Math.random() * 10 }
    return () => {
      for (const b of Object.values(bones)) {
        b.bone.quaternion.copy(b.rest)
        b.bone.position.copy(b.restPos)
      }
      rig.current = null
    }
  }, [model])

  useFrame((_, rawDt) => {
    const r = rig.current
    if (!r || !isShown(root.current)) return
    const dt = Math.min(rawDt, 0.1)
    const a = anim?.current
    const speed = a?.speed ?? 0
    const grounded = a?.grounded ?? true
    r.t += dt
    const k = 1 - Math.exp(-10 * dt)
    r.move += ((speed > 0.2 ? 1 : 0) - r.move) * k
    r.run += ((speed > 3.2 ? 1 : 0) - r.run) * k
    // Only a real jump/fall counts as airborne: the ground check flickers for a frame or
    // two on kerbs and road edges, and that must not flash the jump pose mid-stride.
    r.airTime = grounded ? 0 : r.airTime + dt
    r.air += ((r.airTime > 0.18 ? 1 : 0) - r.air) * (1 - Math.exp(-12 * dt))

    // Gait parameters blend from walk to run.
    const amp = 26 + 18 * r.run // thigh swing, degrees
    const knee = 42 + 50 * r.run // swing-phase knee flex
    const armAmp = 22 + 30 * r.run
    const lean = 3 + 9 * r.run
    // Advance the cycle by distance travelled: one cycle = two steps.
    const stride = 4 * LEG * Math.sin(amp * DEG)
    r.phase += (speed / stride) * Math.PI * 2 * dt
    const s = Math.sin(r.phase)
    const air = r.air
    const m = r.move * (1 - air)
    const idle = 1 - r.move
    const breath = Math.sin(r.t * 1.9)
    // Left leg leads when s > 0. Its swing runs from toe-off (phase -90°) to heel strike
    // (+90°); the knee flexes most early in the swing, peaking at phase -30°.
    const sw = Math.cos(r.phase + Math.PI / 6)
    const kneeL = (knee * pos(sw) ** 1.5 + 5) * m + 4
    const kneeR = (knee * pos(-sw) ** 1.5 + 5) * m + 4
    const elbow = 10 + 25 * r.run
    const ja = air // airborne blend: one knee tucked, arms up

    const set = (name, fwd, twist, out, down = true) => {
      const b = r.bones[name]
      if (!b) return
      b.bone.quaternion.copy(b.rest)
      // Character faces +z. Rotating a downward-pointing limb about +X by a negative angle
      // swings it forward; for the upward spine/head a positive angle leans forward.
      if (fwd) b.bone.quaternion.multiply(r.q.setFromAxisAngle(b.ax, (down ? -fwd : fwd) * DEG))
      if (twist) b.bone.quaternion.multiply(r.q.setFromAxisAngle(b.ay, twist * DEG))
      if (out) b.bone.quaternion.multiply(r.q.setFromAxisAngle(b.az, out * b.outSign * DEG))
    }
    const mix = (v, jump) => v * (1 - ja) + jump * ja

    set('UpperLegL', mix(amp * s * m, 50), 0, 0)
    set('UpperLegR', mix(-amp * s * m, -15), 0, 0)
    set('LowerLegL', mix(-kneeL, -75), 0, 0)
    set('LowerLegR', mix(-kneeR, -35), 0, 0)
    set('FootL', (12 * pos(s) - 10 * pos(-s) * pos(-sw)) * m, 0, 0)
    set('FootR', (12 * pos(-s) - 10 * pos(s) * pos(sw)) * m, 0, 0)
    set('UpperArmL', mix(-armAmp * s * m + breath * 1.5 * idle, 130), 0, mix(6 + 2 * idle, 25))
    set('UpperArmR', mix(armAmp * s * m - breath * 1.5 * idle, 110), 0, mix(6 + 2 * idle, 25))
    set('LowerArmL', mix(12 + elbow * pos(-s) * m, 25), 0, 0)
    set('LowerArmR', mix(12 + elbow * pos(s) * m, 35), 0, 0)
    set('Spine', mix(lean * m + breath * 1.2 * idle, 8), 6 * s * m, 0, false)
    set('Head', -lean * 0.6 * m - breath * idle, -4 * s * m + Math.sin(r.t * 0.5) * 8 * idle, 0, false)

    // Hips dip at the double-support moments so the planted foot stays on the ground,
    // plus a little bounce in the run.
    const hips = r.bones.Hips
    if (hips) {
      const drop = LEG * (1 - Math.cos(amp * DEG))
      const bob = (-drop + 0.12 * r.run) * (0.5 - 0.5 * Math.cos(2 * r.phase)) * m + breath * 0.003 * idle
      hips.bone.position.copy(hips.restPos).addScaledVector(hips.up, bob)
    }
  })

  return (
    <group ref={root} scale={scale}>
      <primitive object={model} />
    </group>
  )
}

const pos = (v) => (v > 0 ? v : 0)

// Visible all the way up to the scene? (People hides far-away pedestrians.)
function isShown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return !!o
}

// Merge the per-material skinned parts into one skinned mesh with vertex colours.
// Remembers each part's vertex range so it can be recoloured (and the shades hidden).
function mergeParts(root, parts, castShadow) {
  const ranges = {}
  let start = 0
  const geos = parts.map((p) => {
    const g = p.geometry.clone()
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(name)) g.deleteAttribute(name)
    }
    const n = g.attributes.position.count
    const c = p.material.color
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new BufferAttribute(col, 3))
    ranges[p.material.name] = { start, count: n, base: c.clone() }
    start += n
    return g
  })
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  if (!merged) return
  const first = parts[0]
  const body = new SkinnedMesh(merged, BODY_MATERIAL)
  body.name = 'Body'
  body.position.copy(first.position)
  body.quaternion.copy(first.quaternion)
  body.scale.copy(first.scale)
  body.bind(first.skeleton, first.bindMatrix.clone())
  body.castShadow = castShadow
  body.receiveShadow = true
  body.frustumCulled = false
  first.parent.add(body)
  for (const p of parts) p.parent.remove(p)
  root.userData.ranges = ranges
  root.userData.body = body
  root.userData.restPositions = merged.attributes.position.array.slice()
}

function recolourMerged(root, colors, shades) {
  const { ranges, body, restPositions } = root.userData
  const geo = body.geometry
  const col = geo.attributes.color
  const tmp = new Color()
  for (const [name, r] of Object.entries(ranges)) {
    tmp.copy(r.base)
    if (colors?.[name]) tmp.set(colors[name])
    for (let i = r.start; i < r.start + r.count; i++) col.setXYZ(i, tmp.r, tmp.g, tmp.b)
  }
  col.needsUpdate = true
  // Hide the sunglasses by collapsing their vertices onto one point (and restore them).
  const sh = ranges.Shades
  if (sh) {
    const p = geo.attributes.position
    for (let i = sh.start; i < sh.start + sh.count; i++) {
      const j = shades ? i : sh.start
      p.setXYZ(i, restPositions[j * 3], restPositions[j * 3 + 1], restPositions[j * 3 + 2])
    }
    p.needsUpdate = true
  }
}

// Box-projected UVs so a check texture can wrap the shirt (the model has no UV map).
function ensureUVs(geometry) {
  if (geometry.attributes.uv) return
  const p = geometry.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) + p.getZ(i)) * 4
    uv[i * 2 + 1] = p.getY(i) * 4
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
}

const plaidCache = new Map()
function plaidTexture(base, line) {
  const key = `${base}|${line}`
  if (plaidCache.has(key)) return plaidCache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = line
  g.globalAlpha = 0.55
  for (let x = 6; x < 64; x += 16) g.fillRect(x, 0, 7, 64)
  for (let y = 6; y < 64; y += 16) g.fillRect(0, y, 64, 7)
  g.globalAlpha = 0.9
  for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1.5, 64)
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 1.5)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = tex.wrapT = RepeatWrapping
  plaidCache.set(key, tex)
  return tex
}

useGLTF.preload(HUMAN_MODEL)
