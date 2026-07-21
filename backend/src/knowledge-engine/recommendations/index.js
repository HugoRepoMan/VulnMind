/**
 * Recommendations Engine (Async)
 * 
 * Agrega y prioriza recomendaciones accionables basadas en
 * las reglas que hicieron match y la correlación.
 */
class RecommendationsEngine {
  async generate(rules, correlationResult) {
    console.log(`[RecommendationsEngine] Generando plan de acción mitigador...`);
    
    // Deduplicar recomendaciones de múltiples reglas
    const rawRecommendations = rules.map(r => r.recommendation).filter(Boolean);
    const uniqueRecs = [...new Set(rawRecommendations)];
    
    // Si hay riesgo de escalamiento detectado por correlación, 
    // agregar recomendaciones de contención urgentes.
    if (correlationResult?.escalationRisk) {
      uniqueRecs.unshift("ACCIÓN INMEDIATA: Aislar activo de la red principal para prevenir movimiento lateral.");
    }
    
    return uniqueRecs;
  }
}

export default new RecommendationsEngine();
