import { useState, useEffect, useRef, useMemo } from 'react';
import dayjs from 'dayjs';
import { Typography, Tabs, Table, Tag, Empty, message, Button, Segmented, DatePicker, Select, Drawer, Spin } from 'antd';
import { DownloadOutlined, FileExcelOutlined, ReloadOutlined } from '@ant-design/icons';
import { reportsAPI } from '../services/api';
import { Reveal } from '../components/ui/Reveal';
import { paginationConfig } from '../utils/pagination';
import TableSearch from '../components/ui/TableSearch';
import { matchesSearch, textSorter, dateSorter } from '../utils/tableTools';
import EcdChangesChart, { downloadChartPng } from '../components/EcdChangesChart';
import { Panel, PRESETS } from '../components/ResolutionWidgets';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const VENDOR = 'Deloitte';

const STATUS_COLORS = {
  'Open': 'blue', 'In Progress': 'orange', 'Pending': 'gold',
  'On Hold': 'purple', 'Pending with User': 'magenta', 'Closed': 'green'
};

function fmt(d) { return d ? dayjs(d).format('DD-MMM-YYYY') : ''; }

const plural = (n, one, many) => (n === 1 ? one : many);

// The SR Date window the chart is narrowed to: "last 30 days" means SRs raised in the last 30 days.
function presetStart(preset) {
  if (['30', '90', '180'].includes(preset)) return dayjs().subtract(Number(preset), 'day').startOf('day');
  if (preset === 'year') return dayjs().startOf('year');
  return null;
}

// Clicking a bar lists the SRs behind it - an on-demand drill-down, not a standing table.
function ChangesDrawer({ changes, rows, onClose }) {
  const [search, setSearch] = useState('');
  const shown = useMemo(
    () => rows.filter(r => matchesSearch(search, r.sr_number, r.status, r.last_comment)),
    [rows, search],
  );
  const columns = useMemo(() => [
    { title: 'SR Number', dataIndex: 'sr_number', width: 110, sorter: (a, b) => Number(a.sr_number) - Number(b.sr_number) },
    {
      title: 'SR Date', dataIndex: 'sr_date', width: 110, render: fmt, defaultSortOrder: 'descend',
      sorter: (a, b) => dateSorter('sr_date')(a, b) || Number(a.sr_number) - Number(b.sr_number),
    },
    {
      title: 'Status', dataIndex: 'status', width: 120, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
      filters: Object.keys(STATUS_COLORS).map(status => ({ text: status, value: status })),
      onFilter: (value, row) => row.status === value,
      sorter: textSorter('status'),
    },
    {
      title: 'Latest closure date', width: 140,
      sorter: (a, b) => new Date(a.ecd_sequence.at(-1) || 0) - new Date(b.ecd_sequence.at(-1) || 0),
      render: (_, row) => fmt(row.ecd_sequence.at(-1)) || '—',
    },
  ], []);

  return (
    <Drawer
      open={changes !== null} onClose={onClose} width={560} destroyOnHidden
      title={changes === null ? '' : `${rows.length} ${plural(rows.length, 'SR', 'SRs')} with ${changes} closure-date ${plural(changes, 'change', 'changes')}`}
    >
      <TableSearch value={search} onChange={setSearch} placeholder="Search SR number, status, comment..." width="100%" />
      <Table
        style={{ marginTop: 12 }} rowKey="sr_number" size="small" columns={columns} dataSource={shown}
        locale={{ emptyText: 'No SRs match your search' }}
        pagination={paginationConfig('SRs', { defaultPageSize: 20 })}
      />
    </Drawer>
  );
}

// Fixed to Deloitte — matched as a substring against Assigned To (see reports.js's
// assigned_to LIKE %Deloitte%) so both the PDF importer's bare "Deloitte" and the
// ManageEngine sync's full "Deloitte ERP Support" roll up into the same report.
function AssignedToEcdReport() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [preset, setPreset] = useState('all');
  const [range, setRange] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [changesPicked, setChangesPicked] = useState(null);
  const svgRef = useRef(null);

  async function fetchReport() {
    setLoading(true);
    try {
      const res = await reportsAPI.assignedToEcd({ assignedTo: VENDOR, category: 'SR' });
      setReport(res.data);
    } catch {
      message.error('Failed to load report');
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchReport(); }, []);

  // The SR-raised window and status narrow the chart; clicking a bar lists the SRs behind it.
  const scoped = useMemo(() => {
    const from = preset === 'custom' ? range?.[0]?.startOf('day') : presetStart(preset);
    const to = preset === 'custom' ? range?.[1]?.endOf('day') : null;
    return (report?.data || []).filter(r => {
      if (statuses.length && !statuses.includes(r.status)) return false;
      if (from || to) {
        const raised = r.sr_date ? dayjs(r.sr_date) : null;
        if (!raised || (from && raised.isBefore(from)) || (to && raised.isAfter(to))) return false;
      }
      return true;
    });
  }, [report, preset, range, statuses]);

  // A narrowed-down view may no longer contain the picked count; drop the pick rather than keep an empty list open.
  const pickedCount = changesPicked !== null && scoped.some(r => r.change_count === changesPicked) ? changesPicked : null;
  useEffect(() => { if (changesPicked !== null && pickedCount === null) setChangesPicked(null); }, [changesPicked, pickedCount]);
  const pickedRows = useMemo(
    () => (pickedCount === null ? [] : scoped.filter(r => r.change_count === pickedCount)),
    [scoped, pickedCount],
  );

  // Column count follows the longest sequence actually present in the data.
  const ecdColumnCount = Math.max(1, ...scoped.map(r => r.ecd_sequence.length));

  function filterSummary() {
    const parts = [];
    if (preset === 'custom' && range?.[0] && range?.[1]) parts.push(`SRs raised ${range[0].format('DD-MMM-YYYY')} to ${range[1].format('DD-MMM-YYYY')}`);
    else if (preset !== 'all' && preset !== 'custom') parts.push(`SRs raised: ${PRESETS.find(p => p.value === preset)?.label.toLowerCase()}`);
    if (statuses.length) parts.push(`Status: ${statuses.join(', ')}`);
    return [`Assigned to ${VENDOR}`, `${scoped.length} ${plural(scoped.length, 'SR', 'SRs')}`, ...parts, `as of ${dayjs().format('DD-MMM-YYYY')}`].join(' · ');
  }

  async function handleDownloadChart() {
    if (!svgRef.current) return;
    try {
      await downloadChartPng(svgRef.current, {
        title: 'How many times the closure date was changed',
        subtitle: filterSummary(),
        filename: `Closure_date_changes_${VENDOR}_${dayjs().format('YYYY-MM-DD')}.png`,
      });
    } catch { message.error('Could not save the chart image'); }
  }

  // The detailed list that used to sit under the chart: the SRs the chart currently covers.
  async function handleExport() {
    if (!scoped.length) return;
    const XLSX = await import('xlsx');
    const rows = scoped.map(r => {
      const out = {
        'SR Number': r.sr_number, 'SR Date': fmt(r.sr_date), Status: r.status,
        Comment: r.last_comment || '', Changes: r.change_count,
      };
      for (let i = 0; i < ecdColumnCount; i++) out[`ECD${i + 1}`] = fmt(r.ecd_sequence[i]) || '';
      return out;
    });
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, `Assigned to ${VENDOR}`.slice(0, 31));
    XLSX.writeFile(wb, `Assigned_to_${VENDOR}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  }

  const hasData = !!report?.data?.length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#8c8c8c', fontSize: 12 }}>SRs raised:</span>
          <Segmented
            options={PRESETS} value={preset}
            onChange={p => { setPreset(p); if (p !== 'custom') setRange(null); }}
          />
          {preset === 'custom' && (
            <RangePicker
              format="DD-MMM-YYYY" allowClear value={range} onChange={setRange}
              disabledDate={d => d.isAfter(dayjs(), 'day')}
            />
          )}
          <Select
            mode="multiple" allowClear maxTagCount="responsive" placeholder="All statuses" style={{ minWidth: 180, maxWidth: 320 }}
            value={statuses} onChange={setStatuses}
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s }))}
          />
          {(preset !== 'all' || statuses.length > 0) && (
            <Button onClick={() => { setPreset('all'); setRange(null); setStatuses([]); }}>Reset</Button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button icon={<ReloadOutlined />} onClick={fetchReport} loading={loading} title="Refresh" />
          <Button icon={<DownloadOutlined />} disabled={!scoped.length} onClick={handleDownloadChart}>
            Download chart
          </Button>
          <Button
            icon={<FileExcelOutlined />} disabled={!scoped.length} onClick={handleExport}
            title={`Detailed list of the ${scoped.length} ${plural(scoped.length, 'SR', 'SRs')} in the chart, with every closure date`}
          >
            Download details (Excel)
          </Button>
        </div>
      </div>

      <Panel title="How many times the closure date was changed">
        {!report && loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          : report && !hasData ? <Empty description={`No SRs currently assigned to ${VENDOR}`} style={{ margin: '24px 0' }} />
            : <EcdChangesChart rows={scoped} selected={pickedCount} onSelect={setChangesPicked} svgRef={svgRef} />}
      </Panel>

      <ChangesDrawer changes={pickedCount} rows={pickedRows} onClose={() => setChangesPicked(null)} />
    </div>
  );
}

export default function Reports() {
  const items = [
    { key: 'assigned-deloitte', label: 'Assigned to Deloitte', children: <AssignedToEcdReport /> },
  ];
  return (
    <Reveal>
      <div style={{ width: '100%' }}>
        <Title level={5}>Reports</Title>
        <Tabs defaultActiveKey="assigned-deloitte" items={items} />
      </div>
    </Reveal>
  );
}
