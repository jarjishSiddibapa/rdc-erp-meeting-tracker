import { useMemo, useState } from 'react';
import { Typography } from 'antd';
import { BRAND, niceMax, useElementWidth } from './ResolutionWidgets';

const { Text } = Typography;

const BRAND_DARK = '#048a17';

// How many SRs had their closure date changed once, twice, ... n times. One bar per change count from 0 up to the
// most any SR has had, so a gap (nobody changed it exactly 7 times) is visible rather than skipped. Hover a bar for
// the split by open/closed; click it (or press Enter) to select that count - the caller narrows its table to those
// SRs. Clicking the selected bar again clears the selection.
export function bucketByChanges(rows) {
  const max = rows.reduce((m, r) => Math.max(m, r.change_count || 0), 0);
  const buckets = Array.from({ length: max + 1 }, (_, changes) => ({ changes, count: 0, open: 0, closed: 0 }));
  for (const r of rows) {
    const b = buckets[r.change_count || 0];
    b.count += 1;
    if (r.status === 'Closed') b.closed += 1; else b.open += 1;
  }
  return buckets;
}

const plural = (n, one, many) => (n === 1 ? one : many);

// Saves the chart as a PNG (white background, title and a one-line description of the filters on top), drawn from the
// live SVG so what is downloaded is exactly what is on screen.
export async function downloadChartPng(svg, { title, subtitle, filename }) {
  const w = svg.clientWidth || Number(svg.getAttribute('width')), h = svg.clientHeight || Number(svg.getAttribute('height'));
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  clone.style.fontFamily = 'Arial, Helvetica, sans-serif';
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    const scale = 2, pad = 16, head = subtitle ? 52 : 34;
    const canvas = document.createElement('canvas');
    canvas.width = (w + pad * 2) * scale;
    canvas.height = (h + head + pad) * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.font = '600 15px Arial, Helvetica, sans-serif';
    ctx.fillText(title, pad, 26);
    if (subtitle) {
      ctx.fillStyle = '#595959';
      ctx.font = '12px Arial, Helvetica, sans-serif';
      ctx.fillText(subtitle, pad, 44);
    }
    ctx.drawImage(img, pad, head, w, h);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EcdChangesChart({ rows, selected, onSelect, svgRef }) {
  const [ref, measured] = useElementWidth();
  const [active, setActive] = useState(null);
  const buckets = useMemo(() => bucketByChanges(rows), [rows]);
  const total = rows.length;
  const most = useMemo(() => rows.reduce((top, r) => ((r.change_count || 0) > (top?.change_count || 0) ? r : top), null), [rows]);

  const W = Math.max(280, measured || 560), H = 260, L = 44, R = 10, T = 24, B = 52;
  const innerW = W - L - R, innerH = H - T - B;
  const maxCount = niceMax(Math.max(...buckets.map(b => b.count), 1));
  const step = innerW / buckets.length;
  const barW = Math.min(48, step * 0.62);
  const x = i => L + step * i + step / 2;
  const y = v => T + innerH - (v / maxCount) * innerH;
  const labelEvery = Math.max(1, Math.ceil(22 / step));
  const hovered = active !== null ? buckets[active] : null;
  const pick = b => { if (b.count > 0) onSelect(selected === b.changes ? null : b.changes); };

  if (!total) return <Text type="secondary">No SRs match these filters.</Text>;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg ref={svgRef} width={W} height={H} style={{ display: 'block' }} role="group" aria-label="Number of SRs by how many times the closure date changed">
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={T + innerH * (1 - f)} y2={T + innerH * (1 - f)} stroke="#eef0ef" />
            <text x={L - 6} y={T + innerH * (1 - f) + 4} textAnchor="end" fontSize="11" fill="#8c8c8c">{Math.round(maxCount * f * 10) / 10}</text>
          </g>
        ))}
        <text x={12} y={T + innerH / 2} fontSize="11" fill="#8c8c8c" textAnchor="middle" transform={`rotate(-90 12 ${T + innerH / 2})`}>SRs</text>
        <text x={L + innerW / 2} y={H - 4} fontSize="11" fill="#8c8c8c" textAnchor="middle">Times the closure date was changed</text>
        {buckets.map((b, i) => {
          const top = y(b.count);
          const on = active === i;
          const chosen = selected === b.changes;
          const dim = selected !== null && selected !== undefined && !chosen;
          const clickable = b.count > 0;
          return (
            <g
              key={b.changes} tabIndex={clickable ? 0 : undefined} role={clickable ? 'button' : undefined}
              aria-pressed={clickable ? chosen : undefined}
              aria-label={`${b.changes} ${plural(b.changes, 'change', 'changes')}: ${b.count} ${plural(b.count, 'SR', 'SRs')}`}
              style={{ cursor: clickable ? 'pointer' : 'default', outline: 'none' }}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)} onBlur={() => setActive(null)}
              onClick={() => pick(b)}
              onKeyDown={e => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(b); } }}
            >
              <rect x={x(i) - step / 2} y={T} width={step} height={H - T - 14} fill={on ? 'rgba(0,181,26,.07)' : 'transparent'} />
              {b.count > 0 && (
                <rect
                  x={x(i) - barW / 2} y={top} width={barW} height={T + innerH - top} rx="3"
                  fill={chosen || on ? BRAND_DARK : BRAND} opacity={dim ? 0.25 : chosen || on ? 0.95 : 0.75}
                  stroke={chosen ? '#111827' : 'none'} strokeWidth={chosen ? 1.5 : 0}
                />
              )}
              <text x={x(i)} y={b.count > 0 ? top - 5 : T + innerH - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill={b.count > 0 ? '#262626' : '#bfbfbf'}>{b.count}</text>
              {(i % labelEvery === 0 || on || chosen) && (
                <text x={x(i)} y={H - 24} textAnchor="middle" fontSize="11" fontWeight={on || chosen ? 700 : 400} fill="#595959">{b.changes}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          style={{
            position: 'absolute', left: Math.min(Math.max(x(active), 100), W - 100), top: 0, transform: 'translate(-50%, -4px)',
            background: '#262626', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12, lineHeight: 1.5,
            pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,.2)',
          }}
        >
          <b>{hovered.changes} {plural(hovered.changes, 'change', 'changes')}</b><br />
          {hovered.count} {plural(hovered.count, 'SR', 'SRs')} ({Math.round(hovered.count / total * 100)}%)<br />
          {hovered.open} open, {hovered.closed} closed
          {hovered.count > 0 && <><br /><span style={{ color: '#95de64' }}>{selected === hovered.changes ? 'Click to close the list' : 'Click to list these SRs'}</span></>}
        </div>
      )}
      <Text type="secondary" style={{ fontSize: 12 }}>
        {total} {plural(total, 'SR', 'SRs')}
        {' · '}{buckets[0].count} never changed
        {most && most.change_count > 0 && <> · most changed: SR {most.sr_number} ({most.change_count} {plural(most.change_count, 'time', 'times')})</>}
      </Text>
    </div>
  );
}
