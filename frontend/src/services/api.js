import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

export const srAPI = {
  list: (params) => api.get('/srs', { params }),
  get: (id) => api.get(`/srs/${id}`),
  create: (data) => api.post('/srs', data),
  update: (id, data) => api.put(`/srs/${id}`, data),
  close: (id) => api.post(`/srs/${id}/close`),
  reopen: (id) => api.post(`/srs/${id}/reopen`),
  delete: (id) => api.delete(`/srs/${id}`),
  stats: (params) => api.get('/srs/stats/summary', { params }),
  distinctValues: (category, field) => api.get('/srs/meta/distinct', { params: { category, field } }),
  addComment: (id, comment) => api.post(`/srs/${id}/comments`, { comment }),
};

export const statsAPI = {
  dashboard: () => api.get('/stats/dashboard'),
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
};

export const userAPI = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  bulkCreate: (rows) => api.post('/users/bulk', { rows }),
  update: (id, data) => api.put(`/users/${id}`, data),
};

export const backupAPI = {
  getSettings: () => api.get('/backup/settings'),
  updateSettings: (data) => api.put('/backup/settings', data),
  runNow: () => api.post('/backup/run-now'),
  history: () => api.get('/backup/history'),
  // The download route requires the same JWT auth as everything else, so it can't be a
  // plain <a href>; fetch it as a blob (auth header attached by the interceptor above)
  // and hand the browser a temporary object URL to save.
  download: async (filename) => {
    const res = await api.get(`/backup/download/${filename}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
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
