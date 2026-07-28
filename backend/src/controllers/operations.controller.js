import { z } from 'zod';
import { prisma } from '../database/prisma.js';

const idSchema = z.string().trim().min(1);
const projectStatus = z.enum(['ACTIVE', 'ARCHIVED']);
const auditStatus = z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const assetStatus = z.enum(['ACTIVE', 'INACTIVE', 'REMOVED']);
const assetCriticality = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const findingStatus = z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'ACCEPTED', 'FALSE_POSITIVE']);

const projectCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  status: projectStatus.optional()
});
const projectUpdateSchema = projectCreateSchema.partial().refine((value) => Object.keys(value).length, {
  message: 'At least one field is required'
});
const auditCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  status: auditStatus.optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional()
});
const auditUpdateSchema = auditCreateSchema.partial().refine((value) => Object.keys(value).length, {
  message: 'At least one field is required'
});
const assetCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  ip: z.string().trim().max(255).nullable().optional(),
  type: z.string().trim().min(1).max(80).optional(),
  criticality: assetCriticality.optional(),
  status: assetStatus.optional()
});
const assetUpdateSchema = assetCreateSchema.partial().refine((value) => Object.keys(value).length, {
  message: 'At least one field is required'
});
const findingUpdateSchema = z.object({
  status: findingStatus
});

const failNotFound = (entity) => {
  const error = new Error(`${entity} not found`);
  error.statusCode = 404;
  throw error;
};

const logMutation = (tx, req, data) =>
  tx.auditLog.create({
    data: {
      userId: req.user.id,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      projectId: data.projectId,
      auditId: data.auditId,
      details: data.details
    }
  });

const projectInclude = {
  owner: { select: { id: true, email: true } },
  _count: { select: { audits: true } }
};

const auditInclude = {
  project: { select: { id: true, name: true } },
  _count: { select: { assets: true } }
};

const assetInclude = {
  audit: { select: { id: true, name: true, projectId: true } },
  _count: { select: { findings: true } }
};

export const listProjects = async (req, res, next) => {
  try {
    const data = await prisma.project.findMany({
      include: projectInclude,
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.projectId);
    const data = await prisma.project.findUnique({
      where: { id },
      include: {
        ...projectInclude,
        audits: { include: { _count: { select: { assets: true } } }, orderBy: { updatedAt: 'desc' } }
      }
    });
    if (!data) failNotFound('Project');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createProject = async (req, res, next) => {
  try {
    const input = projectCreateSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { ...input, ownerId: req.user.id },
        include: projectInclude
      });
      await logMutation(tx, req, {
        action: 'PROJECT_CREATED', entityType: 'Project', entityId: project.id,
        projectId: project.id, details: { name: project.name }
      });
      return project;
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.projectId);
    const input = projectUpdateSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({ where: { id }, data: input, include: projectInclude });
      await logMutation(tx, req, {
        action: 'PROJECT_UPDATED', entityType: 'Project', entityId: id,
        projectId: id, details: { changedFields: Object.keys(input) }
      });
      return project;
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.projectId);
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!project) failNotFound('Project');
    await prisma.project.delete({ where: { id } });
    res.json({ success: true, data: { id }, message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
};

export const listAudits = async (req, res, next) => {
  try {
    const projectId = req.query.projectId ? idSchema.parse(req.query.projectId) : undefined;
    const data = await prisma.audit.findMany({
      where: projectId ? { projectId } : undefined,
      include: auditInclude,
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getAudit = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.auditId);
    const data = await prisma.audit.findUnique({
      where: { id },
      include: {
        ...auditInclude,
        assets: { include: { _count: { select: { findings: true } } }, orderBy: { riskScore: 'desc' } }
      }
    });
    if (!data) failNotFound('Audit');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createAudit = async (req, res, next) => {
  try {
    const projectId = idSchema.parse(req.params.projectId);
    const input = auditCreateSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const audit = await tx.audit.create({ data: { ...input, projectId }, include: auditInclude });
      await logMutation(tx, req, {
        action: 'AUDIT_CREATED', entityType: 'Audit', entityId: audit.id,
        projectId, auditId: audit.id, details: { name: audit.name }
      });
      return audit;
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateAudit = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.auditId);
    const input = auditUpdateSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const audit = await tx.audit.update({ where: { id }, data: input, include: auditInclude });
      await logMutation(tx, req, {
        action: 'AUDIT_UPDATED', entityType: 'Audit', entityId: id,
        projectId: audit.projectId, auditId: id, details: { changedFields: Object.keys(input) }
      });
      return audit;
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteAudit = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.auditId);
    const audit = await prisma.audit.findUnique({ where: { id }, select: { id: true } });
    if (!audit) failNotFound('Audit');
    await prisma.audit.delete({ where: { id } });
    res.json({ success: true, data: { id }, message: 'Audit deleted' });
  } catch (error) {
    next(error);
  }
};

export const listAssets = async (req, res, next) => {
  try {
    const auditId = req.query.auditId ? idSchema.parse(req.query.auditId) : undefined;
    const data = await prisma.asset.findMany({
      where: auditId ? { auditId } : undefined,
      include: assetInclude,
      orderBy: [{ riskScore: 'desc' }, { updatedAt: 'desc' }]
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getAsset = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.assetId);
    const data = await prisma.asset.findUnique({
      where: { id },
      include: {
        ...assetInclude,
        findings: { include: { analysis: true }, orderBy: { createdAt: 'desc' } }
      }
    });
    if (!data) failNotFound('Asset');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createAsset = async (req, res, next) => {
  try {
    const auditId = idSchema.parse(req.params.auditId);
    const input = assetCreateSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const audit = await tx.audit.findUnique({ where: { id: auditId }, select: { projectId: true } });
      if (!audit) failNotFound('Audit');
      const asset = await tx.asset.create({ data: { ...input, auditId }, include: assetInclude });
      await logMutation(tx, req, {
        action: 'ASSET_CREATED', entityType: 'Asset', entityId: asset.id,
        projectId: audit.projectId, auditId, details: { name: asset.name }
      });
      return asset;
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateAsset = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.assetId);
    const input = assetUpdateSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.update({ where: { id }, data: input, include: assetInclude });
      await logMutation(tx, req, {
        action: 'ASSET_UPDATED', entityType: 'Asset', entityId: id,
        projectId: asset.audit.projectId, auditId: asset.auditId,
        details: { changedFields: Object.keys(input) }
      });
      return asset;
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteAsset = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.assetId);
    const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
    if (!asset) failNotFound('Asset');
    await prisma.asset.delete({ where: { id } });
    res.json({ success: true, data: { id }, message: 'Asset deleted' });
  } catch (error) {
    next(error);
  }
};

export const listFindings = async (req, res, next) => {
  try {
    const assetId = req.query.assetId ? idSchema.parse(req.query.assetId) : undefined;
    const data = await prisma.finding.findMany({
      where: assetId ? { assetId } : undefined,
      include: {
        asset: { select: { id: true, name: true, auditId: true } },
        analysis: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getFinding = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.findingId);
    const data = await prisma.finding.findUnique({
      where: { id },
      include: { asset: { include: { audit: { select: { id: true, projectId: true } } } }, analysis: true }
    });
    if (!data) failNotFound('Finding');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateFinding = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.findingId);
    const input = findingUpdateSchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const finding = await tx.finding.update({
        where: { id }, data: input,
        include: { asset: { include: { audit: { select: { projectId: true } } } }, analysis: true }
      });
      await logMutation(tx, req, {
        action: 'FINDING_STATUS_UPDATED', entityType: 'Finding', entityId: id,
        projectId: finding.asset.audit.projectId, auditId: finding.asset.auditId,
        details: { status: input.status }
      });
      return finding;
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteFinding = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.findingId);
    const data = await prisma.$transaction(async (tx) => {
      const finding = await tx.finding.findUnique({
        where: { id },
        select: { id: true, assetId: true }
      });
      if (!finding) failNotFound('Finding');
      await tx.finding.delete({ where: { id } });
      const remaining = await tx.finding.aggregate({
        where: { assetId: finding.assetId },
        _max: { riskScore: true }
      });
      await tx.asset.update({
        where: { id: finding.assetId },
        data: { riskScore: remaining._max.riskScore ?? 0 }
      });
      return finding;
    });
    res.json({ success: true, data: { id: data.id }, message: 'Finding deleted' });
  } catch (error) {
    next(error);
  }
};
