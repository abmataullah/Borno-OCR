import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@state/auth-context';
import { api, type Plan } from '@api/client';
import { requestUpgrade } from '../../lib/upgrade';
import { FileText, Check, Loader2, ArrowLeft, CreditCard, Sparkles } from 'lucide-react';

const PROVIDERS = [
  { id: 'bkash', label: 'bKash', sub: 'BDT mobile' },
  { id: 'stripe', label: 'Stripe', sub: 'Cards, intl' },
  { id: 'sslcommerz', label: 'SSL Commerz', sub: 'BD payments' },
];

export function PricingPage() {
  const { user, isEmbed } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<string>('bkash');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    api.billing.plans()
      .then((data) => { setPlans(data.plans); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSubscribe(planId: string) {
    if (isEmbed) {
      requestUpgrade();
      return;
    }
    if (planId === 'free') { navigate('/dashboard'); return; }
    setProcessing(planId);
    try {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return;
      const currency = provider === 'stripe' ? 'USD' : 'BDT';
      const amount = currency === 'USD' ? plan.priceUsd : plan.priceBdt;
      const result = await api.billing.createPayment({
        provider, planId, amount, currency,
        returnUrl: `${window.location.origin}/dashboard`,
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      console.error('Payment failed:', err);
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-gold animate-spin" />
      </div>
    );
  }

  // If inside Banglai Cloud embed mode, show the unified central subscription view
  if (isEmbed) {
    const isPro = user?.plan === 'pro';
    return (
      <div className="min-h-screen bg-app-bg text-text-primary relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gold/10 blur-[120px] rounded-full" />
        </div>

        <header className="sticky top-0 z-40 backdrop-blur-xl bg-app-bg/70 border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gold" />
              <span className="font-bold text-shimmer">BornoOCR</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-16 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-semibold text-gold uppercase tracking-widest mb-4">
              <Sparkles className="w-3 h-3" /> Banglai Cloud Central Subscription
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
              BornoOCR <span className="text-gradient-gold">Pro</span>
            </h1>
            <p className="text-text-secondary text-base max-w-lg mx-auto">
              High-accuracy Bangla & English OCR with in-browser LibreOffice Word and Excel editing.
            </p>
          </motion.div>

          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-24 p-8 bg-gradient-to-br from-gold/20 via-gold/5 to-transparent border-2 border-gold shadow-gold-glow"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-text-on-gold text-xs font-bold px-4 py-1 rounded-full shadow-lg uppercase tracking-wider">
                {isPro ? 'CURRENT PLAN' : 'RECOMMENDED'}
              </div>

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-1">Pro Plan</h3>
                <p className="text-sm text-text-tertiary">All-in-one PDF & Document Suite</p>
                <div className="flex items-baseline justify-center gap-1 mt-4">
                  <span className="text-5xl font-extrabold text-gold">৳499</span>
                  <span className="text-text-tertiary">/month</span>
                </div>
                <p className="text-xs text-gold/80 mt-1">14-day free trial included</p>
              </div>

              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                  <span className="text-text-secondary">High-accuracy Bangla OCR (PaddleOCR + Surya)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                  <span className="text-text-secondary">Full Collabora Word (DOCX) & Excel (XLSX) editor</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                  <span className="text-text-secondary">Unlimited document conversions & storage</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                  <span className="text-text-secondary">Table detection, OCR post-correction, and form extraction</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                  <span className="text-text-secondary">Central bKash payment with instant admin approval</span>
                </li>
              </ul>

              {isPro ? (
                <div className="space-y-3">
                  <div className="w-full bg-gold/15 border border-gold/40 text-gold py-3 rounded-12 font-semibold text-center text-sm">
                    ✓ BornoOCR Pro Active
                  </div>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full btn-glass py-3 rounded-12 text-sm justify-center"
                  >
                    Go to Dashboard
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => requestUpgrade()}
                    className="w-full btn-gold-3d py-3.5 rounded-12 text-sm justify-center font-bold"
                  >
                    Upgrade via Banglai Cloud
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full text-center text-xs text-text-tertiary hover:text-text-secondary transition py-1"
                  >
                    Continue with Free Tier
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  // Standalone Pricing Page
  return (
    <div className="min-h-screen bg-app-bg text-text-primary relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gold/10 blur-[120px] rounded-full" />
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

      <main className="max-w-6xl mx-auto px-6 py-16 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-semibold text-gold uppercase tracking-widest mb-4">
            <Sparkles className="w-3 h-3" /> Simple Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
            Choose <span className="text-gradient-gold">Your Plan</span>
          </h1>
          <p className="text-text-secondary text-lg">Start free. Upgrade when you need more. Cancel anytime.</p>
        </motion.div>

        {/* Provider selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-10"
        >
          <span className="text-sm text-text-tertiary mr-2">Payment method:</span>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`group px-4 py-2 rounded-12 text-sm font-medium transition-all ${
                provider === p.id
                  ? 'bg-gold text-text-on-gold shadow-gold-glow'
                  : 'bg-app-panel/60 backdrop-blur border border-white/[0.08] text-text-secondary hover:border-gold/40 hover:text-text-primary'
              }`}
            >
              <span className="block">{p.label}</span>
              <span className={`block text-[10px] ${provider === p.id ? 'text-black/60' : 'text-text-tertiary'}`}>
                {p.sub}
              </span>
            </button>
          ))}
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => {
            const isCurrent = user?.plan === plan.id;
            const isPro = plan.id === 'pro';
            const price = provider === 'stripe' ? `$${plan.priceUsd}` : `৳${plan.priceBdt}`;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className={`relative rounded-24 p-8 ${
                  isPro
                    ? 'bg-gradient-to-br from-gold/20 via-gold/5 to-transparent border-2 border-gold shadow-gold-glow md:scale-105'
                    : 'glass'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-text-on-gold text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-text-tertiary mb-4">
                  {plan.id === 'free' && 'Best for trying out'}
                  {plan.id === 'pro' && 'For professionals'}
                  {plan.id === 'business' && 'For teams & enterprises'}
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-extrabold">{price}</span>
                  <span className="text-text-tertiary">/mo</span>
                </div>

                <ul className="space-y-3 mb-8 min-h-[180px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                      <span className="text-text-secondary">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrent || processing === plan.id}
                  className={`w-full ${
                    isCurrent
                      ? 'bg-app-elevated/50 border border-white/[0.08] text-text-tertiary py-3 rounded-12 font-semibold cursor-not-allowed'
                      : isPro
                      ? 'btn-gold-3d w-full justify-center'
                      : 'btn-glass w-full justify-center'
                  } flex items-center justify-center gap-2`}
                >
                  {processing === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : plan.id === 'free' ? (
                    'Get Started Free'
                  ) : (
                    <><CreditCard className="h-4 w-4" /> Subscribe</>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="glass rounded-16 p-6 text-center">
            <h3 className="font-semibold text-base mb-2">Need a custom plan?</h3>
            <p className="text-sm text-text-secondary mb-4">
              For larger teams or enterprise needs, contact us for custom pricing & dedicated support.
            </p>
            <a
              href="mailto:support@banglai.cloud"
              className="inline-flex items-center gap-2 text-sm text-gold font-semibold hover:underline"
            >
              <CreditCard className="h-4 w-4" /> Contact Sales
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
