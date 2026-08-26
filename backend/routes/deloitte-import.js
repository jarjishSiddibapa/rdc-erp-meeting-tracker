const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const TRACKS = ['DBA', 'P2P', 'O2C', 'Finance', 'PTM'];
const TRACK_RE = new RegExp('\\b(' + TRACKS.join('|') + ')\\b');

// ETA extraction is deliberately tolerant of the format drift this exact weekly template has
// already shown between runs: the label's punctuation varies ("ETA |", "ETA:", "ETA –", or just
// "ETA "), the date's own separators vary (-, /, ., or a bare space), the month may be
// abbreviated or spelled out, the year may be 2 or 4 digits, a day may carry an ordinal suffix
// ("17th"), and PDF text extraction sometimes injects a stray extra space inside the date itself
// (observed live: "21-Aug- 26", "18- Aug-26"). Anchoring to end-of-string (the original
// approach) broke on any trailing qualifier after the date too (observed live: "ETA | 21-Aug-26
// | Dependent on SR"). Instead this scans for every "ETA <date>" occurrence anywhere in the row
// and keeps the LAST one — a row can mention an earlier superseded ETA before a final one
// (observed live: "Accounting ETA | 17-Aug-26 Efforts ETA | 18-Aug-26" should resolve to
// 18-Aug-26), so "last occurrence wins" preserves that behavior while fixing the false negatives.
// A bare date with no "ETA" label at all (e.g. a date mentioned in prose) is deliberately never
// treated as an ETA — that would be guessing, not parsing.
const MONTH_RE = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const DATE_TOKEN_SRC = `(\\d{1,2})(?:st|nd|rd|th)?\\s*[-/.\\s]\\s*(${MONTH_RE})\\s*[-/.,\\s]\\s*(\\d{2,4})`;
const ETA_RE = new RegExp(`ETA\\s*[:|\\-–—]?\\s*${DATE_TOKEN_SRC}`, 'gi');
const ETA_WORD_RE = /\bETA\b/i;

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
  const dt = new Date(y, mon, d);
  if (isNaN(dt.getTime()) || dt.getMonth() !== mon) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Finds the last ETA-labeled date in `text`. Also reports `mentionedUnparsed`: true when the
// literal word "ETA" appears but no date could be parsed after it — a signal that this row's
// format doesn't match any variant handled above, so it should be surfaced for manual review
// instead of silently treated the same as "this row simply has no ETA this week" (which is a
// normal, expected case — see parseWipRow).
function findLastEta(text) {
  let last = null;
  for (const match of text.matchAll(ETA_RE)) last = match;
  if (last) return { eta: parseEtaDate(last[1], last[2], last[3]), match: last, mentionedUnparsed: false };
  return { eta: null, match: null, mentionedUnparsed: ETA_WORD_RE.test(text) };
}

// Rows in both tables always start with a Request ID (6 digits, optionally prefixed with a
// bullet/dash if a future export style adds list markers) at the start of a line — a long
// Subject can wrap onto extra lines before the rest of the row's data, so a row's real
// boundary is "up to the next line that itself starts with a Request ID", not one PDF text
// line.
const ROW_START_RE = /^[•●\-*]?\s*\d{6}\b/;

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
  return chunk.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
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

  const { eta, match, mentionedUnparsed } = findLastEta(rest);
  if (match) {
    // Remove just the matched "ETA <date>" substring, not everything after it — so a trailing
    // qualifier like "| Dependent on SR" (observed live) stays in the comment instead of being
    // silently dropped along with the date.
    rest = (rest.slice(0, match.index) + rest.slice(match.index + match[0].length))
      .replace(/\s{2,}/g, ' ').trim();
  }

  const trackMatch = rest.match(TRACK_RE);
  const subject = trackMatch ? rest.slice(0, trackMatch.index).trim() : rest;
  const comment = trackMatch ? rest.slice(trackMatch.index + trackMatch[0].length).trim() : '';

  // Some rows (e.g. SR 211595, 220547 in a real sample) simply have no ETA that week — eta
  // stays null and only the comment gets applied. That's normal. `etaMentionedUnparsed` is the
  // different, always-suspicious case: the row does say "ETA" but no variant above could parse
  // a date out of it, meaning the format moved in a way this parser doesn't know about yet.
  return { requestId, subject, comment, eta, trackFound: !!trackMatch, etaMentionedUnparsed: mentionedUnparsed };
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

// Returns the parsed rows AND a page-by-page account of what happened to every single page in
// the PDF (recognized as Work in Progress / Pending with User / not relevant) — this is what
// lets the preview show "here's every page and what we did with it" instead of asking for
// blind trust that nothing was silently skipped.
async function extractRows(buffer) {
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

  for (const page of pages) {
    const text = page.text || '';
    const firstLine = (text.split('\n')[0] || '').trim();
    if (WIP_HEADER_RE.test(firstLine)) {
      let count = 0;
      for (const chunk of splitRows(text)) {
        const row = parseWipRow(chunk);
        if (row) { wip.push(row); count++; }
      }
      pageSummary.push({ page: page.num, firstLine, classification: 'Work in Progress', rowsFound: count });
    } else if (PENDING_HEADER_RE.test(firstLine)) {
      let count = 0;
      for (const chunk of splitRows(text)) {
        const row = parsePendingRow(chunk);
        if (row) { pendingWithUser.push(row); count++; }
      }
      pageSummary.push({ page: page.num, firstLine, classification: 'Pending with User', rowsFound: count });
    } else {
      // Not one of the two actionable tables (cover, ticket snapshot, pending approval/on
      // hold, weekly summary, testing status, thank-you) — recorded, not silently dropped.
      pageSummary.push({ page: page.num, firstLine, classification: 'Not relevant — skipped', rowsFound: null });
    }
  }

  return { wip, pendingWithUser, pageSummary };
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
  for (const row of rows) map.set(row.sr_number, row);
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

    const { wip, pendingWithUser, pageSummary } = await extractRows(req.file.buffer);
    const matches = await matchRows([...wip, ...pendingWithUser].map(r => r.requestId));

    const wipOut = [];
    for (const row of wip) {
      const sr = matches.get(row.requestId) || null;
      wipOut.push({
        type: 'wip',
        request_id: row.requestId,
        subject: row.subject,
        comment: row.comment,
        eta: row.eta,
        matched: !!sr,
        sr_id: sr?.id ?? null,
        current_status: sr?.status ?? null,
        current_ecd: sr?.expected_closure_date ?? null,
        current_assigned_to: sr?.assigned_to ?? null,
        current_pending_with: sr?.pending_with ?? null,
        // Track not found is always suspect (Subject/Comment split may be wrong). A row that
        // says "ETA" but couldn't be parsed into a date is equally suspect — see findLastEta.
        needsReview: !row.trackFound || row.etaMentionedUnparsed,
      });
    }

    const pendingOut = [];
    for (const row of pendingWithUser) {
      const sr = matches.get(row.requestId) || null;
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
        needsReview: !row.trackFound,
      });
    }

    res.json({ wip: wipOut, pendingWithUser: pendingOut, pageSummary });
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
    const wip = Array.isArray(req.body.wip) ? req.body.wip : [];
    const pendingWithUser = Array.isArray(req.body.pendingWithUser) ? req.body.pendingWithUser : [];

    let commentsAdded = 0, ecdUpdated = 0, ecdCleared = 0, statusUpdated = 0, skippedClosed = 0, srsCreated = 0, assignedToUpdated = 0, pendingWithUpdated = 0;

    // Same transactional pattern csv-import.js already uses for its bulk writes — a PDF can
    // touch 40-80 SRs in one go, so a failure partway through (e.g. a bad row) should roll
    // back everything rather than leave the import half-applied.
    await conn.beginTransaction();

    for (const row of wip) {
      let srId = row.sr_id;
      let currentEcd = row.current_ecd;

      if (!row.matched) {
        // Work in Progress means Deloitte is actively on it — that's a status, not a guess.
        // Pending With is set to Deloitte at creation too, for the same reason.
        srId = await createSrFromRow(conn, row.request_id, row.subject, 'In Progress', row.eta, 'Deloitte', req.user.id);
        currentEcd = null;
        srsCreated++;
      } else {
        if (await ensureAssignedToDeloitte(conn, srId, row.current_assigned_to, req.user.id)) assignedToUpdated++;
        if (await ensurePendingWithDeloitte(conn, srId, row.current_pending_with, req.user.id)) pendingWithUpdated++;
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
      if (row.matched && row.eta && row.eta !== currentEcd) {
        await conn.execute('UPDATE srs SET expected_closure_date = ?, updated_by = ? WHERE id = ?', [row.eta, req.user.id, srId]);
        await conn.execute(
          'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
          [srId, 'expected_closure_date', currentEcd, row.eta, req.user.id]
        );
        ecdUpdated++;
      }
    }

    for (const row of pendingWithUser) {
      if (!row.matched) {
        // Pending With is left blank here (not "Deloitte") — this row is waiting on the RDC
        // user to respond, not on Deloitte, same reasoning as ensurePendingWithDeloitte above.
        // ECD is always null at creation — an SR waiting on the RDC user has no Deloitte-quoted
        // closure date, so there's nothing to set (and nothing to log a history row against).
        await createSrFromRow(conn, row.request_id, row.subject, 'Pending with User', null, null, req.user.id);
        srsCreated++;
        continue;
      }

      if (await ensureAssignedToDeloitte(conn, row.sr_id, row.current_assigned_to, req.user.id)) assignedToUpdated++;

      // Pending with User means the ball is in the RDC user's court — Deloitte isn't working
      // toward a date for it, so any ECD the SR is still carrying (e.g. quoted during an
      // earlier Work in Progress week) is stale and gets cleared, with a normal history entry
      // recording what it changed from so the trail isn't lost.
      if (row.current_ecd !== null) {
        await conn.execute('UPDATE srs SET expected_closure_date = NULL, updated_by = ? WHERE id = ?', [req.user.id, row.sr_id]);
        await conn.execute(
          'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
          [row.sr_id, 'expected_closure_date', row.current_ecd, null, req.user.id]
        );
        ecdCleared++;
      }

      if (row.current_status === 'Closed') { skippedClosed++; continue; }
      if (row.current_status === 'Pending with User') continue;

      await conn.execute('UPDATE srs SET status = ?, updated_by = ? WHERE id = ?', ['Pending with User', req.user.id, row.sr_id]);
      await conn.execute(
        'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
        [row.sr_id, 'status', row.current_status, 'Pending with User', req.user.id]
      );
      statusUpdated++;
    }

    await conn.commit();
    res.json({
      comments_added: commentsAdded, ecd_updated: ecdUpdated, ecd_cleared: ecdCleared, status_updated: statusUpdated,
      skipped_closed: skippedClosed, srs_created: srsCreated, assigned_to_updated: assignedToUpdated,
      pending_with_updated: pendingWithUpdated,
    });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;
