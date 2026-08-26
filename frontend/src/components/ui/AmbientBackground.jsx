import { Squiggle, Sparkle, DashedCircle, Arrow, BarChart, CheckScribble } from './Doodles';

// A quiet dotted-grid + floating-doodle backdrop, adapted from the portfolio site's
// AmbientBackground — kept deliberately faint (low opacity, `pointer-events: none`) so it
// reads as texture behind real content instead of competing with data tables.
export default function AmbientBackground({ dense = false }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5,
        backgroundImage:
          'linear-gradient(to right, var(--doodle-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--doodle-grid) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 30%, transparent 100%)',
      }} />

      <Squiggle className="doodle-float" style={{ position: 'absolute', top: '13%', left: '6%', color: 'var(--brand)', opacity: 0.28, transform: 'rotate(-6deg)' }} />
      <Sparkle className="doodle-glow" style={{ position: 'absolute', top: '22%', right: '9%', color: 'var(--doodle-warm)', opacity: 0.5, transform: 'rotate(12deg)' }} />
      <BarChart className="doodle-float" style={{ position: 'absolute', top: '40%', left: '4%', color: 'var(--brand)', opacity: 0.25, transform: 'rotate(3deg)', animationDelay: '-2s' }} />
      <DashedCircle className="doodle-float" style={{ position: 'absolute', top: '64%', left: '8%', color: 'var(--brand)', opacity: 0.22, animationDelay: '-3s' }} />
      <CheckScribble className="doodle-float" style={{ position: 'absolute', top: '50%', right: '7%', color: 'var(--doodle-accent2)', opacity: 0.3, animationDelay: '-1.5s' }} />
      {dense && (
        <>
          <Arrow className="doodle-float" style={{ position: 'absolute', top: '44%', right: '18%', color: 'var(--doodle-accent2)', opacity: 0.25, animationDelay: '-1s' }} />
          <Sparkle className="doodle-glow" style={{ position: 'absolute', top: '80%', left: '22%', color: 'var(--brand)', opacity: 0.32, transform: 'rotate(-6deg)' }} />
          <Squiggle className="doodle-float" style={{ position: 'absolute', top: '86%', right: '14%', color: 'var(--doodle-warm)', opacity: 0.3, transform: 'rotate(3deg)', animationDelay: '-2.5s' }} />
        </>
      )}

      <div className="noise-overlay" style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
