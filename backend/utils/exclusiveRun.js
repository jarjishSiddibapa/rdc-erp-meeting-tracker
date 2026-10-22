const { pool } = require('../db/pool');

// More than one copy of this app can end up running against the same database (a leftover
// process from an old start, a second folder, another machine). Every copy registers the same
// cron jobs, so each scheduled backup / reminder email would fire once per copy. These helpers make
// a scheduled job run at most once across all copies, using a MySQL named lock (shared by every
// connection to this server) plus a "did it already run a moment ago" check for the copy that
// reaches the lock just after the first one has finished.

// A scheduled run that finished less than this long ago counts as "already done" by another copy.
const RECENT_WINDOW_MINUTES = 2;

// Runs fn only if no other connection holds `lockName`. Resolves to { skipped: true } otherwise.
async function runExclusive(lockName, fn) {
  const conn = await pool.getConnection();
  try {
    const [[row]] = await conn.query('SELECT GET_LOCK(?, 0) AS got', [lockName]);
    if (!row.got) return { skipped: true };
    try {
      return { skipped: false, value: await fn() };
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } finally {
    conn.release();
  }
}

// `table` is one of this app's own settings tables with a last_run_at column (never user input).
async function settingsRanRecently(table) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS n FROM ${table} WHERE is_deleted = 0 AND last_run_at > NOW() - INTERVAL ${RECENT_WINDOW_MINUTES} MINUTE`
  );
  return row.n > 0;
}

async function scheduledBackupRanRecently() {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS n FROM backup_runs WHERE triggered_by = 'schedule' AND is_deleted = 0 AND started_at > NOW() - INTERVAL ${RECENT_WINDOW_MINUTES} MINUTE`
  );
  return row.n > 0;
}

module.exports = { runExclusive, settingsRanRecently, scheduledBackupRanRecently };
