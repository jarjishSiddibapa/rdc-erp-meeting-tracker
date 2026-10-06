const cron = require('node-cron');
const { pool } = require('../db/pool');
const { splitPendingWith, isRealPersonName } = require('../utils/pendingWith');
const { sendPendingReminderEmail } = require('./mailer');

const RAISED_DATE = `COALESCE(NULLIF(TRIM(s.creation_date), ''), DATE(s.created_at))`;

let cronTask = null;
let scheduledRunActive = false;

// Deloitte is tracked separately (the weekly PDF import already covers them) — this feature
// is specifically for reminding the RDC-side and other named people, so any pending_with
// token that names Deloitte in any form ("Deloitte", "Deloitte ERP Support") is left out.
// isRealPersonName (see utils/pendingWith.js) filters out the ManageEngine status placeholder
// on top of this — that one's excluded everywhere, not just here.
function isDeloitte(name) {
  return name.toLowerCase().includes('deloitte');
}

// Builds one group per PERSON currently named in an open SR's Pending With field (excluding
// Deloitte and anyone marked "ignored" in the contacts directory - ignored contacts remain
// valid Pending With names, they're just never sent a reminder). Grouped by resolved email
// (not by name) so two name-variants for the same person ("Aniket" / "Aniket Sawant") that
// share one contact email get merged into a single email rather than two separate ones;
// a name with no email on file yet can't be merged with anything, so it stays its own group
// keyed by name until an email is added. Recomputed fresh from the DB every time this is
// called — never trust a client-supplied SR list for what actually gets emailed.
async function buildReminderGroups() {
  const [rows] = await pool.query(`
    SELECT
      s.sr_number, s.description, s.status, s.pending_with, s.expected_closure_date,
      DATEDIFF(CURDATE(), COALESCE(
        s.pending_since_date,
        (SELECT MAX(DATE(h.changed_at)) FROM sr_history h WHERE h.sr_id = s.id AND h.field_changed = 'pending_with' AND h.is_deleted = 0),
        ${RAISED_DATE}
      )) as pending_since_days
    FROM srs s
    WHERE s.category = 'SR' AND s.is_deleted = 0 AND s.status != 'Closed'
  `);

  const [contactRows] = await pool.query('SELECT id, name, email, is_ignored FROM contacts WHERE is_deleted = 0');
  const contactByLowerName = new Map(contactRows.map(c => [c.name.toLowerCase(), c]));

  const groups = new Map();
  for (const row of rows) {
    for (const name of splitPendingWith(row.pending_with)) {
      if (!isRealPersonName(name) || isDeloitte(name)) continue;
      const contact = contactByLowerName.get(name.toLowerCase());
      if (contact?.is_ignored) continue;

      const email = contact?.email || null;
      const key = email ? `email:${email.toLowerCase()}` : `name:${name.toLowerCase()}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, name, email, contactId: contact?.id || null, srs: [] };
        groups.set(key, group);
      } else if (!group.name.split(' / ').includes(name)) {
        group.name = `${group.name} / ${name}`;
      }
      if (!group.srs.some(s => s.sr_number === row.sr_number)) {
        group.srs.push({
          sr_number: row.sr_number,
          description: row.description,
          status: row.status,
          expected_closure_date: row.expected_closure_date,
          pending_since_days: row.pending_since_days,
        });
      }
    }
  }

  return [...groups.values()].sort((a, b) => b.srs.length - a.srs.length);
}

// Sends one reminder per group and logs every outcome. sentBy is the admin's user id for a
// manual send, or null for the weekly automatic run (the history table shows null as "System").
async function sendReminderGroups(groups, sentBy) {
  const sent = [];
  const failed = [];

  for (const group of groups) {
    const srNumbers = group.srs.map(s => s.sr_number).join(', ');
    if (!group.email) {
      failed.push({ name: group.name, message: 'No email on file for this contact' });
      await pool.execute(
        'INSERT INTO pending_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, message, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [group.name, null, group.srs.length, srNumbers, 'failed', 'No email on file for this contact', sentBy]
      );
      continue;
    }
    try {
      await sendPendingReminderEmail({ to: group.email, name: group.name, srs: group.srs });
      sent.push({ name: group.name, email: group.email, srCount: group.srs.length });
      await pool.execute(
        'INSERT INTO pending_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, sent_by) VALUES (?, ?, ?, ?, ?, ?)',
        [group.name, group.email, group.srs.length, srNumbers, 'sent', sentBy]
      );
    } catch (e) {
      failed.push({ name: group.name, message: e.message });
      await pool.execute(
        'INSERT INTO pending_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, message, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [group.name, group.email, group.srs.length, srNumbers, 'failed', e.message, sentBy]
      );
    }
  }

  return { sent, failed };
}

async function getSettings() {
  const [rows] = await pool.query('SELECT * FROM pending_reminder_settings WHERE is_deleted = 0 ORDER BY id DESC LIMIT 1');
  return rows[0] || { enabled: 0, day_of_week: 1, hour: 9, minute: 0, last_run_at: null, last_run_message: null };
}

// The automatic run only emails people who already have an address on file: nobody is around to
// resolve a missing email at 9am on a Monday, so those people are skipped and counted in the
// summary (and stay visible, flagged, on the manual tab) rather than logged as a failure every week.
async function runScheduledReminders() {
  if (scheduledRunActive) return null;
  scheduledRunActive = true;
  let message;
  try {
    const groups = await buildReminderGroups();
    const sendable = groups.filter(g => g.email);
    const skipped = groups.length - sendable.length;
    if (sendable.length === 0) {
      message = groups.length === 0
        ? 'Nothing pending with anyone — no emails sent.'
        : `No emails sent — ${skipped} ${skipped === 1 ? 'person has' : 'people have'} no email on file.`;
    } else {
      const { sent, failed } = await sendReminderGroups(sendable, null);
      message = `Sent to ${sent.length}${failed.length ? `; ${failed.length} failed` : ''}${skipped ? `; ${skipped} skipped (no email on file)` : ''}.`;
    }
  } catch (e) {
    message = `Automatic run failed: ${e.message}`.slice(0, 1000);
    console.error('Scheduled pending reminders failed:', e.message);
  } finally {
    scheduledRunActive = false;
  }

  await pool.execute(
    'UPDATE pending_reminder_settings SET last_run_at = NOW(), last_run_message = ? WHERE is_deleted = 0',
    [message]
  );
  return message;
}

function scheduleFromSettings(settings) {
  if (cronTask) { cronTask.stop(); cronTask = null; }
  if (!settings.enabled) { console.log('Automatic pending reminders disabled'); return; }
  const pattern = `${settings.minute} ${settings.hour} * * ${settings.day_of_week}`;
  cronTask = cron.schedule(pattern, () => {
    runScheduledReminders().catch(e => console.error('Scheduled pending reminders failed:', e.message));
  });
  console.log(`Automatic pending reminders scheduled (cron "${pattern}")`);
}

async function initPendingReminderScheduler() {
  scheduleFromSettings(await getSettings());
}

module.exports = {
  buildReminderGroups,
  sendReminderGroups,
  getSettings,
  runScheduledReminders,
  initPendingReminderScheduler,
  reschedulePendingReminders: initPendingReminderScheduler,
};
