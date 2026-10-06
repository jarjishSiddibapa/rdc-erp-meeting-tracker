const express = require('express');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  buildReminderGroups, sendReminderGroups, getSettings, reschedulePendingReminders,
} = require('../services/pending-reminders');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/preview', async (req, res, next) => {
  try {
    const groups = await buildReminderGroups();
    res.json({
      groups: groups.map(g => ({ ...g, srCount: g.srs.length })),
      unresolvedCount: groups.filter(g => !g.email).length,
    });
  } catch (e) { next(e); }
});

router.post('/send', async (req, res, next) => {
  try {
    const requestedKeys = new Set((req.body.keys || []).map(String));
    if (requestedKeys.size === 0) return res.status(400).json({ message: 'Select at least one person to send to' });

    const groups = (await buildReminderGroups()).filter(g => requestedKeys.has(g.key));
    res.json(await sendReminderGroups(groups, req.user.id));
  } catch (e) { next(e); }
});

router.get('/history', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.*, u.full_name as sent_by_name
      FROM pending_reminder_log l LEFT JOIN users u ON l.sent_by = u.id
      ORDER BY l.sent_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/settings', async (req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (e) { next(e); }
});

router.put('/settings', async (req, res, next) => {
  try {
    const { enabled, day_of_week, hour, minute } = req.body;
    const d = Number(day_of_week), h = Number(hour), m = Number(minute);
    if (!Number.isInteger(d) || d < 0 || d > 6) return res.status(400).json({ message: 'Day must be 0 (Sunday) to 6 (Saturday)' });
    if (!Number.isInteger(h) || h < 0 || h > 23) return res.status(400).json({ message: 'Hour must be 0-23' });
    if (!Number.isInteger(m) || m < 0 || m > 59) return res.status(400).json({ message: 'Minute must be 0-59' });

    const current = await getSettings();
    if (current.id) {
      await pool.execute(
        'UPDATE pending_reminder_settings SET enabled = ?, day_of_week = ?, hour = ?, minute = ?, updated_by = ? WHERE id = ?',
        [enabled ? 1 : 0, d, h, m, req.user.id, current.id]
      );
    } else {
      await pool.execute(
        'INSERT INTO pending_reminder_settings (enabled, day_of_week, hour, minute, updated_by) VALUES (?, ?, ?, ?, ?)',
        [enabled ? 1 : 0, d, h, m, req.user.id]
      );
    }

    await reschedulePendingReminders();
    res.json(await getSettings());
  } catch (e) { next(e); }
});

module.exports = router;
