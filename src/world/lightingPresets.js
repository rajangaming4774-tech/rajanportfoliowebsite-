// Time-of-day presets for the city. Chennai's sea is to the east (+x), so the
// morning sun rises over the Marina; night ambience comes from lamps and lit windows.

export const TIMES = ['morning', 'day', 'night']

export const PRESETS = {
  morning: {
    label: 'Morning',
    icon: '🌅',
    sun: [120, 22, 10], // low in the east over the sea
    sunColor: '#ffc98a',
    sunIntensity: 2.3,
    hemi: ['#ffd9b4', '#6f5f4a', 0.75],
    fog: ['#f3d7b6', 55, 190],
    sky: { turbidity: 9, rayleigh: 2.6, mieCoefficient: 0.012, mieDirectionalG: 0.9 },
    exposure: 1.05,
  },
  day: {
    label: 'Day',
    icon: '☀️',
    sun: [-60, 90, 40],
    sunColor: '#fff5e6',
    sunIntensity: 2.8,
    hemi: ['#d8ecff', '#7d6f58', 0.85],
    fog: ['#cfe3f2', 70, 230],
    sky: { turbidity: 3, rayleigh: 0.8, mieCoefficient: 0.004, mieDirectionalG: 0.8 },
    exposure: 1.0,
  },
  night: {
    label: 'Night',
    icon: '🌙',
    sun: [40, 70, -60], // the moon
    sunColor: '#8fa6d6',
    sunIntensity: 0.35,
    hemi: ['#1a2440', '#2a1d12', 0.55],
    fog: ['#0b1020', 40, 160],
    sky: null,
    exposure: 0.9,
  },
}
