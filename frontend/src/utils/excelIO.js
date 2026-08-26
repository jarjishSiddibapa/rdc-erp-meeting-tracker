import * as XLSX from 'xlsx';

// Excel's date epoch (serial 0 = Dec 30, 1899 - the well-known off-by-one-day convention
// every spreadsheet date library uses).
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

function dateStringToExcelSerial(isoDateStr) {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EXCEL_EPOCH_UTC) / 86400000);
}

// The inverse of dateStringToExcelSerial - computed with the same UTC-day-count math we
// use to write it. Deliberately does NOT go through xlsx's own serial <-> Date object
// conversion (cellDates:true): that path is meant for full timestamps and adjusts by the
// reading machine's local timezone offset when it converts, which introduces a several-
// second-to-hours drift for a plain date-only value (worse for half-hour-offset zones like
// IST) - occasionally enough to flip the calendar day. Doing the arithmetic ourselves, the
// same way in both directions, guarantees an exact round-trip with nothing to drift.
function excelSerialToDateString(serial) {
  const ms = EXCEL_EPOCH_UTC + Math.round(serial) * 86400000;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear(), mm = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function readWorkbook(file) {
  const buf = await file.arrayBuffer();
  // No cellDates here - date cells are read as their raw numeric serial (see
  // excelSerialToDateString above) so the conversion stays exact.
  return XLSX.read(buf, { type: 'array' });
}

// Builds one sheet from `rows`, writing date-flagged fields as real date-only Excel cells
// (a plain integer serial + a date number format - editable via Excel's date picker, no
// time-of-day component to have) and appends it to `workbook` under `sheetName`.
export function buildSheet(workbook, sheetName, fields, rows) {
  const data = rows.map(row => {
    const out = {};
    fields.forEach(f => { out[f.label] = f.date ? '' : (row[f.key] ?? ''); });
    return out;
  });

  const sheet = XLSX.utils.json_to_sheet(data, { header: fields.map(f => f.label) });

  fields.forEach((f, colIdx) => {
    if (!f.date) return;
    rows.forEach((row, i) => {
      const v = row[f.key];
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: colIdx });
      if (v) {
        sheet[cellRef] = { t: 'n', v: dateStringToExcelSerial(v), z: 'dd-mmm-yyyy' };
      } else {
        // Still blank, but pre-stamp the day-first number format so that if someone
        // types a new date straight into this cell (e.g. adding a brand-new SR row),
        // Excel renders it unambiguously (04-Aug-2026) instead of falling back to
        // whatever short-date default the opening machine's Windows region uses -
        // which for a lot of installs reads as month-first and is exactly the
        // dd/mm vs mm/dd mix-up this format exists to avoid.
        sheet[cellRef] = { t: 'z', z: 'dd-mmm-yyyy' };
      }
    });
  });

  sheet['!cols'] = fields.map(f => ({ wch: Math.max(14, f.label.length + 2) }));
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}

// Reverses buildSheet: reads a sheet back into plain row objects keyed by field `key`
// (not the human-readable header). Works from raw cells rather than sheet_to_json's
// resolved values, since date columns need type-aware handling: a numeric+date-formatted
// cell (the user left it alone, or edited it with Excel's date picker) converts via exact
// serial-number math; anything else (the user typed free text into the cell) is passed
// through as a trimmed string for the backend's own date parser to interpret.
export function readSheetAsFields(workbook, sheetName, fields) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const headerRow = range.s.r;
  const headerToCol = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell && cell.v != null) headerToCol[String(cell.v).trim()] = c;
  }

  const rows = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const out = {};
    let hasAnyValue = false;
    fields.forEach(f => {
      const col = headerToCol[f.label];
      const cell = col === undefined ? undefined : sheet[XLSX.utils.encode_cell({ r, c: col })];
      if (cell && cell.v !== undefined && cell.v !== '') hasAnyValue = true;

      if (!cell || cell.v === undefined) { out[f.key] = ''; return; }
      if (f.date) {
        out[f.key] = cell.t === 'n' ? excelSerialToDateString(cell.v) : String(cell.v).trim();
      } else {
        out[f.key] = String(cell.v).trim();
      }
    });
    if (hasAnyValue) rows.push(out);
  }
  return rows;
}
