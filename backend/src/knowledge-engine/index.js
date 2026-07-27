import InferenceEngine from './inference/index.js';
import KnowledgeEngine from './knowledge/index.js';
import ScoringEngine from './scoring/index.js';

import CorrelationEngine from './correlation/index.js';
import RecommendationsEngine from './recommendations/index.js';
import ExplainabilityEngine from './explainability/index.js';

export const ENGINE_VERSION = '2.0';

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
    const riskBreakdown = await ScoringEngine.calculateRisk(assetId, matchedRules);

    // 4. Completar el pipeline antes de responder para no perder resultados.
    const pipelineResult = await this.completePipeline(
      assetId,
      inferenceResult,
      matchedRules,
      riskBreakdown
    );

    return {
      success: true,
      riskScore: riskBreakdown.finalScore,
      calculatedRisk: riskBreakdown.finalScore,
      riskBreakdown,
      engineVersion: ENGINE_VERSION,
      inferenceResult,
      matchedRules,
      ...pipelineResult
    };
  }

  async completePipeline(assetId, inference, rules, riskBreakdown) {
    const correlation = await CorrelationEngine.correlate(assetId, inference, rules);
    const recommendations = await RecommendationsEngine.generate(rules, correlation);
    const explanation = await ExplainabilityEngine.generateExplanation(
      riskBreakdown,
      rules,
      correlation
    );

    console.log(`[VulnMindEngine] Pipeline completado para Activo ${assetId}.`);
    const completedAt = new Date().toISOString();
    const timelineEvents = [
      { step: 'INFERENCE_COMPLETED', at: completedAt, details: { fields: inference } },
      { step: 'RULES_MATCHED', at: completedAt, details: { ruleIds: rules.map(({ id }) => id) } },
      { step: 'RISK_CALCULATED', at: completedAt, details: riskBreakdown },
      { step: 'CORRELATION_COMPLETED', at: completedAt, details: { signals: correlation.signals } },
      { step: 'EXPLANATION_GENERATED', at: completedAt }
    ];
    return { correlation, recommendations, explanation, timelineEvents };
  }
}

export const engine = new VulnMindEngine();
