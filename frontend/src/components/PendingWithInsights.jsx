import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import { Typography, Table, Tag, Button, Drawer, Grid, Select, DatePicker, Segmented, message, Space, Tooltip } from 'antd';
import { ReloadOutlined, DownloadOutlined, ClearOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { resolutionAPI } from '../services/api';
import { LoadingNotice } from './ui/LoadingNotice';
import TableSearch from './ui/TableSearch';
import useSRDetailPanel from './useSRDetailPanel';
import { STATUS_COLORS } from './ResolutionRecordsTable';
import {
  DEFAULT_FILTERS, PRESETS, filtersToParams, Kpi, KpiGrid, Panel, DistributionBars, BarCell, TrendChart, monthLabel,
} from './ResolutionWidgets';
import { formatDuration, toDays, compareNullable } from '../utils/duration';
import { exportWorkbook } from '../utils/resolutionExport';
import { paginationConfig } from '../utils/pagination';
import { matchesSearch, filtersFrom } from '../utils/tableTools';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// A date at midnight is a "Pending Since" date with no time of day, so show it as a plain date.
const when = v => (v ? dayjs(v).format(String(v).endsWith('00:00:00') ? 'DD-MMM-YYYY' : 'DD-MMM-YYYY hh:mm A') : null);

function outcomeOf(hold) {
  if (hold.ongoing) return 'With them now';
  if (hold.ended_by === 'handover') return 'Handed over';
  if (hold.ended_by === 'closed') return 'SR closed';
  return 'Cleared';
}

const OUTCOME_COLORS = { 'With them now': 'gold', 'Handed over': 'blue', 'SR closed': 'green', Cleared: 'default' };

function holdsToSheet(holds) {
  return holds.map(h => ({
    'SR No': h.sr_number,
    Description: h.description || '',
    'Pending with': h.holder,
    From: h.start ? `${when(h.start)}${h.estimated ? ' (estimated)' : ''}` : 'Not recorded',
    To: h.ongoing ? 'Now' : when(h.end),
    'Time held (days)': toDays(h.minutes) ?? '',
    'Time held': h.minutes === null ? '' : formatDuration(h.minutes),
    Outcome: outcomeOf(h),
    'Handed to': h.handed_to || '',
    'SR status': h.status,
    'Expected closure': h.expected_closure_date ? dayjs(h.expected_closure_date).format('DD-MMM-YYYY') : '',
    Overdue: h.overdue ? 'Yes' : '',
  }));
}

const inBucket = (b, ongoing) => h => (
  h.ongoing === ongoing && h.minutes !== null && h.minutes >= b.from_minutes && (b.to_minutes === null || h.minutes < b.to_minutes)
);

// Every period an SR sat with someone, with when it started and how it ended. Opens from a person, a bar
// of either chart, and clicking an SR opens the normal SR detail panel.
function HoldsDrawer({ target, onClose, openSR, showPerson = true }) {
  const screens = Grid.useBreakpoint();
  const [search, setSearch] = useState('');
  const holds = useMemo(() => (target?.holds || []).map(h => ({ ...h, outcome: outcomeOf(h), sort_end: h.end || '9999' })), [target]);
  const rows = useMemo(
    () => holds.filter(h => matchesSearch(search, h.sr_number, h.description, h.holder, h.handed_to, h.status)),
    [holds, search],
  );
  const stat = useMemo(() => {
    const timed = holds.filter(h => !h.ongoing && h.minutes !== null);
    return {
      now: holds.filter(h => h.ongoing).length,
      done: holds.filter(h => !h.ongoing).length,
      average: timed.length ? timed.reduce((sum, h) => sum + h.minutes, 0) / timed.length : null,
    };
  }, [holds]);

  const columns = useMemo(() => [
    {
      title: 'SR No', dataIndex: 'sr_number', width: 100, fixed: 'left',
      sorter: (a, b) => Number(a.sr_number) - Number(b.sr_number),
      render: (v, row) => <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => openSR(row.sr_id)}>{v}</Button>,
    },
    { title: 'Description', dataIndex: 'description', width: 240, ellipsis: true, render: v => v || <Text type="secondary">-</Text> },
    ...(showPerson ? [{
      title: 'Pending with', dataIndex: 'holder', width: 170,
      sorter: (a, b) => a.holder.localeCompare(b.holder),
      filters: filtersFrom(holds, 'holder'), filterSearch: true, onFilter: (value, row) => row.holder === value,
    }] : []),
    {
      title: 'From', dataIndex: 'start', width: 160,
      sorter: (a, b) => String(a.start || '').localeCompare(String(b.start || '')),
      render: (v, row) => (v
        ? (row.estimated ? <Tooltip title="Estimated: counted from the day the SR was raised, because Pending With has not changed since"><span>{when(v)} ~</span></Tooltip> : when(v))
        : <Tooltip title="Pending With was not being tracked yet when this started"><Text type="secondary">not recorded</Text></Tooltip>),
    },
    {
      title: 'To', dataIndex: 'sort_end', width: 160, defaultSortOrder: 'descend',
      sorter: (a, b) => a.sort_end.localeCompare(b.sort_end),
      render: (_, row) => (row.ongoing ? <Text strong>Now</Text> : when(row.end)),
    },
    {
      title: 'Time held', dataIndex: 'minutes', width: 140,
      sorter: (a, b) => compareNullable(a.minutes, b.minutes),
      render: (v, row) => (v === null ? <Text type="secondary">unknown</Text> : (
        <Space size={4}><BarCell minutes={v} max={Math.max(1, ...holds.map(h => h.minutes || 0))} />{row.ongoing && <Text type="secondary" style={{ fontSize: 11 }}>{row.estimated ? '~ so far' : 'so far'}</Text>}</Space>
      )),
    },
    {
      title: 'Outcome', dataIndex: 'outcome', width: 170,
      filters: Object.keys(OUTCOME_COLORS).map(o => ({ text: o, value: o })), onFilter: (value, row) => row.outcome === value,
      render: (v, row) => (
        <Space size={4} wrap>
          <Tag color={OUTCOME_COLORS[v]} style={{ marginInlineEnd: 0 }}>{v}</Tag>
          {row.handed_to && <Text type="secondary" style={{ fontSize: 12 }}>to {row.handed_to}</Text>}
          {row.overdue && <Text type="danger" style={{ fontSize: 12 }}>overdue</Text>}
        </Space>
      ),
    },
    {
      title: 'SR status', dataIndex: 'status', width: 130,
      filters: Object.keys(STATUS_COLORS).map(s => ({ text: s, value: s })), onFilter: (value, row) => row.status === value,
      render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
    },
  ], [holds, openSR, showPerson]);

  return (
    <Drawer
      title={target?.title} open={!!target} onClose={() => { onClose(); setSearch(''); }} width={screens.lg ? 1040 : '100%'} destroyOnHidden
      extra={(
        <Button icon={<DownloadOutlined />} disabled={!rows.length} onClick={() => exportWorkbook('Pending_with', [{ name: 'Holds', rows: holdsToSheet(rows) }])}>
          Export
        </Button>
      )}
    >
      <Space size={20} wrap style={{ marginBottom: 12 }}>
        <Text><b>{holds.length}</b> periods</Text>
        {stat.now > 0 && <Text><b>{stat.now}</b> with them now</Text>}
        {stat.done > 0 && <Text><b>{stat.done}</b> finished{stat.average !== null && <>, average <b>{formatDuration(stat.average)}</b></>}</Text>}
      </Space>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <TableSearch value={search} onChange={setSearch} placeholder="Search SR no, description, person..." width={300} />
        {search && <Text type="secondary" style={{ fontSize: 12 }}>{rows.length} of {holds.length}</Text>}
      </div>
      <Table
        rowKey={(row, i) => `${row.sr_id}-${row.holder}-${row.start || 'x'}-${i}`} size="small" bordered columns={columns} dataSource={rows}
        scroll={{ x: 'max-content' }} pagination={paginationConfig('periods', { defaultPageSize: 10 })}
        locale={{ emptyText: 'Nothing matches' }}
      />
    </Drawer>
  );
}

function FilterBar({ people, value, onChange }) {
  const set = patch => onChange({ ...value, ...patch });
  const dirty = value.preset !== 'all' || value.technicians.length > 0;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      <Tooltip title="Finished holds are filtered by the date they ended. SRs that are with someone right now always show.">
        <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
      </Tooltip>
      <Segmented
        options={PRESETS} value={value.preset}
        onChange={preset => set({ preset, range: preset === 'custom' ? value.range : null })}
      />
      {value.preset === 'custom' && (
        <RangePicker format="DD-MMM-YYYY" allowClear value={value.range} onChange={range => set({ range })} disabledDate={d => d.isAfter(dayjs(), 'day')} />
      )}
      <Select
        mode="multiple" allowClear maxTagCount="responsive" placeholder="Everyone" style={{ minWidth: 200, maxWidth: 340 }}
        value={value.technicians} onChange={technicians => set({ technicians })}
        options={people.map(name => ({ value: name, label: name }))}
      />
      {dirty && <Button icon={<ClearOutlined />} onClick={() => onChange(DEFAULT_FILTERS)}>Reset</Button>}
    </div>
  );
}

export default function PendingWithInsights() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await resolutionAPI.pending(filtersToParams(filters));
      if (id === requestId.current) setData(res.data);
    } catch (e) {
      if (id === requestId.current) message.error(e.response?.data?.message || 'Failed to load Pending With Insights');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const { openDetail, detail } = useSRDetailPanel(load);

  const people = useMemo(() => (data?.people || []).filter(p => matchesSearch(search, p.key)), [data, search]);
  const maxAvgNow = Math.max(0, ...(data?.people || []).map(p => p.avg_age_minutes || 0));
  const maxAvgHold = Math.max(0, ...(data?.people || []).map(p => p.avg_minutes || 0));
  const holdsOf = useCallback(name => (data?.holds || []).filter(h => h.holder === name), [data]);

  const columns = useMemo(() => [
    {
      title: 'Person', dataIndex: 'key', width: 200, fixed: 'left', sorter: (a, b) => a.key.localeCompare(b.key),
      render: v => <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => setTarget({ title: `Pending with ${v}`, holds: holdsOf(v), showPerson: false })}>{v}</Button>,
    },
    {
      title: <Tooltip title="SRs that are with this person right now."><span>With them now</span></Tooltip>,
      dataIndex: 'holding_now', width: 110, defaultSortOrder: 'descend', sorter: (a, b) => a.holding_now - b.holding_now,
    },
    {
      title: 'Overdue', dataIndex: 'overdue_now', width: 90, sorter: (a, b) => a.overdue_now - b.overdue_now,
      render: v => (v ? <Text type="danger" strong>{v}</Text> : <Text type="secondary">0</Text>),
    },
    {
      title: <Tooltip title="Average time the SRs they hold now have been with them so far."><span>Average wait so far</span></Tooltip>,
      dataIndex: 'avg_age_minutes', width: 160, sorter: (a, b) => compareNullable(a.avg_age_minutes, b.avg_age_minutes),
      render: v => <BarCell minutes={v} max={maxAvgNow} />,
    },
    {
      title: 'Longest wait now', dataIndex: 'oldest_minutes', width: 130, sorter: (a, b) => compareNullable(a.oldest_minutes, b.oldest_minutes),
      render: (v, row) => (v === null ? <Text type="secondary">-</Text> : <Tooltip title={`SR ${row.oldest_sr}`}>{formatDuration(v)}</Tooltip>),
    },
    {
      title: <Tooltip title="Different SRs that have been with this person in the selected period."><span>SRs held</span></Tooltip>,
      dataIndex: 'srs_held', width: 90, sorter: (a, b) => a.srs_held - b.srs_held,
    },
    {
      title: <Tooltip title="Periods that are over: the SR moved to someone else or was closed."><span>Finished</span></Tooltip>,
      dataIndex: 'completed', width: 90, sorter: (a, b) => a.completed - b.completed,
    },
    {
      title: 'Average time held', dataIndex: 'avg_minutes', width: 160, sorter: (a, b) => compareNullable(a.avg_minutes, b.avg_minutes),
      render: v => <BarCell minutes={v} max={maxAvgHold} />,
    },
    { title: 'Median', dataIndex: 'median_minutes', width: 100, sorter: (a, b) => compareNullable(a.median_minutes, b.median_minutes), render: formatDuration },
    { title: 'Longest', dataIndex: 'max_minutes', width: 100, sorter: (a, b) => compareNullable(a.max_minutes, b.max_minutes), render: formatDuration },
    {
      title: <Tooltip title="Finished periods whose start was never recorded, so they are not in the averages."><span>Not timed</span></Tooltip>,
      dataIndex: 'unknown_start', width: 100, sorter: (a, b) => a.unknown_start - b.unknown_start,
      render: v => (v ? <Text type="secondary">{v}</Text> : 0),
    },
  ], [maxAvgNow, maxAvgHold, holdsOf]);

  function handleExport() {
    if (!data) return;
    exportWorkbook('Pending_with_Insights', [
      {
        name: 'By person',
        rows: data.people.map(p => ({
          Person: p.key, 'With them now': p.holding_now, Overdue: p.overdue_now,
          'Average wait so far (days)': toDays(p.avg_age_minutes) ?? '', 'Longest wait now (days)': toDays(p.oldest_minutes) ?? '',
          'SRs held': p.srs_held, 'Finished periods': p.completed, 'Average time held (days)': toDays(p.avg_minutes) ?? '',
          'Median (days)': toDays(p.median_minutes) ?? '', 'Longest (days)': toDays(p.max_minutes) ?? '', 'Not timed': p.unknown_start,
        })),
      },
      { name: 'All periods', rows: holdsToSheet(data.holds) },
    ]);
  }

  const s = data?.summary;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 14, maxWidth: 760 }}>
          How long SRs sit with each person in Pending With. Time runs from the moment an SR was handed to someone until it
          moved on or was closed; SRs still with someone are counted up to now. Handover times are the moment each change was
          recorded here, and a person's first recorded hold has no known start, so it is left out of the averages.
        </Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} title="Refresh" />
          <Button icon={<DownloadOutlined />} disabled={!data} onClick={handleExport}>Export Excel</Button>
        </Space>
      </div>

      <FilterBar people={data?.facets.people || []} value={filters} onChange={setFilters} />

      {!data ? <LoadingNotice /> : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <KpiGrid>
            <Kpi
              label="Pending with someone now" value={s.holding_now} sub={s.overdue_now ? `${s.overdue_now} past expected closure` : 'none overdue'}
              tone={s.overdue_now ? 'bad' : undefined}
            />
            <Kpi
              label="Average wait so far" value={formatDuration(s.avg_age_minutes)}
              sub={s.oldest_minutes ? `longest ${formatDuration(s.oldest_minutes)} (${s.oldest_holder})` : undefined}
              hint="How long the SRs that are pending now have been with their current person."
            />
            <Kpi
              label="Average time per hold" value={formatDuration(s.avg_minutes)} sub={`${s.timed} finished periods`}
              hint="How long an SR stays with one person before it moves on or is closed."
            />
            <Kpi label="Median time per hold" value={formatDuration(s.median_minutes)} sub="half move on faster than this" />
            <Kpi
              label="Longest hold" value={formatDuration(s.max_minutes)}
              hint="The longest finished period an SR spent with one person."
            />
            <Kpi
              label="Periods with a known start" value={`${s.timed} of ${s.completed}`}
              sub={s.unknown_start ? `${s.unknown_start} start before tracking began` : 'all timed'}
              hint="Pending With history only goes back to when it was first tracked. Earlier periods count as SRs held but have no duration."
            />
          </KpiGrid>

          <Panel
            title="By person" style={{ marginBottom: 16 }}
            extra={<TableSearch value={search} onChange={setSearch} placeholder="Find a person..." width={220} />}
          >
            <Table
              rowKey="key" size="small" bordered columns={columns} dataSource={people}
              scroll={{ x: 'max-content' }} pagination={paginationConfig('people', { defaultPageSize: 15 })}
              locale={{ emptyText: 'Nothing matches these filters' }}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Click a person to see every SR that has been with them, when it started and how it ended.
            </Text>
          </Panel>

          <Panel title="Month by month" style={{ marginBottom: 16 }}>
            <TrendChart
              rows={data.trend} countKey="count" noun={['hold', 'holds']} verb="ended" yLabel="Average days held"
              empty="No finished holds in this range." hint="Click to see these holds"
              onSelect={row => setTarget({
                title: `Holds that ended in ${monthLabel(row.key)}`,
                holds: data.holds.filter(h => !h.ongoing && h.minutes !== null && String(h.end).slice(0, 7) === row.key),
              })}
            />
          </Panel>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <Panel title="How long pending SRs have been with their current person">
              <DistributionBars
                data={s.holding_now ? data.current_distribution : []} noun="SRs pending now" verb="have been with their person for"
                empty="Nothing is pending with anyone."
                onSelect={b => setTarget({ title: `Pending now - with their person for ${b.label.toLowerCase()}`, holds: data.holds.filter(inBucket(b, true)) })}
              />
            </Panel>
            <Panel title="How long a hold lasts before the SR moves on">
              <DistributionBars
                data={data.completed_distribution} noun="finished periods" verb="lasted" empty="No finished periods in this range."
                onSelect={b => setTarget({ title: `Holds that lasted ${b.label.toLowerCase()}`, holds: data.holds.filter(inBucket(b, false)) })}
              />
            </Panel>
          </div>
        </div>
      )}

      <HoldsDrawer target={target} onClose={() => setTarget(null)} openSR={openDetail} showPerson={target?.showPerson !== false} />
      {detail}
    </div>
  );
}
