import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './Scene1';
import { Scene2 } from './Scene2';
import { Scene3 } from './Scene3';
import { Scene4 } from './Scene4';
import { Scene5 } from './Scene5';

export const SCENE_DURATIONS: Record<string, number> = {
  hook: 8000,
  product: 10000,
  aiMagic: 8000,
  quote: 10000,
  outro: 9000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  hook: Scene1,
  product: Scene2,
  aiMagic: Scene3,
  quote: Scene4,
  outro: Scene5,
};

const orbState = [
  { x: '80vw', y: '10vh', scale: 0.5, opacity: 0.2, filter: 'blur(60px)' },
  { x: '50vw', y: '50vh', scale: 1.5, opacity: 0.15, filter: 'blur(80px)' },
  { x: '50vw', y: '50vh', scale: 5, opacity: 0.4, filter: 'blur(100px)' },
  { x: '10vw', y: '60vh', scale: 1.2, opacity: 0.2, filter: 'blur(70px)' },
  { x: '50vw', y: '50vh', scale: 2, opacity: 0.3, filter: 'blur(90px)' },
];

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="w-full h-full overflow-hidden relative" style={{ backgroundColor: 'var(--color-bg-light)' }}>
      {/* Persistent gradient orb */}
      <motion.div
        className="absolute rounded-full gradient-bg pointer-events-none"
        style={{
          width: '40vw',
          height: '40vw',
          x: '-50%',
          y: '-50%',
          transformOrigin: 'center center',
        }}
        animate={{
          left: orbState[sceneIndex]?.x,
          top: orbState[sceneIndex]?.y,
          scale: orbState[sceneIndex]?.scale,
          opacity: orbState[sceneIndex]?.opacity,
          filter: orbState[sceneIndex]?.filter,
        }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
          backgroundSize: '4vw 4vw',
        }}
      />

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
