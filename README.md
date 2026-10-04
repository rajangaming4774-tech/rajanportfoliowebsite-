# Rajan — Game Portfolio

A game-style developer portfolio for Rajan, a full-stack web developer and AI integration specialist from Chennai.

Flow: a retro terminal boots up, you hold SPACE (or press and hold the button on touch) to board the flight, and a 3D version of Chennai loads where each zone holds a section of the portfolio. Prefer a plain page? Type `skip` in the terminal or open `/#classic`.

Stack: Vite, React 19, three.js, @react-three/fiber, @react-three/drei, @react-three/rapier. The 3D code is lazy-loaded and split into its own chunks, so the terminal page stays light.

## Getting started

```bash
npm install
npm run dev      # dev server with HMR
npm run build    # production build into dist/
npm run preview  # serve the built site locally
npm run lint     # oxlint
```

## Folder structure

```
index.html            meta tags, Open Graph, noscript fallback
public/               favicon, manifest, robots.txt, images
src/
  App.jsx             switches stages: terminal, world, classic
  ErrorBoundary.jsx   friendly fallback if the 3D world fails to load
  data/portfolio.js   all content (single source of truth)
  terminal/           boot sequence, commands, hold-to-enter, typing sound
  classic/            the plain portfolio site
  world/              the 3D city (World, Player, zones, HUD, PerfMonitor)
```

## Editing content

Everything lives in `src/data/portfolio.js`: profile, contact details, skills, projects, experience and the zone names. The terminal, classic site and 3D world all read from it. To add a project, append an object to `projects` (`title`, `category`, `description`, `stack`, optional `url` and `image`). Images go in `public/`.

## Controls

Terminal:
- Hold SPACE (or press and hold the button) to enter the city
- `help` lists commands: `whoami`, `ls`, `cat <section>`, `open <n>` (opens project n's live demo), `contact`, `sound` (toggle typing sounds), `skip`, `clear`
- Tab autocompletes, Up/Down browse history

3D world: see the on-screen HUD for movement and interaction keys.

Classic site: scroll, use the nav (hamburger menu on mobile), or press "Play mode" to go back to the terminal.

## Deploy

Both hosts need no special config: it is a static Vite site.

Vercel:
1. Push the repo to GitHub and import it at vercel.com/new.
2. Framework preset: Vite. Build command `npm run build`, output directory `dist`.
3. Deploy.

Netlify:
1. Push the repo and choose "Add new site" then "Import an existing project".
2. Build command `npm run build`, publish directory `dist`.
3. Deploy.

Once you have a domain, add the canonical link and absolute `og:image` URL (see the TODO comments in `index.html`), and add a 1200x630 `public/og-image.png`.
