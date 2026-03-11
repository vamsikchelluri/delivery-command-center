// src/lib/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  r => r.data,
  err => Promise.reject(err.response?.data || err)
);

export const resourcesApi = {
  list:         (params) => api.get('/resources', { params }),
  get:          (id)     => api.get(`/resources/${id}`),
  create:       (data)   => api.post('/resources', data),
  update:       (id, data) => api.patch(`/resources/${id}`, data),
  updateStatus: (id, data) => api.patch(`/resources/${id}/status`, data),
  delete:       (id)     => api.delete(`/resources/${id}`),
};

export const skillsApi = {
  list:   ()         => api.get('/skills'),
  create: (data)     => api.post('/skills', data),
  update: (id, data) => api.patch(`/skills/${id}`, data),
  delete: (id)       => api.delete(`/skills/${id}`),
};

export const currenciesApi = {
  list:         ()           => api.get('/currencies'),
  upsert:       (data)       => api.post('/currencies', data),
  updateRate:   (code, rate) => api.patch(`/currencies/${code}`, { rateVsUSD: rate }),
  delete:       (code)       => api.delete(`/currencies/${code}`),
};

export const configApi = {
  get:    ()     => api.get('/config'),
  update: (data) => api.patch('/config', data),
};

export const projectsApi = {
  list:             (params) => api.get('/projects', { params }),
  get:              (id)     => api.get(`/projects/${id}`),
  create:           (data)   => api.post('/projects', data),
  update:           (id, d)  => api.patch(`/projects/${id}`, d),
  delete:           (id)     => api.delete(`/projects/${id}`),
  addRole:          (projId, data) => api.post(`/projects/${projId}/roles`, data),
  updateRole:       (roleId, data) => api.patch(`/projects/roles/${roleId}`, data),
  deleteRole:       (roleId)       => api.delete(`/projects/roles/${roleId}`),
  addMilestone:     (projId, data) => api.post(`/projects/${projId}/milestones`, data),
  updateMilestone:  (mid, data)    => api.patch(`/projects/milestones/${mid}`, data),
  deleteMilestone:  (mid)          => api.delete(`/projects/milestones/${mid}`),
  listUsers:        (params)       => api.get('/users', { params }),
};

export const pipelineApi = {
  list:        (params)   => api.get('/pipeline', { params }),
  get:         (id)       => api.get(`/pipeline/${id}`),
  create:      (data)     => api.post('/pipeline', data),
  update:      (id, d)    => api.patch(`/pipeline/${id}`, d),
  delete:      (id)       => api.delete(`/pipeline/${id}`),
  addRole:     (oppId, d) => api.post(`/pipeline/${oppId}/roles`, d),
  updateRole:  (rId, d)   => api.patch(`/pipeline/roles/${rId}`, d),
  deleteRole:  (rId)      => api.delete(`/pipeline/roles/${rId}`),
  convert:     (id)       => api.post(`/pipeline/${id}/convert`),
};

export const deploymentsApi = {
  create: (data)   => api.post('/deployments', data),
  update: (id, d)  => api.patch(`/deployments/${id}`, d),
  delete: (id)     => api.delete(`/deployments/${id}`),
};

export const actualsApi = {
  upsert: (data) => api.post('/actuals', data),
  delete: (id)   => api.delete(`/actuals/${id}`),
};

export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

export default api;

export const teamApi = {
  list:   (params) => api.get('/team', { params }),
  create: (data)   => api.post('/team', data),
  update: (id, d)  => api.patch(`/team/${id}`, d),
  delete: (id)     => api.delete(`/team/${id}`),
};
