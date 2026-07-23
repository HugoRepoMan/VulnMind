import { store } from '../store/memory.js';

export const getStats = (req, res) => {
  const stats = store.getStats();
  res.json({
    success: true,
    data: stats
  });
};

export const getRecentFindings = (req, res) => {
  const recent = store.getRecentFindings(10);
  res.json({
    success: true,
    data: recent
  });
};
