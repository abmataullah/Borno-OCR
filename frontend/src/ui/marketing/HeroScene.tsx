import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { FileText, Image as ImageIcon, Table as TableIcon, Type, Languages, Sparkles } from 'lucide-react';

/**
 * HeroScene — 3D-feeling animated hero illustration.
 * Uses CSS 3D transforms + framer-motion (no WebGL — keeps bundle small).
 *
 * Layers:
 * - Floating document stack (parallax tilt with mouse)
 * - Orbiting feature pills around the main doc
 * - Glow + grid background
 */
export function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 80, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 80, damping: 20 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handle = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      mx.set(px);
      my.set(py);
    };
    const reset = () => {
      mx.set(0);
      my.set(0);
    };
    el.addEventListener('mousemove', handle);
    el.addEventListener('mouseleave', reset);
    return () => {
      el.removeEventListener('mousemove', handle);
      el.removeEventListener('mouseleave', reset);
    };
  }, [mx, my]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[480px] md:h-[560px] perspective-1000"
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />

      {/* Floating 3D stack */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center preserve-3d"
        style={{ rotateX: rx, rotateY: ry }}
      >
        {/* Back card (Table) */}
        <motion.div
          className="absolute w-56 md:w-64 h-72 md:h-80 rounded-16 glass shadow-2xl preserve-3d overflow-hidden"
          style={{ translateZ: -80, translateX: -110, translateY: 30 }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="h-8 bg-gradient-to-r from-gold/30 to-gold/10 border-b border-gold/20 flex items-center px-3 gap-1">
            <span className="w-2 h-2 rounded-full bg-status-danger/70" />
            <span className="w-2 h-2 rounded-full bg-status-warning/70" />
            <span className="w-2 h-2 rounded-full bg-status-success/70" />
            <span className="ml-2 text-[10px] text-text-tertiary font-mono">budget.pdf</span>
          </div>
          <div className="p-3 grid grid-cols-3 gap-1">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className={`h-4 rounded-sm ${i % 3 === 0 ? 'bg-gold/40' : 'bg-white/10'}`}
              />
            ))}
          </div>
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-2 bg-white/10 rounded-sm" style={{ width: `${60 + i * 8}%` }} />
            ))}
          </div>
        </motion.div>

        {/* Right card (Image/scanned) */}
        <motion.div
          className="absolute w-56 md:w-64 h-72 md:h-80 rounded-16 glass shadow-2xl preserve-3d overflow-hidden"
          style={{ translateZ: -40, translateX: 120, translateY: 50 }}
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        >
          <div className="h-8 bg-gradient-to-r from-blue-500/20 to-purple-500/10 border-b border-white/10 flex items-center px-3 gap-1">
            <span className="w-2 h-2 rounded-full bg-status-danger/70" />
            <span className="w-2 h-2 rounded-full bg-status-warning/70" />
            <span className="w-2 h-2 rounded-full bg-status-success/70" />
            <span className="ml-2 text-[10px] text-text-tertiary font-mono">scan.pdf</span>
          </div>
          <div className="p-3">
            <div className="aspect-video rounded-8 bg-gradient-to-br from-gold/20 via-white/5 to-blue-500/20 mb-3 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gold/60" />
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-white/15 rounded-sm w-full" />
              <div className="h-2 bg-white/15 rounded-sm w-4/5" />
              <div className="h-2 bg-white/15 rounded-sm w-3/5" />
              <div className="h-2 bg-gold/40 rounded-sm w-2/3" />
            </div>
          </div>
        </motion.div>

        {/* Front card (Main document) */}
        <motion.div
          className="relative w-64 md:w-80 h-80 md:h-96 rounded-16 bg-gradient-to-br from-app-panel via-app-elevated to-app-panel border border-gold/30 shadow-gold-glow-lg preserve-3d overflow-hidden"
          style={{ translateZ: 0 }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="h-9 bg-gradient-to-r from-gold via-yellow-300 to-gold bg-[length:200%_100%] animate-gradient-x flex items-center px-3 gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-black/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-black/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-black/30" />
            <span className="ml-2 text-[11px] text-black/80 font-semibold">BornoOCR Editor</span>
            <Sparkles className="w-3 h-3 text-black/70 ml-auto" />
          </div>
          <div className="p-5">
            <div className="text-[10px] text-gold/80 font-semibold mb-2 tracking-widest">CHAPTER 1</div>
            <div className="h-3 bg-gradient-to-r from-text-primary via-text-primary to-text-primary/40 rounded-sm w-5/6 mb-3" />
            <div className="space-y-2 mb-4">
              <div className="h-2 bg-white/20 rounded-sm" />
              <div className="h-2 bg-white/20 rounded-sm w-11/12" />
              <div className="h-2 bg-white/20 rounded-sm w-4/5" />
            </div>
            <div className="bg-gold/10 border-l-2 border-gold rounded-r-4 p-2 mb-3">
              <div className="h-2 bg-gold/50 rounded-sm w-3/4 mb-1" />
              <div className="h-2 bg-gold/30 rounded-sm w-1/2" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-2 bg-white/15 rounded-sm" />
              <div className="h-2 bg-white/15 rounded-sm w-5/6" />
            </div>
            {/* Bengali line */}
            <div className="font-bengali text-xs text-text-primary/80 mt-2 leading-snug">
              বাংলা ফন্ট সাপোর্ট সহ পিডিএফ এডিটর
            </div>
          </div>
          {/* Animated cursor */}
          <motion.div
            className="absolute w-0.5 h-4 bg-gold"
            style={{ left: '45%', top: '52%' }}
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </motion.div>

        {/* Orbiting feature pills */}
        <OrbitPill icon={Type} label="Edit Text" delay={0} radius={220} duration={20} />
        <OrbitPill icon={TableIcon} label="Tables" delay={5} radius={220} duration={20} />
        <OrbitPill icon={Languages} label="Bangla" delay={10} radius={220} duration={20} />
        <OrbitPill icon={FileText} label="OCR" delay={15} radius={220} duration={20} />
      </motion.div>

      {/* Decorative orbs */}
      <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-gold/20 blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-purple-500/10 blur-3xl animate-float-slow" />
    </div>
  );
}

function OrbitPill({
  icon: Icon,
  label,
  delay,
  radius,
  duration,
}: {
  icon: typeof FileText;
  label: string;
  delay: number;
  radius: number;
  duration: number;
}) {
  return (
    <motion.div
      className="absolute"
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: 'linear', delay: -delay }}
      style={{ width: radius * 2, height: radius * 2 }}
    >
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-gold text-xs font-semibold text-gold shadow-gold-glow"
        animate={{ rotate: -360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear', delay: -delay }}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </motion.div>
    </motion.div>
  );
}
