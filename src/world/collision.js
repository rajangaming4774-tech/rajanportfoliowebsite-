import { interactionGroups } from '@react-three/rapier'

// Thin props (lamp posts, palm trunks, slim pillars) still block the player, but the
// camera ignores them; otherwise it snaps in and out every time a pole passes
// between it and Rajan, which reads as flicker while walking.
export const THIN_PROPS = interactionGroups(1)
export const CAMERA_RAY = interactionGroups(0, [0])
export const THIN_RADIUS = 0.4
