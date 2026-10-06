import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  Card, Button, Table, Alert, Space, Typography,
  Row, Col, Result, Upload, Tabs, Tag, Collapse, Select, Popconfirm, message,
  Modal, Form, Input, Switch, TimePicker
} from 'antd';
import {
  FileExcelOutlined, DownloadOutlined, UploadOutlined, FilePdfOutlined, SyncOutlined, StopOutlined,
  PlusOutlined, MailOutlined, ContactsOutlined
} from '@ant-design/icons';
import { srAPI, csvImportAPI, deloitteImportAPI, manageEngineImportAPI, contactsAPI, pendingRemindersAPI } from '../services/api';
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

function MatchTag({ matched, canApply = true, duplicateConflict = false }) {
  if (!canApply) return <Tag color="red">{duplicateConflict ? 'Conflict - skipped' : 'Review - skipped'}</Tag>;
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
  const blockedRows = parsed ? [...parsed.wip, ...parsed.pendingWithUser].filter(r => !r.can_apply) : [];
  const conflictRows = blockedRows.filter(r => r.duplicate_conflict || r.database_duplicate);
  const reviewRows = blockedRows.filter(r => !r.duplicate_conflict && !r.database_duplicate);
  const latestEtaRows = parsed
    ? [...parsed.wip, ...parsed.pendingWithUser].filter(r => r.duplicate_resolution === 'latest_eta')
    : [];
  const applicableRows = totalRows - blockedRows.length;

  const reviewColumn = {
    title: 'Review', dataIndex: 'needsReview', width: 110,
    render: (v, row) => !row.can_apply
      ? <Tag color="red" title={row.review_reasons?.join('; ')}>{row.duplicate_conflict ? 'Conflict' : 'Review - skipped'}</Tag>
      : row.duplicate_resolution === 'latest_eta'
        ? <Tag color="blue" title="Older duplicate rows were discarded">Latest ETA kept</Tag>
      : v
        ? <Tag color="orange" title={row.review_reasons?.join('; ')}>Check manually</Tag>
        : <Tag color="green">OK</Tag>,
  };

  const wipColumns = [
    { title: 'SR Number', dataIndex: 'request_id', width: 100 },
    { title: 'Subject', dataIndex: 'subject', ellipsis: true, render: v => v || <Text type="secondary">-</Text> },
    { title: 'Comment', dataIndex: 'comment', render: v => v || <Text type="secondary">-</Text> },
    {
      title: 'New Expected Closure', dataIndex: 'eta', width: 150,
      render: (v, row) => <span title={row.eta_source || ''}>{fmtEta(v)}</span>,
    },
    { title: 'Match', dataIndex: 'matched', width: 150, render: (v, row) => <MatchTag matched={v} canApply={row.can_apply} duplicateConflict={row.duplicate_conflict} /> },
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
    { title: 'Match', dataIndex: 'matched', width: 150, render: (v, row) => <MatchTag matched={v} canApply={row.can_apply} duplicateConflict={row.duplicate_conflict} /> },
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
        just because it's new. Repeated identical rows are collapsed. If the same SR appears more
        than once with different dates, the row carrying the uniquely highest valid Expected
        Closure Date is kept. A tie at the highest date, or duplicates with no valid date to rank,
        are blocked for review. Nothing is written to the database until you review the preview below
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
          {parsed.reportPeriod && (
            <Alert
              type="info"
              showIcon
              message={`PDF report period: ${fmtEta(parsed.reportPeriod.start)} to ${fmtEta(parsed.reportPeriod.end)}`}
              description="Dates shown below are parsed exactly from the Expected Closure Date cells; the importer never changes Aug to Sep or otherwise guesses a correction."
            />
          )}
          <Alert
            type={blockedRows.length > 0 ? 'warning' : totalMatched === totalRows ? 'success' : 'info'}
            showIcon
            message={
              blockedRows.length > 0
                ? `${applicableRows} safe row${applicableRows === 1 ? '' : 's'} ready; ${blockedRows.length} row${blockedRows.length === 1 ? '' : 's'} blocked for review`
                : totalMatched === totalRows
                ? `All ${totalRows} rows matched an existing SR`
                : `${totalMatched} of ${totalRows} rows matched an existing SR - the other ${totalRows - totalMatched} will be created as new SRs`
            }
          />

          {reviewRows.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${reviewRows.length} suspicious source row${reviewRows.length === 1 ? '' : 's'} excluded from Apply`}
              description={reviewRows
                .map(row => `SR ${row.request_id}: ${row.review_reasons?.join('; ') || 'verify the parsed row'}`)
                .join(' | ')}
            />
          )}

          {latestEtaRows.length > 0 && (
            <Alert
              type="info"
              showIcon
              message={`${latestEtaRows.length} duplicate SR${latestEtaRows.length === 1 ? '' : 's'} resolved using the highest Expected Closure Date`}
              description={latestEtaRows.map(row => {
                const discardedDates = row.discarded_variants?.map(variant => variant.eta).filter(Boolean).map(fmtEta) || [];
                return `SR ${row.request_id}: kept ${fmtEta(row.eta)}${discardedDates.length ? `; discarded ${discardedDates.join(', ')}` : ''}`;
              }).join(' | ')}
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
                      {row.conflict_variants?.some(variant => variant.eta)
                        ? ` Source dates: ${[...new Set(row.conflict_variants.map(variant => variant.eta).filter(Boolean).map(fmtEta))].join(' vs ')}.`
                        : ''}
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

  async function handleDetailSetOnHold(sr) {
    try {
      await srAPI.update(sr.id, { status: 'On Hold' });
      message.success(`${sr.sr_number} put on hold`);
    } catch (e) { message.error(e.response?.data?.message || 'Failed to update status'); }
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
        onSetOnHold={handleDetailSetOnHold}
        onDelete={handleDetailDelete}
      />
    </div>
  );
}

// ── Pending-With Contacts (name → email directory) ──
// The name-to-email directory backing the SR form's multi-person Pending With picker and the
// reminder-email feature below. Deliberately separate from User Management: most of these
// names never log into the app at all (Deloitte-side staff, external contacts).
function ContactsManager() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  async function fetchContacts() {
    setLoading(true);
    try {
      const res = await contactsAPI.listAll();
      setContacts(res.data);
    } catch { message.error('Failed to load contacts'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchContacts(); }, []);

  function openAdd() { setEditing(null); form.resetFields(); setModalOpen(true); }
  function openEdit(row) { setEditing(row); form.setFieldsValue(row); setModalOpen(true); }

  async function handleSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const res = await contactsAPI.update(editing.id, values);
        // A rename cascades into every currently-active SR that used the old name (see
        // cascadeContactRename in routes/contacts.js) - confirm that actually happened rather
        // than leaving the admin to wonder whether existing SRs still show the old spelling.
        message.success(
          res.data.srsUpdated > 0
            ? `Contact saved - updated ${res.data.srsUpdated} existing SR${res.data.srsUpdated === 1 ? '' : 's'} to match`
            : 'Contact saved'
        );
      } else {
        await contactsAPI.create(values);
        message.success('Contact saved');
      }
      setModalOpen(false);
      fetchContacts();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to save contact');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try {
      await contactsAPI.delete(id);
      message.success('Contact moved to Inactive');
      fetchContacts();
    } catch (e) { message.error(e.response?.data?.message || 'Failed to remove contact'); }
  }

  async function handleSetIgnored(row, ignored) {
    try {
      await contactsAPI.update(row.id, { is_ignored: ignored });
      message.success(ignored ? `${row.name} will be skipped for reminders` : `${row.name} will receive reminders again`);
      fetchContacts();
    } catch (e) { message.error(e.response?.data?.message || 'Failed to update contact'); }
  }

  async function handleRestore(row) {
    try {
      await contactsAPI.update(row.id, { is_deleted: false });
      message.success(`${row.name} restored`);
      fetchContacts();
    } catch (e) { message.error(e.response?.data?.message || 'Failed to restore contact'); }
  }

  const active   = contacts.filter(c => !c.is_deleted && !c.is_ignored);
  const ignored  = contacts.filter(c => !c.is_deleted && c.is_ignored);
  const inactive = contacts.filter(c => c.is_deleted);

  // A filter (not just a visual cue) on the Email column, so an admin working through the
  // directory can isolate exactly the entries still missing one and fill them in one after
  // another, instead of scanning the whole alphabetical list by eye.
  const baseColumns = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    {
      title: 'Email', dataIndex: 'email',
      render: v => v || <Text type="secondary">No email on file</Text>,
      filters: [
        { text: 'Missing email', value: 'missing' },
        { text: 'Has email', value: 'has' },
      ],
      onFilter: (value, row) => value === 'missing' ? !row.email : !!row.email,
      sorter: (a, b) => (a.email ? 1 : 0) - (b.email ? 1 : 0),
    },
  ];

  const activeColumns = [
    ...baseColumns,
    {
      title: 'Actions', width: 220,
      render: (_, row) => (
        <Space size={8}>
          <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title={`Never send ${row.name} reminder emails?`} onConfirm={() => handleSetIgnored(row, true)}>
            <Button size="small">Ignore</Button>
          </Popconfirm>
          <Popconfirm title={`Move ${row.name} to Inactive?`} onConfirm={() => handleDelete(row.id)}>
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const ignoredColumns = [
    ...baseColumns,
    {
      title: 'Actions', width: 220,
      render: (_, row) => (
        <Space size={8}>
          <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="small" type="primary" onClick={() => handleSetIgnored(row, false)}>Unignore</Button>
          <Popconfirm title={`Move ${row.name} to Inactive?`} onConfirm={() => handleDelete(row.id)}>
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const inactiveColumns = [
    ...baseColumns,
    {
      title: 'Actions', width: 140,
      render: (_, row) => <Button size="small" type="primary" onClick={() => handleRestore(row)}>Restore</Button>,
    },
  ];

  function contactsTable(data, columns) {
    return (
      <Table
        rowKey="id" size="small" columns={columns} dataSource={data} loading={loading}
        pagination={data.length > 10 ? compactPaginationConfig('contacts', { defaultPageSize: 10 }) : false}
        locale={{ emptyText: 'Nothing here' }}
      />
    );
  }

  return (
    <div>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        The name-to-email directory used for Pending With on the SR form (which now accepts more
        than one person per SR) and for sending pending-work reminder emails below. Seeded once
        from names already in use; add or fix entries here as needed. Ignored people stay valid
        Pending With names but are permanently skipped when sending reminders.
      </Paragraph>
      <div style={{ marginBottom: 12 }}>
        <BrandButton icon={<PlusOutlined />} onClick={openAdd}>Add Contact</BrandButton>
      </div>
      <Card>
        <Tabs
          defaultActiveKey="active"
          items={[
            { key: 'active', label: `Active (${active.length})`, children: contactsTable(active, activeColumns) },
            { key: 'ignored', label: `Ignored (${ignored.length})`, children: contactsTable(ignored, ignoredColumns) },
            { key: 'inactive', label: `Inactive (${inactive.length})`, children: contactsTable(inactive, inactiveColumns) },
          ]}
        />
      </Card>
      <Modal
        title={editing ? `Edit ${editing.name}` : 'Add Contact'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} confirmLoading={saving} destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Atish Kshirsagar" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Not a valid email address' }]}>
            <Input placeholder="e.g. atish.kshirsagar@rdc.in" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  .map((label, value) => ({ label, value }));

// Next time the weekly job will fire, from the saved day/time (server clock == this network's clock).
function nextAutomaticRun(settings) {
  let next = dayjs().day(settings.day_of_week).hour(settings.hour).minute(settings.minute).second(0).millisecond(0);
  if (!next.isAfter(dayjs())) next = next.add(7, 'day');
  return next;
}

// Weekly automatic send: the same email the manual button sends, on a configurable weekday and
// time, with an on/off switch. Only people who already have an email on file are included.
function AutoReminderSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  async function fetchSettings() {
    try {
      const res = await pendingRemindersAPI.getSettings();
      setSettings(res.data);
    } catch { message.error('Failed to load automatic reminder settings'); }
  }

  useEffect(() => { fetchSettings(); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await pendingRemindersAPI.updateSettings(settings);
      setSettings(res.data);
      message.success(res.data.enabled ? 'Automatic weekly reminders saved' : 'Automatic reminders are off');
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to save settings');
    } finally { setSaving(false); }
  }

  return (
    <Card size="small" loading={!settings} title="Automatic weekly reminders" style={{ marginBottom: 24 }}>
      {settings && (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space align="center" size={12}>
            <Switch checked={!!settings.enabled} onChange={v => setSettings({ ...settings, enabled: v })} />
            <Text>{settings.enabled ? 'Reminders are sent automatically every week' : 'Automatic sending is off - use the manual send below'}</Text>
          </Space>

          <Space align="center" size={12} wrap>
            <Text>Send every</Text>
            <Select
              style={{ width: 140 }} options={WEEKDAYS} disabled={!settings.enabled}
              value={settings.day_of_week} onChange={v => setSettings({ ...settings, day_of_week: v })}
            />
            <Text>at</Text>
            <TimePicker
              format="hh:mm A" use12Hours allowClear={false} disabled={!settings.enabled}
              value={dayjs().hour(settings.hour).minute(settings.minute)}
              onChange={v => v && setSettings({ ...settings, hour: v.hour(), minute: v.minute() })}
            />
          </Space>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Goes to everyone with an email on file, same list as the manual send below. People missing an email are
            skipped - add theirs here or in Pending-With Contacts.
            {!!settings.enabled && <> Next automatic send: <b>{nextAutomaticRun(settings).format('dddd, DD-MMM-YYYY hh:mm A')}</b>.</>}
          </Text>

          {settings.last_run_at && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Last automatic run: {dayjs(settings.last_run_at).format('DD-MMM-YYYY hh:mm A')} - {settings.last_run_message}
            </Text>
          )}

          <BrandButton loading={saving} onClick={handleSave}>Save Schedule</BrandButton>
        </Space>
      )}
    </Card>
  );
}

// ── Send Pending Reminders ──
// One email per person (except Deloitte, tracked separately via the weekly PDF) listing
// everything currently pending with them — sent automatically each week (AutoReminderSettings)
// and still fireable by hand, e.g. the day before a meeting.
function SendPendingReminders() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [editingEmailFor, setEditingEmailFor] = useState(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [history, setHistory] = useState([]);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveDrafts, setResolveDrafts] = useState({});
  const [resolvingKey, setResolvingKey] = useState(null);

  const unresolvedGroups = (preview?.groups || []).filter(g => !g.email);

  async function fetchPreview() {
    setLoading(true);
    try {
      const res = await pendingRemindersAPI.preview();
      setPreview(res.data);
      // Only someone with a known email can actually be sent to - pre-select exactly that set
      // so "Send Reminders" does the right thing with zero extra clicks in the common case.
      // Groups are keyed by resolved email (not name) so two name-variants sharing one contact
      // merge into a single send instead of emailing the same person twice.
      setSelectedKeys(res.data.groups.filter(g => g.email).map(g => g.key));
    } catch { message.error('Failed to load pending reminders'); }
    finally { setLoading(false); }
  }

  async function fetchHistory() {
    try {
      const res = await pendingRemindersAPI.history();
      setHistory(res.data);
    } catch { /* history is a nice-to-have, not worth surfacing an error for */ }
  }

  useEffect(() => { fetchPreview(); fetchHistory(); }, []);

  async function handleSaveEmail(group) {
    const email = emailDraft.trim();
    if (!email) return;
    setSavingEmail(true);
    try {
      if (group.contactId) await contactsAPI.update(group.contactId, { email });
      else await contactsAPI.create({ name: group.name, email });
      message.success(`Email saved for ${group.name}`);
      setEditingEmailFor(null);
      await fetchPreview();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to save email');
    } finally { setSavingEmail(false); }
  }

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await pendingRemindersAPI.send(selectedKeys);
      setResult(res.data);
      message.success(`Sent to ${res.data.sent.length} of ${selectedKeys.length}`);
      await fetchPreview();
      await fetchHistory();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to send reminders');
    } finally { setSending(false); }
  }

  // Clicking Send doesn't just skip anyone missing an email - it surfaces them right there so
  // the admin can fix or explicitly ignore each one before (or instead of) sending.
  function handleSendClick() {
    if (unresolvedGroups.length > 0) {
      setResolveDrafts({});
      setResolveModalOpen(true);
      return;
    }
    handleSend();
  }

  async function resolveWithEmail(group) {
    const email = (resolveDrafts[group.key] || '').trim();
    if (!email) return;
    setResolvingKey(group.key);
    try {
      if (group.contactId) await contactsAPI.update(group.contactId, { email });
      else await contactsAPI.create({ name: group.name, email });
      message.success(`Email saved for ${group.name}`);
      await fetchPreview();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to save email');
    } finally { setResolvingKey(null); }
  }

  async function resolveIgnore(group) {
    setResolvingKey(group.key);
    try {
      if (group.contactId) await contactsAPI.update(group.contactId, { is_ignored: true });
      else await contactsAPI.create({ name: group.name, is_ignored: true });
      message.success(`${group.name} will be skipped from reminders going forward`);
      await fetchPreview();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to update contact');
    } finally { setResolvingKey(null); }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', width: 180 },
    {
      title: 'Email', dataIndex: 'email', width: 280,
      render: (v, row) => {
        if (editingEmailFor === row.key) {
          return (
            <Space.Compact style={{ width: '100%' }}>
              <Input
                size="small" value={emailDraft} autoFocus
                placeholder="name@rdc.in"
                onChange={e => setEmailDraft(e.target.value)}
                onPressEnter={() => handleSaveEmail(row)}
              />
              <Button size="small" type="primary" loading={savingEmail} onClick={() => handleSaveEmail(row)}>Save</Button>
              <Button size="small" onClick={() => setEditingEmailFor(null)}>Cancel</Button>
            </Space.Compact>
          );
        }
        return v ? v : (
          <Button size="small" danger onClick={() => { setEditingEmailFor(row.key); setEmailDraft(''); }}>
            + Add email
          </Button>
        );
      },
    },
    { title: 'Pending SRs', dataIndex: 'srCount', width: 110, render: v => <Tag color="blue">{v}</Tag> },
  ];

  const srColumns = [
    { title: 'SR No', dataIndex: 'sr_number', width: 100 },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: v => v || <Text type="secondary">-</Text> },
    { title: 'Status', dataIndex: 'status', width: 130, render: v => <Tag>{v}</Tag> },
    { title: 'Pending', dataIndex: 'pending_since_days', width: 90, render: v => `${v}d` },
  ];

  const historyColumns = [
    { title: 'Recipient', dataIndex: 'recipient_name', width: 160 },
    { title: 'Email', dataIndex: 'recipient_email', render: v => v || <Text type="secondary">-</Text> },
    { title: 'SRs', dataIndex: 'sr_count', width: 70 },
    { title: 'Status', dataIndex: 'status', width: 100, render: v => v === 'sent' ? <Tag color="green">Sent</Tag> : <Tag color="red">Failed</Tag> },
    { title: 'Sent By', dataIndex: 'sent_by_name', width: 140, render: v => v || <Text type="secondary">System</Text> },
    { title: 'Sent At', dataIndex: 'sent_at', width: 170, render: v => dayjs(v).format('DD-MMM-YYYY hh:mm A') },
  ];

  return (
    <div>
      <AutoReminderSettings />

      <Title level={5} style={{ marginTop: 0 }}>Send now</Title>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Everyone except Deloitte currently named in Pending With on an open SR, with everything
        that's pending against them. Send manually at any time - e.g. the day before a meeting - so each
        person gets an email listing exactly what's pending with them. Missing an email? Add one
        inline below; it's saved to Pending-With Contacts for next time too.
      </Paragraph>

      {preview?.unresolvedCount > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={`${preview.unresolvedCount} ${preview.unresolvedCount === 1 ? 'person has' : 'people have'} no email on file - add one below to include them.`}
        />
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Table
          rowKey="key" size="small" loading={loading} columns={columns} dataSource={preview?.groups || []}
          expandable={{ expandedRowRender: row => <Table rowKey="sr_number" size="small" columns={srColumns} dataSource={row.srs} pagination={false} /> }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: setSelectedKeys,
            getCheckboxProps: row => ({ disabled: !row.email }),
          }}
          pagination={false}
          locale={{ emptyText: 'Nothing pending with anyone right now' }}
        />
      </Card>

      <BrandButton icon={<MailOutlined />} loading={sending} disabled={selectedKeys.length === 0} onClick={handleSendClick}>
        Send Reminders ({selectedKeys.length})
      </BrandButton>

      <Modal
        title={`${unresolvedGroups.length} ${unresolvedGroups.length === 1 ? 'person is' : 'people are'} missing an email`}
        open={resolveModalOpen}
        onCancel={() => setResolveModalOpen(false)}
        width={640}
        footer={[
          <Button key="close" onClick={() => setResolveModalOpen(false)}>Close</Button>,
          <Button key="continue" type="primary" onClick={() => { setResolveModalOpen(false); handleSend(); }}>
            Continue to Send ({selectedKeys.length})
          </Button>,
        ]}
      >
        <Paragraph type="secondary">
          Add an email so they're included in this send, or Ignore to permanently exclude them
          from reminders. Anyone left unresolved is simply skipped when you continue.
        </Paragraph>
        <Table
          rowKey="key" size="small" pagination={false}
          dataSource={unresolvedGroups}
          locale={{ emptyText: 'Everyone now has an email on file' }}
          columns={[
            { title: 'Name', dataIndex: 'name' },
            { title: 'Pending SRs', dataIndex: 'srCount', width: 90, render: v => <Tag color="blue">{v}</Tag> },
            {
              title: 'Resolve', width: 320,
              render: (_, row) => (
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    size="small" placeholder="name@rdc.in"
                    value={resolveDrafts[row.key] || ''}
                    onChange={e => setResolveDrafts(d => ({ ...d, [row.key]: e.target.value }))}
                    onPressEnter={() => resolveWithEmail(row)}
                  />
                  <Button size="small" type="primary" loading={resolvingKey === row.key} onClick={() => resolveWithEmail(row)}>Save</Button>
                  <Button size="small" danger loading={resolvingKey === row.key} onClick={() => resolveIgnore(row)}>Ignore</Button>
                </Space.Compact>
              ),
            },
          ]}
        />
      </Modal>

      {result && (
        <Alert
          style={{ marginTop: 16 }}
          type={result.failed.length > 0 ? 'warning' : 'success'}
          showIcon
          message={`Sent to ${result.sent.length}${result.failed.length ? `; ${result.failed.length} failed` : ''}`}
          description={result.failed.length > 0 ? result.failed.map(f => `${f.name}: ${f.message}`).join(' | ') : undefined}
        />
      )}

      {history.length > 0 && (
        <Collapse
          style={{ marginTop: 20 }} size="small"
          items={[{
            key: 'history',
            label: `Recent sends (${history.length})`,
            children: (
              <Table
                rowKey="id" size="small" dataSource={history} columns={historyColumns}
                pagination={history.length > 10 ? compactPaginationConfig('sends', { defaultPageSize: 10 }) : false}
              />
            ),
          }]}
        />
      )}
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
            { key: 'contacts', label: <Space><ContactsOutlined />Pending-With Contacts</Space>, children: <ContactsManager /> },
            { key: 'reminders', label: <Space><MailOutlined />Send Pending Reminders</Space>, children: <SendPendingReminders /> },
          ]}
        />
      </div>
    </Reveal>
  );
}
