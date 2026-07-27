import axios from 'axios';
import { useAppStore } from '@/store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAppStore.getState().logout();
    }

    return Promise.reject(error);
  }
);

export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data.data;
  },
  getSession: async () => {
    const response = await api.get('/auth/me');
    return response.data.data;
  }
};

export const dashboardService = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data.data;
  },
  getRecentFindings: async () => {
    const response = await api.get('/findings/recent');
    return response.data.data;
  }
};

export const findingsService = {
  getFindings: async (assetId) => {
    const response = await api.get('/findings', { params: assetId ? { assetId } : {} });
    return response.data.data;
  },
  createFinding: async ({ idempotencyKey = crypto.randomUUID(), ...payload }) => {
    const response = await api.post('/findings', payload, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
    return response.data.data;
  },
  updateFinding: async ({ id, ...payload }) => {
    const response = await api.patch(`/findings/${id}`, payload);
    return response.data.data;
  },
  deleteFinding: async (id) => {
    const response = await api.delete(`/findings/${id}`);
    return response.data.data;
  }
};

export const operationsService = {
  getProjects: async () => {
    const response = await api.get('/projects');
    return response.data.data;
  },
  createProject: async (payload) => {
    const response = await api.post('/projects', payload);
    return response.data.data;
  },
  updateProject: async ({ id, ...payload }) => {
    const response = await api.patch(`/projects/${id}`, payload);
    return response.data.data;
  },
  deleteProject: async (id) => {
    const response = await api.delete(`/projects/${id}`);
    return response.data.data;
  },
  getAudits: async (projectId) => {
    const response = await api.get('/audits', { params: projectId ? { projectId } : {} });
    return response.data.data;
  },
  createAudit: async ({ projectId, ...payload }) => {
    const response = await api.post(`/projects/${projectId}/audits`, payload);
    return response.data.data;
  },
  updateAudit: async ({ id, ...payload }) => {
    const response = await api.patch(`/audits/${id}`, payload);
    return response.data.data;
  },
  deleteAudit: async (id) => {
    const response = await api.delete(`/audits/${id}`);
    return response.data.data;
  },
  getAssets: async (auditId) => {
    const response = await api.get('/assets', { params: auditId ? { auditId } : {} });
    return response.data.data;
  },
  createAsset: async ({ auditId, ...payload }) => {
    const response = await api.post(`/audits/${auditId}/assets`, payload);
    return response.data.data;
  },
  updateAsset: async ({ id, ...payload }) => {
    const response = await api.patch(`/assets/${id}`, payload);
    return response.data.data;
  },
  deleteAsset: async (id) => {
    const response = await api.delete(`/assets/${id}`);
    return response.data.data;
  }
};

export const knowledgeService = {
  getRules: async (params = {}) => {
    const response = await api.get('/knowledge/rules', { params });
    return response.data.data;
  },
  createRule: async (payload) => {
    const response = await api.post('/knowledge/rules', payload);
    return response.data.data;
  },
  updateRule: async ({ id, ...payload }) => {
    const response = await api.patch(`/knowledge/rules/${id}`, payload);
    return response.data.data;
  },
  deleteRule: async (id) => {
    const response = await api.delete(`/knowledge/rules/${id}`);
    return response.data.data;
  }
};

export default api;
