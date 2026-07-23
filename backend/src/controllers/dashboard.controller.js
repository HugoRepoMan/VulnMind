import { getDashboardStats } from '../repositories/dashboard.repository.js';
import { findRecentFindings } from '../repositories/finding.repository.js';

export const getStats = async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

export const getRecentFindings = async (req, res, next) => {
  try {
    const recent = await findRecentFindings(10);
    res.json({
      success: true,
      data: recent
    });
  } catch (error) {
    next(error);
  }
};
