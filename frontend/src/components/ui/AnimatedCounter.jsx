// Operational figures should be readable immediately and should never temporarily display 0.
export default function AnimatedCounter({ value, suffix = '' }) {
  return <span>{Number(value) || 0}{suffix}</span>;
}
