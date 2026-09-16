import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` once the returned ref scrolls into
 * view. Respects prefers-reduced-motion by jumping straight to the target.
 */
export function useCountUp(target: number, duration = 1400, decimals = 0) {
  const ref = useRef<HTMLElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setValue(target);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(target * eased);
          if (progress < 1) requestAnimationFrame(tick);
          else setValue(target);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  const display = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return { ref, display };
}
