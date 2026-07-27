import { prisma } from '../database/prisma.js';

export const matchesCondition = (condition, inference) =>
  Object.entries(condition).every(([key, expected]) => {
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
