import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // Logo scales up
      setTimeout(() => setPhase(2), 2000),  // Tagline
      setTimeout(() => setPhase(3), 3500),  // URL
      setTimeout(() => setPhase(4), 8000),  // Exit prep (loop back)
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-white"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}quoteai-logo.png`}
        className="w-[25vw] max-w-[400px] h-auto object-contain z-10"
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.8, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      />

      <motion.div 
        className="text-[2vw] font-bold text-slate-600 mt-8 z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        Il preventivo professionale in 60 secondi.
      </motion.div>

      <motion.div 
        className="text-[3vw] font-black gradient-text mt-12 z-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        transition={{ duration: 1, type: 'spring', stiffness: 100 }}
      >
        quoteai.ca
      </motion.div>
    </motion.div>
  );
}
