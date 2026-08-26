import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import { Typography, Tabs, Table, Tag, Card, Empty, message, Button } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { reportsAPI, srAPI } from '../services/api';
import { Reveal } from '../components/ui/Reveal';
import ResizableTitle from '../components/ui/ResizableTitle';
import SRDetail from '../components/SRDetail';
import CommentCell from '../components/CommentCell';
import { paginationConfig } from '../utils/pagination';

const { Title } = Typography;

const VENDOR = 'Deloitte';

const STATUS_COLORS = {
  'Open': 'blue', 'In Progress': 'orange', 'Pending': 'gold',
  'On Hold': 'purple', 'Pending with User': 'magenta', 'Closed': 'green'
};

function fmt(d) { return d ? dayjs(d).format('DD-MMM-YYYY') : ''; }

// Fixed to Deloitte — matched case-insensitively against Assigned To so "deloitte" /
// "DELOITTE" / "Deloitte" entered anywhere all roll up into the same report.
function AssignedToEcdReport() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [colWidths, setColWidths] = useState({});
  const tableWrapRef = useRef(null);

  // Clicking an SR Number opens the exact same detail/edit panel the SR page uses, so an
  // SR can be managed (edited, commented on, closed) without leaving the report.
  const [detailSR, setDetailSR] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

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

  const openDetail = useCallback(async (row) => {
    try {
      const res = await srAPI.get(row.id);
      setDetailSR(res.data);
      setDetailOpen(true);
    } catch { message.error('Failed to load details'); }
  }, []);

  async function handleCloseSR(sr) {
    try {
      await srAPI.close(sr.id);
      message.success(`${sr.sr_number} closed`);
      fetchReport();
    } catch (e) { message.error(e.response?.data?.message || 'Failed to close'); }
  }

  async function handleReopenSR(sr) {
    try {
      await srAPI.reopen(sr.id);
      message.success(`${sr.sr_number} reopened`);
      fetchReport();
    } catch (e) { message.error(e.response?.data?.message || 'Failed to reopen'); }
  }

  async function handleDeleteSR(id) {
    try {
      await srAPI.delete(id);
      message.success('Deleted');
      fetchReport();
    } catch (e) { message.error(e.response?.data?.message || 'Delete failed'); }
  }

  // Column count follows the longest sequence actually present in the data — the backend's
  // change_count counts raw history rows, which can outnumber the real sequence when a
  // change's new_value was blank (filtered out), so basing it on max_changes alone left a
  // trailing all-"—" column. Deriving it from ecd_sequence.length avoids that entirely.
  const ecdColumnCount = Math.max(1, ...(report?.data || []).map(r => r.ecd_sequence.length));

  // Wheel-to-pan: this table can grow wide (one column per closure-date push), so Shift+wheel
  // scrolls it sideways — the standard convention (Excel, Sheets, GitHub diffs all use it).
  // Deliberately gated on shiftKey, not just "wheel over the table": an earlier version reacted
  // to plain vertical scrolling too, which hijacked normal page scroll the moment the table
  // needed horizontal room, making the whole panel feel like it scrolled both ways at once.
  useEffect(() => {
    const el = tableWrapRef.current?.querySelector('.ant-table-content');
    if (!el) return;
    function onWheel(e) {
      if (!e.shiftKey) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [report, ecdColumnCount]);

  // Memoized on their real inputs (same reasoning as SRPage.jsx's columns) — this table's
  // column count is data-driven and can grow wide, so rebuilding it on unrelated re-renders
  // (e.g. every column-drag updating colWidths) was wasted work.
  const rawColumns = useMemo(() => [
    {
      title: 'SR Number', dataIndex: 'sr_number', width: 110, fixed: 'left',
      render: (v, row) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600, fontSize: 13 }} onClick={() => openDetail(row)}>
          {v}
        </Button>
      ),
    },
    { title: 'SR Date', dataIndex: 'sr_date', width: 110, render: fmt },
    { title: 'Status', dataIndex: 'status', width: 100, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    {
      title: 'Comment', dataIndex: 'last_comment', width: 180,
      render: (_, row) => <CommentCell srId={row.id} lastComment={row.last_comment} lastCommentAt={row.last_comment_at} />,
    },
    { title: 'Changes', dataIndex: 'change_count', width: 90, align: 'center' },
    ...Array.from({ length: ecdColumnCount }, (_, i) => ({
      title: `ECD${i + 1}`,
      dataIndex: `ecd_${i}`,
      width: 115,
      render: (_, row) => fmt(row.ecd_sequence[i]) || '—',
    })),
  ], [ecdColumnCount, openDetail]);

  // Drag-to-resize column headers, same pattern as the SR/Digitization table.
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

  async function handleExport() {
    if (!report?.data?.length) return;
    const XLSX = await import('xlsx');
    const rows = report.data.map(r => {
      const out = { 'SR Number': r.sr_number, 'SR Date': fmt(r.sr_date), Status: r.status, Changes: r.change_count };
      for (let i = 0; i < ecdColumnCount; i++) out[`ECD${i + 1}`] = fmt(r.ecd_sequence[i]) || '';
      return out;
    });
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, `Assigned to ${VENDOR}`.slice(0, 31));
    XLSX.writeFile(wb, `Assigned_to_${VENDOR}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Button icon={<ReloadOutlined />} onClick={fetchReport} loading={loading} title="Refresh" />
        <Button icon={<DownloadOutlined />} disabled={!report?.data?.length} onClick={handleExport}>
          Export Excel
        </Button>
      </div>

      <Card size="small" className="shadow-soft" style={{ borderRadius: 10 }} styles={{ body: { padding: 8 } }}>
        {report && report.data.length === 0 ? (
          <Empty description={`No SRs currently assigned to ${VENDOR}`} style={{ margin: '24px 0' }} />
        ) : (
          <div ref={tableWrapRef}>
            <Table
              rowKey="sr_number"
              columns={columns}
              components={{ header: { cell: ResizableTitle } }}
              dataSource={report?.data || []}
              loading={loading}
              size="small"
              bordered
              scroll={{ x: 'max-content' }}
              pagination={paginationConfig('SRs', { defaultPageSize: 20 })}
            />
          </div>
        )}
      </Card>

      <SRDetail
        sr={detailSR}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={updated => { setDetailSR(updated); fetchReport(); }}
        onCloseSR={handleCloseSR}
        onReopenSR={handleReopenSR}
        onDelete={handleDeleteSR}
      />
    </div>
  );
}

export default function Reports() {
  return (
    <Reveal>
      <div style={{ width: '100%' }}>
        <Title level={5}>Reports</Title>
        <Tabs
          defaultActiveKey="assigned-deloitte"
          items={[
            { key: 'assigned-deloitte', label: 'Assigned to Deloitte', children: <AssignedToEcdReport /> },
          ]}
        />
      </div>
    </Reveal>
  );
}
