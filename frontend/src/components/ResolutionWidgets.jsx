import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Select, DatePicker, Segmented, Typography, Space, Button, Tooltip } from 'antd';
import { ClearOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { formatDuration, formatPct } from '../utils/duration';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export const BRAND = '#00B51A';
const BRAND_DARK = '#048a17';
const AMBER = '#c2760c';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Filters ──────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FILTERS = { preset: 'all', range: null, scope: null, types: [], technicians: [] };

export const PRESETS = [
  { label: 'All time', value: 'all' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: '6 months', value: '180' },
  { label: 'This year', value: 'year' },
  { label: 'Custom', value: 'custom' },
];

// The date range always means "SRs closed between these dates"; open SRs are a live snapshot.
export function filtersToParams(filters) {
  const params = {};
  const today = dayjs();
  if (filters.preset === 'custom' && filters.range?.[0] && filters.range?.[1]) {
    params.from = filters.range[0].format('YYYY-MM-DD');
    params.to = filters.range[1].format('YYYY-MM-DD');
  } else if (['30', '90', '180'].includes(filters.preset)) {
    params.from = today.subtract(Number(filters.preset), 'day').format('YYYY-MM-DD');
  } else if (filters.preset === 'year') {
    params.from = today.startOf('year').format('YYYY-MM-DD');
  }
  if (filters.scope) params.scope = filters.scope;
  if (filters.types.length) params.type = filters.types.join(',');
  if (filters.technicians.length) params.technician = filters.technicians.join(',');
  return params;
}

export function FilterBar({ facets, value, onChange, extra }) {
  const set = patch => onChange({ ...value, ...patch });
  const dirty = value.preset !== 'all' || !!value.scope || value.types.length > 0 || value.technicians.length > 0;

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      <Tooltip title="Closed SRs are filtered by the date they were closed. SRs that are still open always show their current state.">
        <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
      </Tooltip>
      <Segmented
        size="middle" options={PRESETS} value={value.preset}
        onChange={preset => set({ preset, range: preset === 'custom' ? value.range : null })}
      />
      {value.preset === 'custom' && (
        <RangePicker
          format="DD-MMM-YYYY" allowClear value={value.range}
          onChange={range => set({ range })}
          disabledDate={d => d.isAfter(dayjs(), 'day')}
        />
      )}
      <Select
        allowClear placeholder="Internal / External" style={{ width: 160 }} value={value.scope}
        options={[{ value: 'Internal', label: 'Internal' }, { value: 'External', label: 'External' }]}
        onChange={scope => set({ scope: scope || null })}
      />
      <Select
        mode="multiple" allowClear maxTagCount="responsive" placeholder="All technicians" style={{ minWidth: 200, maxWidth: 320 }}
        value={value.technicians} onChange={technicians => set({ technicians })}
        options={(facets?.technicians || []).map(t => ({ value: t.name, label: t.name }))}
      />
      <Select
        mode="multiple" allowClear maxTagCount="responsive" placeholder="All types" style={{ minWidth: 180, maxWidth: 300 }}
        value={value.types} onChange={types => set({ types })}
        options={(facets?.types || []).map(t => ({ value: t, label: t }))}
      />
      {extra}
      {dirty && <Button icon={<ClearOutlined />} onClick={() => onChange(DEFAULT_FILTERS)}>Reset</Button>}
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────────────────────

export function Kpi({ label, value, sub, hint, tone }) {
  const color = tone === 'bad' ? '#cf1322' : tone === 'good' ? BRAND_DARK : '#111827';
  return (
    <div style={{
      border: '1px solid #e5e7e6', borderRadius: 10, background: '#fff', padding: '12px 14px', minWidth: 0,
    }}>
      <Space size={5} style={{ marginBottom: 2 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
        {hint && (
          <Tooltip title={hint}><InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 11 }} /></Tooltip>
        )}
      </Space>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color }}>{value}</div>
      {sub && <Text type="secondary" style={{ fontSize: 12 }}>{sub}</Text>}
    </div>
  );
}

export function KpiGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function SummaryKpis({ summary }) {
  const s = summary || {};
  return (
    <KpiGrid>
      <Kpi
        label="Average turnaround" value={formatDuration(s.avg_minutes)} sub={`${s.closed ?? 0} SRs closed`}
        hint="Mean time from the SR being raised in ManageEngine to it being completed (calendar time, weekends included)."
      />
      <Kpi
        label="Median turnaround" value={formatDuration(s.median_minutes)} sub="half close faster than this"
        hint="The typical SR. Unlike the average it is not pulled up by a few very slow tickets."
      />
      <Kpi
        label="Closed within 3 days" value={formatPct(s.within_3d_pct)}
        sub={s.within_1d_pct === null || s.within_1d_pct === undefined ? undefined : `${s.within_1d_pct}% within 1 day`}
      />
      <Kpi
        label="Open now" value={s.open ?? 0}
        sub={s.overdue ? `${s.overdue} past expected closure` : 'none overdue'}
        tone={s.overdue ? 'bad' : undefined}
      />
      <Kpi
        label="Average age of open SRs" value={formatDuration(s.open_avg_age_minutes)}
        sub={s.open_oldest_minutes ? `oldest ${formatDuration(s.open_oldest_minutes)}` : undefined}
        hint="How long the SRs that are still open have been open so far."
      />
    </KpiGrid>
  );
}

export function Panel({ title, extra, children, style }) {
  return (
    <div style={{ border: '1px solid #e5e7e6', borderRadius: 10, background: '#fff', padding: 14, minWidth: 0, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Text strong>{title}</Text>
        {extra}
      </div>
      {children}
    </div>
  );
}

// ── Charts (plain SVG/CSS - no charting dependency to ship) ──────────────────────────────────

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} '${String(y).slice(2)}`;
}

// Measures the width the chart actually gets, so text stays a readable fixed size at any layout
// width instead of shrinking with a scaled SVG.
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(Math.floor(el.clientWidth));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Bars: SRs closed per month. Line: average turnaround of those SRs, in days.
// Months along the bottom (x), average days to close up the side (y). How many SRs went into each month's
// average is printed under the month, since an average over one or two SRs says little. Hover a month for the
// detail; click it (when `onSelect` is given) to list the SRs closed that month.
export function niceMax(value) {
  if (value <= 5) return Math.max(1, Math.ceil(value));
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / (magnitude / 2)) * (magnitude / 2);
}

export function TrendChart({
  rows, onSelect, countKey = 'closed', noun = ['SR', 'SRs'], verb = 'closed', yLabel = 'Average days to close',
  empty = 'No closed SRs in this range.', hint = 'Click to see these SRs',
}) {
  const [ref, measured] = useElementWidth();
  const [active, setActive] = useState(null);
  const data = useMemo(() => (rows || []).filter(r => r[countKey] > 0), [rows, countKey]);
  const count = d => d[countKey];
  const nounOf = d => (count(d) === 1 ? noun[0] : noun[1]);

  const W = Math.max(260, measured || 520), H = 240, L = 44, R = 10, T = 22, B = 46;
  const innerW = W - L - R, innerH = H - T - B;
  const maxDays = niceMax(Math.max(...data.map(d => d.avg_minutes / 1440), 0.1));
  const step = innerW / Math.max(data.length, 1);
  const barW = Math.min(44, step * 0.6);
  const x = i => L + step * i + step / 2;
  const yDays = v => T + innerH - (v / maxDays) * innerH;
  // With many months, label every n-th so names never overlap.
  const labelEvery = Math.max(1, Math.ceil(46 / step));
  const dayLabel = minutes => `${Math.round(minutes / 1440 * 10) / 10}d`;
  const hovered = active !== null ? data[active] : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {!data.length ? <Text type="secondary">{empty}</Text> : (
        <>
          <svg width={W} height={H} style={{ display: 'block' }} role="group" aria-label={`${yLabel}, by month`}>
            {[0, 0.5, 1].map(f => (
              <g key={f}>
                <line x1={L} x2={W - R} y1={T + innerH * (1 - f)} y2={T + innerH * (1 - f)} stroke="#eef0ef" />
                <text x={L - 6} y={T + innerH * (1 - f) + 4} textAnchor="end" fontSize="11" fill="#8c8c8c">{Math.round(maxDays * f * 10) / 10}</text>
              </g>
            ))}
            <text x={12} y={T + innerH / 2} fontSize="11" fill="#8c8c8c" textAnchor="middle" transform={`rotate(-90 12 ${T + innerH / 2})`}>{yLabel}</text>
            {data.map((d, i) => {
              const top = yDays(d.avg_minutes / 1440);
              const on = active === i;
              return (
                <g
                  key={d.key} tabIndex={onSelect ? 0 : undefined} role={onSelect ? 'button' : undefined}
                  aria-label={`${monthLabel(d.key)}: average ${formatDuration(d.avg_minutes)}, ${count(d)} ${nounOf(d)} ${verb}`}
                  style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
                  onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                  onClick={() => onSelect?.(d)}
                  onKeyDown={e => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(d); } }}
                >
                  <rect x={x(i) - step / 2} y={T} width={step} height={H - T} fill={on ? 'rgba(0,181,26,.06)' : 'transparent'} />
                  <rect
                    x={x(i) - barW / 2} y={top} width={barW} height={T + innerH - top} rx="3"
                    fill={on ? BRAND_DARK : BRAND} opacity={on ? 0.9 : count(d) < 3 ? 0.35 : 0.7}
                  />
                  <text x={x(i)} y={top - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#262626">{dayLabel(d.avg_minutes)}</text>
                  {(i % labelEvery === 0 || on) && (
                    <>
                      <text x={x(i)} y={H - 24} textAnchor="middle" fontSize="11" fontWeight={on ? 700 : 400} fill="#595959">{monthLabel(d.key)}</text>
                      <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#8c8c8c">{count(d)} {nounOf(d)}</text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          {hovered && (
            <div
              style={{
                position: 'absolute', left: Math.min(Math.max(x(active), 90), W - 90), top: 0, transform: 'translate(-50%, -4px)',
                background: '#262626', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12, lineHeight: 1.5,
                pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,.2)',
              }}
            >
              <b>{monthLabel(hovered.key)}</b><br />
              {count(hovered)} {nounOf(hovered)} {verb}<br />
              Average {formatDuration(hovered.avg_minutes)}
              {hovered.median_minutes !== null && hovered.median_minutes !== undefined && <><br />Median {formatDuration(hovered.median_minutes)}</>}
              {onSelect && <><br /><span style={{ color: '#95de64' }}>{hint}</span></>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// One row per turnaround bucket. Hover for the exact count; click (when `onSelect` is given) to list the SRs.
export function DistributionBars({ data, onSelect, noun = 'closed SRs', verb = 'took', empty = 'No closed SRs in this range.' }) {
  const [hovered, setHovered] = useState(null);
  const total = (data || []).reduce((sum, b) => sum + b.count, 0);
  if (!total) return <Text type="secondary">{empty}</Text>;
  const max = Math.max(...data.map(b => b.count), 1);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {data.map(b => {
        const clickable = !!onSelect && b.count > 0;
        const on = hovered === b.key && clickable;
        return (
          <Tooltip key={b.key} title={`${b.count} of ${total} ${noun} (${b.pct}%) ${verb} ${b.label.toLowerCase()}${clickable ? ' - click to see them' : ''}`}>
            <div
              role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
              onClick={() => clickable && onSelect(b)}
              onKeyDown={e => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(b); } }}
              onMouseEnter={() => setHovered(b.key)} onMouseLeave={() => setHovered(null)}
              style={{
                display: 'grid', gridTemplateColumns: '96px 1fr 74px', gap: 8, alignItems: 'center', fontSize: 12,
                padding: '3px 4px', borderRadius: 6, cursor: clickable ? 'pointer' : 'default', background: on ? 'rgba(0,181,26,.07)' : 'transparent',
              }}
            >
              <span style={{ fontWeight: on ? 700 : 400 }}>{b.label}</span>
              <div style={{ background: '#f1f3f2', borderRadius: 4, height: 16, overflow: 'hidden' }}>
                <div style={{ width: `${(b.count / max) * 100}%`, height: '100%', background: on ? BRAND_DARK : BRAND, opacity: on ? 0.95 : 0.75, borderRadius: 4, transition: 'width .2s' }} />
              </div>
              <span style={{ textAlign: 'right' }}><b>{b.count}</b> <Text type="secondary">({b.pct}%)</Text></span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

// A number with a faint proportional bar behind it, so a column of durations can be compared at a glance.
export function BarCell({ minutes, max }) {
  if (minutes === null || minutes === undefined) return <Text type="secondary">-</Text>;
  const width = max ? Math.min(100, (minutes / max) * 100) : 0;
  return (
    <div style={{ position: 'relative', minWidth: 80 }}>
      <div style={{ position: 'absolute', inset: '2px auto 2px 0', width: `${width}%`, background: 'rgba(0,181,26,.16)', borderRadius: 3 }} />
      <span style={{ position: 'relative', paddingLeft: 4, fontWeight: 600 }}>{formatDuration(minutes)}</span>
    </div>
  );
}
