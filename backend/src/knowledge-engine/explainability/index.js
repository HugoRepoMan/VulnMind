/**
 * Explainability Engine (Async)
 * 
 * Traduce las reglas técnicas y la correlación a lenguaje natural
 * para que el auditor (o el cliente) entienda por qué se asignó
 * un nivel de riesgo específico.
 */
class ExplainabilityEngine {
  async generateExplanation(riskScore, rules, correlationResult) {
    console.log(`[ExplainabilityEngine] Construyendo explicación en lenguaje natural...`);
    
    if (rules.length === 0) {
      return "No se encontraron vulnerabilidades conocidas para este hallazgo. El riesgo se mantiene en el nivel base.";
    }

    const ruleCauses = rules.map(r => r.recommendation ? "se identificó la necesidad de " + r.recommendation.toLowerCase() : "").filter(Boolean);
    
    let explanation = `El nivel de riesgo se evaluó en ${riskScore} debido a que ${ruleCauses.join(' y ')}.`;
    
    if (correlationResult?.escalationRisk) {
      explanation += " Además, la correlación con hallazgos anteriores indica una ruta probable de ataque lateral, lo que agrava severamente la puntuación.";
    }

    return explanation;
  }
}

export default new ExplainabilityEngine();
