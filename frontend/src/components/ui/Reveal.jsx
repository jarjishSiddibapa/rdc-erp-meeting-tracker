import { motion } from 'framer-motion';

// Scroll-triggered fade + blur-in, ported from the portfolio site's Reveal component —
// content animates in as it enters the viewport rather than only once on mount.
export function Reveal({ children, className, style, delay = 0, y = 24, once = true }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function RevealGroup({ children, className, style, stagger = 0.08 }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      transition={{ staggerChildren: stagger }}
    >
      {children}
    </motion.div>
  );
}
