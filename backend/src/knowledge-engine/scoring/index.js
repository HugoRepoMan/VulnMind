/**
 * Scoring Engine
 * 
 * Calcula dinámicamente el riesgo inicial basado en las
 * reglas que hicieron match.
 */
class ScoringEngine {
  async calculateRisk(assetId, matchedRules) {
    const contributions = matchedRules.map((rule) => ({
      ruleId: rule.id,
      ruleName: rule.name,
      score: Number(rule.baseRiskScore) || 0,
      priority: rule.priority
    }));
    const rawScore = contributions.reduce((total, item) => total + item.score, 0);
    const finalScore = Math.min(100, Math.max(0, rawScore));
    
    console.log(`[ScoringEngine] Riesgo calculado para Activo ${assetId}: ${finalScore}/100`);
    return {
      finalScore,
      rawScore,
      capped: rawScore > 100,
      method: 'SUM_ACTIVE_RULES_CAPPED_0_100',
      contributions
    };
  }
}

export default new ScoringEngine();
