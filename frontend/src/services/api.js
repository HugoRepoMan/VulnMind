import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

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
