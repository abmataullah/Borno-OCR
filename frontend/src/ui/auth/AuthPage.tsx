import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@state/auth-context';
import { api } from '@api/client';
import { FileText, Mail, ArrowRight, Loader2, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

export function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.auth.requestOtp(email);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.auth.verifyOtp(email, code, name || undefined);
      login(result.token, result.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-text-primary relative overflow-hidden flex items-center justify-center px-4">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gold/10 blur-[120px] rounded-full animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <Link to="/" className="flex items-center gap-2 justify-center mb-8 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gold blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
            <FileText className="h-8 w-8 text-gold relative" />
          </div>
          <span className="text-2xl font-bold text-shimmer">BornoOCR</span>
        </Link>

        <div className="glass rounded-24 p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 'request' ? (
              <motion.form
                key="request"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleRequestOtp}
                className="space-y-5"
              >
                <div>
                  <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
                  <p className="text-sm text-text-secondary">
                    Enter your email — we'll send you a one-time code.
                  </p>
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 py-3.5 bg-app-elevated/60 border border-white/10 rounded-12 text-text-primary placeholder-text-tertiary focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] transition-all"
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/30 rounded-8 px-3 py-2"
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="btn-gold-3d w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Continue <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>

                <div className="flex items-center gap-2 text-xs text-text-tertiary pt-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-gold" />
                  We never share your email. No password needed.
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOtp}
                className="space-y-5"
              >
                <div>
                  <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-gold" />
                    Check your inbox
                  </h1>
                  <p className="text-sm text-text-secondary">
                    We sent a 6-digit code to{' '}
                    <span className="text-gold font-semibold">{email}</span>
                  </p>
                </div>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full px-4 py-3 bg-app-elevated/60 border border-white/10 rounded-12 text-text-primary placeholder-text-tertiary focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] transition-all"
                />

                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  required
                  className="w-full px-4 py-4 bg-app-elevated/60 border border-white/10 rounded-12 text-text-primary text-center text-3xl font-mono tracking-[0.5em] placeholder-text-tertiary focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] transition-all"
                />

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/30 rounded-8 px-3 py-2"
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="btn-gold-3d w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setCode('');
                    setError('');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Use a different email
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-6">
          By signing in, you agree to our{' '}
          <a href="#" className="text-gold hover:underline">Terms</a> and{' '}
          <a href="#" className="text-gold hover:underline">Privacy Policy</a>.
        </p>
      </motion.div>
    </div>
  );
}
