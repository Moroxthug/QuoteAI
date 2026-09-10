import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // Video fades in strongly
      setTimeout(() => setPhase(2), 1500),  // Skeleton paths start drawing
      setTimeout(() => setPhase(3), 2500),  // Elements populate
      setTimeout(() => setPhase(4), 7000),  // Exit prep
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-slate-900 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Background AI Video */}
      <motion.video
        src={`${import.meta.env.BASE_URL}videos/ai-particles.mp4`}
        className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-80"
        autoPlay muted loop playsInline
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.8 }}
        transition={{ duration: 2, ease: "easeOut" }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-slate-900/10" />

      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <motion.h2 
          className="absolute top-[15%] text-[4.5vw] font-black tracking-tighter text-white"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          L'AI genera il preventivo.
        </motion.h2>

        {/* Abstract Document Skeleton Assembly */}
        <div className="w-[50vw] h-[60vh] mt-16 relative">
          <svg width="100%" height="100%" viewBox="0 0 500 600" className="absolute inset-0 overflow-visible">
            {/* Header rect */}
            <motion.rect
              x="50" y="50" width="400" height="80" rx="8"
              fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={phase >= 2 ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
            {/* Line items */}
            {[0, 1, 2, 3].map((i) => (
              <motion.g key={i}>
                <motion.rect
                  x="50" y={160 + i * 80} width="400" height="60" rx="4"
                  fill="none" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="2"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={phase >= 2 ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  transition={{ duration: 1, delay: 0.5 + i * 0.2, ease: "easeInOut" }}
                />
                <motion.line
                  x1="70" y1={190 + i * 80} x2="300" y2={190 + i * 80}
                  stroke="rgba(255,255,255,0.5)" strokeWidth="8" strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={phase >= 3 ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{ duration: 0.8, delay: 1 + i * 0.2 }}
                />
                <motion.line
                  x1="350" y1={190 + i * 80} x2="430" y2={190 + i * 80}
                  stroke="rgba(6, 182, 212, 0.6)" strokeWidth="8" strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={phase >= 3 ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{ duration: 0.8, delay: 1.2 + i * 0.2 }}
                />
              </motion.g>
            ))}
            
            {/* Total */}
            <motion.rect
              x="250" y="500" width="200" height="50" rx="4"
              fill="rgba(79, 70, 229, 0.2)" stroke="rgba(79, 70, 229, 0.8)" strokeWidth="2"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={phase >= 3 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.8, delay: 2.2, type: 'spring' }}
            />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
