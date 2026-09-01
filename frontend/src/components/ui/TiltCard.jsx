// Kept as a compatibility wrapper for existing call sites. A quiet CSS hover provides tactile
// feedback without per-pointer calculations, spring objects or GPU-heavy 3D transforms.
export default function TiltCard({ children, style, disabled = false }) {
  return <div className={disabled ? undefined : 'interactive-surface'} style={style}>{children}</div>;
}
