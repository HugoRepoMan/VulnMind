/**
 * Explainability Engine (Async)
 * 
 * Traduce las reglas técnicas y la correlación a lenguaje natural
 * para que el auditor (o el cliente) entienda por qué se asignó
 * un nivel de riesgo específico.
 */
class ExplainabilityEngine {
  async generateExplanation(riskBreakdown, rules, correlationResult) {
    console.log(`[ExplainabilityEngine] Construyendo explicación en lenguaje natural...`);
    
    if (rules.length === 0) {
      return 'No coincidió ninguna regla activa; por eso el puntaje calculado es 0 de 100.';
    }

    const ruleCauses = riskBreakdown.contributions
      .map(({ ruleName, score }) => `${ruleName} aportó ${score} puntos`);
    let explanation = `El riesgo es ${riskBreakdown.finalScore} de 100: ${ruleCauses.join('; ')}.`;

    if (riskBreakdown.capped) {
      explanation += ` La suma original fue ${riskBreakdown.rawScore} y se limitó al máximo de 100.`;
    }
    
    if (correlationResult?.escalationRisk) {
      explanation += ` ${correlationResult.summary}`;
    }

    return explanation;
  }
}

export default new ExplainabilityEngine();
