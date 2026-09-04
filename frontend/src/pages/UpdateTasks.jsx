import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  Card, Button, Table, Alert, Space, Typography,
  Row, Col, Result, Upload, Tabs, Tag, Collapse, Select, Popconfirm, message
} from 'antd';
import {
  FileExcelOutlined, DownloadOutlined, UploadOutlined, FilePdfOutlined, SyncOutlined, StopOutlined
} from '@ant-design/icons';
import { srAPI, csvImportAPI, deloitteImportAPI, manageEngineImportAPI } from '../services/api';
import { Reveal } from '../components/ui/Reveal';
import BrandButton from '../components/ui/BrandButton';
import SRDetail from '../components/SRDetail';
import { compactPaginationConfig } from '../utils/pagination';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const BRAND = '#00B51A';

const SHEET_NAMES = { SR: 'Service Requests', Digitization: 'Digitization Projects' };

const TASK_FIELDS = {
  SR: [
    { key: 'sr_number',             label: 'Sr No' },
    { key: 'description',           label: 'Description' },
    { key: 'scope',                 label: 'Internal/External' },
    { key: 'type',                  label: 'Type' },
    { key: 'creation_date',         label: 'Creation Date', date: true },
    { key: 'status',                label: 'Status' },
    { key: 'created_by_name',       label: 'Created By' },
    { key: 'pending_with',          label: 'Pending With' },
    { key: 'assigned_to',           label: 'Assigned To' },
    { key: 'expected_closure_date', label: 'Expected Closure Date', date: true },
    { key: 'closed_date',           label: 'Closed Date', date: true },
  ],
  Digitization: [
    { key: 'sr_number',     label: 'Sr No' },
    { key: 'project_name',  label: 'Project Name' },
    { key: 'process_owner', label: 'Process Owner' },
    { key: 'pending_with',  label: 'Pending With' },
    { key: 'status',        label: 'Current Status' },
    { key: 'creation_date', label: 'Creation Date', date: true },
    { key: 'target_date',   label: 'Target Date', date: true },
    { key: 'closed_date',   label: 'Closed Date', date: true },
  ],
};

function categoryLabel(c) { return c === 'SR' ? 'Service Requests' : c; }

function ResultSummary({ result, reset, tiles }) {
  if (result.error) {
    return <Result status="error" title="Import Failed" subTitle={result.error} extra={<Button onClick={reset}>Try Again</Button>} />;
  }
  return (
    <Result
      status="success" title="Import Complete!"
      subTitle={`${result.imported} new, ${result.updated ?? 0} updated, ${result.skipped} skipped`}
      extra={[
        <Button key="another" onClick={reset}>Import Another File</Button>,
        <Button key="view" type="primary" onClick={() => window.location.reload()}>View SRs</Button>,
      ]}
    >
      <Row gutter={16} style={{ textAlign: 'center' }}>
        {tiles.map(t => (
          <Col span={24 / tiles.length} key={t.label}>
            <Card size="small">
              <Title level={3} style={{ color: t.color, margin: 0 }}>{t.value}</Title>
              <Text type="secondary">{t.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>
      {result.errors?.length > 0 && (
        <Alert type="warning" showIcon message="Some rows had errors"
          description={result.errors.slice(0, 20).join('\n')}
          style={{ marginTop: 16, textAlign: 'left' }}
        />
      )}
    </Result>
  );
}

// ── Update Task Data (SR + Digitization data fields, one workbook, two sheets) ──
function UpdateTaskData() {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);

  async function handleDownload() {
    setDownloading(true);
    try {
      // xlsx (421KB) and excelIO.js are only needed once someone actually clicks Download -
      // dynamic-imported here instead of at module load, same reasoning as SRPage.jsx's export.
      const [XLSX, { buildSheet }, [srRes, digRes]] = await Promise.all([
        import('xlsx'),
        import('../utils/excelIO'),
        Promise.all([
          srAPI.list({ category: 'SR', limit: 100000, page: 1 }),
          srAPI.list({ category: 'Digitization', limit: 100000, page: 1 }),
        ]),
      ]);
      const wb = XLSX.utils.book_new();
      buildSheet(wb, SHEET_NAMES.SR, TASK_FIELDS.SR, srRes.data.data);
      buildSheet(wb, SHEET_NAMES.Digitization, TASK_FIELDS.Digitization, digRes.data.data);
      XLSX.writeFile(wb, `RDC_Update_Tasks_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    } catch {
      setResult({ error: 'Failed to prepare the download. Try again.' });
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload(file) {
    setUploading(true); setResult(null); setFileName(file.name);
    try {
      const { readWorkbook, readSheetAsFields } = await import('../utils/excelIO');
      const wb = await readWorkbook(file);
      const summary = { imported: 0, updated: 0, skipped: 0, errors: [] };
      let sheetsFound = 0;

      for (const category of ['SR', 'Digitization']) {
        const rows = readSheetAsFields(wb, SHEET_NAMES[category], TASK_FIELDS[category]);
        if (!rows) continue;
        sheetsFound++;
        const nonEmpty = rows.filter(r => r.sr_number);
        if (!nonEmpty.length) continue;
        const res = await csvImportAPI.execute(category, nonEmpty);
        summary.imported += res.data.imported;
        summary.updated += res.data.updated ?? 0;
        summary.skipped += res.data.skipped;
        summary.errors.push(...(res.data.errors || []).map(e => `[${categoryLabel(category)}] ${e}`));
      }

      if (sheetsFound === 0) {
        setResult({ error: `Couldn't find the "${SHEET_NAMES.SR}" or "${SHEET_NAMES.Digitization}" sheet in this file. Download the current data first and edit that file, rather than building one from scratch.` });
      } else {
        setResult(summary);
      }
    } catch (e) {
      setResult({ error: e.response?.data?.message || (e.message === 'Network Error' ? 'Cannot reach server - please restart the backend and try again' : 'Could not read that file - make sure it\'s the .xlsx you downloaded from here.') });
    } finally {
      setUploading(false);
    }
    return false; // prevent antd Upload's own upload behavior
  }

  function reset() { setResult(null); setFileName(''); }

  return (
    <div>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Download the current data as one Excel file - Service Requests and Digitization Projects
        each get their own sheet inside it. Edit it in Excel (add rows for new tasks, change status,
        push out a closure date, whatever's needed), save it, then upload the same file back here.
        Matching an existing Sr No updates that row field-by-field; a new Sr No creates a new record.
        Blank cells are left alone rather than clearing existing data.
      </Paragraph>

      {!result ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>1. Download current data</Text>
                <br />
                <BrandButton
                  icon={<DownloadOutlined />} loading={downloading} onClick={handleDownload}
                  style={{ marginTop: 8 }}
                >
                  Download Excel (SR + Digitization)
                </BrandButton>
              </div>

              <div>
                <Text strong>2. Edit it in Excel, then upload the same file</Text>
                <Dragger
                  accept=".xlsx,.xls"
                  beforeUpload={handleUpload}
                  showUploadList={false}
                  style={{ marginTop: 8 }}
                >
                  <p className="ant-upload-drag-icon"><FileExcelOutlined style={{ fontSize: 36, color: BRAND }} /></p>
                  <p className="ant-upload-text">{uploading ? `Importing ${fileName}...` : 'Click or drag your edited Excel file here'}</p>
                  <p className="ant-upload-hint">Must have "{SHEET_NAMES.SR}" and/or "{SHEET_NAMES.Digitization}" sheets - same as the download.</p>
                </Dragger>
              </div>
            </Space>
          </Card>
        </Space>
      ) : (
        <Card>
          <ResultSummary result={result} reset={reset} tiles={[
            { label: 'New', value: result.imported, color: '#52c41a' },
            { label: 'Updated', value: result.updated, color: BRAND },
            { label: 'Skipped', value: result.skipped, color: '#faad14' },
            { label: 'Errors', value: result.errors?.length || 0, color: '#ff4d4f' },
          ]} />
        </Card>
      )}
    </div>
  );
}

// ── Upload Deloitte PDF (weekly PDF → preview → apply) ──
// Deloitte's weekly status report PDF has two actionable tables: "Work in Progress" (Request
// ID, Comments, Expected Closure Date) and "Pending with User" (Request ID only). Upload the
// PDF, review what got parsed and matched against real SRs, then apply - nothing touches the
// database until Apply is clicked.
function fmtEta(v) { return v ? dayjs(v).format('DD-MMM-YYYY') : '-'; }

function MatchTag({ matched, canApply = true }) {
  if (!canApply) return <Tag color="red">Conflict - skipped</Tag>;
  return matched ? <Tag color="green">Found</Tag> : <Tag color="gold">Will create new SR</Tag>;
}

const CLASSIFICATION_COLOR = {
  'Work in Progress': 'blue',
  'Pending with User': 'purple',
  'Not relevant - skipped': 'default',
};

// Lets the admin see exactly what the parser did with every single page in the PDF, rather
// than trusting silently that nothing relevant was missed - addresses the "not 100% sure
// everything is picked up" concern directly instead of just asserting it's fine.
function PageCoverage({ pageSummary }) {
  if (!pageSummary?.length) return null;
  const actionable = pageSummary.filter(p => p.classification !== 'Not relevant - skipped').length;
  const columns = [
    { title: 'Page', dataIndex: 'page', width: 70 },
    { title: 'First line', dataIndex: 'firstLine', ellipsis: true, render: v => v || <Text type="secondary">(blank)</Text> },
    { title: 'Classified as', dataIndex: 'classification', width: 190, render: v => <Tag color={CLASSIFICATION_COLOR[v] || 'default'}>{v}</Tag> },
    { title: 'Rows found', dataIndex: 'rowsFound', width: 100, render: v => v ?? <Text type="secondary">-</Text> },
  ];
  return (
    <Collapse
      size="small"
      items={[{
        key: 'coverage',
        label: `Page-by-page coverage (${pageSummary.length} pages - ${actionable} used)`,
        children: (
          <Table
            rowKey="page" size="small" columns={columns} dataSource={pageSummary}
            pagination={false}
          />
        ),
      }]}
    />
  );
}

function UploadDeloittePdf() {
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { wip, pendingWithUser }
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleUpload(file) {
    setParsing(true); setError(''); setResult(null); setParsed(null); setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await deloitteImportAPI.parse(formData);
      setParsed(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not read that PDF - make sure it\'s the Deloitte weekly status report.');
    } finally {
      setParsing(false);
    }
    return false;
  }

  async function handleApply() {
    if (!parsed) return;
    setApplying(true);
    try {
      const res = await deloitteImportAPI.apply(parsed);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to apply updates.');
    } finally {
      setApplying(false);
    }
  }

  function reset() { setParsed(null); setResult(null); setError(''); setFileName(''); }

  const wipMatched = parsed?.wip.filter(r => r.matched).length ?? 0;
  const pendingMatched = parsed?.pendingWithUser.filter(r => r.matched).length ?? 0;
  const totalMatched = wipMatched + pendingMatched;
  const totalRows = (parsed?.wip.length ?? 0) + (parsed?.pendingWithUser.length ?? 0);
  const needsReviewCount = (parsed?.wip.filter(r => r.needsReview && r.can_apply).length ?? 0)
    + (parsed?.pendingWithUser.filter(r => r.needsReview && r.can_apply).length ?? 0);
  const conflictRows = parsed ? [...parsed.wip, ...parsed.pendingWithUser].filter(r => !r.can_apply) : [];
  const applicableRows = totalRows - conflictRows.length;

  const reviewColumn = {
    title: 'Review', dataIndex: 'needsReview', width: 110,
    render: (v, row) => !row.can_apply
      ? <Tag color="red">Blocked</Tag>
      : v ? <Tag color="orange">Check manually</Tag> : <Tag color="green">OK</Tag>,
  };

  const wipColumns = [
    { title: 'SR Number', dataIndex: 'request_id', width: 100 },
    { title: 'Subject', dataIndex: 'subject', ellipsis: true, render: v => v || <Text type="secondary">-</Text> },
    { title: 'Comment', dataIndex: 'comment', render: v => v || <Text type="secondary">-</Text> },
    { title: 'New Expected Closure', dataIndex: 'eta', width: 150, render: fmtEta },
    { title: 'Match', dataIndex: 'matched', width: 150, render: (v, row) => <MatchTag matched={v} canApply={row.can_apply} /> },
    reviewColumn,
  ];

  const pendingColumns = [
    { title: 'SR Number', dataIndex: 'request_id', width: 100 },
    { title: 'Subject', dataIndex: 'subject', ellipsis: true, render: v => v || <Text type="secondary">-</Text> },
    { title: 'Current Status', dataIndex: 'current_status', width: 140, render: v => v || <Text type="secondary">-</Text> },
    {
      title: 'Expected Closure', dataIndex: 'current_ecd', width: 190,
      render: v => v
        ? <Space size={4}><Text delete type="secondary">{fmtEta(v)}</Text><Text type="secondary">→ will be cleared</Text></Space>
        : <Text type="secondary">- (already empty)</Text>,
    },
    { title: 'Match', dataIndex: 'matched', width: 150, render: (v, row) => <MatchTag matched={v} canApply={row.can_apply} /> },
    reviewColumn,
  ];

  return (
    <div>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Upload the weekly Deloitte status report PDF. "Work in Progress" rows add their comment,
        push the Expected Closure Date forward if an ETA is present (with full history, same as
        editing it by hand), and have both Assigned To and <Text strong>Pending With</Text> set
        to <Text strong>Deloitte</Text> - the ticket is sitting with them awaiting action.
        "Pending with User" rows flip the SR's status to <Text strong>Pending with User</Text>,
        set Assigned To to <Text strong>Deloitte</Text> (leaving Pending With as-is - those are
        waiting on the RDC user to respond, not on Deloitte), and clear any Expected Closure Date
        the SR is still carrying - Deloitte isn't working toward a date while it's waiting on the
        user, so a stale ECD from an earlier week is removed (with full history, same as any
        other change). A Request ID that doesn't match any existing SR gets created from scratch
        (Subject as the description, Internal/External fixed to External) - nothing is left out
        just because it's new. Repeated identical rows are collapsed. If the same SR appears with
        conflicting dates or details, it is visibly blocked and skipped instead of guessing which
        value is correct. Nothing is written to the database until you review the preview below
        and click Apply.
      </Paragraph>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      {!parsed && !result && (
        <Card>
          <Dragger
            accept=".pdf"
            beforeUpload={handleUpload}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon"><FilePdfOutlined style={{ fontSize: 36, color: BRAND }} /></p>
            <p className="ant-upload-text">{parsing ? `Reading ${fileName}...` : 'Click or drag the weekly Deloitte PDF here'}</p>
            <p className="ant-upload-hint">Looks for "Incident Details | Work in Progress" and "Incident Details | Pending with User" tables.</p>
          </Dragger>
        </Card>
      )}

      {parsed && !result && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type={conflictRows.length > 0 ? 'warning' : totalMatched === totalRows ? 'success' : 'info'}
            showIcon
            message={
              conflictRows.length > 0
                ? `${applicableRows} safe row${applicableRows === 1 ? '' : 's'} ready; ${conflictRows.length} conflicting SR${conflictRows.length === 1 ? '' : 's'} blocked`
                : totalMatched === totalRows
                ? `All ${totalRows} rows matched an existing SR`
                : `${totalMatched} of ${totalRows} rows matched an existing SR - the other ${totalRows - totalMatched} will be created as new SRs`
            }
          />

          {needsReviewCount > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${needsReviewCount} row${needsReviewCount === 1 ? '' : 's'} need a manual look - marked "Check manually" below`}
              description="Either the Track label (DBA / P2P / O2C / Finance / PTM) that separates Subject from Comment wasn't found - so the whole line was kept as Subject and Comment may be blank - or the row mentions an ETA that couldn't be parsed into a date, meaning this week's PDF used a date format the parser doesn't recognize yet. Verify these against the PDF before applying."
            />
          )}

          {conflictRows.length > 0 && (
            <Alert
              type="error"
              showIcon
              message={`${conflictRows.length} conflicting SR${conflictRows.length === 1 ? '' : 's'} will not be applied`}
              description={(
                <Space direction="vertical" size={2}>
                  {conflictRows.map(row => (
                    <Text key={row.request_id}>
                      SR {row.request_id}: found {row.duplicate_count} times
                      {row.source_pages?.length ? ` on page${row.source_pages.length === 1 ? '' : 's'} ${row.source_pages.join(', ')}` : ''}.
                      {' '}Verify the source PDF and update this SR manually.
                    </Text>
                  ))}
                </Space>
              )}
            />
          )}

          <PageCoverage pageSummary={parsed.pageSummary} />

          <Card size="small" title={`Work in Progress (${parsed.wip.length})`}>
            <Table
              rowKey="request_id" size="small" columns={wipColumns} dataSource={parsed.wip}
              pagination={parsed.wip.length > 10 ? compactPaginationConfig('rows', { defaultPageSize: 10 }) : false}
            />
          </Card>

          <Card size="small" title={`Pending with User (${parsed.pendingWithUser.length})`}>
            <Table
              rowKey="request_id" size="small" columns={pendingColumns} dataSource={parsed.pendingWithUser}
              pagination={parsed.pendingWithUser.length > 10 ? compactPaginationConfig('rows', { defaultPageSize: 10 }) : false}
            />
          </Card>

          <Space>
            <Button onClick={reset}>Cancel</Button>
            <BrandButton icon={<UploadOutlined />} loading={applying} disabled={applicableRows === 0} onClick={handleApply}>
              Apply {applicableRows} Safe Update{applicableRows === 1 ? '' : 's'}
            </BrandButton>
          </Space>
        </Space>
      )}

      {result && (
        <Card>
          <Result
            status={result.skipped_conflicts > 0 ? 'warning' : 'success'}
            title={result.skipped_conflicts > 0 ? 'Safe Updates Applied; Conflicts Skipped' : 'Updates Applied'}
            extra={<Button type="primary" onClick={() => window.location.reload()}>View SRs</Button>}
          >
            <Row gutter={[16, 16]} style={{ textAlign: 'center' }}>
              {[
                { label: 'SRs Created', value: result.srs_created, color: '#722ed1' },
                { label: 'Comments Added', value: result.comments_added, color: '#52c41a' },
                { label: 'ECD Updated', value: result.ecd_updated, color: BRAND },
                { label: 'ECD Cleared', value: result.ecd_cleared, color: '#fa8c16' },
                { label: 'Status Updated', value: result.status_updated, color: '#1677ff' },
                { label: 'Assigned To Updated', value: result.assigned_to_updated, color: '#13c2c2' },
                { label: 'Pending With Updated', value: result.pending_with_updated, color: '#eb2f96' },
                { label: 'Skipped (Closed)', value: result.skipped_closed, color: '#faad14' },
                { label: 'Skipped (Conflicts)', value: result.skipped_conflicts, color: '#cf1322' },
              ].map(t => (
                <Col xs={12} sm={8} key={t.label}>
                  <Card size="small">
                    <Title level={4} style={{ color: t.color, margin: 0 }}>{t.value}</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t.label}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
            <Button style={{ marginTop: 16 }} onClick={reset}>Upload Another PDF</Button>
          </Result>
        </Card>
      )}
    </div>
  );
}

// ── Update SRs from ManageEngine (reconcile against a per-technician CSV export) ──
// Pick a technician (Assigned To), upload their ManageEngine export, and this reconciles
// tracked open SRs that ManageEngine now shows closed/resolved. Requests absent from the
// local tracker are reported as ignored and can never be created by this workflow.
function UpdateFromManageEngine() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [technicianOptions, setTechnicianOptions] = useState([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selectedCloseKeys, setSelectedCloseKeys] = useState([]);
  const [detailSR, setDetailSR] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [closingId, setClosingId] = useState(null);

  async function refreshSyncStatus() {
    try {
      const res = await manageEngineImportAPI.syncStatus();
      setSyncStatus(res.data);
    } catch { /* The manual CSV fallback remains usable if status lookup fails. */ }
  }

  useEffect(() => {
    srAPI.distinctValues('SR', 'assignedTo').then(res => setTechnicianOptions(res.data)).catch(() => {});
    refreshSyncStatus();
  }, []);

  async function handleSyncNow() {
    setSyncLoading(true);
    setError('');
    try {
      const res = await manageEngineImportAPI.syncNow();
      const summary = res.data;
      message.success(`ManageEngine sync complete: ${summary.updated || 0} updated, ${summary.unchanged || 0} unchanged`);
      await refreshSyncStatus();
    } catch (e) {
      setError(e.response?.data?.message || 'ManageEngine API sync failed. Check the API configuration and server log.');
      await refreshSyncStatus();
    } finally {
      setSyncLoading(false);
    }
  }

  // Ambiguous rows (tracked as open here, absent from the export) need a way to actually
  // resolve them right here instead of just being told about them - either open the full SR
  // detail popup (same one used everywhere else in the app: edit, comment, close, reopen) or
  // one-click close for the common case where it's obviously just done.
  async function openAmbiguousDetail(row) {
    try {
      const res = await srAPI.get(row.sr_id);
      setDetailSR(res.data);
      setDetailOpen(true);
    } catch { message.error('Failed to load SR details'); }
  }

  function removeResolvedAmbiguous(srId) {
    setParsed(p => p ? { ...p, ambiguous: p.ambiguous.filter(r => r.sr_id !== srId) } : p);
  }

  async function handleQuickClose(row) {
    setClosingId(row.sr_id);
    try {
      await srAPI.close(row.sr_id);
      message.success(`${row.sr_number} closed`);
      removeResolvedAmbiguous(row.sr_id);
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to close');
    } finally {
      setClosingId(null);
    }
  }

  async function handleDetailClose(sr) {
    try {
      await srAPI.close(sr.id);
      message.success(`${sr.sr_number} closed`);
      removeResolvedAmbiguous(sr.id);
    } catch (e) { message.error(e.response?.data?.message || 'Failed to close'); }
  }

  async function handleDetailReopen(sr) {
    try {
      await srAPI.reopen(sr.id);
      message.success(`${sr.sr_number} reopened`);
      // Still open, still absent from the export -- leave it in the ambiguous list so it
      // isn't silently forgotten; only actually closing (or deleting) resolves the flag.
    } catch (e) { message.error(e.response?.data?.message || 'Failed to reopen'); }
  }

  async function handleDetailDelete(id) {
    try {
      await srAPI.delete(id);
      message.success('Deleted');
      removeResolvedAmbiguous(id);
      setDetailOpen(false);
    } catch (e) { message.error(e.response?.data?.message || 'Delete failed'); }
  }

  async function handleUpload(file) {
    if (!assignedTo) { setError('Select a technician (Assigned To) before uploading.'); return false; }
    setParsing(true); setError(''); setResult(null); setParsed(null); setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('csv', file);
      formData.append('assignedTo', assignedTo);
      const res = await manageEngineImportAPI.parse(formData);
      setParsed(res.data);
      setSelectedCloseKeys(res.data.toClose.map(r => r.sr_id));
    } catch (e) {
      setError(e.response?.data?.message || "Could not read that CSV - make sure it's a ManageEngine export with the expected columns.");
    } finally {
      setParsing(false);
    }
    return false;
  }

  async function handleApply() {
    if (!parsed) return;
    setApplying(true);
    try {
      const toClose = parsed.toClose.filter(r => selectedCloseKeys.includes(r.sr_id));
      const res = await manageEngineImportAPI.apply({ assignedTo, toClose });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to apply updates.');
    } finally {
      setApplying(false);
    }
  }

  function reset() {
    setParsed(null); setResult(null); setError(''); setFileName('');
    setSelectedCloseKeys([]);
  }

  const closeColumns = [
    { title: 'SR Number', dataIndex: 'sr_number', width: 100 },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: v => v || <Text type="secondary">-</Text> },
    { title: 'Current Status', dataIndex: 'current_status', width: 130, render: v => <Tag>{v}</Tag> },
    { title: 'ManageEngine Status', dataIndex: 'manageengine_status', width: 160, render: v => <Tag color="red">{v}</Tag> },
  ];

  // Resolvable right here instead of just being reported: click the SR number for the full
  // detail popup (edit, comment, close, reopen - same one used everywhere else in the app),
  // or one-click Close for the common case where it's obviously just done.
  const ambiguousColumns = [
    {
      title: 'SR Number', dataIndex: 'sr_number', width: 110,
      render: (v, row) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => openAmbiguousDetail(row)}>
          {v}
        </Button>
      ),
    },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: v => v || <Text type="secondary">-</Text> },
    {
      title: 'Resolve', width: 200,
      render: (_, row) => (
        <Space size={8}>
          <Button size="small" onClick={() => openAmbiguousDetail(row)}>View / Edit</Button>
          <Popconfirm
            title={`Close ${row.sr_number}?`}
            description="Use this once you've confirmed it's actually done in ManageEngine."
            onConfirm={() => handleQuickClose(row)}
          >
            <Button size="small" danger icon={<StopOutlined />} loading={closingId === row.sr_id}>Close</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalActions = selectedCloseKeys.length;

  return (
    <div>
      <Card
        size="small"
        title={<Space><SyncOutlined style={{ color: BRAND }} />Automatic API sync</Space>}
        extra={<Button icon={<SyncOutlined />} loading={syncLoading || syncStatus?.running} disabled={!syncStatus?.configured} onClick={handleSyncNow}>Sync now</Button>}
        style={{ marginBottom: 20 }}
      >
        {!syncStatus?.configured ? (
          <Alert
            type="warning"
            showIcon
            message="ManageEngine API credentials are not configured"
            description={`Add the missing values to backend/.env${syncStatus?.missing_configuration?.length ? `: ${syncStatus.missing_configuration.join(', ')}` : ''}, then restart the server.`}
          />
        ) : (
          <>
            <Alert
              type={syncStatus.enabled ? 'success' : 'info'}
              showIcon
              message={syncStatus.enabled ? `Automatic sync runs every ${syncStatus.interval_minutes} minutes` : 'API is configured; automatic sync is currently disabled'}
              description="Only SR numbers that already exist in this tracker are refreshed. Untracked ManageEngine requests are ignored and never created automatically. Local descriptions are never overwritten."
            />
            {syncStatus.last_run && (
              <Row gutter={[12, 12]} style={{ marginTop: 14 }}>
                {[
                  ['Last result', syncStatus.last_run.status],
                  ['Matched', syncStatus.last_run.matched],
                  ['Updated', syncStatus.last_run.updated],
                  ['Unchanged', syncStatus.last_run.unchanged],
                  ['Not found', syncStatus.last_run.missing],
                  ['Finished', syncStatus.last_run.finished_at ? dayjs(syncStatus.last_run.finished_at).format('DD-MMM-YYYY hh:mm A') : 'Running'],
                ].map(([label, value]) => (
                  <Col xs={12} sm={8} md={4} key={label}>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{label}</Text>
                    <Text strong>{value ?? 0}</Text>
                  </Col>
                ))}
              </Row>
            )}
          </>
        )}
      </Card>

      <Title level={5} style={{ marginBottom: 6 }}>Manual CSV fallback</Title>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Reconcile this app against a ManageEngine export for one technician. Pick who the export
        belongs to (Assigned To), then upload it. Only SRs already tracked here can be closed from
        the export, with full history just like closing them by hand. Open or closed ManageEngine
        tickets that do not exist in this tracker are ignored. Nothing is written until you review
        the preview below and click Apply.
      </Paragraph>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      {!parsed && !result && (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>Assigned To (Technician)</Text>
              <Select
                style={{ width: '100%', marginTop: 6 }}
                placeholder="Select the technician this export belongs to"
                value={assignedTo || undefined}
                onChange={setAssignedTo}
                options={technicianOptions.map(v => ({ value: v, label: v }))}
                showSearch
              />
            </div>
            <Dragger
              accept=".csv"
              beforeUpload={handleUpload}
              showUploadList={false}
              disabled={!assignedTo}
            >
              <p className="ant-upload-drag-icon"><SyncOutlined style={{ fontSize: 36, color: BRAND }} /></p>
              <p className="ant-upload-text">
                {parsing ? `Reading ${fileName}...` : assignedTo ? 'Click or drag the ManageEngine CSV export here' : 'Select a technician above first'}
              </p>
              <p className="ant-upload-hint">Expects these ManageEngine columns: Request ID, Technician.Name, Status.Name.</p>
            </Dragger>
          </Space>
        </Card>
      )}

      {parsed && !result && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {parsed.technicianMismatch && (
            <Alert type="warning" showIcon
              message={`Heads up: most rows in this file (${parsed.technicianMismatch.csvTechnicianCount} of ${parsed.technicianMismatch.totalRows}) show Technician.Name = "${parsed.technicianMismatch.csvTechnician}", not "${assignedTo}" - double-check you picked the right file.`}
            />
          )}

          <Alert type="info" showIcon
            message={`${parsed.toClose.length} tracked SR${parsed.toClose.length === 1 ? '' : 's'} to close, ${parsed.alreadyOpenBothCount} already tracked and still open (no action), ${parsed.untrackedOpenCount} open-and-untracked ignored, ${parsed.closedNeverTrackedCount} closed-and-untracked ignored`}
          />

          {parsed.ambiguous.length > 0 && (
            <>
              <Alert type="warning" showIcon
                message={`${parsed.ambiguous.length} SR${parsed.ambiguous.length === 1 ? '' : 's'} tracked as open here for ${assignedTo}, but not found anywhere in this export`}
                description="Most likely reassigned to someone else in ManageEngine. Not auto-closed - review these manually."
              />
              <Card size="small" title="Needs manual review">
                <Table rowKey="sr_number" size="small" columns={ambiguousColumns} dataSource={parsed.ambiguous} pagination={false} />
              </Card>
            </>
          )}

          <Card size="small" title={`SRs to close (${parsed.toClose.length})`}>
            <Table
              rowKey="sr_id" size="small" columns={closeColumns} dataSource={parsed.toClose}
              rowSelection={{ selectedRowKeys: selectedCloseKeys, onChange: setSelectedCloseKeys }}
              pagination={parsed.toClose.length > 10 ? compactPaginationConfig('SRs', { defaultPageSize: 10 }) : false}
            />
          </Card>

          <Space>
            <Button onClick={reset}>Cancel</Button>
            <BrandButton icon={<UploadOutlined />} loading={applying}
              disabled={totalActions === 0}
              onClick={handleApply}>
              Apply ({selectedCloseKeys.length} close)
            </BrandButton>
          </Space>
        </Space>
      )}

      {result && (
        <Card>
          <Result
            status="success" title="Updates Applied"
            extra={<Button type="primary" onClick={() => window.location.reload()}>View SRs</Button>}
          >
            <Row gutter={[16, 16]} style={{ textAlign: 'center' }}>
              {[
                { label: 'SRs Closed', value: result.closed, color: BRAND },
              ].map(t => (
                <Col xs={24} key={t.label}>
                  <Card size="small">
                    <Title level={4} style={{ color: t.color, margin: 0 }}>{t.value}</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t.label}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
            <Button style={{ marginTop: 16 }} onClick={reset}>Reconcile Another Technician</Button>
          </Result>
        </Card>
      )}

      <SRDetail
        sr={detailSR}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={updated => setDetailSR(updated)}
        onCloseSR={handleDetailClose}
        onReopenSR={handleDetailReopen}
        onDelete={handleDetailDelete}
      />
    </div>
  );
}

export default function UpdateTasks() {
  return (
    <Reveal>
      <div style={{ maxWidth: 960, width: '100%' }}>
        <Title level={5}>Update Tasks</Title>
        <Tabs
          defaultActiveKey="data"
          items={[
            { key: 'data', label: <Space><UploadOutlined />Update Task Data</Space>, children: <UpdateTaskData /> },
            { key: 'deloitte', label: <Space><FilePdfOutlined />Upload Deloitte PDF</Space>, children: <UploadDeloittePdf /> },
            { key: 'manageengine', label: <Space><SyncOutlined />Update from ManageEngine</Space>, children: <UpdateFromManageEngine /> },
          ]}
        />
      </div>
    </Reveal>
  );
}
