import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
  Upload, FileText, Github, Mail, ArrowRight, Sparkles,
  Check, Languages, Edit3, Image as ImageIcon, Table as TableIcon, Cloud,
  Star, Quote, ChevronRight, Play, Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HeroScene } from './HeroScene';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-app-bg text-text-primary overflow-x-hidden">
      {/* Decorative global background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <Nav />

      <main className="relative">
        <HeroSection />
        <LogoTickerSection />
        <FeaturesSection />
        <ShowcaseSection />
        <HowItWorksSection />
        <PricingPreviewSection />
        <TestimonialsSection />
        <FaqSection />
        <CtaSection />
      </main>

      <Footer />
    </div>
  );
}

/* -------------------- NAV -------------------- */
function Nav() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 backdrop-blur-xl bg-app-bg/70 border-b border-white/[0.06]"
    >
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6 lg:px-10">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gold blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
            <FileText className="w-6 h-6 text-gold relative" />
          </div>
          <span className="text-lg font-bold text-shimmer">BornoOCR</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-text-secondary hover:text-gold transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-text-secondary hover:text-gold transition-colors">How it works</a>
          <Link to="/pricing" className="text-sm text-text-secondary hover:text-gold transition-colors">Pricing</Link>
          <Link to="/help" className="text-sm text-text-secondary hover:text-gold transition-colors">Help</Link>
          <a href="#testimonials" className="text-sm text-text-secondary hover:text-gold transition-colors">Reviews</a>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-text-secondary hover:text-text-primary transition-colors hidden sm:block">
            Sign in
          </Link>
          <Link to="/auth" className="btn-gold-3d text-sm py-2 px-4">
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

/* -------------------- HERO -------------------- */
function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);

  return (
    <section ref={ref} className="relative px-6 lg:px-10 pt-12 pb-16 md:pt-20 md:pb-24">
      <motion.div style={{ opacity, y }} className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        {/* Left: copy */}
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-gold text-xs font-semibold mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            <span className="text-gold">AI-Powered · Bangla Support · Free Tier</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight"
          >
            Edit PDFs like
            <br />
            <span className="text-gradient-gold">Word & Excel</span>
            <br />
            <span className="text-text-secondary text-3xl md:text-4xl lg:text-5xl font-bold">
              right in your browser.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-xl text-lg text-text-secondary leading-relaxed"
          >
            The most powerful PDF editor for <span className="text-gold font-semibold">Bangla, English & multilingual</span> documents.
            Edit text, tables, scanned pages, and images — no installation, no friction.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap gap-4"
          >
            <Link to="/auth" className="btn-gold-3d group">
              <Upload className="w-5 h-5" />
              Start Editing Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#how-it-works" className="btn-glass">
              <Play className="w-4 h-4 text-gold" />
              Watch Demo
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center gap-6 text-sm text-text-tertiary"
          >
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-status-success" />
              No credit card
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-status-success" />
              Free forever plan
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-status-success" />
              Bangla & English
            </div>
          </motion.div>
        </div>

        {/* Right: 3D scene */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <HeroScene />
        </motion.div>
      </motion.div>
    </section>
  );
}

/* -------------------- LOGO TICKER -------------------- */
function LogoTickerSection() {
  const logos = ['Trusted by 50,000+ users', 'University of Dhaka', 'Bangladesh Bank', 'Robi', 'Grameenphone', 'BRAC', 'bKash'];
  return (
    <section className="relative py-8 border-y border-white/[0.04] overflow-hidden">
      <div className="flex items-center gap-12 animate-marquee whitespace-nowrap">
        {[...logos, ...logos].map((logo, i) => (
          <span key={i} className="text-text-tertiary text-sm font-medium uppercase tracking-widest">
            {logo}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </section>
  );
}

/* -------------------- FEATURES -------------------- */
const FEATURES: { icon: LucideIcon; title: string; desc: string; gradient: string }[] = [
  {
    icon: Languages,
    title: 'Bangla First',
    desc: 'Full Unicode support for Bangla, English, Arabic, Hindi with proper font shaping.',
    gradient: 'from-orange-500/20 to-red-500/20',
  },
  {
    icon: Edit3,
    title: 'Rich Text Editor',
    desc: 'Word-like editing with formatting, lists, headings, tables, headers & footers.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    icon: TableIcon,
    title: 'Smart Tables',
    desc: 'Auto-detect tables in PDFs. Edit, format, sort, and export as Excel.',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    icon: ImageIcon,
    title: 'OCR for Scans',
    desc: 'Extract editable text from scanned documents. Bangla & English supported.',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: Cloud,
    title: 'Cloud Sync',
    desc: 'Your documents auto-save and sync across devices. Access from anywhere.',
    gradient: 'from-indigo-500/20 to-blue-500/20',
  },
  {
    icon: Shield,
    title: 'Bank-Grade Security',
    desc: 'End-to-end encryption. Your documents never leave secure servers.',
    gradient: 'from-yellow-500/20 to-amber-500/20',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="relative px-6 lg:px-10 py-24 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Features"
          title="Everything you need to edit PDFs"
          subtitle="Built for the way you actually work — fast, multilingual, and beautiful."
        />

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="card-3d group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-16 pointer-events-none`} />
              <div className="relative">
                <div className="w-12 h-12 rounded-12 bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-gold/20 transition-transform duration-300">
                  <f.icon className="w-6 h-6 text-gold" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- SHOWCASE -------------------- */
function ShowcaseSection() {
  return (
    <section className="relative px-6 lg:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Built for power users"
          title="Three modes, one editor"
          subtitle="Switch seamlessly between PDF layout, document, and table editing."
        />

        <div className="mt-16 grid lg:grid-cols-3 gap-6">
          {[
            { icon: FileText, title: 'PDF Layout', desc: 'Edit text & images preserving exact PDF positioning.', color: 'gold' },
            { icon: Edit3, title: 'Document', desc: 'Flow-based Word-style editing with pagination.', color: 'blue-400' },
            { icon: TableIcon, title: 'Table', desc: 'Excel-style cell editing with formulas.', color: 'green-400' },
          ].map((mode, i) => (
            <motion.div
              key={mode.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative overflow-hidden rounded-24 bg-gradient-to-br from-app-panel to-app-elevated border border-white/[0.06] p-8 hover:border-gold/30 transition-all duration-500 group"
            >
              <div className="relative z-10">
                <mode.icon className="w-10 h-10 text-gold mb-4" />
                <h3 className="text-xl font-bold mb-2">{mode.title}</h3>
                <p className="text-text-secondary mb-6">{mode.desc}</p>
                <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-gold font-semibold group-hover:gap-2 transition-all">
                  Try now <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-gold/10 blur-2xl group-hover:bg-gold/20 transition-all duration-500" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- HOW IT WORKS -------------------- */
function HowItWorksSection() {
  const steps = [
    { num: '01', title: 'Upload your PDF', desc: 'Drag & drop any PDF — scanned, native, or password-protected.' },
    { num: '02', title: 'AI processes it', desc: 'OCR runs on scans, tables get auto-detected, fonts matched.' },
    { num: '03', title: 'Edit like a pro', desc: 'Word-style editing with full formatting & multilingual support.' },
    { num: '04', title: 'Export anywhere', desc: 'Save as PDF, DOCX, Excel, or share with a link.' },
  ];

  return (
    <section id="how-it-works" className="relative px-6 lg:px-10 py-24 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="How it works"
          title="From PDF to perfection in 4 steps"
          subtitle="No installation. No learning curve. Just upload and edit."
        />

        <div className="mt-16 relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative"
              >
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gold/20 rounded-full blur-xl animate-pulse-glow" />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-gold/30 to-gold/5 border-2 border-gold/40 flex items-center justify-center font-bold text-2xl text-gradient-gold">
                    {step.num}
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2 text-center">{step.title}</h3>
                <p className="text-sm text-text-secondary text-center">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------- PRICING PREVIEW -------------------- */
function PricingPreviewSection() {
  const plans = [
    { name: 'Free', price: '$0', period: '/forever', features: ['100 MB storage', '5 projects', 'Basic OCR', 'Bangla support'], highlight: false },
    { name: 'Pro', price: '$9', period: '/month', features: ['5 GB storage', 'Unlimited projects', 'Advanced OCR', 'Priority processing', 'Export to DOCX/XLSX'], highlight: true },
    { name: 'Business', price: '$29', period: '/month', features: ['100 GB storage', 'Team collaboration', 'API access', 'Custom branding', 'SLA support'], highlight: false },
  ];

  return (
    <section className="relative px-6 lg:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          subtitle="Start free, upgrade when you need more. Cancel anytime."
        />

        <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-24 p-8 ${
                plan.highlight
                  ? 'bg-gradient-to-br from-gold/20 via-gold/5 to-transparent border-2 border-gold shadow-gold-glow scale-105'
                  : 'glass'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-text-on-gold text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}
              <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                <span className="text-text-tertiary">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-gold flex-shrink-0" />
                    <span className="text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/pricing"
                className={plan.highlight ? 'btn-gold-3d w-full justify-center' : 'btn-glass w-full justify-center'}
              >
                {plan.name === 'Free' ? 'Get started' : 'Choose plan'}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- TESTIMONIALS -------------------- */
function TestimonialsSection() {
  const reviews = [
    { name: 'Rashed Ahmed', role: 'Lawyer', text: 'Finally a PDF editor that handles Bangla properly. Saves me hours every week.', rating: 5 },
    { name: 'Priya Sharma', role: 'Accountant', text: 'The table extraction is magical. I scan bank statements and they come out perfectly editable.', rating: 5 },
    { name: 'Dr. Karim', role: 'Researcher', text: 'OCR quality on old Bangla newspapers is the best I have ever used.', rating: 5 },
  ];

  return (
    <section id="testimonials" className="relative px-6 lg:px-10 py-24 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Testimonials"
          title="Loved by thousands"
          subtitle="From students to enterprises — see what our users say."
        />

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="card-3d"
            >
              <Quote className="w-8 h-8 text-gold/40 mb-4" />
              <p className="text-text-secondary mb-6 leading-relaxed">"{r.text}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-text-tertiary">{r.role}</div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-gold text-gold" />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- CTA -------------------- */
function CtaSection() {
  return (
    <section className="relative px-6 lg:px-10 py-24">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto relative overflow-hidden rounded-24 bg-gradient-to-br from-gold/20 via-gold/5 to-purple-500/10 border border-gold/30 p-12 md:p-20 text-center"
      >
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/20 blur-3xl rounded-full" />

        <div className="relative">
          <Sparkles className="w-12 h-12 text-gold mx-auto mb-6 animate-pulse-glow" />
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            Ready to transform your <span className="text-gradient-gold">PDF workflow?</span>
          </h2>
          <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto">
            Join 50,000+ professionals who edit PDFs the modern way.
            Free forever plan. No credit card required.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/auth" className="btn-gold-3d text-base px-8 py-4">
              <Upload className="w-5 h-5" />
              Start Editing Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/pricing" className="btn-glass text-base px-8 py-4">
              View Pricing
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* -------------------- FOOTER -------------------- */
function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gold" />
              <span className="font-bold text-shimmer">BornoOCR</span>
            </div>
            <p className="text-sm text-text-tertiary leading-relaxed">
              The most powerful PDF editor for Bangla & multilingual documents.
            </p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { label: 'Editor', to: '/editor' },
              { label: 'Pricing', to: '/pricing' },
              { label: 'Features', href: '#features' },
            ]}
          />

          <FooterColumn
            title="Company"
            links={[
              { label: 'About', href: '#' },
              { label: 'Help Center', to: '/help' },
              { label: 'Contact', href: 'mailto:support@banglai.cloud' },
            ]}
          />

          <FooterColumn
            title="Legal"
            links={[
              { label: 'Privacy', href: '#' },
              { label: 'Terms', href: '#' },
              { label: 'Security', href: '#' },
            ]}
          />
        </div>

        <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs text-text-tertiary">
            © {new Date().getFullYear()} BornoOCR. Made with ❤ in Bangladesh.
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-text-tertiary hover:text-gold transition-colors">
              <Github className="w-4 h-4" />
            </a>
            <a href="mailto:support@banglai.cloud" className="text-text-tertiary hover:text-gold transition-colors">
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; to?: string; href?: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-4">{title}</h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            {link.to ? (
              <Link to={link.to} className="text-sm text-text-tertiary hover:text-gold transition-colors">
                {link.label}
              </Link>
            ) : (
              <a href={link.href} className="text-sm text-text-tertiary hover:text-gold transition-colors">
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------- FAQ (AEO — visible Q&A for answer engines) -------------------- */
function FaqSection() {
  const faqs = [
    {
      q: 'Can I edit a PDF like a Word document?',
      a: 'Yes. BornoOCR converts your PDF into fully editable text blocks and tables, so you can edit it exactly like a Word document — change text, fonts, alignment, and layout directly in your browser.',
    },
    {
      q: 'Does BornoOCR support Bangla (Bengali) OCR?',
      a: 'Yes. BornoOCR has high-accuracy Bangla OCR with automatic post-correction for common Bangla character errors, plus support for English, Hindi, Sinhala, Tamil, and Arabic. It handles scanned Bangla documents, forms, and tables.',
    },
    {
      q: 'Can BornoOCR edit scanned PDFs?',
      a: 'Yes. BornoOCR uses hybrid OCR (PaddleOCR + Surya) to convert scanned PDFs into editable documents, preserving the original layout, tables, and formatting.',
    },
    {
      q: 'Can I extract tables from a PDF into Excel?',
      a: 'Yes. BornoOCR automatically detects tables in PDFs — including scanned ones — and converts them into editable spreadsheet-like tables with support for merged cells and headers. You can then export to DOCX or other formats.',
    },
    {
      q: 'Is BornoOCR free?',
      a: 'BornoOCR has a free plan with in-browser OCR editing. Paid plans add high-accuracy server-side OCR, document analysis, form field extraction, and priority processing.',
    },
    {
      q: 'Is my document data secure?',
      a: 'Yes. Free-plan OCR runs entirely in your browser — files never leave your device. Server-side processing uses encrypted transfer, strict access controls, and documents are not shared with third parties.',
    },
  ];

  return (
    <section id="faq" className="py-24 px-6 lg:px-10">
      <div className="max-w-3xl mx-auto">
        <SectionHeader
          eyebrow="FAQ"
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about editing PDFs with BornoOCR."
        />
        <div className="mt-12 space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="glass rounded-xl p-6"
            >
              <h3 className="text-base font-semibold text-text-primary mb-2">{faq.q}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- SHARED -------------------- */
function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="text-center max-w-3xl mx-auto"
    >
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-semibold text-gold uppercase tracking-widest mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
        {eyebrow}
      </div>
      <h2 className="text-3xl md:text-5xl font-extrabold mb-4">{title}</h2>
      <p className="text-lg text-text-secondary">{subtitle}</p>
    </motion.div>
  );
}
