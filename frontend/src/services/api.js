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
  createFinding: async (payload) => {
    const response = await api.post('/findings', payload);
    return response.data.data;
  }
};

export default api;
