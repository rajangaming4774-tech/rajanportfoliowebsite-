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
