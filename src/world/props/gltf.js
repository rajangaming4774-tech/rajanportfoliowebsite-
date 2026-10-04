// Models built in Higgsfield 3D (Blender) include a preview Sun and Camera.
// The game has its own lighting, so strip them from any loaded GLB scene.
export function stripLightsAndCameras(root) {
  const doomed = []
  root.traverse((o) => {
    if (o.isLight || o.isCamera) doomed.push(o)
  })
  for (const o of doomed) o.parent?.remove(o)
  return root
}
