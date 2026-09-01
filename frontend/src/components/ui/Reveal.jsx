// Product pages should become interactive immediately. These compatibility wrappers keep the
// existing layout API without installing observers or running blur/transform animations.
export function Reveal({ children, className, style }) {
  return <div className={className} style={style}>{children}</div>;
}

export function RevealGroup({ children, className, style }) {
  return <div className={className} style={style}>{children}</div>;
}
