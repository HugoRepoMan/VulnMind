/**
 * Cliente HTTP único. Agrupa endpoints por dominio y adjunta el JWT almacenado
 * en Zustand antes de cada petición.
 */
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
    // 401 implica token vencido/inválido o una cuenta que fue desactivada.
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
  register: async (credentials) => {
    const response = await api.post('/auth/register', credentials);
    return response.data.data;
  },
  getSession: async () => {
    const response = await api.get('/auth/me');
    return response.data.data;
  }
};

export const usersService = {
  getUsers: async () => {
    const response = await api.get('/users');
    return response.data.data;
  },
  createUser: async (payload) => {
    const response = await api.post('/users', payload);
    return response.data.data;
  },
  updateUser: async ({ id, ...payload }) => {
    const response = await api.patch(`/users/${id}`, payload);
    return response.data.data;
  },
  resetPassword: async ({ id, password }) => {
    const response = await api.post(`/users/${id}/reset-password`, { password });
    return response.data.data;
  }
};

export const dashboardService = {
  getStats: async (params = {}) => {
    const response = await api.get('/dashboard/stats', { params });
    return response.data.data;
  },
  getRecentFindings: async (params = {}) => {
    const response = await api.get('/findings/recent', { params });
    return response.data.data;
  }
};

export const findingsService = {
  getFindings: async (assetId) => {
    const response = await api.get('/findings', { params: assetId ? { assetId } : {} });
    return response.data.data;
  },
  createFinding: async ({ idempotencyKey = crypto.randomUUID(), ...payload }) => {
    try {
      const response = await api.post('/findings', payload, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      return response.data.data;
    } catch (error) {
      const retryable = !error.response || [502, 503, 504].includes(error.response.status);
      if (!retryable) throw error;
      const { enqueueFinding } = await import('@/services/offline');
      const queued = await enqueueFinding({ payload, idempotencyKey });
      return { offline: true, queueId: queued.id };
    }
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
  },
  importRules: async (file) => {
    const response = await api.post('/knowledge/rules/import', {
      filename: file.name,
      content: await file.text()
    });
    return response.data.data;
  }
};

export const importService = {
  importFindings: async ({ file, format, auditId }) => {
    const content = await file.text();
    const response = await api.post('/imports/findings', {
      auditId,
      format,
      filename: file.name,
      content
    });
    return response.data.data;
  }
};

export const scanComparisonService = {
  compare: async (baselineAssetId, currentAssetId) => {
    const response = await api.get('/comparisons/scans', {
      params: { baselineAssetId, currentAssetId }
    });
    return response.data.data;
  }
};

export const attackGraphService = {
  getGraph: async (params = {}) => {
    const response = await api.get('/attack-graph', {
      params: Object.fromEntries(Object.entries(params).filter(([, value]) => value))
    });
    return response.data.data;
  }
};

export const remediationService = {
  getPriorities: async (params = {}) => {
    const response = await api.get('/remediation-priorities', {
      params: Object.fromEntries(Object.entries(params).filter(([, value]) => value))
    });
    return response.data.data;
  }
};

const filenameFromDisposition = (disposition, fallback) =>
  disposition?.match(/filename="?([^"]+)"?/i)?.[1] || fallback;

export const exportService = {
  downloadFindings: async (format, params = {}) => {
    const response = await api.get('/exports/findings', {
      params: { ...params, format },
      responseType: 'blob'
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameFromDisposition(
      response.headers['content-disposition'],
      `vulnmind-findings.${format}`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
};

export const notificationService = {
  getConfiguration: async () => {
    const response = await api.get('/notifications/configuration');
    return response.data.data;
  },
  subscribe: async (subscription) => {
    const response = await api.post('/notifications/subscriptions', subscription);
    return response.data.data;
  },
  unsubscribe: async (endpoint) => {
    const response = await api.delete('/notifications/subscriptions', {
      data: { endpoint }
    });
    return response.data.data;
  }
};

export default api;
