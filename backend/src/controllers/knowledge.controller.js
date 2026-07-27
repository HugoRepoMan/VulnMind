import { z } from 'zod';
import { prisma } from '../database/prisma.js';

const idSchema = z.string().trim().min(1);
const idsSchema = z.array(z.string().trim().min(1).max(80)).max(50);
const valueSchema = z.union([
  z.string().trim().min(1).max(255), z.number().finite(), z.boolean(),
  z.array(z.union([z.string().trim().min(1).max(255), z.number().finite(), z.boolean()])).min(1)
]);
const conditionSchema = z.record(z.string().trim().min(1).max(80), valueSchema)
  .refine((value) => Object.keys(value).length > 0, { message: 'Condition must contain a criterion' });
const ruleSchema = z.object({
  name: z.string().trim().min(3).max(160),
  type: z.string().trim().min(2).max(80),
  condition: conditionSchema,
  baseRiskScore: z.coerce.number().min(0).max(100),
  mitreIds: idsSchema.optional(),
  owaspIds: idsSchema.optional(),
  cweIds: idsSchema.optional(),
  recommendation: z.string().trim().min(5).max(2000),
  priority: z.coerce.number().int().min(-1000).max(1000).optional(),
  active: z.boolean().optional()
});
const updateSchema = ruleSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required'
});
const filtersSchema = z.object({
  search: z.string().trim().max(160).optional(),
  type: z.string().trim().max(80).optional(),
  active: z.enum(['true', 'false']).optional()
});

const failNotFound = () => {
  const error = new Error('Knowledge rule not found');
  error.statusCode = 404;
  throw error;
};

const logChange = (tx, req, action, rule, details) => tx.auditLog.create({
  data: {
    userId: req.user.id,
    action,
    entityType: 'KnowledgeRule',
    entityId: rule.id,
    details
  }
});

export const listKnowledgeRules = async (req, res, next) => {
  try {
    const filters = filtersSchema.parse(req.query);
    const data = await prisma.knowledgeRule.findMany({
      where: {
        ...(filters.active === undefined ? {} : { active: filters.active === 'true' }),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.search ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { recommendation: { contains: filters.search, mode: 'insensitive' } }
          ]
        } : {})
      },
      include: { _count: { select: { analyses: true } } },
      orderBy: [{ active: 'desc' }, { priority: 'desc' }, { updatedAt: 'desc' }]
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getKnowledgeRule = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.ruleId);
    const data = await prisma.knowledgeRule.findUnique({
      where: { id },
      include: { _count: { select: { analyses: true } } }
    });
    if (!data) failNotFound();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createKnowledgeRule = async (req, res, next) => {
  try {
    const input = ruleSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const rule = await tx.knowledgeRule.create({ data: input });
      await logChange(tx, req, 'KNOWLEDGE_RULE_CREATED', rule, { name: rule.name, type: rule.type });
      return rule;
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateKnowledgeRule = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.ruleId);
    const input = updateSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeRule.findUnique({ where: { id }, select: { id: true } });
      if (!existing) failNotFound();
      const rule = await tx.knowledgeRule.update({ where: { id }, data: input });
      await logChange(tx, req, 'KNOWLEDGE_RULE_UPDATED', rule, {
        changedFields: Object.keys(input)
      });
      return rule;
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteKnowledgeRule = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.ruleId);
    await prisma.$transaction(async (tx) => {
      const rule = await tx.knowledgeRule.findUnique({
        where: { id },
        select: { id: true, name: true }
      });
      if (!rule) failNotFound();
      await logChange(tx, req, 'KNOWLEDGE_RULE_DELETED', rule, { name: rule.name });
      await tx.knowledgeRule.delete({ where: { id } });
    });
    res.json({ success: true, data: { id }, message: 'Knowledge rule deleted' });
  } catch (error) {
    next(error);
  }
};
