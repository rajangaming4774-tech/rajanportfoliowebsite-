// Subtle typing click via WebAudio. Off by default; the choice is kept in localStorage.
const KEY = 'portfolio-sound'

let enabled = false
try {
  enabled = localStorage.getItem(KEY) === 'on'
} catch {
  // storage unavailable: stay off
}

let ctx = null

export const isSoundOn = () => enabled

export function setSound(value) {
  enabled = value
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off')
  } catch {
    // ignore
  }
}

// Call from a key/pointer handler so the AudioContext is allowed to start.
export function playClick() {
  if (!enabled) return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    ctx ??= new AudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(900 + Math.random() * 300, t)
    gain.gain.setValueAtTime(0.025, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.05)
  } catch {
    // audio is optional
  }
}
