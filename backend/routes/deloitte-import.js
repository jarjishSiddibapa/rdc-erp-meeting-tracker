const express = require('express');
const multer = require('multer');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const TRACKS = ['DBA', 'P2P', 'O2C', 'Finance', 'PTM'];
const TRACK_RE = new RegExp('\\b(' + TRACKS.join('|') + ')\\b');

// ETA extraction is deliberately tolerant of format drift while remaining label-anchored: a
// bare date in a comment is never guessed to be the closure date. Deloitte has used optional
// qualifiers ("Dev ETA", "Analysis ETA", "Revised ETA"), varied punctuation, named or numeric
// months, 2/4-digit years, ordinal days, and whitespace inserted by PDF extraction. Every
// recognized ETA is retained as a candidate. The final candidate remains the selected value for
// backwards compatibility, but multiple different candidates are visibly flagged for review.
const MONTH_RE = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const DATE_TOKEN_SRC = `(\\d{1,2})(?:st|nd|rd|th)?\\s*[-/.\\s]\\s*(${MONTH_RE})\\s*[-/.,\\s]\\s*(\\d{2,4})`;
const NUMERIC_DATE_TOKEN_SRC = '(\\d{1,2})\\s*[-/.]\\s*(\\d{1,2})\\s*[-/.]\\s*(\\d{2,4})';
const ISO_DATE_TOKEN_SRC = '(\\d{4})\\s*[-/.]\\s*(\\d{1,2})\\s*[-/.]\\s*(\\d{1,2})';
const ETA_QUALIFIER_SRC = '(?:(?:Dev(?:elopment)?|Analysis|Accounting|Efforts?|UAT|Testing|Revised|Final)\\s+)?';
const ETA_LABEL_SRC = `${ETA_QUALIFIER_SRC}\\bETA\\b\\s*[:|\\-–—]?\\s*`;
const ETA_WORD_RE = /\bETA\b/i;
const ETA_WORD_GLOBAL_RE = /\bETA\b/gi;

// Builds a real Date from captured (day, month-name, year) parts instead of handing a loosely-
// formatted string to `new Date(...)` (locale/engine-dependent parsing risk). Cross-checks the
// month round-trips through the Date constructor unchanged, which catches an impossible day for
// that month (e.g. a mis-OCR'd "31-Apr") rather than silently rolling over into the next month.
function parseEtaDate(day, monthStr, year) {
  const mon = MONTH_INDEX[monthStr.slice(0, 3).toLowerCase()];
  const d = parseInt(day, 10);
  let y = parseInt(year, 10);
  if (mon === undefined || !d || !y) return null;
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, mon, d));
  if (isNaN(dt.getTime()) || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mon || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseNumericEtaDate(day, month, year) {
  const mon = Number(month) - 1;
  const d = Number(day);
  let y = Number(year);
  if (y < 100) y += 2000;
  if (!d || mon < 0 || mon > 11 || !y) return null;
  const dt = new Date(Date.UTC(y, mon, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mon || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.getUTCFullYear() === Number(match[1])
    && parsed.getUTCMonth() === Number(match[2]) - 1
    && parsed.getUTCDate() === Number(match[3]);
}

function collectEtaCandidates(text) {
  const candidates = [];
  const patterns = [
    {
      regex: new RegExp(`${ETA_LABEL_SRC}${DATE_TOKEN_SRC}`, 'gi'),
      parse: match => parseEtaDate(match[1], match[2], match[3]),
    },
    {
      regex: new RegExp(`${ETA_LABEL_SRC}${ISO_DATE_TOKEN_SRC}`, 'gi'),
      parse: match => parseNumericEtaDate(match[3], match[2], match[1]),
    },
    {
      regex: new RegExp(`${ETA_LABEL_SRC}${NUMERIC_DATE_TOKEN_SRC}`, 'gi'),
      parse: match => parseNumericEtaDate(match[1], match[2], match[3]),
    },
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      candidates.push({ match, eta: pattern.parse(match) });
    }
  }
  candidates.sort((a, b) => a.match.index - b.match.index);
  return candidates;
}

// Finds the final valid ETA-labelled date and preserves enough diagnostics to avoid silent
// failures. An impossible date (31-Apr), an unknown ETA format, or two different ETA values is
// a review condition even if another candidate in the same cell was valid.
function findLastEta(text) {
  const candidates = collectEtaCandidates(text);
  const valid = candidates.filter(candidate => candidate.eta);
  const last = valid.at(-1) || null;
  const etaMentions = [...text.matchAll(ETA_WORD_GLOBAL_RE)].length;
  const distinctEtas = [...new Set(valid.map(candidate => candidate.eta))];
  const firstEtaIndex = text.search(ETA_WORD_RE);
  const firstMatch = candidates[0]?.match || null;
  return {
    eta: last?.eta || null,
    match: last?.match || null,
    firstMatch,
    closureStart: firstMatch?.index ?? (firstEtaIndex >= 0 ? firstEtaIndex : null),
    mentionedUnparsed: etaMentions > candidates.length || candidates.some(candidate => !candidate.eta),
    multipleDistinct: distinctEtas.length > 1,
    candidates: valid.map(candidate => candidate.eta),
  };
}

// Rows in both tables always start with a Request ID (6 digits, optionally prefixed with a
// bullet/dash if a future export style adds list markers) at the start of a line — a long
// Subject can wrap onto extra lines before the rest of the row's data, so a row's real
// boundary is "up to the next line that itself starts with a Request ID", not one PDF text
// line.
const ROW_START_RE = /^[•●\-*]?\s*\d{6}\b/;
const REPORT_FOOTER_RE = /(?:©|�|\(c\))\s*20\d{2}\.?\s+For information, contact Deloitte/i;

// Table-header classification, tolerant of the separator between "Incident Details" and the
// table name changing (pipe/colon/dash observed across other headers in this same template
// family) — still requires both anchor phrases, so this can't false-positive on an unrelated page.
const WIP_HEADER_RE = /Incident Details\s*[|:\-–—]?\s*Work in Progress/i;
const PENDING_HEADER_RE = /Incident Details\s*[|:\-–—]?\s*Pending with User/i;
function splitRows(pageText) {
  const lines = pageText.split('\n');
  const rows = [];
  let cur = [];
  for (const line of lines) {
    // The footer is emitted after the last data row by some PDF engines. Ignore it explicitly
    // so a last-row Work in Progress item with a blank ECD cannot absorb copyright text into
    // its imported comment.
    if (REPORT_FOOTER_RE.test(line)) continue;
    if (ROW_START_RE.test(line.trim())) {
      if (cur.length) rows.push(cur.join('\n'));
      cur = [line];
    } else if (cur.length) {
      cur.push(line);
    }
  }
  if (cur.length) rows.push(cur.join('\n'));
  return rows;
}

function flatten(chunk) {
  return chunk.split('\n').map(l => l.trim()).filter(Boolean).join(' ')
    // Some PowerPoint-generated PDFs expose punctuation as double-decoded UTF-8. Normalize the
    // common sequences before a subject/comment can be stored in a newly created tracker row.
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€™/g, '’')
    .replace(/â€œ|â€/g, '"');
}

// Comments column: everything between the Track token and the trailing "ETA | date" (if
// present). Track itself is only used to find where Subject ends and Comment begins — there's
// no Track/module column on an SR, so it's never stored anywhere. Subject (everything before
// Track) IS kept now — it becomes the Description when a Request ID doesn't match any existing
// SR and a new one needs to be created from scratch. Some rows (e.g. SR 211595, 220547 in the
// real sample) simply have no ETA that week; ecd stays null and only the comment gets applied.
// `trackFound` records whether the Track token that delimits Subject from Comment was
// actually located — when it isn't, `subject` swallows the whole row and `comment` comes back
// empty, which is silently indistinguishable from "this row genuinely has no comment" unless
// it's flagged. Surfaced in /parse's response so the preview can flag it for a manual look
// instead of quietly presenting a possibly-wrong split as if it were certain.
const REQUEST_ID_RE = /^[•●\-*]?\s*(\d{6})\s+(.*)$/;

function parseWipRow(chunk) {
  const flat = flatten(chunk);
  const m = flat.match(REQUEST_ID_RE);
  if (!m) return null;
  const requestId = m[1];
  let rest = m[2];

  const etaResult = findLastEta(rest);
  const { eta, mentionedUnparsed, multipleDistinct, candidates, closureStart } = etaResult;
  const etaSource = closureStart === null ? null : rest.slice(closureStart).trim();
  // Expected Closure Date is the final table column. Remove the whole cell, including prefixes
  // such as "Dev"/"Analysis" and suffixes such as "Dependent on SR", so those values cannot
  // leak into the imported Comments column.
  if (closureStart !== null) rest = rest.slice(0, closureStart).trim();

  const trackMatch = rest.match(TRACK_RE);
  const subject = trackMatch ? rest.slice(0, trackMatch.index).trim() : rest;
  const comment = trackMatch
    ? rest.slice(trackMatch.index + trackMatch[0].length).trim().replace(/^[|:;,\-–—'’]+\s*/, '')
    : '';

  // Some rows simply have no ETA that week — eta stays null and only the comment gets applied.
  // That's normal. `etaMentionedUnparsed` is the
  // different, always-suspicious case: the row does say "ETA" but no variant above could parse
  // a date out of it, meaning the format moved in a way this parser doesn't know about yet.
  return {
    requestId,
    subject,
    comment,
    eta,
    etaSource,
    etaCandidates: candidates,
    etaMultipleDistinct: multipleDistinct,
    trackFound: !!trackMatch,
    etaMentionedUnparsed: mentionedUnparsed,
  };
}

// Pending with User rows never carry an ETA — an SR sitting here is waiting on the RDC user to
// respond, so Deloitte hasn't (and can't) commit to a closure date for it. No ETA extraction
// needed; see the ECD-clearing logic in /apply for what happens to a matched SR's existing ECD.
function parsePendingRow(chunk) {
  const flat = flatten(chunk);
  const m = flat.match(REQUEST_ID_RE);
  if (!m) return null;
  const requestId = m[1];
  const rest = m[2];

  const trackMatch = [...rest.matchAll(new RegExp(TRACK_RE, 'g'))].pop();
  const subject = trackMatch ? rest.slice(0, trackMatch.index).trim() : rest;
  return { requestId, subject, trackFound: !!trackMatch };
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function findReportPeriod(pages) {
  const coverText = (pages.slice(0, 3).map(page => page.text || '').join('\n'));
  const headingIndex = coverText.search(/Weekly Status Report\s*:/i);
  if (headingIndex < 0) return null;
  const headingText = coverText.slice(headingIndex, headingIndex + 200);
  const matches = [...headingText.matchAll(new RegExp(DATE_TOKEN_SRC, 'gi'))]
    .map(match => parseEtaDate(match[1], match[2], match[3]))
    .filter(Boolean);
  if (matches.length < 2) return null;
  return { start: matches[0], end: matches[1] };
}

function reviewReasons(row, reportPeriod) {
  const reasons = [];
  if (!row.trackFound) reasons.push('Track column could not be identified');
  if (row.etaMentionedUnparsed) reasons.push('ETA text contains an invalid or unsupported date');
  if (row.etaMultipleDistinct) reasons.push('Expected Closure cell contains multiple different ETA dates');
  if (row.eta && reportPeriod?.start && row.eta < reportPeriod.start) {
    reasons.push('ETA is earlier than the weekly report period; verify the source date');
  }
  return reasons;
}

function parsedRowSignature(row) {
  return JSON.stringify([
    row.type,
    compactText(row.subject),
    compactText(row.comment),
    row.eta || null,
  ]);
}

function variantSummary(row) {
  return {
    type: row.type,
    subject: compactText(row.subject) || null,
    comment: compactText(row.comment) || null,
    eta: row.eta || null,
    source_page: row.sourcePage,
  };
}

// A Request ID occasionally appears more than once in Deloitte's PDF. Identical repeats collapse
// to one operation. When different repeats have a uniquely highest valid ETA, that newest-dated
// row wins and the older variants are retained in preview metadata for transparency. If dates
// cannot identify one winner (no valid ETA or a tie at the highest ETA), the SR remains blocked.
function consolidateParsedRows(wip = [], pendingWithUser = []) {
  const groups = new Map();
  const tagged = [
    ...wip.map(row => ({ ...row, type: 'wip' })),
    ...pendingWithUser.map(row => ({ ...row, type: 'pending_with_user' })),
  ];

  for (const row of tagged) {
    const requestId = String(row.requestId || row.request_id || '').trim();
    if (!requestId) continue;
    const normalized = {
      ...row,
      requestId,
      sourcePage: row.sourcePage ?? row.source_page ?? null,
    };
    const existing = groups.get(requestId) || [];
    existing.push(normalized);
    groups.set(requestId, existing);
  }

  const consolidated = { wip: [], pendingWithUser: [] };
  const duplicateIds = [];
  const conflictingIds = [];
  const resolvedByLatestEtaIds = [];
  let identicalRowsCollapsed = 0;

  for (const [requestId, rows] of groups) {
    const variants = [...new Map(rows.map(row => [parsedRowSignature(row), row])).values()];
    const sourcePages = [...new Set(rows.map(row => row.sourcePage).filter(page => page !== null))];
    const inheritedBlock = rows.some(row =>
      row.canApply === false || row.can_apply === false || row.duplicateConflict || row.duplicate_conflict
    );
    const datedVariants = variants.filter(row => isIsoDate(row.eta));
    const highestEta = datedVariants.reduce(
      (highest, row) => !highest || row.eta > highest ? row.eta : highest,
      null
    );
    const highestEtaVariants = highestEta ? variants.filter(row => row.eta === highestEta) : [];
    const resolvedByLatestEta = variants.length > 1 && highestEtaVariants.length === 1 && !inheritedBlock;
    const selected = resolvedByLatestEta ? highestEtaVariants[0] : variants[0];
    const duplicateConflict = inheritedBlock || (variants.length > 1 && !resolvedByLatestEta);

    if (rows.length > 1) {
      duplicateIds.push(requestId);
      identicalRowsCollapsed += rows.length - variants.length;
    }
    if (resolvedByLatestEta) resolvedByLatestEtaIds.push(requestId);
    if (duplicateConflict) conflictingIds.push(requestId);

    const output = {
      ...selected,
      requestId,
      duplicateCount: rows.length,
      sourcePages,
      duplicateConflict,
      canApply: !duplicateConflict,
      duplicateResolution: resolvedByLatestEta ? 'latest_eta' : null,
      conflictVariants: duplicateConflict ? variants.map(variantSummary) : [],
      discardedVariants: resolvedByLatestEta
        ? variants.filter(row => row !== selected).map(variantSummary)
        : [],
    };

    if (output.type === 'wip') consolidated.wip.push(output);
    else consolidated.pendingWithUser.push(output);
  }

  return {
    ...consolidated,
    duplicateSummary: {
      duplicateIds,
      conflictingIds,
      resolvedByLatestEtaIds,
      identicalRowsCollapsed,
    },
  };
}

// Returns the parsed rows AND a page-by-page account of what happened to every single page in
// the PDF (recognized as Work in Progress / Pending with User / not relevant) — this is what
// lets the preview show "here's every page and what we did with it" instead of asking for
// blind trust that nothing was silently skipped.
async function extractRows(buffer) {
  // pdf-parse adds roughly 20-25 MB of resident memory. Most server runs never parse a PDF,
  // so load it only for the admin action that actually needs it instead of on every startup.
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  let pages;
  try {
    const result = await parser.getText();
    pages = result.pages;
  } finally {
    await parser.destroy();
  }

  const wip = [];
  const pendingWithUser = [];
  const pageSummary = [];
  const reportPeriod = findReportPeriod(pages);

  for (const page of pages) {
    const text = page.text || '';
    const firstLine = (text.split('\n')[0] || '').trim();
    // Restrict classification to the title area but do not require the title to be literally
    // the first extracted line; logos and accessibility tags can precede it in future exports.
    const titleArea = text.split('\n').slice(0, 8).join(' ');
    if (WIP_HEADER_RE.test(titleArea)) {
      let count = 0;
      for (const chunk of splitRows(text)) {
        const row = parseWipRow(chunk);
        if (row) { wip.push({ ...row, sourcePage: page.num }); count++; }
      }
      pageSummary.push({ page: page.num, firstLine, classification: 'Work in Progress', rowsFound: count });
    } else if (PENDING_HEADER_RE.test(titleArea)) {
      let count = 0;
      for (const chunk of splitRows(text)) {
        const row = parsePendingRow(chunk);
        if (row) { pendingWithUser.push({ ...row, sourcePage: page.num }); count++; }
      }
      pageSummary.push({ page: page.num, firstLine, classification: 'Pending with User', rowsFound: count });
    } else {
      // Not one of the two actionable tables (cover, ticket snapshot, pending approval/on
      // hold, weekly summary, testing status, thank-you) — recorded, not silently dropped.
      pageSummary.push({ page: page.num, firstLine, classification: 'Not relevant - skipped', rowsFound: null });
    }
  }

  return { wip, pendingWithUser, pageSummary, reportPeriod };
}

// Matches every parsed request ID against the live SRs table in one query instead of one
// round trip per row — a weekly PDF can have 40-80 rows across both tables, which was 40-80
// sequential `await`s before. Returns a Map keyed by sr_number for O(1) lookup per row.
async function matchRows(requestIds) {
  const map = new Map();
  const unique = [...new Set(requestIds)];
  if (!unique.length) return map;
  const [rows] = await pool.query(
    `SELECT id, sr_number, status, expected_closure_date, assigned_to, pending_with FROM srs WHERE sr_number IN (${unique.map(() => '?').join(',')}) AND category = 'SR' AND is_deleted = 0`,
    unique
  );
  for (const row of rows) {
    const matches = map.get(row.sr_number) || [];
    matches.push(row);
    map.set(row.sr_number, matches);
  }
  return map;
}

// Shared diffed-update helper — sets a column to a fixed value and logs history, but only if
// it's actually changing (keeps history clean of no-op "changed from Deloitte to Deloitte"
// entries). `field` is never request-controlled — only ever one of the two literals below.
const DELOITTE_FIELDS = ['assigned_to', 'pending_with'];
async function ensureFieldValue(conn, srId, field, currentValue, newValue, userId) {
  if (!DELOITTE_FIELDS.includes(field)) throw new Error(`Unexpected field: ${field}`);
  if (currentValue === newValue) return false;
  await conn.execute(`UPDATE srs SET ${field} = ?, updated_by = ? WHERE id = ?`, [newValue, userId, srId]);
  await conn.execute(
    'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
    [srId, field, currentValue, newValue, userId]
  );
  return true;
}

// Any SR that shows up in the weekly PDF — whether it already existed or was just created —
// is, by definition, one Deloitte is tracking, so its Assigned To gets set/kept as "Deloitte" too.
const ensureAssignedToDeloitte = (conn, srId, currentAssignedTo, userId) =>
  ensureFieldValue(conn, srId, 'assigned_to', currentAssignedTo, 'Deloitte', userId);

// A "Work in Progress" row means the ticket is sitting with Deloitte awaiting their action —
// that's what Pending With is for, so it gets set/kept as "Deloitte" too. Deliberately NOT
// applied to "Pending with User" rows: those are waiting on the RDC user to respond, not on
// Deloitte, so their existing Pending With value (the actual person) is left alone.
const ensurePendingWithDeloitte = (conn, srId, currentPendingWith, userId) =>
  ensureFieldValue(conn, srId, 'pending_with', currentPendingWith, 'Deloitte', userId);

// POST /api/deloitte-import/parse — multipart, field "pdf". Read-only: matches each parsed
// row against the live SRs table but writes nothing, so a bad/garbled PDF costs nothing to
// try and review before committing anything.
router.post('/parse', upload.single('pdf'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No PDF file uploaded' });

    const extracted = await extractRows(req.file.buffer);
    const { wip, pendingWithUser, duplicateSummary } = consolidateParsedRows(
      extracted.wip,
      extracted.pendingWithUser
    );
    const matches = await matchRows([...wip, ...pendingWithUser].map(r => r.requestId));

    const wipOut = [];
    for (const row of wip) {
      const dbMatches = matches.get(row.requestId) || [];
      const databaseDuplicate = dbMatches.length > 1;
      const sr = dbMatches.length === 1 ? dbMatches[0] : null;
      const rowReviewReasons = reviewReasons(row, extracted.reportPeriod);
      // Review flags are fail-closed. A suspicious row stays visible in preview but cannot be
      // included in bulk apply; the admin can verify and update that SR manually without risking
      // a guessed date or an incorrectly split comment.
      const canApply = row.canApply && !databaseDuplicate && rowReviewReasons.length === 0;
      wipOut.push({
        type: 'wip',
        request_id: row.requestId,
        subject: row.subject,
        comment: row.comment,
        eta: row.eta,
        eta_source: row.etaSource,
        eta_candidates: row.etaCandidates,
        matched: !!sr,
        sr_id: sr?.id ?? null,
        current_status: sr?.status ?? null,
        current_ecd: sr?.expected_closure_date ?? null,
        current_assigned_to: sr?.assigned_to ?? null,
        current_pending_with: sr?.pending_with ?? null,
        // Track not found is always suspect (Subject/Comment split may be wrong). A row that
        // says "ETA" but couldn't be parsed into a date is equally suspect — see findLastEta.
        needsReview: rowReviewReasons.length > 0 || !canApply,
        review_reasons: rowReviewReasons,
        can_apply: canApply,
        duplicate_count: row.duplicateCount,
        duplicate_conflict: row.duplicateConflict,
        duplicate_resolution: row.duplicateResolution,
        source_pages: row.sourcePages,
        conflict_variants: row.conflictVariants,
        discarded_variants: row.discardedVariants,
        database_duplicate: databaseDuplicate,
      });
    }

    const pendingOut = [];
    for (const row of pendingWithUser) {
      const dbMatches = matches.get(row.requestId) || [];
      const databaseDuplicate = dbMatches.length > 1;
      const sr = dbMatches.length === 1 ? dbMatches[0] : null;
      const rowReviewReasons = reviewReasons(row, extracted.reportPeriod);
      const canApply = row.canApply && !databaseDuplicate && rowReviewReasons.length === 0;
      pendingOut.push({
        type: 'pending_with_user',
        request_id: row.requestId,
        subject: row.subject,
        matched: !!sr,
        sr_id: sr?.id ?? null,
        current_status: sr?.status ?? null,
        // Carried through purely so the preview can show what's about to be cleared — Pending
        // with User SRs never keep an ECD, see the clearing logic in /apply.
        current_ecd: sr?.expected_closure_date ?? null,
        current_assigned_to: sr?.assigned_to ?? null,
        needsReview: rowReviewReasons.length > 0 || !canApply,
        review_reasons: rowReviewReasons,
        can_apply: canApply,
        duplicate_count: row.duplicateCount,
        duplicate_conflict: row.duplicateConflict,
        duplicate_resolution: row.duplicateResolution,
        source_pages: row.sourcePages,
        conflict_variants: row.conflictVariants,
        discarded_variants: row.discardedVariants,
        database_duplicate: databaseDuplicate,
      });
    }

    res.json({
      wip: wipOut,
      pendingWithUser: pendingOut,
      pageSummary: extracted.pageSummary,
      reportPeriod: extracted.reportPeriod,
      duplicateSummary,
    });
  } catch (e) { next(e); }
});

// A Request ID with no matching SR gets created from whatever the PDF actually gives us:
// Subject as the Description, Assigned To fixed to "Deloitte" and Internal/External fixed to
// "External" (every SR that comes in through this route is, by definition, one of theirs),
// status reflecting which table it was found in. Everything else the PDF doesn't provide
// (Type, created-by, a real creation date) is left blank rather than guessed — same
// "don't invent data" rule csv-import.js's row-creation path already follows.
async function createSrFromRow(conn, requestId, subject, status, ecd, pendingWith, userId) {
  const today = new Date();
  const creationDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [result] = await conn.execute(
    `INSERT INTO srs (sr_number, category, status, scope, assigned_to, pending_with, description, creation_date, expected_closure_date, created_by, updated_by)
     VALUES (?, 'SR', ?, 'External', 'Deloitte', ?, ?, ?, ?, ?, ?)`,
    [requestId, status, pendingWith, subject || null, creationDate, ecd, userId, userId]
  );
  return result.insertId;
}

// POST /api/deloitte-import/apply — body: { wip: [...], pendingWithUser: [...] } (the same
// shape /parse returned, optionally trimmed down to just the rows the admin wants applied).
router.post('/apply', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const submittedWip = Array.isArray(req.body.wip) ? req.body.wip : [];
    const submittedPending = Array.isArray(req.body.pendingWithUser) ? req.body.pendingWithUser : [];
    // Never trust the preview's matched/sr_id/current_* snapshot. It can be stale, duplicated,
    // or tampered with by the time Apply is clicked. Consolidate the request IDs again and
    // resolve every current row inside this transaction.
    const { wip, pendingWithUser } = consolidateParsedRows(submittedWip, submittedPending);
    if ([...wip, ...pendingWithUser].some(row => !/^\d{6}$/.test(row.requestId))) {
      const error = new Error('The PDF preview contains an invalid SR number. Upload and review the PDF again.');
      error.status = 400;
      throw error;
    }
    if (wip.some(row => row.eta && !isIsoDate(row.eta))) {
      const error = new Error('The PDF preview contains an invalid Expected Closure Date. Upload and review the PDF again.');
      error.status = 400;
      throw error;
    }

    let commentsAdded = 0, ecdUpdated = 0, ecdCleared = 0, statusUpdated = 0,
      skippedClosed = 0, skippedConflicts = 0, srsCreated = 0,
      assignedToUpdated = 0, pendingWithUpdated = 0;

    // Same transactional pattern csv-import.js already uses for its bulk writes — a PDF can
    // touch 40-80 SRs in one go, so a failure partway through (e.g. a bad row) should roll
    // back everything rather than leave the import half-applied.
    await conn.beginTransaction();

    const requestIds = [...new Set([...wip, ...pendingWithUser]
      .map(row => row.requestId)
      .filter(Boolean))];
    const activeByNumber = new Map();
    if (requestIds.length) {
      const [currentRows] = await conn.query(
        `SELECT id, sr_number, status, expected_closure_date, assigned_to, pending_with
         FROM srs
         WHERE category = 'SR' AND is_deleted = 0
           AND sr_number IN (${requestIds.map(() => '?').join(',')})
         FOR UPDATE`,
        requestIds
      );
      for (const current of currentRows) {
        if (activeByNumber.has(current.sr_number)) {
          const error = new Error(`SR ${current.sr_number} exists more than once. Resolve the duplicate before importing.`);
          error.status = 409;
          throw error;
        }
        activeByNumber.set(current.sr_number, current);
      }
    }

    for (const row of wip) {
      if (!row.canApply) { skippedConflicts++; continue; }
      const requestId = row.requestId;
      let current = activeByNumber.get(requestId) || null;
      const wasExisting = !!current;
      let srId = current?.id;
      const currentEcd = current?.expected_closure_date ?? null;

      if (!current) {
        // Work in Progress means Deloitte is actively on it — that's a status, not a guess.
        // Pending With is set to Deloitte at creation too, for the same reason.
        srId = await createSrFromRow(conn, requestId, row.subject, 'In Progress', row.eta, 'Deloitte', req.user.id);
        current = {
          id: srId,
          sr_number: requestId,
          status: 'In Progress',
          expected_closure_date: row.eta || null,
          assigned_to: 'Deloitte',
          pending_with: 'Deloitte',
        };
        activeByNumber.set(requestId, current);
        srsCreated++;
      } else {
        if (await ensureAssignedToDeloitte(conn, srId, current.assigned_to, req.user.id)) assignedToUpdated++;
        if (await ensurePendingWithDeloitte(conn, srId, current.pending_with, req.user.id)) pendingWithUpdated++;
      }

      if (row.comment) {
        await conn.execute(
          'INSERT INTO sr_comments (sr_id, comment, commented_by) VALUES (?, ?, ?)',
          [srId, row.comment, req.user.id]
        );
        commentsAdded++;
      }

      // For a brand-new SR the ECD was already set at creation (no prior value to diff
      // against, so no history row) — only log a change when updating an existing one.
      if (wasExisting && row.eta && row.eta !== currentEcd) {
        await conn.execute('UPDATE srs SET expected_closure_date = ?, updated_by = ? WHERE id = ?', [row.eta, req.user.id, srId]);
        await conn.execute(
          'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
          [srId, 'expected_closure_date', currentEcd, row.eta, req.user.id]
        );
        ecdUpdated++;
      }
    }

    for (const row of pendingWithUser) {
      if (!row.canApply) { skippedConflicts++; continue; }
      const requestId = row.requestId;
      const current = activeByNumber.get(requestId) || null;

      if (!current) {
        // Pending With is left blank here (not "Deloitte") — this row is waiting on the RDC
        // user to respond, not on Deloitte, same reasoning as ensurePendingWithDeloitte above.
        // ECD is always null at creation — an SR waiting on the RDC user has no Deloitte-quoted
        // closure date, so there's nothing to set (and nothing to log a history row against).
        const srId = await createSrFromRow(conn, requestId, row.subject, 'Pending with User', null, null, req.user.id);
        activeByNumber.set(requestId, {
          id: srId,
          sr_number: requestId,
          status: 'Pending with User',
          expected_closure_date: null,
          assigned_to: 'Deloitte',
          pending_with: null,
        });
        srsCreated++;
        continue;
      }

      if (await ensureAssignedToDeloitte(conn, current.id, current.assigned_to, req.user.id)) assignedToUpdated++;

      // Pending with User means the ball is in the RDC user's court — Deloitte isn't working
      // toward a date for it, so any ECD the SR is still carrying (e.g. quoted during an
      // earlier Work in Progress week) is stale and gets cleared, with a normal history entry
      // recording what it changed from so the trail isn't lost.
      if (current.expected_closure_date !== null) {
        await conn.execute('UPDATE srs SET expected_closure_date = NULL, updated_by = ? WHERE id = ?', [req.user.id, current.id]);
        await conn.execute(
          'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
          [current.id, 'expected_closure_date', current.expected_closure_date, null, req.user.id]
        );
        ecdCleared++;
      }

      if (current.status === 'Closed') { skippedClosed++; continue; }
      if (current.status === 'Pending with User') continue;

      await conn.execute('UPDATE srs SET status = ?, updated_by = ? WHERE id = ?', ['Pending with User', req.user.id, current.id]);
      await conn.execute(
        'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
        [current.id, 'status', current.status, 'Pending with User', req.user.id]
      );
      statusUpdated++;
    }

    await conn.commit();
    res.json({
      comments_added: commentsAdded, ecd_updated: ecdUpdated, ecd_cleared: ecdCleared, status_updated: statusUpdated,
      skipped_closed: skippedClosed, srs_created: srsCreated, assigned_to_updated: assignedToUpdated,
      pending_with_updated: pendingWithUpdated, skipped_conflicts: skippedConflicts,
    });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;
module.exports._test = {
  collectEtaCandidates,
  consolidateParsedRows,
  extractRows,
  findLastEta,
  findReportPeriod,
  isIsoDate,
  parseEtaDate,
  parseNumericEtaDate,
  parsePendingRow,
  parseWipRow,
  splitRows,
};
