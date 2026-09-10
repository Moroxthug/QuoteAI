import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const FULL_TEXT = "Ristrutturazione bagno 8mq: rimozione rivestimenti, nuova piastrellatura, sostituzione sanitari e rubinetteria, box doccia nuovo.";

export function Scene2() {
  const [phase, setPhase] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [photoAttached, setPhotoAttached] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),   // card appears
      setTimeout(() => setPhase(2), 1400),  // typing starts
      setTimeout(() => setPhase(3), 7200),  // photo button pulse highlight
      setTimeout(() => setPhotoAttached(true), 7600), // photo attaches
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (phase < 2) return;
    if (charCount >= FULL_TEXT.length) return;
    const id = setTimeout(() => setCharCount(c => c + 1), 38);
    return () => clearTimeout(id);
  }, [phase, charCount]);

  const displayText = FULL_TEXT.slice(0, charCount);
  const hasText = charCount > 0;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 0.96, filter: 'blur(12px)' }}
      transition={{ duration: 1.1, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Headline */}
      <motion.div
        className="absolute top-[12%] text-center w-full px-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.5 }}
      >
        <h2 className="text-[3.6vw] font-black tracking-tighter text-slate-900">
          Descrivi il lavoro.{' '}
          <span className="gradient-text">In italiano.</span>
        </h2>
      </motion.div>

      {/* App card — faithful recreation of the real new.tsx UI */}
      <motion.div
        className="w-[62vw] flex flex-col gap-3 mt-6"
        initial={{ y: 80, opacity: 0 }}
        animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22, delay: 0.1 }}
      >
        {/* Tab switcher */}
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ background: '#f3f4f6' }}
        >
          {/* AI tab — active */}
          <div
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg"
            style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            {/* Bot icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"/>
              <circle cx="12" cy="5" r="2"/>
              <path d="M12 7v4"/>
              <line x1="8" y1="16" x2="8" y2="16"/>
              <line x1="16" y1="16" x2="16" y2="16"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: '#7C3AED' }}>Genera con AI</span>
          </div>
          {/* Manual tab */}
          <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: '#9ca3af' }}>Manuale</span>
          </div>
        </div>

        {/* AI bar card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          {/* Photo thumbnail strip — appears when photo attached */}
          {photoAttached && (
            <motion.div
              className="px-3 pt-3 pb-3 flex gap-2"
              style={{ borderBottom: '1px solid #f3f4f6' }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="w-14 h-14 rounded-lg overflow-hidden relative shrink-0"
                style={{ border: '1px solid #e5e7eb', background: '#f8fafc' }}
              >
                {/* Simulated construction photo thumbnail */}
                <div className="w-full h-full" style={{
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)'
                }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              </div>
            </motion.div>
          )}

          {/* Input bar row */}
          <div className="flex items-center gap-2 px-3 py-3">
            {/* ImagePlus button */}
            <motion.div
              className="h-8 w-8 flex items-center justify-center rounded-xl shrink-0 cursor-pointer"
              style={{
                background: photoAttached ? '#ede9fe' : 'transparent',
                color: photoAttached ? '#7C3AED' : '#9ca3af',
              }}
              animate={phase === 3 && !photoAttached ? {
                scale: [1, 1.2, 1, 1.15, 1],
                background: ['transparent', '#ede9fe', 'transparent', '#ede9fe', '#ede9fe'],
              } : {}}
              transition={{ duration: 0.6 }}
            >
              {/* ImagePlus icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
                <line x1="16" y1="5" x2="22" y2="5"/>
                <line x1="19" y1="2" x2="19" y2="8"/>
              </svg>
            </motion.div>

            {/* Sparkles icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>

            {/* Text input */}
            <div className="flex-1 relative">
              <span
                className="text-sm text-gray-800"
                style={{ lineHeight: '1.5', minHeight: '1.5em', display: 'block' }}
              >
                {displayText}
                {phase >= 1 && charCount < FULL_TEXT.length && (
                  <motion.span
                    style={{ display: 'inline-block', width: 2, height: '1em', background: '#7C3AED', marginLeft: 1, verticalAlign: 'middle', borderRadius: 1 }}
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
                {!hasText && phase >= 1 && (
                  <span style={{ color: '#9ca3af' }}>
                    Descrivi il lavoro e ottieni un preventivo in 30 secondi...
                    <motion.span
                      style={{ display: 'inline-block', width: 2, height: '1em', background: '#7C3AED', marginLeft: 1, verticalAlign: 'middle', borderRadius: 1 }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  </span>
                )}
              </span>
            </div>

            {/* Mic button — gray disabled */}
            <div
              className="h-8 w-8 flex items-center justify-center rounded-xl shrink-0"
              style={{ color: '#d1d5db', cursor: 'not-allowed' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>

            {/* Send button — gradient circle when has text */}
            <motion.div
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: hasText
                  ? 'linear-gradient(135deg, #7C3AED, #4F46E5, #06B6D4)'
                  : '#f3f4f6',
                boxShadow: hasText ? '0 2px 12px rgba(124,58,237,0.35)' : 'none',
              }}
              animate={hasText ? {
                boxShadow: [
                  '0 2px 12px rgba(124,58,237,0.35)',
                  '0 4px 24px rgba(124,58,237,0.6)',
                  '0 2px 12px rgba(124,58,237,0.35)',
                ]
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasText ? '#fff' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </motion.div>
          </div>

          {/* Example chips */}
          <div className="px-3 pb-3" style={{ borderTop: '1px solid #f9fafb', paddingTop: 10 }}>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>Es:</span>
              {['Imbianchino', 'Elettricista', 'Idraulico', 'Ristrutturazione', 'Muratore'].map((label, i) => (
                <motion.div
                  key={label}
                  className="rounded-full"
                  style={{
                    fontSize: 12,
                    padding: '4px 12px',
                    border: '1px solid #e5e7eb',
                    color: '#4b5563',
                    background: '#fff',
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.8 + i * 0.07 }}
                >
                  {label}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Committente panel */}
        <motion.div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.9 }}
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f9fafb' }}>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Committente</span>
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>opzionale</span>
          </div>
          <div className="px-4 py-3">
            <div
              className="w-full rounded-xl flex items-center justify-center"
              style={{
                padding: '10px 0',
                border: '1px dashed #e5e7eb',
                fontSize: 12,
                color: '#9ca3af',
              }}
            >
              + Aggiungi dati committente
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
