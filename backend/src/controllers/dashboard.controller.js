/**
 * Endpoints de lectura del Dashboard. Reutilizan los mismos filtros que las
 * consultas y exportaciones para mostrar cifras coherentes.
 */
import { getDashboardStats } from '../repositories/dashboard.repository.js';
import { findRecentFindings } from '../repositories/finding.repository.js';
import {
  buildFindingWhere,
  findingFilterSchema
} from '../services/finding-filter.service.js';

export const getStats = async (req, res, next) => {
  try {
    const filters = findingFilterSchema.parse(req.query);
    const stats = await getDashboardStats(filters);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getRecentFindings = async (req, res, next) => {
  try {
    const filters = findingFilterSchema.parse(req.query);
    const recent = await findRecentFindings(10, buildFindingWhere(filters));
    res.json({ success: true, data: recent });
  } catch (error) {
    next(error);
  }
};
