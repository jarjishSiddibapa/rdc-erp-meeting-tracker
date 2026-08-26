import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

// Mouse-tracking 3D tilt + a glow that follows the cursor — ported from the portfolio
// site's TiltCard. Gives cards a tactile, physical feel without the cost of a 3D scene.
export default function TiltCard({ children, style, disabled = false }) {
  const ref = useRef(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const springConfig = { stiffness: 150, damping: 18, mass: 0.5 };
  const rotateX = useSpring(useTransform(y, [0, 1], [6, -6]), springConfig);
  const rotateY = useSpring(useTransform(x, [0, 1], [-6, 6]), springConfig);
  const glowX = useTransform(x, [0, 1], ['0%', '100%']);
  const glowY = useTransform(y, [0, 1], ['0%', '100%']);
  const glowBg = useTransform([glowX, glowY], ([gx, gy]) =>
    `radial-gradient(360px circle at ${gx} ${gy}, rgba(0,181,26,0.16), transparent 70%)`
  );

  function handleMove(e) {
    if (disabled) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  }
  function handleLeave() { x.set(0.5); y.set(0.5); }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        ...style,
        rotateX: disabled ? 0 : rotateX,
        rotateY: disabled ? 0 : rotateY,
        transformPerspective: 900,
        position: 'relative',
      }}
    >
      {!disabled && (
        <motion.div
          aria-hidden
          style={{
            position: 'absolute', inset: -1, borderRadius: 'inherit',
            pointerEvents: 'none', background: glowBg, zIndex: 1,
          }}
        />
      )}
      {children}
    </motion.div>
  );
}
