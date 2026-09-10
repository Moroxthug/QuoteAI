import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // Image pan starts
      setTimeout(() => setPhase(2), 1500),  // Red slash
      setTimeout(() => setPhase(3), 2000),  // Text 1
      setTimeout(() => setPhase(4), 3000),  // Text 2
      setTimeout(() => setPhase(5), 7000),  // Exit prep
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Background Image */}
      <motion.img 
        src={`${import.meta.env.BASE_URL}images/craftsman-workbench.png`}
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        initial={{ scale: 1.1, x: 0 }}
        animate={{ scale: 1.2, x: '-5%' }}
        transition={{ duration: 10, ease: 'linear' }}
      />

      {/* Dark vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

      {/* Content Container */}
      <div className="relative z-10 w-[80vw] h-full flex flex-col justify-center">
        {/* Visual metaphor: Red slash crossing out "handwritten notes" */}
        <div className="absolute top-[35%] left-0 w-full h-[40vh]">
          <motion.div 
            className="absolute top-1/2 left-0 h-[8px] bg-red-500 rounded-full"
            style={{ transformOrigin: 'left center', rotate: -5 }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={phase >= 2 ? { scaleX: 1, opacity: 0.8 } : { scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.87, 0, 0.13, 1] }}
          />
          <motion.div 
            className="absolute top-[55%] left-[10%] h-[6px] bg-red-500/80 rounded-full"
            style={{ transformOrigin: 'left center', rotate: 2 }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={phase >= 2 ? { scaleX: 0.8, opacity: 0.6 } : { scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.87, 0, 0.13, 1] }}
          />
        </div>

        <div className="relative z-20">
          <motion.p
            className="text-[6vw] font-black tracking-tighter text-white leading-[1.1] max-w-[60vw]"
            initial={{ y: 50, opacity: 0, filter: 'blur(10px)' }}
            animate={phase >= 3 ? { y: 0, opacity: 1, filter: 'blur(0px)' } : { y: 50, opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Fare preventivi.
          </motion.p>

          <motion.p
            className="text-[4vw] font-bold tracking-tight text-white/70 leading-[1.2] mt-4 max-w-[60vw]"
            initial={{ y: 30, opacity: 0, filter: 'blur(10px)' }}
            animate={phase >= 4 ? { y: 0, opacity: 1, filter: 'blur(0px)' } : { y: 30, opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Il lavoro che nessuno vuole fare.
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
