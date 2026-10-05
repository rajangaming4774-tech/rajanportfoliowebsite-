// Single source of truth for portfolio content.
// Used by the terminal commands, the classic site, and (later) the game world zones.

export const profile = {
  name: 'Rajan',
  handle: 'rajan',
  role: 'Full-Stack Web Developer & AI Integration Specialist',
  location: 'Chennai, India',
  availability: 'Available worldwide (remote)',
  photo: '/rajan-profile.jpg',
  tagline: 'I build web apps that look stunning and think for themselves.',
  about: [
    "I'm a full-stack web developer and AI integration specialist from Chennai, working with clients worldwide.",
    'I turn complex ideas into fast, intelligent web applications: chatbots, AI-powered SaaS products, and the interfaces around them.',
    'Every project is built for performance, made to scale, and designed with obsessive attention to detail.',
  ],
}

export const contact = {
  email: 'rajanmfreelancer@gmail.com',
  whatsapp: '+91 88070 62029',
  whatsappUrl:
    'https://wa.me/918807062029?text=Hi%20Rajan%2C%20I%27m%20interested%20in%20working%20with%20you',
  hours: 'Mon – Sat, 10:00 AM – 8:00 PM IST',
}

export const skills = [
  { name: 'HTML, CSS & JavaScript', level: 95 },
  { name: 'AI & OpenAI APIs', level: 92 },
  { name: 'React / Next.js', level: 90 },
  { name: 'Node.js & Express', level: 88 },
  { name: 'UI/UX & Design', level: 87 },
  { name: 'Databases', level: 85 },
]

export const extraSkills = {
  'Front-End': ['TypeScript', 'Tailwind CSS', 'Redux / Zustand', 'Framer Motion', 'GSAP', 'PWA'],
  'Back-End & DevOps': ['Express.js', 'REST & GraphQL', 'WebSockets', 'JWT Auth', 'Docker', 'CI/CD'],
  'AI & ML': ['OpenAI GPT-4', 'LangChain', 'Vector DBs', 'Embeddings', 'Prompt Engineering', 'AI Agents'],
}

export const projects = [
  {
    slug: 'arleen-builders',
    title: 'Arleen Builders',
    category: 'Construction / Business site',
    description:
      'Website for a Chennai builder (since 2007): construction, interiors and sports-court flooring, completed projects and a free-quote enquiry flow.',
    stack: ['Responsive', 'Local SEO', 'Open Graph'],
    url: 'https://arleen.vercel.app/',
  },
  {
    slug: 'guna-steels',
    title: 'Guna Steels',
    category: 'Industrial / Manufacturer',
    description:
      'Site for a Tamil Nadu maker of sanitary SS 304 / 316L valves, fittings and purified-water systems for pharma and dairy plants.',
    stack: ['Responsive', 'SEO', 'Product showcase'],
    url: 'https://guna-steels.vercel.app/',
  },
  {
    slug: 'guna-pharma',
    title: 'Guna Pharma',
    category: 'Industrial / Product catalogue',
    description:
      'Pharmaceutical stainless-steel engineering: a 96-product catalogue of valves, fittings and accessories, plus a five-stage build process.',
    stack: ['Next.js', 'Catalogue', 'SEO'],
    url: 'https://guna-phrma.vercel.app/',
  },
  {
    slug: 'accounting-portal',
    title: 'B.Com Accounting Student Portal',
    category: 'Education / Web app',
    description:
      'Sign-in portal for a B.Com Accounting & Finance department: class timetable, attendance and department notices.',
    stack: ['React', 'Vite', 'Auth'],
    url: 'https://accounting-website-virid.vercel.app/',
  },
  {
    slug: 'hapiwelkin',
    title: 'HapiWelkin Creative Institute',
    category: 'Education / Institute site',
    description:
      'Chennai institute (since 2014) for happiness, creativity and career readiness: Hapi, Crea, Wami, DEEP and the HapiCrea Universe lab.',
    stack: ['Responsive', 'Programs', 'Testimonials'],
    url: 'https://de-snowy-delta.vercel.app/',
  },
  {
    slug: 'karuna-sanctuary',
    title: 'Karuna Animal Sanctuary',
    category: 'Non-profit / Giving platform',
    description:
      'Giving platform for a Coimbatore animal rescue: donate, sponsor, adopt or report a rescue, with urgent cases, campaigns and transparent fund breakdowns.',
    stack: ['Donations', 'Campaigns', 'Responsive'],
    url: 'https://de-f8yz.vercel.app/',
  },
  {
    slug: 'smush',
    title: 'smush — Home Bakery',
    category: 'E-commerce / Food brand',
    description:
      'Shop for a Chennai small-batch bakery: fudgy brownies, brown-butter cookies and eggless tiramisu, baked daily.',
    stack: ['Next.js', 'Shop', 'Brand design'],
    url: 'https://smush-shop-br7l.vercel.app/',
  },
  {
    slug: 'saas-dashboard',
    title: 'AI SaaS Analytics Dashboard',
    category: 'SaaS / Analytics',
    description:
      'Real-time analytics, automated reporting, and AI-generated insights so teams can make data-driven decisions.',
    stack: ['React', 'Charts', 'Stripe', 'Auth'],
    url: 'https://sas-demo-el5e808ti-rajanmfreelancer-cells-projects.vercel.app/',
    image: '/saas_dashboard_preview.png',
  },
  {
    slug: 'resume-analyzer',
    title: 'AI Resume Analyzer',
    category: 'AI / Machine Learning',
    description:
      'GPT-4 powered resume parsing and scoring with a detailed breakdown, bulk processing, and PDF reports.',
    stack: ['React', 'Node.js', 'OpenAI API', 'MongoDB'],
  },
  {
    slug: 'chatbot-platform',
    title: 'AI Chatbot Platform',
    category: 'Conversational AI',
    description:
      'Automates customer conversations 24/7: answers questions, qualifies leads, and cuts support costs.',
    stack: ['Next.js', 'TypeScript', 'GPT-4', 'Pinecone'],
  },
  {
    slug: 'content-generator',
    title: 'AI Content Generator',
    category: 'Content Generation',
    description:
      'SEO-optimised articles, social posts and ad copy with brand-voice control and multi-language support.',
    stack: ['React', 'Python', 'OpenAI', 'Firebase'],
  },
]

export const experience = [
  {
    period: '2024 — Present',
    title: 'AI-Powered Web Development Specialist',
    text: 'Building chatbots, content generators and AI SaaS products for clients worldwide. 20+ AI-enhanced apps delivered.',
  },
  {
    period: '2023 — 2024',
    title: 'Full-Stack Developer & Freelancer',
    text: 'React, Next.js and Node.js apps, e-commerce platforms and custom sites for startups and SMBs.',
  },
  {
    period: '2022 — 2023',
    title: 'Front-End Developer',
    text: 'Responsive, pixel-perfect websites with a focus on UI/UX, performance and accessibility.',
  },
  {
    period: '2021 — 2022',
    title: 'Self-Taught Developer',
    text: 'Learned web development through courses, projects and a lot of practice.',
  },
]

// Where each section will live in the Chennai game world (Phase 2+).
export const zones = {
  about: 'Mylapore tea kadai',
  skills: 'Anna Centenary Library',
  projects: 'OMR IT corridor',
  experience: 'Ripon Building',
  contact: 'Marina Beach lighthouse',
}
