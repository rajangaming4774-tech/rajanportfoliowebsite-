import { useMemo } from 'react'
import RiggedHuman from './RiggedHuman'

// Rajan, the player: the Higgsfield rigged human in one of three outfits.
// 'street' (default, from the game reference): white-and-grey checked shirt open
// over a tee, grey jeans, teal sneakers, sunglasses. 'casual': the pale yellow-green
// anime tee look. 'formal': navy blazer, dark trousers, brown shoes.
// Origin is the capsule centre; the model's feet sit at y = -0.85. Faces +z.

const OUTFITS = {
  street: {
    colors: { Print: '#f2f2ef', Placket: '#f7f7f5', Shorts: '#9a9fa6', Legs: '#9a9fa6', Shoes: '#2fd0a8' },
    plaid: ['#f4f4f1', '#8a8f96'],
    shades: true,
  },
  casual: {
    colors: { Tee: '#d3e08f', Print: '#e8862a', Placket: '#d3e08f', Shorts: '#1f2a4a', Legs: '#8a5a3c', Shoes: '#f1efe9' },
    plaid: null,
    shades: false,
  },
  formal: {
    colors: { Tee: '#22365c', Print: '#bcd6f3', Placket: '#2b4370', Shorts: '#262a36', Legs: '#262a36', Shoes: '#3e2a1c' },
    plaid: null,
    shades: false,
  },
}

export default function CharacterModel({ anim, outfit = 'street' }) {
  const look = useMemo(() => OUTFITS[outfit] ?? OUTFITS.street, [outfit])
  return (
    <group position={[0, -0.85, 0]}>
      <RiggedHuman anim={anim} colors={look.colors} plaid={look.plaid} shades={look.shades} />
    </group>
  )
}
