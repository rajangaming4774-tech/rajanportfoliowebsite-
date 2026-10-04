import { BEACH_X } from '../zones'

// Procedural ambience built on WebAudio (no audio files): sea waves, a distant
// auto horn now and then, and a temple bell when the camera is near Mylapore.

const KEY = 'rajan-world-muted'
const VOLUME = 0.5
const TEMPLE = [21, 16]
const TEMPLE_RANGE = 30

const readMuted = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const writeMuted = (v) => {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    // storage unavailable (private mode etc.)
  }
}
const clamp01 = (v) => Math.min(1, Math.max(0, v))

export function createAmbience() {
  let ctx = null
  let master = null
  let wave = null
  let waveLfo = null
  let hiss = null
  let hissLfo = null
  let disposed = false
  let muted = readMuted()
  let seaLevel = -1
  let templeNear = 0
  const subs = new Set()
  const timers = new Set()

  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id)
      if (!disposed) fn()
    }, ms)
    timers.add(id)
  }
  const emit = () => subs.forEach((fn) => fn())

  const noiseBuffer = () => {
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  const lfo = (freq, target) => {
    const osc = ctx.createOscillator()
    osc.frequency.value = freq
    const depth = ctx.createGain()
    depth.gain.value = 0
    osc.connect(depth).connect(target.gain)
    osc.start()
    return depth
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    try {
      ctx = new AC()
    } catch {
      ctx = null
      return
    }
    master = ctx.createGain()
    master.gain.value = muted ? 0 : VOLUME
    master.connect(ctx.destination)

    const buf = noiseBuffer()
    const noise = (filterType, freq, q = 0.7) => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = filterType
      f.frequency.value = freq
      f.Q.value = q
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(f).connect(g).connect(master)
      src.start(0, Math.random() * 3)
      return g
    }
    wave = noise('lowpass', 520)
    waveLfo = lfo(0.09, wave)
    hiss = noise('highpass', 2200)
    hissLfo = lfo(0.13, hiss)
    seaLevel = -1
    later(horn, 9000 + Math.random() * 8000)
    later(bell, 4000)
  }

  function horn() {
    later(horn, 14000 + Math.random() * 18000)
    if (!ctx || ctx.state !== 'running' || muted) return
    const out = ctx.createGain()
    out.gain.value = 0.05
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner()
      pan.pan.value = Math.random() * 1.6 - 0.8
      out.connect(lp).connect(pan).connect(master)
    } else {
      out.connect(lp).connect(master)
    }
    const beeps = Math.random() < 0.5 ? 2 : 1
    for (let i = 0; i < beeps; i++) {
      const t = ctx.currentTime + 0.02 + i * 0.3
      for (const f of [392, 495]) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = f
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(1, t + 0.02)
        g.gain.setValueAtTime(1, t + 0.17)
        g.gain.linearRampToValueAtTime(0, t + 0.22)
        o.connect(g).connect(out)
        o.start(t)
        o.stop(t + 0.26)
      }
    }
  }

  function strike(t, vol) {
    const out = ctx.createGain()
    out.gain.value = vol
    out.connect(master)
    ;[
      [1, 1, 3.4],
      [2.76, 0.55, 2.4],
      [5.4, 0.3, 1.5],
      [8.93, 0.14, 0.9],
    ].forEach(([ratio, amp, decay]) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = 520 * ratio
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(amp, t + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0008, t + decay)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + decay + 0.05)
    })
  }

  function bell() {
    later(bell, 5500 + Math.random() * 4500)
    if (!ctx || ctx.state !== 'running' || muted || templeNear < 0.05) return
    const t = ctx.currentTime + 0.02
    const vol = templeNear * 0.16
    strike(t, vol)
    if (Math.random() < 0.55) strike(t + 0.7, vol * 0.7)
  }

  const api = {
    getMuted: () => muted,
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    unlock() {
      if (disposed) return
      if (!ctx) build()
      if (ctx && ctx.state === 'suspended' && !muted) ctx.resume().catch(() => {})
    },
    toggle() {
      muted = !muted
      writeMuted(muted)
      emit()
      if (muted) {
        if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
        later(() => {
          if (ctx && muted) ctx.suspend().catch(() => {})
        }, 400)
      } else {
        api.unlock()
        if (ctx && master) master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.1)
      }
    },
    // Called every frame with the camera position
    update(x, z) {
      templeNear = clamp01(1 - Math.hypot(x - TEMPLE[0], z - TEMPLE[1]) / TEMPLE_RANGE)
      if (!ctx || !wave) return
      const t = clamp01((x - (BEACH_X - 55)) / 55)
      const level = 0.1 + 0.9 * t * t
      if (Math.abs(level - seaLevel) < 0.01) return
      seaLevel = level
      const now = ctx.currentTime
      wave.gain.setTargetAtTime(level * 0.42, now, 0.3)
      waveLfo.gain.setTargetAtTime(level * 0.3, now, 0.3)
      hiss.gain.setTargetAtTime(level * 0.05, now, 0.3)
      hissLfo.gain.setTargetAtTime(level * 0.035, now, 0.3)
    },
    dispose() {
      disposed = true
      timers.forEach(clearTimeout)
      timers.clear()
      subs.clear()
      if (ctx) ctx.close().catch(() => {})
      ctx = null
    },
  }
  return api
}
