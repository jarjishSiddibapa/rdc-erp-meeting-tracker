// Hand-sketched line-art accents — the same device the portfolio site uses to keep an
// otherwise clean UI from feeling sterile. Kept as inline SVGs (no asset files) so they can
// take `currentColor` and sit at whatever opacity/color the caller wants.

export function Squiggle({ className, style }) {
  return (
    <svg className={className} style={style} width="90" height="34" viewBox="0 0 90 34" fill="none" aria-hidden="true">
      <path d="M2 24C12 6 22 6 32 18C42 30 52 30 62 14C68 4 76 2 88 10"
        stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ className, style }) {
  return (
    <svg className={className} style={style} width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path d="M17 1C17 10 19 15 24 17C19 19 17 24 17 33C17 24 15 19 10 17C15 15 17 10 17 1Z" fill="currentColor" />
    </svg>
  );
}

export function DashedCircle({ className, style }) {
  return (
    <svg className={className} style={style} width="56" height="56" viewBox="0 0 60 60" fill="none" aria-hidden="true">
      <circle cx="30" cy="30" r="26" stroke="currentColor" strokeWidth="3" strokeDasharray="7 9" strokeLinecap="round" />
    </svg>
  );
}

export function Arrow({ className, style }) {
  return (
    <svg className={className} style={style} width="66" height="46" viewBox="0 0 70 50" fill="none" aria-hidden="true">
      <path d="M4 8C24 4 44 6 58 26" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M44 20C50 22 55 24 58 26C57 21 57 16 58 10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BarChart({ className, style }) {
  return (
    <svg className={className} style={style} width="46" height="38" viewBox="0 0 46 38" fill="none" aria-hidden="true">
      <rect x="2" y="20" width="9" height="16" rx="2.5" fill="currentColor" />
      <rect x="18.5" y="8" width="9" height="28" rx="2.5" fill="currentColor" opacity="0.75" />
      <rect x="35" y="14" width="9" height="22" rx="2.5" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function CheckScribble({ className, style }) {
  return (
    <svg className={className} style={style} width="40" height="34" viewBox="0 0 40 34" fill="none" aria-hidden="true">
      <path d="M3 18C8 24 13 29 16 31C21 22 28 10 37 3" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
