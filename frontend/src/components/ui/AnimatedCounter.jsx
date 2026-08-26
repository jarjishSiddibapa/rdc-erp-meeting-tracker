import { useEffect, useState } from 'react';

// Counts up from 0 to `value` on mount. (Scroll-triggered counting, like the portfolio
// site's version, doesn't suit these cards — they're already on-screen the moment the
// page loads, so animating on mount reads the same but avoids depending on
// IntersectionObserver-based `useInView`, which stayed permanently false inside these
// cards' transformed (rotateX/rotateY) TiltCard wrapper.)
export default function AnimatedCounter({ value, suffix = '', duration = 1.1 }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    let raf;
    const start = performance.now();
    setDisplay(0);
    const tick = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return <span>{display}{suffix}</span>;
}
