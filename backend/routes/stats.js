const express = require('express');
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { splitPendingWith } = require('../utils/pendingWith');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', async (req, res, next) => {
  try {
    // Two adjacent rolling windows make the comparison explicit and independent of weekdays.
    // Current = today plus the previous 6 dates. Previous = the 7 dates immediately before it.
    const WEEK_BOUNDS = `(SELECT
      DATE_SUB(CURDATE(), INTERVAL 13 DAY) as previous_start,
      DATE_SUB(CURDATE(), INTERVAL 6 DAY) as current_start,
      DATE_SUB(CURDATE(), INTERVAL 7 DAY) as previous_end,
      CURDATE() as current_end,
      DATE_ADD(CURDATE(), INTERVAL 1 DAY) as next_week_start
    ) b`;

    // Bulk-imported SRs get today's timestamp in created_at (that's just when the import ran),
    // which doesn't reflect when the SR was actually raised. Use the SR's own Creation Date
    // field for "added" comparisons, falling back to created_at only if it's missing —
    // same fallback pending_since_days already uses.
    const RAISED_DATE = `COALESCE(NULLIF(TRIM(s.creation_date), ''), DATE(s.created_at))`;

    // Reconstruct status at the start of the current period. This handles an SR that was
    // closed and later reopened instead of incorrectly treating its current status as the
    // historical one. The history index keeps these small correlated lookups inexpensive.
    const STATUS_AT_PERIOD_START = `COALESCE(
      (SELECT h.new_value
         FROM sr_history h
        WHERE h.sr_id = s.id AND h.field_changed = 'status' AND h.is_deleted = 0
          AND h.changed_at < b.current_start
        ORDER BY h.changed_at DESC, h.id DESC LIMIT 1),
      (SELECT h.old_value
         FROM sr_history h
        WHERE h.sr_id = s.id AND h.field_changed = 'status' AND h.is_deleted = 0
          AND h.changed_at >= b.current_start
        ORDER BY h.changed_at ASC, h.id ASC LIMIT 1),
      s.status
    )`;

    async function catStats(category) {
      // COALESCE every SUM to 0: SUM() returns NULL (not 0) over zero matching rows — this
      // branch is only actually empty on a fresh install with no SRs yet, but that's exactly
      // when it matters most (first thing an admin sees shouldn't be a page of "null" tiles).
      const [rows] = await pool.query(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status != 'Closed' THEN 1 ELSE 0 END), 0) as pending_now,
          COALESCE(SUM(CASE WHEN ${RAISED_DATE} < b.current_start
                    AND ${STATUS_AT_PERIOD_START} != 'Closed'
                    THEN 1 ELSE 0 END), 0) as pending_at_period_start,
          COALESCE(SUM(CASE WHEN status != 'Closed' AND expected_closure_date < CURDATE() THEN 1 ELSE 0 END), 0) as overdue,
          COALESCE(SUM(CASE WHEN ${RAISED_DATE} >= b.current_start
                    AND ${RAISED_DATE} < b.next_week_start THEN 1 ELSE 0 END), 0) as added_current_7d,
          COALESCE(SUM(CASE WHEN ${RAISED_DATE} >= b.previous_start
                    AND ${RAISED_DATE} < b.current_start THEN 1 ELSE 0 END), 0) as added_previous_7d,
          COALESCE(SUM(CASE WHEN status = 'Closed'
                    AND s.closed_date >= b.current_start
                    AND s.closed_date < b.next_week_start THEN 1 ELSE 0 END), 0) as closed_current_7d,
          COALESCE(SUM(CASE WHEN status = 'Closed'
                    AND s.closed_date >= b.previous_start
                    AND s.closed_date < b.current_start THEN 1 ELSE 0 END), 0) as closed_previous_7d,
          DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 13 DAY), '%Y-%m-%d') as previous_period_start,
          DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 7 DAY), '%Y-%m-%d') as previous_period_end,
          DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '%Y-%m-%d') as current_period_start,
          DATE_FORMAT(CURDATE(), '%Y-%m-%d') as current_period_end
        FROM srs s, ${WEEK_BOUNDS}
        WHERE s.category = ? AND s.is_deleted = 0
      `, [category]);
      return rows[0];
    }

    // pending_with can hold multiple people on one SR now — this can no longer be a plain SQL
    // GROUP BY, since a shared SR ("Atish Kshirsagar,Nagesh Tiwari") needs to count toward
    // BOTH of them, not become its own combined-name bucket. Fetch one row per SR with the
    // per-row flags already computed in SQL (so all the date-window logic above stays exactly
    // as it was), then fan out and accumulate per name in JS.
    async function pendingByPerson(category) {
      const [rows] = await pool.query(`
        SELECT
          s.pending_with, s.status,
          CASE WHEN s.status != 'Closed' AND s.expected_closure_date < CURDATE() THEN 1 ELSE 0 END as is_overdue,
          CASE WHEN ${RAISED_DATE} >= b.current_start
                AND ${RAISED_DATE} < b.next_week_start THEN 1 ELSE 0 END as is_added_current_7d,
          CASE WHEN s.status = 'Closed'
                AND s.closed_date >= b.current_start
                AND s.closed_date < b.next_week_start THEN 1 ELSE 0 END as is_closed_current_7d
        FROM srs s, ${WEEK_BOUNDS}
        WHERE s.category = ? AND s.is_deleted = 0
      `, [category]);

      // A single "how long has it been pending" figure doesn't mean much once one person can
      // carry several SRs at once (whose is it - the oldest? an average?), so this stays a
      // per-SR figure (see srs.js's pending_since_days) rather than a per-person one. Clicking
      // a name here already opens the SR panel filtered to them, where each SR's own accurate
      // Pending Since is visible and sortable.
      const byName = new Map();
      for (const row of rows) {
        const names = splitPendingWith(row.pending_with);
        const groupNames = names.length ? names : ['(Unassigned)'];
        // On Hold is its own bucket, not a subset of Pending Now (same convention as the SR
        // list page's status tiles, which already keep On Hold and Pending mutually
        // exclusive) - work that's paused isn't actively pending with anyone right now.
        const isActivePending = row.status !== 'Closed' && row.status !== 'On Hold';
        const isOnHold = row.status === 'On Hold';
        for (const name of groupNames) {
          let agg = byName.get(name);
          if (!agg) {
            agg = { name, pending_now: 0, on_hold: 0, overdue: 0, added_current_7d: 0, closed_current_7d: 0 };
            byName.set(name, agg);
          }
          if (isActivePending) {
            agg.pending_now++;
            agg.overdue += row.is_overdue;
          }
          if (isOnHold) agg.on_hold++;
          agg.added_current_7d += row.is_added_current_7d;
          agg.closed_current_7d += row.is_closed_current_7d;
        }
      }

      return [...byName.values()]
        .filter(r => r.pending_now > 0 || r.on_hold > 0 || r.added_current_7d > 0 || r.closed_current_7d > 0)
        .sort((a, b) => b.pending_now - a.pending_now);
    }

    // Neither query depends on the other's result — both only need the category.
    const [srStats, byPendingWith] = await Promise.all([catStats('SR'), pendingByPerson('SR')]);

    const {
      previous_period_start,
      previous_period_end,
      current_period_start,
      current_period_end,
      ...srMetrics
    } = srStats;

    res.json({
      periods: {
        current: { start: current_period_start, end: current_period_end },
        previous: { start: previous_period_start, end: previous_period_end },
      },
      sr: { ...srMetrics, by_pending_with: byPendingWith },
    });
  } catch (e) { next(e); }
});

module.exports = router;
