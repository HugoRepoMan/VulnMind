/**
 * CRUD e importación de reglas. La validación evita activar condiciones vacías
 * o puntajes fuera de rango que alterarían el Motor Inteligente.
 */
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
export const ruleSchema = z.object({
  code: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(3).max(160),
  type: z.string().trim().min(2).max(80),
  condition: conditionSchema,
  baseRiskScore: z.coerce.number().min(0).max(100),
  mitreIds: idsSchema.optional(),
  owaspIds: idsSchema.optional(),
  cweIds: idsSchema.optional(),
  recommendation: z.string().trim().min(5).max(2000),
  remediationEffort: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dependencies: idsSchema.optional(),
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
const importSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  dryRun: z.boolean().optional(),
  content: z.string().min(1).refine(
    (content) => Buffer.byteLength(content, 'utf8') <= 1024 * 1024,
    { message: 'El archivo supera el límite de 1 MB' }
  )
});

const inferRuleType = (condition) => {
  if ('vulnerability' in condition) return 'VULNERABILITY';
  if ('port' in condition || 'service' in condition) return 'PORT_SERVICE';
  if ('tagsAny' in condition || 'tagsAll' in condition) return 'TAG';
  return 'GENERIC';
};

const normalizeImportedRule = (value) => {
  const rule = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return ({
  ...(rule.code ? { code: String(rule.code).trim() } : {}),
  name: rule.name,
  type: rule.type || inferRuleType(rule.condition || {}),
  condition: rule.condition,
  baseRiskScore: rule.baseRiskScore ?? rule.baseRisk,
  mitreIds: rule.mitreIds || [],
  owaspIds: rule.owaspIds || [],
  cweIds: rule.cweIds || [],
  recommendation: rule.recommendation,
  remediationEffort: rule.remediationEffort || 'MEDIUM',
  dependencies: rule.dependencies || [],
  priority: rule.priority ?? 0,
  active: rule.active ?? true
  });
};

const extractImportedRules = (parsed) => {
  if (Array.isArray(parsed)) return { rules: parsed, source: 'array' };
  if (Array.isArray(parsed.knowledgeRules)) return { rules: parsed.knowledgeRules, source: 'knowledgeRules' };
  if (Array.isArray(parsed.rules)) return { rules: parsed.rules, source: 'rules' };
  const error = new Error('El JSON debe ser una lista o contener knowledgeRules/rules');
  error.statusCode = 400;
  throw error;
};

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

export const importKnowledgeRules = async (req, res, next) => {
  try {
    const payload = importSchema.parse(req.body);
    let parsed;
    try {
      parsed = JSON.parse(payload.content);
    } catch {
      const error = new Error('El archivo no contiene JSON válido');
      error.statusCode = 400;
      throw error;
    }
    const extracted = extractImportedRules(parsed);
    if (extracted.rules.length > 500) {
      const error = new Error('El archivo supera el límite de 500 reglas');
      error.statusCode = 400;
      throw error;
    }

    const summary = {
      filename: payload.filename,
      source: extracted.source,
      total: extracted.rules.length,
      valid: 0,
      created: 0,
      updated: 0,
      wouldCreate: 0,
      wouldUpdate: 0,
      rejected: 0,
      dryRun: payload.dryRun ?? false,
      errors: [],
      warnings: []
    };
    if (parsed.purpose) {
      summary.warnings.push(`Propósito informativo detectado: ${String(parsed.purpose).slice(0, 300)}`);
    }
    if (Array.isArray(parsed.correlationRules) && parsed.correlationRules.length) {
      summary.warnings.push(
        `${parsed.correlationRules.length} correlationRules no se importaron: pertenecen a una estructura de correlación distinta.`
      );
    }

    for (const [index, rawRule] of extracted.rules.entries()) {
      const validation = ruleSchema.safeParse(normalizeImportedRule(rawRule));
      if (!validation.success) {
        summary.rejected += 1;
        summary.errors.push({
          index: index + 1,
          code: rawRule?.code || null,
          message: validation.error.issues.map(({ path, message }) =>
            `${path.join('.') || 'regla'}: ${message}`
          ).join('; ')
        });
        continue;
      }

      const input = validation.data;
      summary.valid += 1;
      if (payload.dryRun) {
        const existing = input.code
          ? await prisma.knowledgeRule.findUnique({ where: { code: input.code } })
          : await prisma.knowledgeRule.findFirst({ where: { name: input.name, type: input.type } });
        summary[existing ? 'wouldUpdate' : 'wouldCreate'] += 1;
        continue;
      }
      const result = await prisma.$transaction(async (tx) => {
        const existing = input.code
          ? await tx.knowledgeRule.findUnique({ where: { code: input.code } })
          : await tx.knowledgeRule.findFirst({
            where: { name: input.name, type: input.type }
          });
        const saved = existing
          ? await tx.knowledgeRule.update({ where: { id: existing.id }, data: input })
          : await tx.knowledgeRule.create({ data: input });
        await logChange(
          tx,
          req,
          existing ? 'KNOWLEDGE_RULE_IMPORTED_UPDATED' : 'KNOWLEDGE_RULE_IMPORTED_CREATED',
          saved,
          { filename: payload.filename, code: saved.code, index: index + 1 }
        );
        return existing ? 'updated' : 'created';
      });
      summary[result] += 1;
    }

    res.status(summary.rejected ? 207 : 200).json({
      success: payload.dryRun ? summary.valid > 0 : summary.created + summary.updated > 0,
      data: summary
    });
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
