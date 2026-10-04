import { profile, contact, skills, projects, experience, zones } from '../data/portfolio'
import { isSoundOn, setSound } from './sound'

// A line is either a plain string or { text, tone, href }.
// tone: 'ok' | 'warn' | 'err' | 'dim' | 'accent' | 'title'
const line = (text, tone, href) => ({ text, tone, href })
const blank = () => line('')

const SECTIONS = ['about', 'skills', 'projects', 'experience', 'contact']

const bar = (pct, width = 20) => {
  const filled = Math.round((pct / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const sectionOutput = {
  about: () => [
    line(`# about — ${zones.about}`, 'title'),
    ...profile.about.map((p) => line(p)),
    blank(),
    line(`📍 ${profile.location} · ${profile.availability}`, 'dim'),
  ],
  skills: () => [
    line(`# skills — ${zones.skills}`, 'title'),
    ...skills.map((s) => line(`${s.name.padEnd(24)} ${bar(s.level)} ${s.level}%`)),
  ],
  projects: () => [
    line(`# projects — ${zones.projects}`, 'title'),
    ...projects.flatMap((p, i) => [
      line(`[${i + 1}] ${p.title}`, 'accent'),
      line(`    ${p.description}`),
      line(`    stack: ${p.stack.join(' · ')}`, 'dim'),
      ...(p.url ? [line(`    live: ${p.url}`, 'ok', p.url)] : []),
    ]),
  ],
  experience: () => [
    line(`# experience — ${zones.experience}`, 'title'),
    ...experience.flatMap((e) => [line(`${e.period}  ${e.title}`, 'accent'), line(`    ${e.text}`)]),
  ],
  contact: () => [
    line(`# contact — ${zones.contact}`, 'title'),
    line(`email     ${contact.email}`, 'ok', `mailto:${contact.email}`),
    line(`whatsapp  ${contact.whatsapp}`, 'ok', contact.whatsappUrl),
    line(`hours     ${contact.hours}`, 'dim'),
  ],
}

const help = () => [
  line('Available commands:', 'title'),
  line('  start        enter the city (or hold SPACE)', 'accent'),
  line('  whoami       who is rajan?'),
  line('  ls           list sections'),
  line('  cat <name>   read a section, e.g. cat projects'),
  line('  open <n>     open project n live demo in a new tab'),
  line('  contact      how to reach me'),
  line('  skip         open the classic (non-game) site'),
  line('  sound        toggle typing sounds (on/off)'),
  line('  clear        clear the screen'),
  line('  ...and a few hidden ones. try "vanakkam" or "coffee".', 'dim'),
]

export const COMMAND_NAMES = [
  'help', 'start', 'play', 'whoami', 'ls', 'cat', 'cd', 'contact', 'skills', 'projects',
  'about', 'experience', 'open', 'sound', 'skip', 'classic', 'clear', 'vanakkam', 'coffee', 'sudo', 'exit',
]

/**
 * Runs a command string.
 * @returns {{ lines?: Array, action?: 'enter' | 'classic' | 'clear' | 'open', url?: string }}
 */
export function runCommand(input) {
  const [cmd, ...args] = input.trim().split(/\s+/)
  const arg = (args[0] || '').replace(/\/$/, '').toLowerCase()

  switch ((cmd || '').toLowerCase()) {
    case '':
      return { lines: [] }
    case 'help':
    case '?':
      return { lines: help() }
    case 'start':
    case 'play':
    case './start.sh':
      return { lines: [line('Boarding flight to Chennai (MAA)... ✈', 'ok')], action: 'enter' }
    case 'whoami':
      return {
        lines: [
          line(`${profile.name} — ${profile.role}`, 'accent'),
          line(profile.tagline),
          line(`📍 ${profile.location}`, 'dim'),
        ],
      }
    case 'ls':
      if (arg === 'projects') return { lines: projects.map((p, i) => line(`${i + 1}. ${p.title}`)) }
      if (SECTIONS.includes(arg)) return { lines: sectionOutput[arg]() }
      return { lines: [line(SECTIONS.map((s) => `${s}/`).join('   '), 'accent')] }
    case 'open':
      if (/^\d+$/.test(arg)) {
        const project = projects[Number(arg) - 1]
        if (!project) return { lines: [line(`open: no project ${arg}. Try 1-${projects.length}.`, 'err')] }
        if (!project.url) {
          return { lines: [line(`${project.title} has no live demo yet. Ask me about it!`, 'warn')] }
        }
        return { lines: [line(`Opening ${project.title}...`, 'ok')], action: 'open', url: project.url }
      }
    // falls through: "open <section>" behaves like cat
    case 'cat':
    case 'cd':
      if (!arg) return { lines: [line(`usage: ${cmd} <section>  (${SECTIONS.join(', ')})`, 'warn')] }
      if (SECTIONS.includes(arg)) return { lines: sectionOutput[arg]() }
      return { lines: [line(`${cmd}: ${args[0]}: No such section`, 'err')] }
    case 'about':
    case 'skills':
    case 'projects':
    case 'experience':
    case 'contact':
      return { lines: sectionOutput[cmd.toLowerCase()]() }
    case 'skip':
    case 'classic':
      return { lines: [line('Opening classic mode...', 'ok')], action: 'classic' }
    case 'sound': {
      const next = arg === 'on' ? true : arg === 'off' ? false : !isSoundOn()
      setSound(next)
      return { lines: [line(`Typing sounds ${next ? 'on' : 'off'}.`, next ? 'ok' : 'dim')] }
    }
    case 'clear':
    case 'cls':
      return { action: 'clear' }
    case 'vanakkam':
    case 'வணக்கம்':
      return { lines: [line('வணக்கம்! 🙏 Welcome to my corner of Chennai.', 'accent')] }
    case 'coffee':
      return {
        lines: [
          line('    ( (', 'dim'),
          line('     ) )', 'dim'),
          line('  .______.'),
          line('  |      |]'),
          line('  \\      /'),
          line("   `----'"),
          line('Fresh filter coffee. +10 productivity ☕', 'ok'),
        ],
      }
    case 'sudo':
      return { lines: [line('Nice try. You need to drink filter coffee first.', 'warn')] }
    case 'exit':
      return { lines: [line("There's no exit from Chennai traffic. Type 'start' instead.", 'warn')] }
    default:
      return { lines: [line(`command not found: ${cmd}. Type 'help' to see commands.`, 'err')] }
  }
}

export function autocomplete(input) {
  const parts = input.split(/\s+/)
  if (parts.length === 1) {
    const match = COMMAND_NAMES.filter((c) => c.startsWith(parts[0].toLowerCase()))
    return match.length === 1 ? `${match[0]} ` : input
  }
  if (parts.length === 2 && ['cat', 'cd', 'ls', 'open'].includes(parts[0])) {
    const match = SECTIONS.filter((s) => s.startsWith(parts[1].toLowerCase()))
    return match.length === 1 ? `${parts[0]} ${match[0]}` : input
  }
  return input
}
