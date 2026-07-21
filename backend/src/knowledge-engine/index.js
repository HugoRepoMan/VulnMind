import InferenceEngine from './inference/index.js';
import KnowledgeEngine from './knowledge/index.js';
import ScoringEngine from './scoring/index.js';

import CorrelationEngine from './correlation/index.js';
import RecommendationsEngine from './recommendations/index.js';
import ExplainabilityEngine from './explainability/index.js';

/**
 * VulnMind Engine
 * 
 * Orquestador principal que une el flujo de procesamiento
 * de un nuevo hallazgo de ciberseguridad.
 */
class VulnMindEngine {
  /**
   * Procesa un hallazgo de manera híbrida.
   * La parte síncrona devuelve resultados inmediatos al frontend.
   */
  async processFinding(assetId, rawData) {
    console.log(`[VulnMindEngine] Iniciando procesamiento para Activo ${assetId}...`);

    // 1. Inferencia (Extraer datos estructurados)
    const inferenceResult = await InferenceEngine.analyze(assetId, rawData);
    
    // 2. Base de Conocimiento (Reglas)
    const matchedRules = await KnowledgeEngine.matchRules(inferenceResult);
    
    // 3. Scoring Inicial
    const riskScore = await ScoringEngine.calculateRisk(assetId, matchedRules);

    // 4. Delegar al pipeline asíncrono (Correlation, Recommendation, Timeline, Explainability)
    // No usamos 'await' para no bloquear la respuesta HTTP
    this.triggerAsyncPipeline(assetId, inferenceResult, matchedRules, riskScore);

    return {
      success: true,
      riskScore,
      inferenceResult,
      matchedRules
    };
  }

  async triggerAsyncPipeline(assetId, inference, rules, riskScore) {
    console.log(`[VulnMindEngine] Disparando Pipeline Asíncrono en segundo plano para Activo ${assetId}`);
    
    try {
      // 1. Correlación
      const correlation = await CorrelationEngine.correlate(assetId, inference, rules);
      
      // 2. Recomendaciones
      const recommendations = await RecommendationsEngine.generate(rules, correlation);
      
      // 3. Explicabilidad
      const explanation = await ExplainabilityEngine.generateExplanation(riskScore, rules, correlation);
      
      // 4. Guardar en Base de Datos (Knowledge Schema)
      console.log(`[VulnMindEngine] Pipeline asíncrono completado para Activo ${assetId}.`);
      console.log(`Explicación generada: ${explanation}`);
      
      // Aquí haríamos el insert final en la BD con Prisma:
      // await prisma.findingAnalysis.create({ ... })
      
    } catch (error) {
      console.error(`[VulnMindEngine] Error en pipeline asíncrono:`, error);
    }
  }
}

export const engine = new VulnMindEngine();
