import { useEffect, useMemo } from 'react'
import { capture } from '../pointer'

// Mutable input state shared by keyboard, touch joystick and the player.
// Kept outside React state so reading it every frame costs nothing.
export function createInput() {
  return { forward: false, back: false, left: false, right: false, run: false, jump: false, joyX: 0, joyY: 0 }
}

// Camera orbit state, driven by mouse/touch drag and the wheel.
export function createCamera(yaw) {
  return { yaw, pitch: 0.32, distance: 7 }
}

const KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
}

// inputRef / uiRef are refs; ui.current.locked freezes the player (open panel, fast travel).
export function useKeyboard(inputRef, uiRef, onFirstMove) {
  useEffect(() => {
    const set = (value) => (e) => {
      const action = KEYS[e.code]
      if (!action) return
      if (value && (uiRef.current.locked || e.ctrlKey || e.metaKey || e.altKey)) return
      if (value) e.preventDefault()
      inputRef.current[action] = value
      if (value && action !== 'run') onFirstMove?.()
    }
    const down = set(true)
    const up = set(false)
    // Releasing everything on blur stops the player running forever after alt-tab.
    const reset = () => Object.assign(inputRef.current, createInput())

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [inputRef, uiRef, onFirstMove])
}

/** Pointer-drag to orbit the camera, wheel to zoom. Returns props for the wrapper element. */
export function useOrbit(camRef) {
  return useMemo(() => orbitHandlers(camRef), [camRef])
}

function orbitHandlers(camRef) {
  let last = null
  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
      last = { x: e.clientX, y: e.clientY, id: e.pointerId }
      capture(e)
    },
    onPointerMove: (e) => {
      if (!last || e.pointerId !== last.id) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last.x = e.clientX
      last.y = e.clientY
      const cam = camRef.current
      cam.yaw -= dx * 0.006
      cam.pitch = Math.min(1.1, Math.max(0.05, cam.pitch + dy * 0.004))
    },
    onPointerUp: (e) => {
      if (last && e.pointerId === last.id) last = null
    },
    onPointerCancel: () => {
      last = null
    },
    onWheel: (e) => {
      const cam = camRef.current
      cam.distance = Math.min(13, Math.max(3.5, cam.distance + e.deltaY * 0.005))
    },
    onContextMenu: (e) => e.preventDefault(),
  }
}
