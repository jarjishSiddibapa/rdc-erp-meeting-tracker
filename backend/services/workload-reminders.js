const cron = require('node-cron');
const { pool } = require('../db/pool');
const { sendWorkloadReminderEmail } = require('./mailer');
const { loadRecords } = require('./resolution-insights');
const { runExclusive, settingsRanRecently } = require('../utils/exclusiveRun');

let cronTask = null;
let scheduledRunActive = false;

// Same exclusions as the pending reminders: Deloitte is an external vendor already covered by the
// weekly PDF import, so it is never emailed, and contacts marked "ignored" are skipped everywhere.
function isDeloitte(name) {
  return name.toLowerCase().includes('deloitte');
}

// One group per PERSON: every open SR currently assigned to them in ManageEngine. Grouped by
// resolved email (not name) so two spellings of one technician that share a contact merge into a
// single email; a name with no email on file stays its own group, keyed by name, until one is
// added. Pure - `records` come from resolution-insights.shapeRecord, `contacts` from the contacts
// table - so the grouping rules can be tested without a database.
function groupWorkload(records, contacts) {
  const contactByLowerName = new Map(contacts.map(c => [c.name.toLowerCase(), c]));
  const groups = new Map();

  for (const record of records) {
    if (record.status === 'Closed') continue;
    const name = record.technician;
    if (!name || isDeloitte(name)) continue;
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
    group.srs.push({
      sr_number: record.sr_number,
      description: record.description,
      status: record.status,
      age_days: record.age_minutes === null ? null : Math.floor(record.age_minutes / (24 * 60)),
      expected_closure_date: record.expected_closure_date,
      overdue: record.overdue,
    });
  }

  for (const group of groups.values()) {
    // Oldest first - the SRs that have waited longest are the ones to see first.
    group.srs.sort((a, b) => (b.age_days ?? -1) - (a.age_days ?? -1) || String(a.sr_number).localeCompare(String(b.sr_number)));
    group.overdueCount = group.srs.filter(s => s.overdue).length;
  }
  return [...groups.values()].sort((a, b) => b.srs.length - a.srs.length || a.name.localeCompare(b.name));
}

// Recomputed from the DB on every call - never trust a client-supplied SR list for what gets emailed.
async function buildWorkloadGroups() {
  const { records } = await loadRecords();
  const [contacts] = await pool.query('SELECT id, name, email, is_ignored FROM contacts WHERE is_deleted = 0');
  return groupWorkload(records, contacts);
}

// Sends one reminder per group and logs every outcome. sentBy is the admin's user id for a manual
// send, or null for the scheduled run (the history table shows null as "System").
async function sendWorkloadGroups(groups, sentBy) {
  const sent = [];
  const failed = [];

  for (const group of groups) {
    const srNumbers = group.srs.map(s => s.sr_number).join(', ');
    if (!group.email) {
      failed.push({ name: group.name, message: 'No email on file for this contact' });
      await pool.execute(
        'INSERT INTO workload_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, message, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [group.name, null, group.srs.length, srNumbers, 'failed', 'No email on file for this contact', sentBy]
      );
      continue;
    }
    try {
      await sendWorkloadReminderEmail({ to: group.email, name: group.name, srs: group.srs });
      sent.push({ name: group.name, email: group.email, srCount: group.srs.length });
      await pool.execute(
        'INSERT INTO workload_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, sent_by) VALUES (?, ?, ?, ?, ?, ?)',
        [group.name, group.email, group.srs.length, srNumbers, 'sent', sentBy]
      );
    } catch (e) {
      failed.push({ name: group.name, message: e.message });
      await pool.execute(
        'INSERT INTO workload_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, message, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [group.name, group.email, group.srs.length, srNumbers, 'failed', e.message, sentBy]
      );
    }
  }

  return { sent, failed };
}

async function getSettings() {
  const [rows] = await pool.query('SELECT * FROM workload_reminder_settings WHERE is_deleted = 0 ORDER BY id DESC LIMIT 1');
  return rows[0] || { enabled: 0, day_of_week: 1, hour: 9, minute: 0, last_run_at: null, last_run_message: null };
}

// Like the pending reminders, the automatic run only emails people who already have an address on
// file; the rest are skipped and counted in the summary rather than logged as a failure every week.
async function runScheduledWorkloadReminders() {
  if (scheduledRunActive) return null;
  scheduledRunActive = true;
  let message;
  try {
    const groups = await buildWorkloadGroups();
    const sendable = groups.filter(g => g.email);
    const skipped = groups.length - sendable.length;
    if (sendable.length === 0) {
      message = groups.length === 0
        ? 'Nothing is assigned to anyone - no emails sent.'
        : `No emails sent - ${skipped} ${skipped === 1 ? 'person has' : 'people have'} no email on file.`;
    } else {
      const { sent, failed } = await sendWorkloadGroups(sendable, null);
      message = `Sent to ${sent.length}${failed.length ? `; ${failed.length} failed` : ''}${skipped ? `; ${skipped} skipped (no email on file)` : ''}.`;
    }
  } catch (e) {
    message = `Automatic run failed: ${e.message}`.slice(0, 1000);
    console.error('Scheduled workload reminders failed:', e.message);
  } finally {
    scheduledRunActive = false;
  }

  await pool.execute(
    'UPDATE workload_reminder_settings SET last_run_at = NOW(), last_run_message = ? WHERE is_deleted = 0',
    [message]
  );
  return message;
}

function scheduleFromSettings(settings) {
  if (cronTask) { cronTask.stop(); cronTask = null; }
  if (!settings.enabled) { console.log('Automatic workload reminders disabled'); return; }
  const pattern = `${settings.minute} ${settings.hour} * * ${settings.day_of_week}`;
  // Another copy of the app on the same database would otherwise send every reminder twice.
  cronTask = cron.schedule(pattern, () => {
    runExclusive('erp-workload-reminders', async () => {
      if (await settingsRanRecently('workload_reminder_settings')) return null;
      return runScheduledWorkloadReminders();
    }).catch(e => console.error('Scheduled workload reminders failed:', e.message));
  });
  console.log(`Automatic workload reminders scheduled (cron "${pattern}")`);
}

async function initWorkloadReminderScheduler() {
  scheduleFromSettings(await getSettings());
}

module.exports = {
  groupWorkload,
  buildWorkloadGroups,
  sendWorkloadGroups,
  getSettings,
  runScheduledWorkloadReminders,
  initWorkloadReminderScheduler,
  rescheduleWorkloadReminders: initWorkloadReminderScheduler,
};
