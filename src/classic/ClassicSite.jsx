import { useEffect, useState } from 'react'
import { profile, contact, skills, extraSkills, projects, experience, zones } from '../data/portfolio'
import './ClassicSite.css'

const NAV = ['about', 'skills', 'projects', 'experience', 'contact']
const YEAR = new Date().getFullYear()

// Highlights the nav link of the section currently in view.
function useActiveSection(ids) {
  const [active, setActive] = useState('')
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) setActive(visible[0].target.id)
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])
  return active
}

// Fades elements with [data-reveal] in as they scroll into view (skipped for reduced motion).
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.classic [data-reveal]')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('is-visible')
          observer.unobserve(e.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

export default function ClassicSite({ onTerminal }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const active = useActiveSection(NAV)
  useScrollReveal()

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="classic">
      <nav className={`c-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main">
        <a href="#top" className="c-logo">
          <span className="c-logo-prompt">{profile.handle}@chennai</span>
          <span className="c-logo-cursor">_</span>
        </a>
        <ul className="c-nav-links" id="c-menu">
          {NAV.map((id) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={active === id ? 'is-active' : undefined}
                aria-current={active === id ? 'true' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {id}
              </a>
            </li>
          ))}
        </ul>
        <button type="button" className="c-play" onClick={onTerminal}>
          ▶ Play mode
        </button>
        <button
          type="button"
          className="c-burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="c-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <header className="c-hero" id="top">
        <div className="c-hero-text" data-reveal>
          <p className="c-kicker">வணக்கம், I'm</p>
          <h1>{profile.name}</h1>
          <p className="c-role">{profile.role}</p>
          <p className="c-tagline">{profile.tagline}</p>
          <div className="c-hero-cta">
            <a className="c-btn c-btn-primary" href="#projects">
              See my work
            </a>
            <a className="c-btn" href={`mailto:${contact.email}`}>
              Email me
            </a>
          </div>
          <p className="c-meta">
            📍 {profile.location} · {profile.availability}
          </p>
        </div>
        <img data-reveal className="c-photo" src={profile.photo} alt={`Portrait of ${profile.name}`} width="320" height="320" />
      </header>

      <main>
        <Section id="about" title="About">
          <div className="c-prose">
            {profile.about.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </Section>

        <Section id="skills" title="Skills">
          <ul className="c-skills">
            {skills.map((s) => (
              <li key={s.name}>
                <div className="c-skill-head">
                  <span>{s.name}</span>
                  <span className="c-skill-pct">{s.level}%</span>
                </div>
                <div className="c-skill-track">
                  <div className="c-skill-fill" style={{ width: `${s.level}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="c-extra">
            {Object.entries(extraSkills).map(([group, items]) => (
              <div key={group}>
                <h3>{group}</h3>
                <ul className="c-tags">
                  {items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section id="projects" title="Projects">
          <div className="c-projects">
            {projects.map((p) => (
              <article key={p.slug} className="c-card" data-reveal>
                {p.image && <img src={p.image} alt={`${p.title} screenshot`} loading="lazy" />}
                <p className="c-card-cat">{p.category}</p>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <ul className="c-tags">
                  {p.stack.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {p.url && (
                  <a className="c-card-link" href={p.url} target="_blank" rel="noreferrer">
                    Live demo →
                  </a>
                )}
              </article>
            ))}
          </div>
        </Section>

        <Section id="experience" title="Experience">
          <ol className="c-timeline">
            {experience.map((e) => (
              <li key={e.period}>
                <p className="c-period">{e.period}</p>
                <h3>{e.title}</h3>
                <p>{e.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="contact" title="Contact">
          <div className="c-contact">
            <p className="c-contact-lead">Have a project in mind? Let's build it.</p>
            <div className="c-hero-cta">
              <a className="c-btn c-btn-primary" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
              <a className="c-btn" href={contact.whatsappUrl} target="_blank" rel="noreferrer">
                WhatsApp {contact.whatsapp}
              </a>
            </div>
            <p className="c-meta">{contact.hours}</p>
          </div>
        </Section>
      </main>

      <footer className="c-footer">
        <p>
          © {YEAR} {profile.name} · Made in Chennai with filter coffee ☕
        </p>
      </footer>
    </div>
  )
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="c-section" aria-labelledby={`${id}-title`} data-reveal>
      <p className="c-section-label">
        <span>$ cat {id}</span>
        <span className="c-zone">in the city: {zones[id]}</span>
      </p>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  )
}
