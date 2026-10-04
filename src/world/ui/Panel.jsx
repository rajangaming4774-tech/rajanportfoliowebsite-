import { useEffect, useRef } from 'react'
import { contact, experience, extraSkills, profile, projects, skills } from '../../data/portfolio'
import './Panel.css'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function About() {
  return (
    <div className="panel-about">
      <img className="panel-photo" src={profile.photo} alt={profile.name} />
      <div>
        <p className="panel-role">{profile.role}</p>
        {profile.about.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="panel-meta">
          📍 {profile.location} · {profile.availability}
        </p>
      </div>
    </div>
  )
}

function Skills() {
  return (
    <>
      <ul className="panel-bars">
        {skills.map((s) => (
          <li key={s.name}>
            <div className="panel-bar-head">
              <span>{s.name}</span>
              <span>{s.level}%</span>
            </div>
            <div className="panel-bar" role="img" aria-label={`${s.name} ${s.level} percent`}>
              <span style={{ width: `${s.level}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {Object.entries(extraSkills).map(([group, items]) => (
        <div key={group} className="panel-group">
          <h3>{group}</h3>
          <ul className="panel-tags">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

function Projects() {
  return (
    <ul className="panel-cards">
      {projects.map((p) => (
        <li key={p.slug} className="panel-card">
          {p.image && <img src={p.image} alt={`${p.title} preview`} loading="lazy" />}
          <p className="panel-card-cat">{p.category}</p>
          <h3>{p.title}</h3>
          <p>{p.description}</p>
          <ul className="panel-tags">
            {p.stack.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {p.url && (
            <a className="panel-link" href={p.url} target="_blank" rel="noreferrer">
              View live ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

function Experience() {
  return (
    <ol className="panel-timeline">
      {experience.map((e) => (
        <li key={e.period}>
          <p className="panel-card-cat">{e.period}</p>
          <h3>{e.title}</h3>
          <p>{e.text}</p>
        </li>
      ))}
    </ol>
  )
}

function Contact() {
  return (
    <div className="panel-contact">
      <p>Have a project in mind? Let's talk.</p>
      <a className="panel-link panel-link-big" href={`mailto:${contact.email}`}>
        ✉ {contact.email}
      </a>
      <a className="panel-link panel-link-big" href={contact.whatsappUrl} target="_blank" rel="noreferrer">
        💬 WhatsApp {contact.whatsapp}
      </a>
      <p className="panel-meta">🕐 {contact.hours}</p>
    </div>
  )
}

const BODY = { about: About, skills: Skills, projects: Projects, experience: Experience, contact: Contact }

export default function Panel({ zone, onClose }) {
  const root = useRef()
  const Body = BODY[zone.section]

  // Move focus in on open, hand it back on close.
  useEffect(() => {
    const previous = document.activeElement
    root.current?.querySelector('.panel-close')?.focus()
    return () => previous?.focus?.()
  }, [])

  const trap = (e) => {
    if (e.key !== 'Tab') return
    const items = [...root.current.querySelectorAll(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="panel-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={root}
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        onKeyDown={trap}
      >
        <header className="panel-head">
          <div>
            <p className="panel-label">📍 {zone.label}</p>
            <h2 id="panel-title">{zone.name}</h2>
          </div>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close panel">
            Esc ✕
          </button>
        </header>
        <div className="panel-body">{Body && <Body />}</div>
      </div>
    </div>
  )
}
