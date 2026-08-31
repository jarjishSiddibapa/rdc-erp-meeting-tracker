import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Table, Button, Tag, Space, Input,
  message, Typography, Row, Col, Card, Statistic
} from 'antd';
import { PlusOutlined, ReloadOutlined, FileExcelOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { srAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SRForm from '../components/SRForm';
import SRDetail from '../components/SRDetail';
import ClosureDateCell from '../components/ClosureDateCell';
import CommentCell from '../components/CommentCell';
import { Reveal } from '../components/ui/Reveal';
import BrandButton from '../components/ui/BrandButton';
import ResizableTitle from '../components/ui/ResizableTitle';
import { paginationConfig } from '../utils/pagination';

const BRAND = '#00B51A';

const { Search } = Input;
const { Text } = Typography;

const STATUS_COLORS = {
  'Open': 'blue', 'In Progress': 'orange', 'Pending': 'gold',
  'On Hold': 'purple', 'Pending with User': 'magenta', 'Closed': 'green'
};

const SCOPE_COLORS = { 'Internal': 'blue', 'External': 'magenta' };
const STATUS_VALUES = ['Open', 'In Progress', 'Pending', 'On Hold', 'Pending with User', 'Closed'];

// Hex equivalents of STATUS_COLORS' tag hues, deep enough for white tile text to stay
// readable — so each status tile visually matches that status's Tag color in the table below.
const STATUS_TILE_COLORS = {
  'Open': '#1677ff', 'In Progress': '#fa8c16', 'Pending': '#ad8b00',
  'On Hold': '#722ed1', 'Pending with User': '#c41d7f', 'Closed': '#0e9f6e',
};
const STATUS_STAT_KEY = {
  'Open': 'open', 'In Progress': 'in_progress', 'Pending': 'pending',
  'On Hold': 'on_hold', 'Pending with User': 'pending_with_user', 'Closed': 'closed',
};

function fmt(date) { return date ? dayjs(date).format('DD-MMM-YYYY') : '—'; }
function fmtCreated(row) {
  return row.manageengine_created_at
    ? dayjs(row.manageengine_created_at).format('DD-MMM-YYYY hh:mm A')
    : fmt(row.creation_date);
}

function PendingSinceCell({ days, isClosed }) {
  if (days === null || days === undefined) return <Text type="secondary">—</Text>;
  let color = '#52c41a';          // green  < 15 days
  if (days > 60) color = '#ff4d4f';      // red    > 60
  else if (days > 30) color = '#fa8c16'; // orange > 30
  else if (days > 14) color = '#faad14'; // yellow > 14
  return (
    <span style={{
      fontWeight: 600, fontSize: 13,
      color: isClosed ? '#9ca3af' : color,
    }}>
      {days}d
    </span>
  );
}

// Column definitions vary per category — no Actions column (moved into SR detail popup)
function buildColumns({ category, onView, filters, typeOptions, pendingWithOptions, assignedToOptions }) {
  const cellStyle = { whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.45 };

  // Every column is server-side sortable; sortOrder reflects the currently active sort
  // so the header arrow stays in sync when driven by something other than a header click
  // (e.g. there is no other trigger today, but keeps the column controlled/consistent).
  function sortable(col) {
    return { ...col, sorter: true, sortOrder: filters.sortField === col.dataIndex ? filters.sortOrder : null };
  }

  // Checkbox filter dropdown driven by the server (filteredValue keeps it controlled so
  // it stays in sync with filters set elsewhere, e.g. the stat-tile clicks for Status).
  function withFilter(col, options, filterKey) {
    return {
      ...col,
      filters: options.map(o => ({ text: o, value: o })),
      filteredValue: filters[filterKey] ? filters[filterKey].split(',') : null,
    };
  }

  const srNoCol = sortable({
    title: 'Sr No', dataIndex: 'sr_number', width: 95, fixed: 'left',
    render: (v, row) => (
      <Button type="link" style={{ padding: 0, fontWeight: 600, fontSize: 13 }} onClick={() => onView(row)}>
        {v}
      </Button>
    )
  });

  const lastCommentCol = sortable({
    title: 'Comments',
    dataIndex: 'last_comment_at',
    // Every other column has a width, which is what wires it into the drag-to-resize system
    // below (columns with no width are skipped entirely, so this one previously had no
    // resize handle at all — not "capped early", just never resizable in the first place).
    width: 220,
    render: (_, row) => <CommentCell srId={row.id} lastComment={row.last_comment} lastCommentAt={row.last_comment_at} />,
  });

  const statusCol = withFilter(sortable(
    { title: 'Status', dataIndex: 'status', width: 105, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> }
  ), STATUS_VALUES, 'status');

  const pendingSinceCol = sortable({
    title: 'Pending Since', dataIndex: 'pending_since_days', width: 95,
    render: (_, row) => (
      <PendingSinceCell
        days={row.pending_since_days}
        isClosed={row.status === 'Closed'}
      />
    ),
  });

  const pendingWithCol = withFilter(sortable(
    { title: 'Pending With', dataIndex: 'pending_with', width: 110, render: v => v || '—' }
  ), pendingWithOptions, 'pendingWith');

  const assignedToCol = withFilter(sortable(
    { title: 'Assigned To', dataIndex: 'assigned_to', width: 110, render: v => v || '—' }
  ), assignedToOptions, 'assignedTo');

  if (category === 'Digitization') {
    return [
      srNoCol,
      sortable({ title: 'Project Name', dataIndex: 'project_name', width: 180, render: v => <div style={cellStyle}>{v || '—'}</div> }),
      sortable({ title: 'Process Owner', dataIndex: 'process_owner', width: 120, render: v => v || '—' }),
      pendingWithCol,
      statusCol,
      sortable({ title: 'Creation Date', dataIndex: 'creation_date', width: 105, render: v => fmt(v) }),
      sortable({ title: 'Target Date', dataIndex: 'target_date', width: 100, render: (v, row) => <ClosureDateCell srId={row.id} field="target_date" value={v} warnOverdue status={row.status} /> }),
      pendingSinceCol,
      lastCommentCol,
    ];
  }

  // SR (merged ERP + Deloitte) — ordered per explicit request: Sr No, Description, Creation
  // Date, Comments, Exp. Closure, Pending Since, Assigned To, Status, then everything else.
  return [
    srNoCol,
    sortable({ title: 'Description', dataIndex: 'description', width: 200, render: v => <div style={cellStyle}>{v || '—'}</div> }),
    sortable({ title: 'Created', dataIndex: 'creation_date', width: 145, render: (_, row) => fmtCreated(row) }),
    lastCommentCol,
    sortable({ title: 'Exp. Closure', dataIndex: 'expected_closure_date', width: 100, render: (v, row) => <ClosureDateCell srId={row.id} field="expected_closure_date" value={v} warnOverdue status={row.status} /> }),
    pendingSinceCol,
    assignedToCol,
    statusCol,
    withFilter(sortable({
      title: <>Internal/<br />External</>, dataIndex: 'scope', width: 125,
      render: v => v ? <Tag color={SCOPE_COLORS[v]}>{v}</Tag> : <Text type="secondary">—</Text>
    }), ['Internal', 'External'], 'scope'),
    withFilter(sortable({
      title: 'Type', dataIndex: 'type', width: 105,
      render: v => v ? (
        <Tag style={{ fontSize: 11, whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%' }}>
          {v}
        </Tag>
      ) : '—'
    }), typeOptions, 'type'),
    sortable({ title: 'Created By', dataIndex: 'created_by_name', width: 100, render: v => v || '—' }),
    pendingWithCol,
  ];
}

export default function SRPage({ category, excludeClosed = false, initialSearch = '', initialPendingWith = '' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // A viewer flagged can_edit_digitization by an admin may create/edit Digitization Projects
  // specifically — Service Requests stay read-only for them either way.
  const canEdit = isAdmin || user?.role === 'editor'
    || (user?.role === 'viewer' && !!user?.can_edit_digitization && category === 'Digitization');

  const [srs, setSrs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [typeOptions, setTypeOptions] = useState([]);
  const [pendingWithOptions, setPendingWithOptions] = useState([]);
  const [assignedToOptions, setAssignedToOptions] = useState([]);

  const [filters, setFilters] = useState({ status: '', overdue: false, scope: '', type: '', pendingWith: initialPendingWith, assignedTo: '', search: initialSearch, sortField: '', sortOrder: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });
  const [searchText, setSearchText] = useState(initialSearch);
  const [colWidths, setColWidths] = useState({});
  const searchDebounceRef = useRef(null);

  const [exporting, setExporting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingSR, setEditingSR] = useState(null);
  const [detailSR, setDetailSR] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // A filter change while on page 2+ triggers two fetches in quick succession — one effect
  // fires immediately with the stale page number, a second effect resets page to 1 and fires
  // again with the corrected one (see the two useEffects below). With no ordering guard, the
  // stale-page response resolving after the corrected one would silently overwrite the table
  // with the wrong page's data. fetchSeqRef makes only the most recently *started* fetch's
  // response ever get applied, regardless of which one resolves first.
  const fetchSeqRef = useRef(0);
  const fetchSRs = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    try {
      const params = { category, page: pagination.page, limit: pagination.limit };
      // Active-only mode: lock status filter to non-closed values
      if (excludeClosed && !filters.status && !filters.overdue) params.excludeClosed = 'true';
      if (filters.status) params.status = filters.status;
      if (filters.overdue) params.overdue = 'true';
      if (filters.scope) params.scope = filters.scope;
      if (filters.type) params.type = filters.type;
      if (filters.pendingWith) params.pendingWith = filters.pendingWith;
      if (filters.assignedTo) params.assignedTo = filters.assignedTo;
      if (filters.search) params.search = filters.search;
      if (filters.sortField) { params.sortField = filters.sortField; params.sortOrder = filters.sortOrder; }
      const res = await srAPI.list(params);
      if (seq !== fetchSeqRef.current) return;
      setSrs(res.data.data);
      setTotal(res.data.total);
    } catch {
      if (seq === fetchSeqRef.current) message.error('Failed to load data');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [category, filters, pagination]);

  // Tiles reflect the current search/scope/type/pendingWith selection (but not status —
  // that's what the tiles themselves set) so they "auto change" to match whatever the
  // table is narrowed to, e.g. after navigating in from a Dashboard person-click.
  const fetchStats = useCallback(async () => {
    try {
      const params = { category };
      if (filters.scope) params.scope = filters.scope;
      if (filters.type) params.type = filters.type;
      if (filters.pendingWith) params.pendingWith = filters.pendingWith;
      if (filters.assignedTo) params.assignedTo = filters.assignedTo;
      if (filters.search) params.search = filters.search;
      const res = await srAPI.stats(params);
      setStats(res.data);
    } catch {}
  }, [category, filters.scope, filters.type, filters.pendingWith, filters.assignedTo, filters.search]);

  useEffect(() => { fetchSRs(); fetchStats(); }, [fetchSRs, fetchStats]);
  useEffect(() => { setPagination(p => ({ ...p, page: 1 })); }, [category, filters]);

  // Type and Pending With are free-form historical data (often imported from Excel), so
  // their filter dropdowns list whatever values actually exist rather than a fixed set.
  useEffect(() => {
    if (category !== 'Digitization') {
      srAPI.distinctValues(category, 'type').then(res => setTypeOptions(res.data)).catch(() => {});
      srAPI.distinctValues(category, 'assignedTo').then(res => setAssignedToOptions(res.data)).catch(() => {});
    }
    srAPI.distinctValues(category, 'pendingWith').then(res => setPendingWithOptions(res.data)).catch(() => {});
  }, [category]);

  useEffect(() => () => clearTimeout(searchDebounceRef.current), []);

  // Auto-search once at least 5 characters are typed, debounced so it doesn't fire a
  // request on every keystroke. Pressing Enter / the search icon (onSearch below) still
  // searches immediately regardless of length.
  function handleSearchInputChange(e) {
    const value = e.target.value;
    setSearchText(value);
    clearTimeout(searchDebounceRef.current);
    if (!value) { setFilters(f => ({ ...f, search: '' })); return; }
    searchDebounceRef.current = setTimeout(() => {
      if (value.trim().length >= 5) setFilters(f => ({ ...f, search: value.trim() }));
    }, 400);
  }

  async function handleSubmit(data) {
    setFormLoading(true);
    try {
      if (editingSR) {
        await srAPI.update(editingSR.id, data);
        message.success('Updated successfully');
      } else {
        await srAPI.create(data);
        message.success('Added successfully');
      }
      setFormOpen(false); setEditingSR(null);
      fetchSRs(); fetchStats();
    } catch (e) {
      message.error(e.response?.data?.message || 'Operation failed');
    } finally { setFormLoading(false); }
  }

  async function handleClose(sr) {
    try {
      await srAPI.close(sr.id);
      message.success(`${sr.sr_number} closed`);
      fetchSRs(); fetchStats();
    } catch (e) { message.error(e.response?.data?.message || 'Failed to close'); }
  }

  async function handleReopen(sr) {
    try {
      await srAPI.reopen(sr.id);
      message.success(`${sr.sr_number} reopened`);
      fetchSRs(); fetchStats();
    } catch (e) { message.error(e.response?.data?.message || 'Failed to reopen'); }
  }

  async function handleDelete(id) {
    try {
      await srAPI.delete(id);
      message.success('Deleted');
      fetchSRs(); fetchStats();
    } catch (e) { message.error(e.response?.data?.message || 'Delete failed'); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = { category, limit: 100000, page: 1 };
      if (excludeClosed && !filters.status && !filters.overdue) params.excludeClosed = 'true';
      if (filters.status) params.status = filters.status;
      if (filters.overdue) params.overdue = 'true';
      if (filters.scope) params.scope = filters.scope;
      if (filters.type) params.type = filters.type;
      if (filters.pendingWith) params.pendingWith = filters.pendingWith;
      if (filters.assignedTo) params.assignedTo = filters.assignedTo;
      if (filters.search) params.search = filters.search;
      if (filters.sortField) { params.sortField = filters.sortField; params.sortOrder = filters.sortOrder; }
      const res = await srAPI.list(params);
      if (!res.data.data.length) { message.info('No data to export'); return; }
      // xlsx is a 421KB dependency only Export actually needs — dynamic-imported here so it
      // doesn't load on every SR-page visit, only when someone actually clicks Export.
      const { exportSRsToExcel } = await import('../utils/exportExcel');
      exportSRsToExcel(category, res.data.data);
    } catch { message.error('Failed to export'); }
    finally { setExporting(false); }
  }

  const openDetail = useCallback(async (row) => {
    try {
      const res = await srAPI.get(row.id);
      setDetailSR(res.data);
      setDetailOpen(true);
    } catch { message.error('Failed to load details'); }
  }, []);

  // User-resized column widths (drag the handle at a column's right edge), keyed by
  // dataIndex — persists for the life of this table instance (category switches remount
  // the component via Dashboard's `key`, so widths don't leak between SR/Digitization).
  // rawColumns is memoized on its real inputs — without this, typing in the search box (which
  // re-renders this component via `searchText` state on every keystroke, well before the
  // debounced `filters.search` itself ever changes) was rebuilding all ~12-14 column configs
  // — fresh render closures, fresh onHeaderCell/onResize — on every character typed, which
  // antd/rc-table then treats as "columns changed" and re-renders every visible row for.
  const rawColumns = useMemo(
    () => buildColumns({ category, onView: openDetail, filters, typeOptions, pendingWithOptions, assignedToOptions }),
    [category, openDetail, filters, typeOptions, pendingWithOptions, assignedToOptions]
  );
  const columns = useMemo(() => rawColumns.map(col => {
    const width = colWidths[col.dataIndex] ?? col.width;
    if (!width) return col;
    return {
      ...col,
      width,
      onHeaderCell: () => ({
        width,
        onResize: (_e, { size }) => {
          setColWidths(w => ({ ...w, [col.dataIndex]: Math.max(60, size.width) }));
        },
      }),
    };
  }), [rawColumns, colWidths]);

  const isDigitization = category === 'Digitization';
  const hasActiveFilters = !!(filters.status || filters.overdue || filters.scope || filters.type || filters.pendingWith || filters.assignedTo || filters.search);

  function handleClearFilters() {
    clearTimeout(searchDebounceRef.current);
    setSearchText('');
    setFilters(f => ({ ...f, status: '', overdue: false, scope: '', type: '', pendingWith: '', assignedTo: '', search: '' }));
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Stats strip — every status bucket gets its own tile (so nothing is invisible, e.g.
          a whole "Pending with User" caseload no longer hides inside an undifferentiated
          Total), plus Overdue as a distinct, genuinely actionable metric. Click a tile to
          filter the table by that status (or by Overdue); click Total to clear both. */}
      {stats && (
        <Reveal>
          <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
            {[
              { label: 'Total', value: stats.total, color: BRAND, kind: 'status', statusValue: '' },
              ...STATUS_VALUES.map(s => ({ label: s, value: stats[STATUS_STAT_KEY[s]], color: STATUS_TILE_COLORS[s], kind: 'status', statusValue: s })),
              { label: 'Overdue', value: stats.overdue, color: '#cf1322', kind: 'overdue' },
            ].map(s => {
              const active = s.kind === 'overdue' ? filters.overdue : (!filters.overdue && filters.status === s.statusValue);
              return (
                <Col key={s.label} xs={12} sm={8} md={6} lg={3}>
                  <Card
                    size="small"
                    className="shadow-soft"
                    onClick={() => setFilters(f => (
                      s.kind === 'overdue' ? { ...f, status: '', overdue: true } : { ...f, status: s.statusValue, overdue: false }
                    ))}
                    style={{
                      textAlign: 'center', background: s.color, border: 'none', cursor: 'pointer', borderRadius: 10,
                      boxShadow: active ? '0 0 0 3px rgba(0,0,0,0.35) inset' : 'none',
                    }}
                  >
                    <Statistic
                      title={<span style={{ color: '#fff' }}>{s.label}</span>}
                      value={s.value}
                      valueStyle={{ fontSize: 18, color: '#fff', fontWeight: 600 }}
                    />
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Reveal>
      )}

      {/* Filters */}
      <Reveal delay={0.05}>
        <Row gutter={[8, 8]} style={{ marginBottom: 12 }} align="middle">
          <Col xs={24} md flex="auto">
            <Search
              placeholder={`Search Sr No, ${isDigitization ? 'project name' : 'description'}, pending with... (auto-searches after 5 letters)`}
              allowClear
              value={searchText}
              onSearch={v => setFilters(f => ({ ...f, search: v.trim() }))}
              onChange={handleSearchInputChange}
            />
          </Col>
          <Col><Button icon={<ReloadOutlined />} onClick={fetchSRs} /></Col>
          <Col>
            <Button icon={<ClearOutlined />} disabled={!hasActiveFilters} onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </Col>
          <Col>
            <Button icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>
              Export Excel
            </Button>
          </Col>
          {canEdit && (
            <Col>
              <BrandButton icon={<PlusOutlined />} onClick={() => { setEditingSR(null); setFormOpen(true); }}>
                Add {isDigitization ? 'Project' : 'SR'}
              </BrandButton>
            </Col>
          )}
        </Row>
      </Reveal>

      <Reveal delay={0.1}>
        <Card size="small" className="shadow-soft" style={{ borderRadius: 10 }} styles={{ body: { padding: 8 } }}>
          <Table
            rowKey="id"
            columns={columns}
            components={{ header: { cell: ResizableTitle } }}
            dataSource={srs}
            loading={loading}
            scroll={{ x: isDigitization ? 900 : 1310, y: 'calc(100vh - 340px)' }}
            size="small"
            rowClassName={row => row.status === 'Closed' ? 'row-closed' : ''}
            onChange={(paginationInfo, tableFilters, sorter) => {
              setPagination({ page: paginationInfo.current, limit: paginationInfo.pageSize });
              // Only touch `filters` if a filter/sort actually changed — otherwise a plain
              // pagination click would produce a new `filters` object and trip the
              // "reset to page 1 on filter change" effect below, breaking pagination.
              const next = {
                status: (tableFilters.status || []).join(','),
                scope: (tableFilters.scope || []).join(','),
                type: (tableFilters.type || []).join(','),
                pendingWith: (tableFilters.pending_with || []).join(','),
                assignedTo: (tableFilters.assigned_to || []).join(','),
                sortField: sorter.order ? sorter.field : '',
                sortOrder: sorter.order || '',
              };
              setFilters(f => (
                f.status === next.status && f.scope === next.scope && f.type === next.type &&
                f.pendingWith === next.pendingWith && f.assignedTo === next.assignedTo &&
                f.sortField === next.sortField && f.sortOrder === next.sortOrder
              ) ? f : { ...f, ...next });
            }}
            pagination={paginationConfig(isDigitization ? 'projects' : 'SRs', {
              current: pagination.page,
              pageSize: pagination.limit,
              total,
            })}
          />
        </Card>
      </Reveal>

      <SRForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingSR(null); }}
        onSubmit={handleSubmit}
        initialValues={editingSR}
        category={category}
        loading={formLoading}
      />

      <SRDetail
        sr={detailSR}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={updated => { setDetailSR(updated); fetchSRs(); fetchStats(); }}
        onEdit={row => { setEditingSR(row); setFormOpen(true); }}
        onCloseSR={async (sr) => { await handleClose(sr); }}
        onReopenSR={async (sr) => { await handleReopen(sr); }}
        onDelete={async (id) => { await handleDelete(id); }}
      />
    </div>
  );
}
