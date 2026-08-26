import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

function fmtDate(v) { return v ? dayjs(v).format('DD-MMM-YYYY') : ''; }
function fmtDateTime(v) { return v ? dayjs(v).format('DD-MMM-YYYY hh:mm A') : ''; }

const DIGITIZATION_COLUMNS = [
  { header: 'Sr No', get: r => r.sr_number },
  { header: 'Project Name', get: r => r.project_name || '' },
  { header: 'Process Owner', get: r => r.process_owner || '' },
  { header: 'Pending With', get: r => r.pending_with || '' },
  { header: 'Status', get: r => r.status },
  { header: 'Creation Date', get: r => fmtDate(r.creation_date) },
  { header: 'Target Date', get: r => fmtDate(r.target_date) },
  { header: 'Pending Since (Days)', get: r => r.pending_since_days ?? '' },
  { header: 'Last Comment', get: r => r.last_comment || '' },
  { header: 'Last Comment At', get: r => fmtDateTime(r.last_comment_at) },
];

const SR_COLUMNS = [
  { header: 'Sr No', get: r => r.sr_number },
  { header: 'Description', get: r => r.description || '' },
  { header: 'Internal/External', get: r => r.scope || '' },
  { header: 'Type', get: r => r.type || '' },
  { header: 'Creation Date', get: r => fmtDate(r.creation_date) },
  { header: 'Status', get: r => r.status },
  { header: 'Created By', get: r => r.created_by_name || '' },
  { header: 'Pending With', get: r => r.pending_with || '' },
  { header: 'Assigned To', get: r => r.assigned_to || '' },
  { header: 'Exp. Closure', get: r => fmtDate(r.expected_closure_date) },
  { header: 'Pending Since (Days)', get: r => r.pending_since_days ?? '' },
  { header: 'Last Comment', get: r => r.last_comment || '' },
  { header: 'Last Comment At', get: r => fmtDateTime(r.last_comment_at) },
];

export function exportSRsToExcel(category, rows) {
  const columns = category === 'Digitization' ? DIGITIZATION_COLUMNS : SR_COLUMNS;
  const data = rows.map(row => {
    const out = {};
    columns.forEach(col => { out[col.header] = col.get(row); });
    return out;
  });

  const sheet = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.header) });
  sheet['!cols'] = columns.map(c => ({ wch: Math.max(12, c.header.length + 2) }));

  const workbook = XLSX.utils.book_new();
  const sheetName = category === 'Digitization' ? 'Digitization Projects' : 'Service Requests';
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  const fileLabel = category === 'Digitization' ? 'Digitization_Projects' : 'Service_Requests';
  XLSX.writeFile(workbook, `${fileLabel}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
}
