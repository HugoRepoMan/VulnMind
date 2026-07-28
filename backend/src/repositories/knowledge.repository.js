import { prisma } from '../database/prisma.js';

export const matchesCondition = (condition, inference) =>
  Object.entries(condition).every(([key, expected]) => {
    if (key === 'tagsAny') {
      const tags = new Set((inference.tags || []).map((tag) => String(tag).toLowerCase()));
      return expected.some((tag) => tags.has(String(tag).toLowerCase()));
    }
    if (key === 'tagsAll') {
      const tags = new Set((inference.tags || []).map((tag) => String(tag).toLowerCase()));
      return expected.every((tag) => tags.has(String(tag).toLowerCase()));
    }
    const actual = inference[key];
    return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  });

export const findMatchingKnowledgeRules = async (inference) => {
  const rules = await prisma.knowledgeRule.findMany({
    where: { active: true },
    orderBy: [{ priority: 'desc' }, { baseRiskScore: 'desc' }]
  });

  return rules.filter((rule) => matchesCondition(rule.condition, inference));
};
