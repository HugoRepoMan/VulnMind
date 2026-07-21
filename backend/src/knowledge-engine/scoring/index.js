/**
 * Scoring Engine
 * 
 * Calcula dinámicamente el riesgo inicial basado en las
 * reglas que hicieron match.
 */
class ScoringEngine {
  async calculateRisk(assetId, matchedRules) {
    let baseScore = 0;
    
    for (const rule of matchedRules) {
      baseScore += (rule.baseRiskScore || 0);
    }
    
    // Normalización matemática simple a 0-100
    // (Luego se aplicará decaimiento temporal y factores ambientales)
    const finalScore = Math.min(100, Math.max(0, baseScore));
    
    console.log(`[ScoringEngine] Riesgo calculado para Activo ${assetId}: ${finalScore}/100`);
    return finalScore;
  }
}

export default new ScoringEngine();
