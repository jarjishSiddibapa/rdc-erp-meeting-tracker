import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import { Table, Select, Input, Segmented, Button, Space, Tabs, Typography, message, Empty } from 'antd';
import { ReloadOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { resolutionAPI } from '../services/api';
import ResolutionRecordsTable, { recordsToSheet } from './ResolutionRecordsTable';
import ResolutionDrilldown from './ResolutionDrilldown';
import { byDimension, byBucket, allOf } from '../utils/drill';
import useSRDetailPanel from './useSRDetailPanel';
import {
  DEFAULT_FILTERS, FilterBar, filtersToParams, SummaryKpis, Panel, TrendChart, DistributionBars, monthLabel,
} from './ResolutionWidgets';
import { formatDuration, formatPct, toDays, compareNullable } from '../utils/duration';
import { exportWorkbook } from '../utils/resolutionExport';

const { Text } = Typography;

const DIMENSIONS = [
  { value: 'technician', label: 'Technician' },
  { value: 'month', label: 'Month closed' },
  { value: 'week', label: 'Week closed' },
  { value: 'type', label: 'Type of request' },
  { value: 'scope', label: 'Internal / External' },
];
const DIMENSION_TITLE = Object.fromEntries(DIMENSIONS.map(d => [d.value, d.label]));
const PERIOD = new Set(['month', 'week']);

// What goes inside each cell of a split (cross-tab) view.
const METRICS = [
  { value: 'avg_minutes', label: 'Average turnaround', kind: 'duration' },
  { value: 'median_minutes', label: 'Median turnaround', kind: 'duration' },
  { value: 'closed', label: 'SRs closed', kind: 'count' },
  { value: 'open', label: 'SRs open now', kind: 'count' },
  { value: 'within_3d_pct', label: 'Closed within 3 days', kind: 'pct' },
];
const METRIC_BY_VALUE = Object.fromEntries(METRICS.map(m => [m.value, m]));

function keyLabel(dimension, key) {
  if (dimension === 'month') return dayjs(`${key}-01`).format('MMM YYYY');
  if (dimension === 'week') return dayjs(key).format('DD-MMM-YYYY');
  return key;
}

function formatMetric(metric, value) {
  if (value === null || value === undefined) return '-';
  if (metric.kind === 'duration') return formatDuration(value);
  if (metric.kind === 'pct') return formatPct(value);
  return value;
}

// Slow turnarounds shade towards amber/red, relative to the 90th-percentile cell on screen so a
// single extreme outlier does not wash out the contrast between everything else.
function heatScale(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] : 0;
}

function heat(value, max) {
  if (value === null || value === undefined || !max) return undefined;
  const t = Math.min(1, value / max);
  const hue = 120 - t * 120; // green -> red
  return `hsla(${hue}, 70%, 55%, ${0.12 + t * 0.2})`;
}

export default function ResolutionExplorer() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [groupBy, setGroupBy] = useState('technician');
  const [thenBy, setThenBy] = useState(null);
  const [metricKey, setMetricKey] = useState('avg_minutes');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('all');
  const [explore, setExplore] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState(null);
  const requestId = useRef(0);

  // Grouping by a dimension and splitting by the very same one makes no sense - the API rejects it.
  const effectiveThenBy = thenBy && thenBy !== groupBy ? thenBy : null;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    const base = { ...filtersToParams(filters), search: search.trim() || undefined };
    try {
      const [exploreRes, recordsRes] = await Promise.all([
        resolutionAPI.explore({ ...base, groupBy, thenBy: effectiveThenBy || undefined }),
        resolutionAPI.records({ ...base, state }),
      ]);
      if (id !== requestId.current) return;
      setExplore(exploreRes.data);
      setRecords(recordsRes.data.records);
    } catch (e) {
      if (id === requestId.current) message.error(e.response?.data?.message || 'Failed to load the report');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters, groupBy, effectiveThenBy, search, state]);

  useEffect(() => {
    // Typing in the search box is debounced; every other control reloads immediately.
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const { openDetail, detail } = useSRDetailPanel(load);
  const drillInto = useCallback((title, ...predicates) => setDrill({ title, predicate: allOf(...predicates) }), []);

  const metric = METRIC_BY_VALUE[metricKey];
  const periodGroup = PERIOD.has(groupBy);
  // After changing Group by / Split by the previous response is still on screen until the new one
  // arrives; only lay out a table once the data actually matches the current controls.
  const fresh = !!explore && explore.dimension === groupBy && (explore.thenBy || null) === effectiveThenBy;

  const columns = useMemo(() => {
    if (!explore || !fresh) return [];
    const first = {
      title: DIMENSION_TITLE[groupBy], dataIndex: 'key', width: 200, fixed: 'left',
      // Months and weeks open newest first.
      ...(PERIOD.has(groupBy) ? { defaultSortOrder: 'descend' } : {}),
      sorter: (a, b) => a.key.localeCompare(b.key),
      render: v => <b>{keyLabel(groupBy, v)}</b>,
    };

    if (effectiveThenBy) {
      const cellValues = explore.rows.flatMap(r => Object.values(r.cells).map(c => c[metricKey])).filter(v => v !== null && v !== undefined);
      const max = metric.kind === 'duration' ? heatScale(cellValues) : 0;
      return [
        first,
        { title: 'Closed', dataIndex: 'closed', width: 80, sorter: (a, b) => a.closed - b.closed },
        {
          title: 'Overall', dataIndex: metricKey, width: 110,
          sorter: (a, b) => compareNullable(a[metricKey], b[metricKey]),
          render: v => <b>{formatMetric(metric, v)}</b>,
        },
        ...explore.columns.map(col => ({
          title: keyLabel(effectiveThenBy, col), key: `col-${col}`, width: 110, align: 'center',
          sorter: (a, b) => compareNullable(a.cells[col]?.[metricKey], b.cells[col]?.[metricKey]),
          onCell: row => ({
            style: { background: heat(row.cells[col]?.[metricKey], max), cursor: row.cells[col] ? 'pointer' : 'default' },
            onClick: e => {
              e.stopPropagation();
              if (row.cells[col]) {
                drillInto(`${keyLabel(groupBy, row.key)} - ${keyLabel(effectiveThenBy, col)}`, byDimension(groupBy, row.key), byDimension(effectiveThenBy, col));
              }
            },
          }),
          render: (_, row) => {
            const cell = row.cells[col];
            if (!cell) return <Text type="secondary">-</Text>;
            return (
              <span title={`${cell.closed} closed`}>{formatMetric(metric, cell[metricKey])}</span>
            );
          },
        })),
      ];
    }

    const num = (title, dataIndex, render, width = 100) => ({
      title, dataIndex, width, sorter: (a, b) => compareNullable(a[dataIndex], b[dataIndex]), render,
    });
    return [
      first,
      ...(periodGroup ? [] : [num('Assigned to', 'assigned', v => v, 100)]),
      num('Closed', 'closed', v => v, 80),
      num('Average', 'avg_minutes', formatDuration),
      num('Median', 'median_minutes', formatDuration),
      num('Fastest', 'min_minutes', formatDuration, 90),
      num('Slowest', 'max_minutes', formatDuration, 90),
      num('≤ 1 day', 'within_1d_pct', formatPct, 90),
      num('≤ 3 days', 'within_3d_pct', formatPct, 90),
      num('≤ 7 days', 'within_7d_pct', formatPct, 90),
      ...(periodGroup ? [] : [
        num('Open now', 'open', v => v, 90),
        num('Overdue', 'overdue', v => (v ? <Text type="danger" strong>{v}</Text> : v), 90),
        num('Waiting on user', 'waiting_on_user', v => v, 120),
        num('Avg open age', 'open_avg_age_minutes', formatDuration, 110),
        num('Oldest open', 'open_oldest_minutes', formatDuration, 110),
      ]),
    ];
  }, [explore, fresh, groupBy, effectiveThenBy, metricKey, metric, periodGroup, drillInto]);

  function handleExport() {
    if (!explore) return;
    const breakdown = explore.rows.map(r => {
      const out = {
        [DIMENSION_TITLE[groupBy]]: keyLabel(groupBy, r.key), 'SRs closed': r.closed,
        'Average (days)': toDays(r.avg_minutes) ?? '', 'Median (days)': toDays(r.median_minutes) ?? '',
        'Fastest (days)': toDays(r.min_minutes) ?? '',
        'Slowest (days)': toDays(r.max_minutes) ?? '', 'Closed within 1 day (%)': r.within_1d_pct ?? '',
        'Closed within 3 days (%)': r.within_3d_pct ?? '', 'Closed within 7 days (%)': r.within_7d_pct ?? '',
      };
      if (!periodGroup) {
        Object.assign(out, {
          'Open now': r.open, Overdue: r.overdue, 'Waiting on user': r.waiting_on_user,
          'Avg open age (days)': toDays(r.open_avg_age_minutes) ?? '', 'Oldest open (days)': toDays(r.open_oldest_minutes) ?? '',
        });
      }
      if (effectiveThenBy) {
        for (const col of explore.columns) {
          const value = r.cells[col]?.[metricKey];
          out[`${metric.label} - ${keyLabel(effectiveThenBy, col)}`] =
            metric.kind === 'duration' ? (toDays(value) ?? '') : (value ?? '');
        }
      }
      return out;
    });
    exportWorkbook('Resolution_Explorer', [
      { name: 'Breakdown', rows: breakdown },
      { name: 'SRs', rows: recordsToSheet(records) },
    ]);
  }

  const splitOptions = [{ value: null, label: 'No split' }, ...DIMENSIONS.filter(d => d.value !== groupBy)];

  const controls = (
    <Space wrap size={[12, 8]} style={{ marginBottom: 16 }}>
      <Space size={6}><Text type="secondary">Group by</Text>
        <Select style={{ width: 170 }} value={groupBy} options={DIMENSIONS} onChange={v => { setGroupBy(v); if (thenBy === v) setThenBy(null); }} />
      </Space>
      <Space size={6}><Text type="secondary">Split by</Text>
        <Select style={{ width: 170 }} value={effectiveThenBy} options={splitOptions} onChange={setThenBy} />
      </Space>
      {effectiveThenBy && (
        <Space size={6}><Text type="secondary">Show</Text>
          <Select style={{ width: 190 }} value={metricKey} options={METRICS} onChange={setMetricKey} />
        </Space>
      )}
      <Input
        allowClear prefix={<SearchOutlined />} placeholder="Search SR no, description, type..." style={{ width: 260 }}
        value={search} onChange={e => setSearch(e.target.value)}
      />
      <Button icon={<ReloadOutlined />} onClick={load} loading={loading} title="Refresh" />
      <Button icon={<DownloadOutlined />} disabled={!explore} onClick={handleExport}>Export Excel</Button>
    </Space>
  );

  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, maxWidth: 780 }}>
        Explore turnaround time any way you like: pick the filters, group by technician, month, week or type, and
        optionally split by a second dimension for a matrix (for example technician by month). All times are
        calendar time from ManageEngine's raised and completed timestamps.
      </Text>

      <FilterBar facets={explore?.facets} value={filters} onChange={setFilters} />
      {controls}

      <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
        <SummaryKpis summary={explore?.summary} />

        <Tabs
          items={[
            {
              key: 'breakdown', label: 'Breakdown',
              children: (
                <div style={{ display: 'grid', gap: 16 }}>
                  <Panel title={`${DIMENSION_TITLE[groupBy]}${effectiveThenBy ? ` by ${DIMENSION_TITLE[effectiveThenBy].toLowerCase()}` : ''}`}>
                    {fresh && explore.rows.length === 0 ? (
                      <Empty description="No SRs match these filters" />
                    ) : (
                      <Table
                        key={`${groupBy}-${effectiveThenBy}`}
                        rowKey="key" size="small" bordered columns={columns} dataSource={fresh ? explore.rows : []} loading={loading || !fresh}
                        scroll={{ x: 'max-content' }} pagination={false}
                        onRow={row => ({
                          onClick: () => drillInto(keyLabel(groupBy, row.key), byDimension(groupBy, row.key)),
                          style: { cursor: 'pointer' },
                        })}
                      />
                    )}
                  </Panel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                    <Panel title="How long SRs take"><DistributionBars data={explore?.distribution} onSelect={b => drillInto(`Took ${b.label.toLowerCase()} to close`, byBucket(b))} /></Panel>
                    <Panel title="Month by month"><TrendChart rows={explore?.trend || []} onSelect={row => drillInto(`Closed in ${monthLabel(row.key)}`, byDimension('month', row.key))} /></Panel>
                  </div>
                </div>
              ),
            },
            {
              key: 'records', label: `SR list (${records.length})`,
              children: (
                <div>
                  <Segmented
                    style={{ marginBottom: 12 }} value={state} onChange={setState}
                    options={[{ label: 'All', value: 'all' }, { label: 'Closed', value: 'closed' }, { label: 'Open', value: 'open' }]}
                  />
                  <ResolutionRecordsTable records={records} loading={loading} onOpen={openDetail} />
                </div>
              ),
            },
          ]}
        />
      </div>
      <ResolutionDrilldown
        target={drill} params={{ ...filtersToParams(filters), search: search.trim() || undefined }}
        onClose={() => setDrill(null)} openSR={openDetail}
      />
      {detail}
    </div>
  );
}
