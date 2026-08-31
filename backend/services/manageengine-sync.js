const cron = require('node-cron');
const { pool } = require('../db/pool');

const ACCEPT = 'application/vnd.manageengine.sdp.v3+json';
const CLOSED_STATUSES = new Set(['closed', 'resolved', 'cancelled', 'canceled', 'rejected', 'completed']);
const DEFAULT_ACCOUNTS_URL = 'https://accounts.zoho.com';
const DEFAULT_INTERVAL_MINUTES = 30;
const PAGE_SIZE = 100;

let accessTokenCache = null;
let cronTask = null;
let activeRun = null;

function envFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getConfig() {
  const interval = Number.parseInt(process.env.MANAGEENGINE_SYNC_INTERVAL_MINUTES, 10);
  return {
    enabled: envFlag('MANAGEENGINE_SYNC_ENABLED'),
    runOnStart: envFlag('MANAGEENGINE_SYNC_RUN_ON_START', true),
    intervalMinutes: Number.isInteger(interval) && interval > 0 && interval <= 60 && 60 % interval === 0
      ? interval
      : DEFAULT_INTERVAL_MINUTES,
    accountsUrl: trimTrailingSlash(process.env.MANAGEENGINE_ACCOUNTS_URL || DEFAULT_ACCOUNTS_URL),
    apiDomain: trimTrailingSlash(process.env.MANAGEENGINE_API_DOMAIN),
    portal: String(process.env.MANAGEENGINE_PORTAL || '').trim(),
    clientId: String(process.env.MANAGEENGINE_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.MANAGEENGINE_CLIENT_SECRET || '').trim(),
    refreshToken: String(process.env.MANAGEENGINE_REFRESH_TOKEN || '').trim(),
    externalTechnician: String(process.env.MANAGEENGINE_EXTERNAL_TECHNICIAN || 'Deloitte ERP Support').trim(),
    timeZone: String(process.env.MANAGEENGINE_TIME_ZONE || 'Asia/Kolkata').trim(),
    maxPages: Math.max(1, Number.parseInt(process.env.MANAGEENGINE_SYNC_MAX_PAGES, 10) || 100),
  };
}

function missingConfig(config = getConfig()) {
  return [
    ['MANAGEENGINE_CLIENT_ID', config.clientId],
    ['MANAGEENGINE_CLIENT_SECRET', config.clientSecret],
    ['MANAGEENGINE_REFRESH_TOKEN', config.refreshToken],
  ].filter(([, value]) => !value).map(([name]) => name);
}

function normalizeStatusName(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function isClosedFamily(value) {
  return CLOSED_STATUSES.has(normalizeStatusName(value));
}

function mapStatus(value) {
  const normalized = normalizeStatusName(value);
  if (isClosedFamily(normalized)) return 'Closed';
  if (normalized === 'on hold' || normalized === 'onhold') return 'On Hold';
  if (normalized.includes('pending with user') || normalized.includes('pending on user')) return 'Pending with User';
  if (normalized.includes('pending')) return 'Pending';
  if (normalized === 'in progress' || normalized === 'inprogress' || normalized === 'work in progress') return 'In Progress';
  return 'Open';
}

function pendingPartyFor(request) {
  if (isClosedFamily(request?.status?.name)) return null;
  const status = normalizeStatusName(request?.status?.name);
  if (status.includes('pending with user') || status.includes('pending on user')) return 'User';
  if (status.includes('pending with technician') || status.includes('pending on technician')) return 'Technician';
  if (request?.unreplied_count === null || request?.unreplied_count === undefined || request?.unreplied_count === '') return null;
  return Number(request?.unreplied_count || 0) > 0 ? 'Technician' : 'User';
}

function dateTimeFromApi(value, timeZone = 'Asia/Kolkata') {
  const raw = value && typeof value === 'object' ? value.value : value;
  if (raw === null || raw === undefined || raw === '' || raw === 'null') return null;
  const milliseconds = Number(raw);
  const date = Number.isFinite(milliseconds) ? new Date(milliseconds) : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute}:${byType.second}`;
}

function normalizeRequest(request, config = getConfig()) {
  const remoteStatus = String(request?.status?.name || '').trim();
  const status = mapStatus(remoteStatus);
  const technician = String(request?.technician?.name || '').trim() || null;
  const requester = String(request?.requester?.name || request?.created_by?.name || '').trim() || null;
  const createdBy = String(request?.created_by?.name || request?.requester?.name || '').trim() || null;
  const pendingParty = pendingPartyFor(request);
  const createdAt = dateTimeFromApi(request?.created_time, config.timeZone);
  const closedAt = dateTimeFromApi(request?.completed_time, config.timeZone);

  return {
    remoteId: String(request?.display_id || request?.id || '').trim(),
    status,
    manageengine_status: remoteStatus || null,
    manageengine_pending_party: pendingParty,
    pending_with: pendingParty === 'Technician' ? technician : pendingParty === 'User' ? requester : null,
    assigned_to: technician,
    scope: technician && technician.localeCompare(config.externalTechnician, undefined, { sensitivity: 'accent' }) === 0
      ? 'External'
      : 'Internal',
    type: String(request?.category?.name || '').trim() || null,
    created_by_name: createdBy,
    manageengine_created_at: createdAt,
    creation_date: createdAt ? createdAt.slice(0, 10) : null,
    manageengine_closed_at: status === 'Closed' ? closedAt : null,
    closed_date: status === 'Closed' && closedAt ? closedAt.slice(0, 10) : null,
  };
}

async function fetchWithRetry(url, options, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status >= 500;
      const body = await response.text();
      const error = new Error(`ManageEngine API returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
      error.status = response.status;
      if (!retryable || attempt === attempts) throw error;
      const retryAfterSeconds = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : attempt * 1000;
      await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 10000)));
    } catch (error) {
      lastError = error;
      if (attempt === attempts || (error.status && error.status < 500 && error.status !== 429)) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

async function refreshAccessToken(config, force = false) {
  if (!force && accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60000) return accessTokenCache;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
  });
  const response = await fetchWithRetry(`${config.accountsUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json();
  if (!payload.access_token) throw new Error(`Zoho did not return an access token (${payload.error || 'unknown response'})`);

  accessTokenCache = {
    accessToken: payload.access_token,
    apiDomain: config.apiDomain || trimTrailingSlash(payload.api_domain),
    expiresAt: Date.now() + (Number(payload.expires_in) || 3600) * 1000,
  };
  if (!accessTokenCache.apiDomain) {
    throw new Error('Zoho token response did not include api_domain; set MANAGEENGINE_API_DOMAIN explicitly');
  }
  return accessTokenCache;
}

function requestsUrl(apiDomain, portal) {
  const portalPath = portal ? `/app/${encodeURIComponent(portal)}` : '';
  return `${trimTrailingSlash(apiDomain)}${portalPath}/api/v3/requests`;
}

function assertApiSuccess(payload) {
  const statuses = Array.isArray(payload?.response_status)
    ? payload.response_status
    : payload?.response_status ? [payload.response_status] : [];
  const failure = statuses.find(item => item?.status && item.status !== 'success');
  if (!failure) return;
  const message = failure.messages?.[0]?.message || failure.message || failure.status_code || 'unknown API error';
  throw new Error(`ManageEngine API rejected the request: ${message}`);
}

async function fetchRequestPage(config, startIndex, forceTokenRefresh = false) {
  const token = await refreshAccessToken(config, forceTokenRefresh);
  const inputData = {
    list_info: {
      row_count: PAGE_SIZE,
      start_index: startIndex,
      sort_field: 'id',
      sort_order: 'desc',
      fields_required: [
        'id', 'display_id', 'status', 'requester', 'created_by', 'technician', 'category',
        'created_time', 'completed_time', 'unreplied_count',
      ],
      filter_by: { name: 'All_Requests' },
    },
  };
  const url = new URL(requestsUrl(token.apiDomain, config.portal));
  url.searchParams.set('input_data', JSON.stringify(inputData));
  try {
    const response = await fetchWithRetry(url, {
      headers: {
        Accept: ACCEPT,
        Authorization: `Zoho-oauthtoken ${token.accessToken}`,
      },
    }, 3);
    const payload = await response.json();
    assertApiSuccess(payload);
    return payload;
  } catch (error) {
    if (error.status === 401 && !forceTokenRefresh) return fetchRequestPage(config, startIndex, true);
    throw error;
  }
}

function requestLookupKeys(request) {
  return [request?.display_id, request?.id]
    .filter(value => value !== null && value !== undefined && String(value).trim())
    .map(value => String(value).trim());
}

async function fetchMatchingRequests(config, localNumbers) {
  const wanted = new Set(localNumbers.map(value => String(value).trim()));
  const matches = new Map();
  let scanned = 0;
  let startIndex = 1;
  let pages = 0;

  while (pages < config.maxPages && matches.size < wanted.size) {
    const payload = await fetchRequestPage(config, startIndex);
    const rows = Array.isArray(payload.requests) ? payload.requests : [];
    scanned += rows.length;
    pages++;

    for (const request of rows) {
      for (const key of requestLookupKeys(request)) {
        if (wanted.has(key) && !matches.has(key)) matches.set(key, request);
      }
    }

    const hasMore = payload?.list_info?.has_more_rows === true || payload?.list_info?.has_more_rows === 'true';
    if (!hasMore || rows.length === 0) break;
    startIndex += rows.length;
  }

  return { matches, scanned, pages };
}

function comparable(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

async function applyRequestUpdate(conn, local, remote, config) {
  const desired = normalizeRequest(remote, config);
  const changes = [];

  const values = {
    scope: desired.scope,
    assigned_to: desired.assigned_to,
    type: desired.type,
  };

  if (desired.created_by_name) values.created_by_name = desired.created_by_name;
  if (desired.manageengine_created_at) values.manageengine_created_at = desired.manageengine_created_at;
  if (desired.manageengine_status) {
    values.status = desired.status;
    values.manageengine_status = desired.manageengine_status;
  }
  if (desired.manageengine_pending_party || desired.status === 'Closed') {
    values.manageengine_pending_party = desired.manageengine_pending_party;
    values.pending_with = desired.pending_with;
  }
  if (desired.creation_date) values.creation_date = desired.creation_date;
  if (desired.manageengine_status && desired.status === 'Closed') {
    if (desired.closed_date) values.closed_date = desired.closed_date;
    if (desired.manageengine_closed_at) values.manageengine_closed_at = desired.manageengine_closed_at;
  } else if (desired.manageengine_status) {
    values.closed_date = null;
    values.manageengine_closed_at = null;
  }

  for (const [field, newValue] of Object.entries(values)) {
    if (comparable(local[field]) === comparable(newValue)) continue;
    changes.push({ field, oldValue: local[field], newValue });
  }

  if (changes.length) {
    const setSql = changes.map(change => `${change.field} = ?`).join(', ');
    await conn.execute(
      `UPDATE srs SET ${setSql}, manageengine_last_synced_at = NOW() WHERE id = ?`,
      [...changes.map(change => change.newValue), local.id]
    );
    for (const change of changes) {
      await conn.execute(
        'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, NULL)',
        [local.id, change.field, change.oldValue, change.newValue]
      );
    }
  } else {
    await conn.execute('UPDATE srs SET manageengine_last_synced_at = NOW() WHERE id = ?', [local.id]);
  }

  return changes.length;
}

async function beginRun(triggeredBy) {
  const [result] = await pool.execute(
    "INSERT INTO manageengine_sync_runs (status, triggered_by) VALUES ('running', ?)",
    [triggeredBy]
  );
  return result.insertId;
}

async function finishRun(runId, status, counts, message = null) {
  await pool.execute(`
    UPDATE manageengine_sync_runs
    SET status = ?, local_srs = ?, remote_requests_scanned = ?, matched = ?, updated = ?,
        unchanged = ?, missing = ?, error_count = ?, message = ?, finished_at = NOW()
    WHERE id = ?
  `, [
    status, counts.localSrs, counts.scanned, counts.matched, counts.updated,
    counts.unchanged, counts.missing, counts.errorCount, message, runId,
  ]);
}

async function executeSync(triggeredBy = 'schedule') {
  const config = getConfig();
  const missing = missingConfig(config);
  if (!config.enabled && triggeredBy === 'schedule') {
    return { skipped: true, message: 'ManageEngine automatic sync is disabled' };
  }
  if (missing.length) throw new Error(`ManageEngine sync is not configured: missing ${missing.join(', ')}`);

  const runId = await beginRun(triggeredBy);
  const counts = { localSrs: 0, scanned: 0, matched: 0, updated: 0, unchanged: 0, missing: 0, errorCount: 0 };
  try {
    const [localRows] = await pool.query(`
      SELECT id, sr_number, status, scope, pending_with, assigned_to, type, creation_date,
             created_by_name, closed_date, manageengine_status, manageengine_pending_party,
             manageengine_created_at, manageengine_closed_at
      FROM srs
      WHERE category = 'SR' AND is_deleted = 0
    `);
    counts.localSrs = localRows.length;
    if (!localRows.length) {
      await finishRun(runId, 'success', counts, 'No existing Service Requests to synchronize');
      return { runId, status: 'success', ...counts };
    }

    const remoteResult = await fetchMatchingRequests(config, localRows.map(row => row.sr_number));
    counts.scanned = remoteResult.scanned;
    counts.matched = localRows.filter(row => remoteResult.matches.has(String(row.sr_number).trim())).length;
    counts.missing = localRows.length - counts.matched;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const local of localRows) {
        const remote = remoteResult.matches.get(String(local.sr_number).trim());
        if (!remote) continue;
        const changedFields = await applyRequestUpdate(conn, local, remote, config);
        if (changedFields) counts.updated++;
        else counts.unchanged++;
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    const status = counts.missing > 0 ? 'partial' : 'success';
    const message = counts.missing > 0
      ? `${counts.missing} local SR(s) were not present in the scanned ManageEngine request list and were left unchanged`
      : null;
    await finishRun(runId, status, counts, message);
    return { runId, status, ...counts, message };
  } catch (error) {
    counts.errorCount++;
    await finishRun(runId, 'failed', counts, error.message.slice(0, 2000));
    throw error;
  }
}

async function runManageEngineSync(triggeredBy = 'schedule') {
  if (activeRun) return { alreadyRunning: true, ...(await activeRun) };
  activeRun = executeSync(triggeredBy);
  try {
    return await activeRun;
  } finally {
    activeRun = null;
  }
}

async function getSyncStatus() {
  const config = getConfig();
  const [rows] = await pool.query('SELECT * FROM manageengine_sync_runs ORDER BY id DESC LIMIT 1');
  return {
    enabled: config.enabled,
    configured: missingConfig(config).length === 0,
    missing_configuration: missingConfig(config),
    interval_minutes: config.intervalMinutes,
    running: !!activeRun,
    portal: config.portal || null,
    last_run: rows[0] || null,
  };
}

function initManageEngineScheduler() {
  const config = getConfig();
  if (cronTask) { cronTask.stop(); cronTask = null; }
  if (!config.enabled) {
    console.log('ManageEngine automatic sync disabled');
    return;
  }
  const missing = missingConfig(config);
  if (missing.length) {
    console.warn(`ManageEngine automatic sync not scheduled; missing ${missing.join(', ')}`);
    return;
  }

  cronTask = cron.schedule(`*/${config.intervalMinutes} * * * *`, () => {
    runManageEngineSync('schedule').catch(error => console.error('Scheduled ManageEngine sync failed:', error.message));
  });
  console.log(`ManageEngine sync scheduled every ${config.intervalMinutes} minutes`);

  if (config.runOnStart) {
    setTimeout(() => {
      runManageEngineSync('startup').catch(error => console.error('Startup ManageEngine sync failed:', error.message));
    }, 5000);
  }
}

module.exports = {
  getConfig,
  getSyncStatus,
  initManageEngineScheduler,
  isClosedFamily,
  mapStatus,
  normalizeRequest,
  pendingPartyFor,
  runManageEngineSync,
};
