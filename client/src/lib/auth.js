// src/lib/auth.js — token management + auth/users/roles/audit API
import api from './api';

const ACCESS_KEY  = 'dcc_access';
const REFRESH_KEY = 'dcc_refresh';

export function getAccessToken()  { return localStorage.getItem(ACCESS_KEY); }
export function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }

export function saveTokens(access, refresh) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// Attach token to every request
api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let refreshing = null;
api.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = api.post('/auth/refresh', { refreshToken: getRefreshToken() })
          .then(data => { saveTokens(data.accessToken, null); refreshing = null; return data.accessToken; })
          .catch(() => { clearTokens(); window.location.href = '/login'; refreshing = null; });
      }
      try {
        const token = await refreshing;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch { return Promise.reject(err); }
    }
    return Promise.reject(err.response?.data || err);
  }
);

export const authApi = {
  login:          (data) => api.post('/auth/login', data),
  logout:         (data) => api.post('/auth/logout', data),
  logoutAll:      ()     => api.post('/auth/logout-all'),
  me:             ()     => api.get('/auth/me'),
  sessions:       ()     => api.get('/auth/sessions'),
  changePassword: (data) => api.patch('/auth/change-password', data),
};

export const usersApi = {
  list:   ()         => api.get('/users'),
  get:    (id)       => api.get(`/users/${id}`),
  create: (data)     => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id)       => api.delete(`/users/${id}`),
};

export const rolesApi = {
  list:          ()         => api.get('/roles'),
  setPermission: (id, data) => api.patch(`/roles/${id}/permissions`, data),
  setFieldPerm:  (id, data) => api.patch(`/roles/${id}/field-permissions`, data),
};

export const auditApi = {
  list: (params) => api.get('/audit', { params }),
};
