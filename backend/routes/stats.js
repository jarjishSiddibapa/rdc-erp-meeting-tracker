const express = require('express');
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', async (req, res, next) => {
  try {
    // Weekly figures are a rolling 7-day window ending today, not a fixed Monday-Sunday
    // calendar week — every number updates daily regardless of what day it is when the
    // dashboard is opened. "This week" = today and the 6 days before it; "last week" = the
    // 7 days immediately before that. week_start/last_week_start/next_week_start keep their
    // names (used generically below by catStats/pendingByPerson) but now mean "start of the
    // rolling this-week window" / "start of the rolling last-week window" / "one past today".
    const WEEK_BOUNDS = `(SELECT
      DATE_SUB(CURDATE(), INTERVAL 6 DAY) as week_start,
      DATE_SUB(CURDATE(), INTERVAL 13 DAY) as last_week_start,
      DATE_ADD(CURDATE(), INTERVAL 1 DAY) as next_week_start
    ) b`;

    // Bulk-imported SRs get today's timestamp in created_at (that's just when the import ran),
    // which doesn't reflect when the SR was actually raised. Use the SR's own Creation Date
    // field for "added" comparisons, falling back to created_at only if it's missing —
    // same fallback pending_since_days already uses.
    const RAISED_DATE = `COALESCE(NULLIF(TRIM(s.creation_date), ''), DATE(s.created_at))`;

    async function catStats(category) {
      // COALESCE every SUM to 0: SUM() returns NULL (not 0) over zero matching rows — this
      // branch is only actually empty on a fresh install with no SRs yet, but that's exactly
      // when it matters most (first thing an admin sees shouldn't be a page of "null" tiles).
      const [rows] = await pool.query(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status != 'Closed' THEN 1 ELSE 0 END), 0) as pending_now,
          COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) as total_closed,
          COALESCE(SUM(CASE WHEN status != 'Closed' AND expected_closure_date < CURDATE() THEN 1 ELSE 0 END), 0) as overdue,
          COALESCE(SUM(CASE WHEN ${RAISED_DATE} >= b.last_week_start
                    AND ${RAISED_DATE} <  b.week_start THEN 1 ELSE 0 END), 0) as added_last_week,
          COALESCE(SUM(CASE WHEN ${RAISED_DATE} >= b.week_start
                    AND ${RAISED_DATE} <  b.next_week_start THEN 1 ELSE 0 END), 0) as added_this_week,
          COALESCE(SUM(CASE WHEN status = 'Closed'
                    AND s.closed_date >= b.last_week_start
                    AND s.closed_date <  b.week_start THEN 1 ELSE 0 END), 0) as closed_last_week
        FROM srs s, ${WEEK_BOUNDS}
        WHERE s.category = ? AND s.is_deleted = 0
      `, [category]);
      return rows[0];
    }

    async function pendingByPerson(category) {
      const [rows] = await pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(pending_with),''), '(Unassigned)') as name,
          COUNT(CASE WHEN status != 'Closed' THEN 1 END) as pending_now,
          COUNT(CASE WHEN
            ${RAISED_DATE} <= b.week_start
            AND (status != 'Closed' OR DATE(s.closed_date) > b.week_start)
          THEN 1 END) as last_week_pending,
          COUNT(CASE WHEN ${RAISED_DATE} >= b.last_week_start
                     AND ${RAISED_DATE} <  b.week_start THEN 1 END) as added_last_week,
          COUNT(CASE WHEN status = 'Closed'
                     AND s.closed_date >= b.last_week_start
                     AND s.closed_date <  b.week_start THEN 1 END) as closed_last_week,
          COUNT(CASE WHEN ${RAISED_DATE} >= b.week_start
                     AND ${RAISED_DATE} <  b.next_week_start THEN 1 END) as added_this_week,
          COALESCE(SUM(CASE WHEN status = 'On Hold' THEN 1 ELSE 0 END), 0) as on_hold,
          COALESCE(SUM(CASE WHEN expected_closure_date < CURDATE() AND status != 'Closed' THEN 1 ELSE 0 END), 0) as overdue
        FROM srs s, ${WEEK_BOUNDS}
        WHERE s.category = ? AND s.is_deleted = 0
        GROUP BY name
        HAVING pending_now > 0
        ORDER BY pending_now DESC
      `, [category]);
      return rows;
    }

    // Neither query depends on the other's result — both only need the category.
    const [srStats, byPendingWith] = await Promise.all([catStats('SR'), pendingByPerson('SR')]);

    res.json({
      sr: { ...srStats, by_pending_with: byPendingWith },
    });
  } catch (e) { next(e); }
});

module.exports = router;
