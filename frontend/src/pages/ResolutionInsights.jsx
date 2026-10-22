import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Typography, Table, Tag, Button, Drawer, Grid, message, Space, Tooltip } from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { resolutionAPI } from '../services/api';
import { LoadingNotice } from '../components/ui/LoadingNotice';
import ResolutionRecordsTable, { recordsToSheet } from '../components/ResolutionRecordsTable';
import ResolutionDrilldown from '../components/ResolutionDrilldown';
import { byDimension, byBucket } from '../utils/drill';
import useSRDetailPanel from '../components/useSRDetailPanel';
import {
  DEFAULT_FILTERS, FilterBar, filtersToParams, SummaryKpis, Panel, TrendChart, DistributionBars, BarCell, monthLabel,
} from '../components/ResolutionWidgets';
import { formatDuration, formatPct, toDays, compareNullable } from '../utils/duration';
import { exportWorkbook } from '../utils/resolutionExport';
import { paginationConfig } from '../utils/pagination';
import TableSearch from '../components/ui/TableSearch';
import { matchesSearch } from '../utils/tableTools';

const { Text, Paragraph } = Typography;

// Fewer closed SRs than this and an average says little - flagged rather than hidden.
const LOW_SAMPLE = 3;

function typeColumns(maxAvg) {
  return [
    { title: 'Type', dataIndex: 'key', width: 170, ellipsis: true },
    { title: 'Closed', dataIndex: 'closed', width: 80, sorter: (a, b) => a.closed - b.closed },
    {
      title: 'Average', dataIndex: 'avg_minutes', width: 130, defaultSortOrder: 'ascend',
      sorter: (a, b) => compareNullable(a.avg_minutes, b.avg_minutes),
      render: v => <BarCell minutes={v} max={maxAvg} />,
    },
    { title: 'Median', dataIndex: 'median_minutes', width: 100, sorter: (a, b) => compareNullable(a.median_minutes, b.median_minutes), render: formatDuration },
    { title: 'Open', dataIndex: 'open', width: 70, sorter: (a, b) => compareNullable(a.open, b.open) },
  ];
}

function TechnicianDrawer({ name, filters, onClose, openSR }) {
  const screens = Grid.useBreakpoint();
  const [data, setData] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    if (!name) return undefined;
    const params = { ...filtersToParams({ ...filters, technicians: [name] }) };
    let cancelled = false;
    setLoading(true);
    setData(null);
    Promise.all([resolutionAPI.overview(params), resolutionAPI.records(params)])
      .then(([overview, list]) => {
        if (cancelled) return;
        setData(overview.data);
        setRecords(list.data.records);
      })
      .catch(() => message.error('Failed to load technician details'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name, filters]);

  const maxTypeAvg = Math.max(0, ...(data?.types || []).map(t => t.avg_minutes || 0));

  return (
    <Drawer
      title={name} open={!!name} onClose={onClose} width={screens.lg ? 960 : '100%'} destroyOnHidden
      extra={(
        <Button
          icon={<DownloadOutlined />} disabled={!records.length}
          onClick={() => exportWorkbook(`Resolution_${name.replace(/\s+/g, '_')}`, [{ name: 'SRs', rows: recordsToSheet(records) }])}
        >
          Export
        </Button>
      )}
    >
      {loading || !data ? <LoadingNotice /> : (
        <div style={{ display: 'grid', gap: 16 }}>
          <SummaryKpis summary={data.summary} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <Panel title="Month by month"><TrendChart rows={data.trend} onSelect={row => setDrill({ title: `Closed in ${monthLabel(row.key)}`, predicate: byDimension('month', row.key) })} /></Panel>
            <Panel title="How long their SRs take"><DistributionBars data={data.distribution} onSelect={b => setDrill({ title: `Took ${b.label.toLowerCase()} to close`, predicate: byBucket(b) })} /></Panel>
          </div>
          {data.types.length > 0 && (
            <Panel title="By type of request">
              <Table
                rowKey="key" size="small" pagination={false} columns={typeColumns(maxTypeAvg)} dataSource={data.types}
                scroll={{ x: 'max-content' }}
                onRow={row => ({ onClick: () => setDrill({ title: `${row.key} (${name})`, predicate: byDimension('type', row.key) }), style: { cursor: 'pointer' } })}
              />
            </Panel>
          )}
          <Panel title={`Their SRs (${records.length})`}>
            <ResolutionRecordsTable records={records} onOpen={openSR} showTechnician={false} pageSize={10} searchable />
          </Panel>
        </div>
      )}
      <ResolutionDrilldown
        target={drill} params={filtersToParams({ ...filters, technicians: [name] })} onClose={() => setDrill(null)} openSR={openSR}
      />
    </Drawer>
  );
}

// The "Assigned to Analytics" tab of SR Insights: turnaround per ManageEngine technician.
export default function AssignedToAnalytics() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [techSearch, setTechSearch] = useState('');
  const [drill, setDrill] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await resolutionAPI.overview(filtersToParams(filters));
      if (id === requestId.current) setData(res.data);
    } catch (e) {
      if (id === requestId.current) message.error(e.response?.data?.message || 'Failed to load Assigned to Analytics');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // The drawer and the page share one SR detail modal; after any edit, refresh the figures.
  const { openDetail, detail } = useSRDetailPanel(load);

  const scopeByName = useMemo(
    () => new Map((data?.facets.technicians || []).map(t => [t.name, t.scope])),
    [data],
  );
  const maxAvg = Math.max(0, ...(data?.technicians || []).map(t => t.avg_minutes || 0));
  const maxTypeAvg = Math.max(0, ...(data?.types || []).map(t => t.avg_minutes || 0));
  const technicianRows = useMemo(
    () => (data?.technicians || []).filter(t => matchesSearch(techSearch, t.key)),
    [data, techSearch],
  );
  const columns = useMemo(() => [
    {
      title: 'Technician', dataIndex: 'key', width: 210, fixed: 'left',
      sorter: (a, b) => a.key.localeCompare(b.key),
      render: (v, row) => (
        <Space size={6} wrap>
          <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => setSelected(v)}>{v}</Button>
          {row.closed > 0 && row.closed < LOW_SAMPLE && (
            <Tooltip title={`Only ${row.closed} closed - too few to say much`}><Tag>few SRs</Tag></Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Type', key: 'scope', width: 90,
      filters: [{ text: 'Internal', value: 'Internal' }, { text: 'External', value: 'External' }],
      onFilter: (value, row) => scopeByName.get(row.key) === value,
      sorter: (a, b) => String(scopeByName.get(a.key) || '').localeCompare(String(scopeByName.get(b.key) || '')),
      render: (_, row) => {
        const scope = scopeByName.get(row.key);
        return scope ? <Tag color={scope === 'External' ? 'magenta' : 'blue'}>{scope}</Tag> : null;
      },
    },
    {
      title: (
        <Tooltip title="Every SR assigned to this technician in ManageEngine: the ones they closed plus the ones still open.">
          <span>Assigned to</span>
        </Tooltip>
      ),
      dataIndex: 'assigned', width: 100, sorter: (a, b) => compareNullable(a.assigned, b.assigned),
    },
    { title: 'Closed', dataIndex: 'closed', width: 80, sorter: (a, b) => a.closed - b.closed, defaultSortOrder: 'descend' },
    {
      title: 'Average turnaround', dataIndex: 'avg_minutes', width: 170,
      sorter: (a, b) => compareNullable(a.avg_minutes, b.avg_minutes),
      render: v => <BarCell minutes={v} max={maxAvg} />,
    },
    { title: 'Median', dataIndex: 'median_minutes', width: 100, sorter: (a, b) => compareNullable(a.median_minutes, b.median_minutes), render: formatDuration },
    { title: 'Fastest', dataIndex: 'min_minutes', width: 90, sorter: (a, b) => compareNullable(a.min_minutes, b.min_minutes), render: formatDuration },
    { title: 'Slowest', dataIndex: 'max_minutes', width: 90, sorter: (a, b) => compareNullable(a.max_minutes, b.max_minutes), render: formatDuration },
    { title: '≤ 3 days', dataIndex: 'within_3d_pct', width: 90, sorter: (a, b) => compareNullable(a.within_3d_pct, b.within_3d_pct), render: formatPct },
    { title: 'Open now', dataIndex: 'open', width: 90, sorter: (a, b) => compareNullable(a.open, b.open) },
    {
      title: 'Overdue', dataIndex: 'overdue', width: 90, sorter: (a, b) => compareNullable(a.overdue, b.overdue),
      render: v => (v ? <Text type="danger" strong>{v}</Text> : <Text type="secondary">0</Text>),
    },
    { title: 'Waiting on user', dataIndex: 'waiting_on_user', width: 120, sorter: (a, b) => compareNullable(a.waiting_on_user, b.waiting_on_user) },
    { title: 'Oldest open', dataIndex: 'open_oldest_minutes', width: 110, sorter: (a, b) => compareNullable(a.open_oldest_minutes, b.open_oldest_minutes), render: formatDuration },
  ], [maxAvg, scopeByName]);

  function handleExport() {
    if (!data) return;
    exportWorkbook('Resolution_Insights', [
      {
        name: 'By technician',
        rows: data.technicians.map(t => ({
          Technician: t.key, 'Internal/External': scopeByName.get(t.key) || '',
          'Assigned to (SRs)': t.assigned, 'SRs closed': t.closed, 'Average (days)': toDays(t.avg_minutes) ?? '', 'Median (days)': toDays(t.median_minutes) ?? '',
          'Fastest (days)': toDays(t.min_minutes) ?? '', 'Slowest (days)': toDays(t.max_minutes) ?? '',
          'Closed within 3 days (%)': t.within_3d_pct ?? '', 'Open now': t.open, Overdue: t.overdue, 'Waiting on user': t.waiting_on_user,
          'Oldest open (days)': toDays(t.open_oldest_minutes) ?? '',
        })),
      },
      {
        name: 'By month',
        rows: data.trend.map(t => ({ Month: t.key, 'SRs closed': t.closed, 'Average (days)': toDays(t.avg_minutes) ?? '', 'Median (days)': toDays(t.median_minutes) ?? '' })),
      },
      {
        name: 'By type',
        rows: data.types.map(t => ({ Type: t.key, 'SRs closed': t.closed, 'Average (days)': toDays(t.avg_minutes) ?? '', 'Median (days)': toDays(t.median_minutes) ?? '', Open: t.open })),
      },
    ]);
  }

  return (
    <>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Paragraph type="secondary" style={{ marginBottom: 14, maxWidth: 720 }}>
              How long it takes each technician to close the SRs assigned to them. Every figure comes straight from
              ManageEngine: when the SR was raised, when it was completed, and who it was assigned to. Time is calendar
              time, so weekends and any time spent waiting on the requester are included.
            </Paragraph>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} title="Refresh" />
            <Button icon={<DownloadOutlined />} disabled={!data} onClick={handleExport}>Export Excel</Button>
          </Space>
        </div>

        <FilterBar facets={data?.facets} value={filters} onChange={setFilters} />

        {!data ? <LoadingNotice /> : (
          <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
            <SummaryKpis summary={data.summary} />

            <Panel
              title="By technician" style={{ marginBottom: 16 }}
              extra={<TableSearch value={techSearch} onChange={setTechSearch} placeholder="Find a technician..." width={220} />}
            >
              <Table
                rowKey="key" size="small" bordered columns={columns} dataSource={technicianRows}
                scroll={{ x: 'max-content' }} pagination={false}
                locale={{ emptyText: 'No SRs match these filters' }}
              />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                Click a technician for their month-by-month trend and every SR behind the numbers.
              </Text>
            </Panel>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
              <Panel title="Month by month"><TrendChart rows={data.trend} onSelect={row => setDrill({ title: `Closed in ${monthLabel(row.key)}`, predicate: byDimension('month', row.key) })} /></Panel>
              <Panel title="How long SRs take"><DistributionBars data={data.distribution} onSelect={b => setDrill({ title: `Took ${b.label.toLowerCase()} to close`, predicate: byBucket(b) })} /></Panel>
            </div>

            <Panel title="By type of request">
              <Table
                rowKey="key" size="small" columns={typeColumns(maxTypeAvg)} dataSource={data.types}
                scroll={{ x: 'max-content' }} pagination={paginationConfig('types', { defaultPageSize: 10 })}
                onRow={row => ({ onClick: () => setDrill({ title: row.key, predicate: byDimension('type', row.key) }), style: { cursor: 'pointer' } })}
              />
            </Panel>
          </div>
        )}

        <TechnicianDrawer name={selected} filters={filters} onClose={() => setSelected(null)} openSR={openDetail} />
        <ResolutionDrilldown target={drill} params={filtersToParams(filters)} onClose={() => setDrill(null)} openSR={openDetail} />
        {detail}
      </div>
    </>
  );
}
