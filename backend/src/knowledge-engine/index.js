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

    // 4. Completar el pipeline antes de responder para no perder resultados.
    const pipelineResult = await this.completePipeline(
      assetId,
      inferenceResult,
      matchedRules,
      riskScore
    );

    return {
      success: true,
      riskScore,
      calculatedRisk: riskScore,
      inferenceResult,
      matchedRules,
      ...pipelineResult
    };
  }

  async completePipeline(assetId, inference, rules, riskScore) {
    const correlation = await CorrelationEngine.correlate(assetId, inference, rules);
    const recommendations = await RecommendationsEngine.generate(rules, correlation);
    const explanation = await ExplainabilityEngine.generateExplanation(
      riskScore,
      rules,
      correlation
    );

    console.log(`[VulnMindEngine] Pipeline completado para Activo ${assetId}.`);
    return { correlation, recommendations, explanation };
  }
}

export const engine = new VulnMindEngine();
