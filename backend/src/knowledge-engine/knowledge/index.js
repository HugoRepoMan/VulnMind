import { findMatchingKnowledgeRules } from '../../repositories/knowledge.repository.js';

/**
 * Knowledge Engine
 * 
 * Cruza los datos inferidos contra la Base de Conocimiento
 * (esquema 'knowledge') para encontrar reglas de seguridad.
 */
class KnowledgeEngine {
  async matchRules(inferenceResult) {
    const matchedRules = await findMatchingKnowledgeRules(inferenceResult);

    console.log(`[KnowledgeEngine] ${matchedRules.length} reglas coincidieron`);
    return matchedRules;
  }
}

export default new KnowledgeEngine();
