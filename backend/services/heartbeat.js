const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function pad(n) { return String(n).padStart(2, '0'); }

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Computed fresh on every write (not cached) so the log rolls over to a new file the
// moment the calendar date changes, with no separate scheduling needed for that part.
function todayFile() {
  const d = new Date();
  return path.join(LOG_DIR, `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.log`);
}

function logEvent(message) {
  fs.appendFile(todayFile(), `[${timestamp()}] ${message}\n`, err => {
    if (err) console.error('Failed to write log:', err.message);
  });
}

let heartbeatTask = null;

// A start-up line plus one line every hour on the hour is enough to tell, from the log
// alone, both that the server came up and roughly how long it's been running since —
// a gap in the hourly lines (or a log file that stops appearing for a whole day) means
// it went down.
function startHeartbeat() {
  logEvent(`Server started (PID ${process.pid})`);
  if (heartbeatTask) heartbeatTask.stop();
  heartbeatTask = cron.schedule('0 * * * *', () => logEvent('Heartbeat — server running'));
}

function logShutdown(signal) {
  logEvent(`Server stopping (${signal})`);
}

function logCrash(source, err) {
  logEvent(`Server crashed (${source}): ${err && err.stack ? err.stack : err}`);
}

module.exports = { logEvent, startHeartbeat, logShutdown, logCrash, LOG_DIR };
