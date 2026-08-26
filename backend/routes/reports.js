const express = require('express');
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Assigned-To ECD history report — for every SR assigned to a given vendor/team, shows the
// full sequence of values the closure-date field has ever held (not just old→new pairs),
// so "how many times was it pushed back" is just the sequence length minus one. Built from
// two queries (SRs, then their history in bulk) rather than one row per SR to avoid N+1s.
router.get('/assigned-to-ecd', async (req, res, next) => {
  try {
    const { assignedTo, category = 'SR' } = req.query;
    if (!assignedTo || !assignedTo.trim())
      return res.status(400).json({ message: 'assignedTo is required' });
    if (!['SR', 'Digitization'].includes(category))
      return res.status(400).json({ message: 'Invalid category' });

    const dateField = category === 'Digitization' ? 'target_date' : 'expected_closure_date';

    const [srs] = await pool.execute(`
      SELECT id, sr_number, creation_date, status, ${dateField} AS current_ecd,
        (SELECT c.comment FROM sr_comments c WHERE c.sr_id = srs.id AND c.is_deleted = 0 ORDER BY c.commented_at DESC LIMIT 1) as last_comment,
        (SELECT c.commented_at FROM sr_comments c WHERE c.sr_id = srs.id AND c.is_deleted = 0 ORDER BY c.commented_at DESC LIMIT 1) as last_comment_at
      FROM srs
      WHERE category = ? AND assigned_to = ? AND is_deleted = 0
      ORDER BY CAST(sr_number AS SIGNED) ASC, sr_number ASC
    `, [category, assignedTo.trim()]);

    if (srs.length === 0) return res.json({ data: [], max_changes: 0 });

    const srIds = srs.map(s => s.id);
    const [historyRows] = await pool.query(`
      SELECT sr_id, old_value, new_value, changed_at
      FROM sr_history
      WHERE sr_id IN (${srIds.map(() => '?').join(',')}) AND field_changed = ? AND is_deleted = 0
      ORDER BY sr_id, changed_at ASC
    `, [...srIds, dateField]);

    const historyBySr = new Map();
    for (const h of historyRows) {
      if (!historyBySr.has(h.sr_id)) historyBySr.set(h.sr_id, []);
      historyBySr.get(h.sr_id).push(h);
    }

    let maxChanges = 0;
    const data = srs.map(sr => {
      const hist = historyBySr.get(sr.id) || [];
      let sequence;
      if (hist.length > 0) {
        // The chain of values this field held over time: the first change's "before" value,
        // then every change's "after" value, in order. When the field was blank beforehand
        // (old_value null — the very first time it was ever set, not a revision of a real
        // date), that leading null is dropped since there's no prior date to display.
        sequence = [hist[0].old_value, ...hist.map(h => h.new_value)].filter(v => v !== null && v !== '');
      } else {
        sequence = sr.current_ecd ? [sr.current_ecd] : [];
      }
      // "Changes" = actual date-to-date revisions, i.e. sequence length minus the starting
      // value — NOT raw history-row count. Those differ whenever the leading history row was
      // "field set for the first time" (old_value null): that's not a revision of a prior
      // date, so counting it inflated "Changes" by one relative to how many ECD columns were
      // actually shown (e.g. 8 history rows but only 8 real dates, not 9, made "Changes: 8"
      // look inconsistent next to a row with a real starting value where 2 changes → 3 dates).
      const changeCount = Math.max(0, sequence.length - 1);
      maxChanges = Math.max(maxChanges, changeCount);
      return {
        id: sr.id,
        sr_number: sr.sr_number,
        sr_date: sr.creation_date,
        status: sr.status,
        last_comment: sr.last_comment,
        last_comment_at: sr.last_comment_at,
        ecd_sequence: sequence,
        change_count: changeCount,
      };
    });

    res.json({ data, max_changes: maxChanges });
  } catch (e) { next(e); }
});

module.exports = router;
