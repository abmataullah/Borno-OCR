import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, ChevronDown, ChevronRight, ArrowLeft,
  Upload, Edit3, Languages, Table as TableIcon, Image as ImageIcon,
  Download, Share2, CreditCard, Shield, Sparkles, BookOpen, Play, Mail,
  Zap, HelpCircle, Lightbulb,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
  category: string;
}

interface Tutorial {
  icon: LucideIcon;
  title: string;
  desc: string;
  steps: string[];
  duration: string;
}

const TUTORIALS: Tutorial[] = [
  {
    icon: Upload,
    title: 'Upload your first PDF',
    desc: 'Learn how to import any PDF into BornoOCR.',
    duration: '2 min',
    steps: [
      'Sign in to your account and click "+ New Project" on the dashboard.',
      'Click the upload zone in the editor, or drag your PDF file directly onto it.',
      'Wait for the file to be processed (scanned PDFs run OCR automatically).',
      'Once processed, you\'ll see all pages in the sidebar. Click any page to start editing.',
    ],
  },
  {
    icon: Edit3,
    title: 'Edit text like Word',
    desc: 'Use the rich text editor with full formatting.',
    duration: '3 min',
    steps: [
      'Switch to "Document Mode" using the mode selector at the top.',
      'Click any text to start editing. Use the ribbon toolbar for formatting.',
      'Apply bold (Ctrl+B), italic (Ctrl+I), underline (Ctrl+U), or strikethrough (Ctrl+S).',
      'Use the heading dropdown to apply H1/H2/H3 styles. Lists work via the toolbar.',
      'Save by clicking Ctrl+S — changes are auto-synced to the cloud.',
    ],
  },
  {
    icon: Languages,
    title: 'Bangla & multilingual editing',
    desc: 'Type in Bangla, English, Arabic — with correct font shaping.',
    duration: '2 min',
    steps: [
      'Switch your keyboard to Bangla input mode (Avro/Unicode IME).',
      'Type directly in any text block — BornoOCR auto-detects script and applies appropriate font.',
      'Use the Font dropdown to select Noto Sans Bengali, Siyam Rupali, Kalpurush, or SolaimanLipi.',
      'Mix Bangla and English freely in the same line. Diacritics and conjuncts render correctly.',
    ],
  },
  {
    icon: TableIcon,
    title: 'Edit tables from scanned PDFs',
    desc: 'Auto-detected tables become editable Excel-like cells.',
    duration: '3 min',
    steps: [
      'Upload a PDF that contains tables. The Python worker auto-detects them.',
      'Switch to "Table Mode" to see all detected tables on the current page.',
      'Click a cell to edit. Press Tab/Enter to move between cells.',
      'Right-click a row or column to add/delete or change alignment.',
      'Export the table as XLSX using the export button.',
    ],
  },
  {
    icon: ImageIcon,
    title: 'OCR scanned documents',
    desc: 'Make scanned PDFs editable with Tesseract OCR.',
    duration: '2 min',
    steps: [
      'When you upload a scanned PDF, OCR runs automatically in the background.',
      'Watch the job progress in the bottom-right notification.',
      'Once OCR completes, the extracted text becomes editable text blocks overlaid on the image.',
      'Use the OCR Correction panel to review low-confidence words (shown highlighted).',
      'Bangla OCR supports both modern and older newspaper-era texts.',
    ],
  },
  {
    icon: Download,
    title: 'Export to PDF, DOCX, or Excel',
    desc: 'Save your work in any format.',
    duration: '1 min',
    steps: [
      'Click "Export" in the top-right corner of the editor.',
      'Choose your format: PDF (default), DOCX (Word), or XLSX (Excel — tables only).',
      'The conversion happens server-side via LibreOffice for high fidelity.',
      'Download the file once the job completes (typically 5-30 seconds).',
    ],
  },
  {
    icon: Share2,
    title: 'Share your documents',
    desc: 'Generate a public link to share read-only.',
    duration: '1 min',
    steps: [
      'On the dashboard, hover over a project card and click the Share icon.',
      'A public share link is copied to your clipboard automatically.',
      'Recipients can view the document without an account — pages render in their browser.',
      'You can disable sharing anytime by clicking the share icon again.',
    ],
  },
  {
    icon: CreditCard,
    title: 'Upgrade & manage billing',
    desc: 'Choose a plan and pay via bKash, SSL Commerz, or Stripe.',
    duration: '2 min',
    steps: [
      'Click "Upgrade" in the dashboard header or visit the Pricing page.',
      'Select your preferred payment method: Stripe (cards), bKash, or SSL Commerz.',
      'Choose your plan (Pro for individuals, Business for teams).',
      'Click Subscribe — you\'ll be redirected to the payment gateway.',
      'After payment, you return to the dashboard with the plan active.',
    ],
  },
];

const FAQS: FaqItem[] = [
  {
    category: 'Getting Started',
    q: 'Do I need to install anything?',
    a: 'No. BornoOCR runs entirely in your browser. As long as you have a modern browser (Chrome, Edge, Firefox, Safari), you can edit PDFs without installing any software.',
  },
  {
    category: 'Getting Started',
    q: 'Is there a free plan?',
    a: 'Yes! The Free plan includes 100 MB of storage, up to 5 projects, basic OCR, and full Bangla support. Perfect for trying out the product or light personal use.',
  },
  {
    category: 'Getting Started',
    q: 'How do I sign in?',
    a: 'We use passwordless login. Enter your email, and we\'ll send a 6-digit code. Enter the code and you\'re in. No passwords to remember.',
  },
  {
    category: 'Editing',
    q: 'Can I edit scanned PDFs?',
    a: 'Yes. When you upload a scanned PDF, OCR runs automatically. The extracted text becomes editable, overlaid on the original page image. We support Bangla and English OCR.',
  },
  {
    category: 'Editing',
    q: 'Does Bangla work properly?',
    a: 'Absolutely — Bangla is a first-class citizen in BornoOCR. We support Noto Sans Bengali, Siyam Rupali, Kalpurush, and SolaimanLipi fonts with full Unicode shaping (conjuncts, diacritics, vowel signs).',
  },
  {
    category: 'Editing',
    q: 'Can I edit tables?',
    a: 'Yes! Tables are auto-detected via pdfplumber + camelot. Switch to Table Mode to edit cells, add/delete rows/columns, and export as Excel.',
  },
  {
    category: 'Pricing & Plans',
    q: 'How do I pay from Bangladesh?',
    a: 'We support bKash, SSL Commerz, and cards via Stripe. Choose your preferred method on the Pricing page. We also support manual payments — contact us if you need custom arrangements.',
  },
  {
    category: 'Pricing & Plans',
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel anytime from your dashboard. You\'ll keep your subscription benefits until the end of the current billing period.',
  },
  {
    category: 'Pricing & Plans',
    q: 'What happens to my files if I downgrade?',
    a: 'Your files stay intact. If you exceed the new plan\'s storage limit, you won\'t be able to upload new files until you free up space or upgrade again.',
  },
  {
    category: 'Security & Privacy',
    q: 'Are my documents secure?',
    a: 'Yes. All documents are encrypted in transit (HTTPS) and at rest. Only you (and people you explicitly share with) can access your files. We never train AI models on your data.',
  },
  {
    category: 'Security & Privacy',
    q: 'Where is my data stored?',
    a: 'Data is stored on secure cloud servers. You can request data export or deletion anytime — we comply with privacy best practices.',
  },
  {
    category: 'Troubleshooting',
    q: 'My OTP code isn\'t arriving',
    a: 'Check your spam/junk folder. The code expires in 10 minutes. If still missing, try the resend option or contact support@banglai.cloud.',
  },
  {
    category: 'Troubleshooting',
    q: 'Export is stuck on "processing"',
    a: 'Exports can take 5-60 seconds depending on document size and complexity. If it\'s been over 2 minutes, refresh the page — the job continues in the background.',
  },
  {
    category: 'Troubleshooting',
    q: 'Some text looks garbled after OCR',
    a: 'OCR isn\'t perfect on low-quality scans. Use the OCR Correction panel to manually fix words. Higher-quality scans (300+ DPI) yield much better accuracy.',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: BookOpen },
  { id: 'Getting Started', label: 'Getting Started', icon: Sparkles },
  { id: 'Editing', label: 'Editing', icon: Edit3 },
  { id: 'Pricing & Plans', label: 'Pricing & Plans', icon: CreditCard },
  { id: 'Security & Privacy', label: 'Security & Privacy', icon: Shield },
  { id: 'Troubleshooting', label: 'Troubleshooting', icon: Zap },
];

export function HelpPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openTut, setOpenTut] = useState<number | null>(0);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((f) => {
      const matchesSearch =
        !search ||
        f.q.toLowerCase().includes(search.toLowerCase()) ||
        f.a.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' || f.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [search, category]);

  return (
    <div className="min-h-screen bg-app-bg text-text-primary relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-app-bg/70 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gold" />
            <span className="font-bold text-shimmer">BornoOCR</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 relative">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-semibold text-gold uppercase tracking-widest mb-4">
            <HelpCircle className="w-3 h-3" /> Help Center
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
            How can we <span className="text-gradient-gold">help you?</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Tutorials, guides, and answers to common questions. Browse below or search.
          </p>

          {/* Search */}
          <div className="relative max-w-xl mx-auto mt-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for tutorials, features, troubleshooting..."
              className="w-full pl-12 pr-4 py-4 bg-app-panel/60 backdrop-blur-xl border border-white/[0.08] rounded-16 text-base focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] transition-all"
            />
          </div>
        </motion.div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-12 text-sm font-medium transition-all ${
                category === c.id
                  ? 'bg-gold text-text-on-gold shadow-gold-glow'
                  : 'bg-app-panel/60 backdrop-blur border border-white/[0.08] text-text-secondary hover:border-gold/40 hover:text-text-primary'
              }`}
            >
              <c.icon className="h-4 w-4" />
              {c.label}
            </button>
          ))}
        </div>

        {/* Tutorials section */}
        {category === 'all' && !search && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <Play className="h-5 w-5 text-gold" />
              <h2 className="text-2xl font-bold">Quick Start Tutorials</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {TUTORIALS.map((t, i) => (
                <motion.div
                  key={t.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-16 overflow-hidden hover:border-gold/30 transition-all"
                >
                  <button
                    onClick={() => setOpenTut(openTut === i ? null : i)}
                    className="w-full p-5 text-left flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-12 bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <t.icon className="h-5 w-5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold">{t.title}</h3>
                        <span className="text-xs text-text-tertiary whitespace-nowrap flex items-center gap-1">
                          <Play className="h-3 w-3" /> {t.duration}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">{t.desc}</p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-text-tertiary transition-transform ${
                        openTut === i ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openTut === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/[0.06]"
                      >
                        <ol className="p-5 space-y-3">
                          {t.steps.map((step, idx) => (
                            <li key={idx} className="flex gap-3 text-sm">
                              <span className="w-6 h-6 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-text-secondary pt-0.5">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* FAQ section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Lightbulb className="h-5 w-5 text-gold" />
            <h2 className="text-2xl font-bold">
              {search ? `Results for "${search}"` : 'Frequently Asked Questions'}
            </h2>
            <span className="text-sm text-text-tertiary">({filteredFaqs.length})</span>
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="text-center py-16 glass rounded-16">
              <Search className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary">No results found. Try a different search term.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFaqs.map((faq, i) => (
                <div
                  key={i}
                  className="bg-app-panel/60 backdrop-blur-xl border border-white/[0.06] rounded-12 overflow-hidden hover:border-gold/20 transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronRight
                        className={`h-4 w-4 text-gold transition-transform flex-shrink-0 ${
                          openFaq === i ? 'rotate-90' : ''
                        }`}
                      />
                      <span className="font-medium text-sm">{faq.q}</span>
                    </div>
                    <span className="text-[10px] text-text-tertiary uppercase tracking-wider whitespace-nowrap">
                      {faq.category}
                    </span>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 pl-12 text-sm text-text-secondary leading-relaxed">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 relative overflow-hidden rounded-24 bg-gradient-to-br from-gold/20 via-gold/5 to-purple-500/10 border border-gold/30 p-8 md:p-12 text-center"
        >
          <Mail className="w-10 h-10 text-gold mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Still need help?</h3>
          <p className="text-text-secondary mb-6">
            Our support team typically replies within a few hours.
          </p>
          <a href="mailto:support@banglai.cloud" className="btn-gold-3d">
            <Mail className="h-4 w-4" /> Contact Support
          </a>
        </motion.div>
      </main>
    </div>
  );
}
