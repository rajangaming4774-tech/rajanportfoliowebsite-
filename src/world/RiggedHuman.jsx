import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SkinnedMesh,
  Sphere,
  SRGBColorSpace,
  Vector3,
} from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stripLightsAndCameras } from './props/gltf'
import { HUMAN_MODEL, WOMAN_MODELS } from './humanModels'

// The rigged human modelled in Higgsfield 3D (public/models/rajan-v6.glb): 16 bones, ~4.9k triangles,
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


const LEG = 0.83 // hip to ankle, metres
const THIGH = 0.42 // hip to knee
const SHIN = 0.41 // knee to ankle
const MAX_REACH = 0.62 // furthest the foot gets ahead of / behind the hip
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
export default function RiggedHuman({ anim, colors, plaid, shades = true, scale = 1, castShadow = true, model: url = HUMAN_MODEL }) {
  const { scene } = useGLTF(url)
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
      ensureUVs(o.geometry)
      o.material = o.material.clone()
    }
    if (merge && parts.length > 1) mergeParts(clone, parts, castShadow)
    enableCulling(clone)
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
    rig.current = { bones, q: new Quaternion(), phase: Math.random(), legL: {}, legR: {}, run: 0, air: 0, airTime: 0, move: 0, t: Math.random() * 10 }
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
    // Same cap as the code that moves the characters, so the legs never outrun the body.
    const dt = Math.min(rawDt, 0.05)
    const a = anim?.current
    const speed = a?.speed ?? 0
    const grounded = a?.grounded ?? true
    r.t += dt
    const k = 1 - Math.exp(-10 * dt)
    // Gait is judged at the character's own size: a child at 0.65 scale moving at 2 m/s is
    // going as fast, relative to its legs, as an adult at ~3 m/s.
    const rel = speed / scale
    r.move += ((speed > 0.15 ? 1 : 0) - r.move) * k
    r.run += ((rel > 3.2 ? 1 : 0) - r.run) * k
    // Only a real jump/fall counts as airborne: the ground check flickers for a frame or
    // two on kerbs and road edges, and that must not flash the jump pose mid-stride.
    r.airTime = grounded ? 0 : r.airTime + dt
    r.air += ((r.airTime > 0.18 ? 1 : 0) - r.air) * (1 - Math.exp(-12 * dt))

    // ---- Gait: a stance / swing cycle per leg (one cycle = two steps) ----
    // While a foot is planted (stance), it moves backwards under the hips at exactly the
    // body's speed, so it stays put on the ground; then it lifts and swings forward.
    // Walking: each foot is down ~60% of the cycle (both feet down at the hand-over);
    // steps lengthen with speed (~100 steps/min at 1.2 m/s, ~135 at a brisk 1.9 m/s).
    // Running: stance ~27% with a flight phase, at a natural cadence (~185 steps/min).
    const run = r.run
    const duty = 0.6 + (0.27 - 0.6) * run // fraction of the cycle a foot is planted
    const walkReach = LEG * Math.sin(Math.min(38, Math.max(20, 14 + 12.5 * rel)) * DEG) // half a step, model units
    const walkRate = rel > 0.05 ? (rel * duty) / (2 * walkReach) : 0 // cycles per second
    const runRate = 1.25 + 0.05 * rel
    const rate = walkRate + (runRate - walkRate) * run
    r.phase = (r.phase + rate * dt) % 1
    // Reach that makes the planted foot keep pace with the ground at this rate and size.
    const reach = rate > 0 ? Math.min(MAX_REACH, (rel * duty) / (2 * rate)) : 0
    const swingKnee = 58 + 42 * run // knee bend at mid-swing, degrees
    const stanceKnee = 6 + 22 * run // softer knee on the planted leg when running
    const air = r.air
    const m = r.move * (1 - air)
    const idle = 1 - r.move
    const breath = Math.sin(r.t * 1.9)
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

    // One leg at cycle position u: foot offset (forward of the hip), knee bend, thigh
    // angle (from the two-bone leg: the ankle sits `x` ahead of the hip), sole angle.
    const leg = (u, out) => {
      let x
      let knee
      let stance
      if (u < duty) {
        stance = true
        x = reach * (1 - (2 * u) / duty) // heel strike in front → toe-off behind, at body speed
        knee = stanceKnee
      } else {
        stance = false
        const w = (u - duty) / (1 - duty) // swing progress
        x = -reach + 2 * reach * (w * w * (3 - 2 * w))
        knee = stanceKnee + (swingKnee - stanceKnee) * Math.sin(Math.PI * Math.min(1, w * 1.15))
      }
      const k = knee * DEG
      const D = Math.sqrt(THIGH * THIGH + SHIN * SHIN + 2 * THIGH * SHIN * Math.cos(k)) // hip → ankle
      const delta = Math.atan2(SHIN * Math.sin(k), THIGH + SHIN * Math.cos(k))
      const xs = Math.max(-0.95 * D, Math.min(0.95 * D, x))
      const thigh = Math.asin(xs / D) + delta
      out.thigh = (thigh / DEG) * m
      out.knee = knee * m + 4 * (1 - m)
      // Sole flat on the ground while planted; toes lift as the foot swings through.
      const flat = (k - thigh) / DEG
      out.foot = (stance ? flat : flat * 0.5 + 12) * m
      out.height = stance ? Math.sqrt(D * D - xs * xs) : Infinity // hip height this leg allows
      out.x = x
    }
    leg(r.phase, r.legL)
    leg((r.phase + 0.5) % 1, r.legR)
    const L = r.legL
    const R = r.legR

    set('UpperLegL', mix(L.thigh, 50), 0, 0)
    set('UpperLegR', mix(R.thigh, -15), 0, 0)
    set('LowerLegL', mix(-L.knee, -75), 0, 0)
    set('LowerLegR', mix(-R.knee, -35), 0, 0)
    set('FootL', L.foot, 0, 0)
    set('FootR', R.foot, 0, 0)

    // Arms swing against the legs (left arm forward with the right foot); elbows bend
    // more as the pace picks up. Torso twists with the stride, head stays steady.
    const swing = Math.cos(2 * Math.PI * r.phase) // +1 when the left foot is in front
    const armAmp = 12 + 9 * Math.min(rel, 2) + 30 * run
    const elbow = 10 + 25 * run
    set('UpperArmL', mix(-armAmp * swing * m + breath * 1.5 * idle, 130), 0, mix(6 + 2 * idle, 25))
    set('UpperArmR', mix(armAmp * swing * m - breath * 1.5 * idle, 110), 0, mix(6 + 2 * idle, 25))
    set('LowerArmL', mix(12 + elbow * pos(-swing) * m, 25), 0, 0)
    set('LowerArmR', mix(12 + elbow * pos(swing) * m, 35), 0, 0)
    const lean = 3 + 9 * run
    set('Spine', mix(lean * m + breath * 1.2 * idle, 8), 6 * swing * m, 0, false)
    set('Head', -lean * 0.6 * m - breath * idle, -4 * swing * m + Math.sin(r.t * 0.5) * 8 * idle, 0, false)

    // Hips ride at the height the lower leg allows, so the planted foot stays exactly on
    // the ground: worked out from the angles actually applied this frame (including the
    // blend in and out of walking), so feet never sink into the pavement or hover.
    // In the run's flight phase the body rises a little between steps.
    const hips = r.bones.Hips
    if (hips) {
      const reachDown = (thighDeg, kneeDeg) =>
        THIGH * Math.cos(thighDeg * DEG) + SHIN * Math.cos((thighDeg - kneeDeg) * DEG)
      let h = Math.max(reachDown(L.thigh, L.knee), reachDown(R.thigh, R.knee))
      if (L.height === Infinity && R.height === Infinity) {
        // Both feet in the air (running): the body keeps its take-off / landing height
        // and rises a little through the flight, instead of following the tucked legs.
        // same leg geometry as in leg(): hip → ankle length with the stance knee bend
        const kc = stanceKnee * DEG
        const Dc = Math.sqrt(THIGH * THIGH + SHIN * SHIN + 2 * THIGH * SHIN * Math.cos(kc))
        const contact = LEG + (Math.sqrt(Math.max(0, Dc * Dc - reach * reach)) - LEG) * m
        const f = ((((r.phase - duty) % 0.5) + 0.5) % 0.5) / (0.5 - duty)
        h = contact + 0.05 * Math.sin(Math.PI * Math.min(1, Math.max(0, f))) * m
      }
      const bob = (h - LEG) * (1 - ja) + breath * 0.003 * idle
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
  first.parent.add(body)
  for (const p of parts) p.parent.remove(p)
  root.userData.ranges = ranges
  root.userData.body = body
  root.userData.restPositions = merged.attributes.position.array.slice()
}

// Skinned meshes can't use their geometry's bounds (the bones move the vertices), so
// they were drawn even when off screen or behind the camera. Give the character one
// fixed sphere: the whole skinned rest pose (in the space the posed vertices end up
// in), enlarged to cover the swing of the arms and legs in the walk / run / jump
// poses. Every part shares it, so a small part (eyes, shades) is never culled on its own.
function enableCulling(root) {
  root.updateMatrixWorld(true)
  const meshes = []
  root.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o)
  })
  const all = new Sphere()
  all.makeEmpty()
  for (const m of meshes) {
    m.skeleton.update()
    m.computeBoundingSphere()
    all.union(m.boundingSphere.clone().applyMatrix4(m.matrixWorld))
  }
  all.radius *= 1.4
  const inv = new Matrix4()
  for (const m of meshes) {
    m.boundingSphere = all.clone().applyMatrix4(inv.copy(m.matrixWorld).invert())
    m.frustumCulled = true
  }
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
Object.values(WOMAN_MODELS).forEach((url) => useGLTF.preload(url))
