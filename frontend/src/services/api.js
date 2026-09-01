const API_ROOT = '/api';

let activeRequestCount = 0;
const loadingSubscribers = new Set();
const inFlightGets = new Map();
const responseCache = new Map();

function publishLoadingState() {
  loadingSubscribers.forEach(listener => listener());
}

function startTracking() {
  const marker = { active: true };
  activeRequestCount += 1;
  publishLoadingState();
  return marker;
}

function stopTracking(marker) {
  if (!marker?.active) return;
  marker.active = false;
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  publishLoadingState();
}

function paramsString(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

function clearReadCache() {
  responseCache.clear();
}

async function readResponse(response, responseType) {
  if (responseType === 'blob') return response.blob();
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  return response.text();
}

function httpError(response, data) {
  const error = new Error(data?.message || `Request failed with HTTP ${response.status}`);
  error.response = { status: response.status, data };
  return error;
}

async function executeRequest(method, path, { params, data, responseType = 'json', signal } = {}) {
  const url = `${API_ROOT}${path}${paramsString(params)}`;
  const headers = { Accept: responseType === 'blob' ? '*/*' : 'application/json' };
  const token = sessionStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let body;
  if (data instanceof FormData) {
    body = data;
  } else if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }

  const marker = startTracking();
  try {
    const response = await fetch(url, { method, headers, body, signal, credentials: 'same-origin' });
    const payload = await readResponse(response, responseType);
    if (!response.ok) {
      if (response.status === 401 && token && path !== '/auth/login') {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.assign('/login');
      }
      throw httpError(response, payload);
    }
    if (method !== 'GET') clearReadCache();
    return { data: payload, status: response.status, headers: response.headers };
  } finally {
    stopTracking(marker);
  }
}

function get(path, options = {}) {
  // Abortable reads represent live table navigation. Do not coalesce them: a freshly
  // started request must not inherit the promise that its caller just cancelled.
  if (options.signal) return executeRequest('GET', path, options);

  const authKey = sessionStorage.getItem('token') || 'anonymous';
  const key = `${authKey}|${path}${paramsString(options.params)}|${options.responseType || 'json'}`;
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
  if (cached) responseCache.delete(key);
  if (inFlightGets.has(key)) return inFlightGets.get(key);

  const promise = executeRequest('GET', path, options)
    .then(response => {
      if (options.cacheMs > 0) {
        responseCache.set(key, { response, expiresAt: Date.now() + options.cacheMs });
      }
      return response;
    })
    .finally(() => inFlightGets.delete(key));
  inFlightGets.set(key, promise);
  return promise;
}

const api = {
  get,
  post: (path, data, options) => executeRequest('POST', path, { ...options, data }),
  put: (path, data, options) => executeRequest('PUT', path, { ...options, data }),
  delete: (path, options) => executeRequest('DELETE', path, options),
};

export function subscribeToApiLoading(listener) {
  loadingSubscribers.add(listener);
  return () => loadingSubscribers.delete(listener);
}

export function getApiLoadingSnapshot() {
  return activeRequestCount;
}

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

export const srAPI = {
  list: (params, options) => api.get('/srs', { ...options, params }),
  get: (id) => api.get(`/srs/${id}`),
  create: (data) => api.post('/srs', data),
  update: (id, data) => api.put(`/srs/${id}`, data),
  close: (id) => api.post(`/srs/${id}/close`),
  reopen: (id) => api.post(`/srs/${id}/reopen`),
  delete: (id) => api.delete(`/srs/${id}`),
  stats: (params, options) => api.get('/srs/stats/summary', { ...options, params }),
  filterOptions: (category) => api.get('/srs/meta/options', { params: { category }, cacheMs: 60_000 }),
  distinctValues: (category, field) => api.get('/srs/meta/distinct', { params: { category, field }, cacheMs: 60_000 }),
  addComment: (id, comment) => api.post(`/srs/${id}/comments`, { comment }),
};

export const statsAPI = {
  dashboard: () => api.get('/stats/dashboard', { cacheMs: 15_000 }),
};

export const reportsAPI = {
  assignedToEcd: (params) => api.get('/reports/assigned-to-ecd', { params }),
};

export const deloitteImportAPI = {
  parse: (formData) => api.post('/deloitte-import/parse', formData),
  apply: (rows) => api.post('/deloitte-import/apply', rows),
};

export const csvImportAPI = {
  execute: (category, rows) => api.post('/csv-import/execute', { category, rows }),
};

export const manageEngineImportAPI = {
  parse: (formData) => api.post('/manageengine-import/parse', formData),
  apply: (data) => api.post('/manageengine-import/apply', data),
  syncStatus: () => api.get('/manageengine-import/sync-status', { cacheMs: 5_000 }),
  syncNow: () => api.post('/manageengine-import/sync-now'),
};

export const userAPI = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  bulkCreate: (rows) => api.post('/users/bulk', { rows }),
  update: (id, data) => api.put(`/users/${id}`, data),
};

export const backupAPI = {
  getSettings: () => api.get('/backup/settings', { cacheMs: 10_000 }),
  updateSettings: (data) => api.put('/backup/settings', data),
  runNow: () => api.post('/backup/run-now'),
  history: () => api.get('/backup/history'),
  download: async (filename) => {
    const res = await api.get(`/backup/download/${filename}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  delete: (filename) => api.delete(`/backup/${filename}`),
};

export default api;
