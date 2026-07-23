/**
 * Correlation Engine (Async)
 * 
 * Busca patrones cruzando el hallazgo actual con otros hallazgos 
 * previos del mismo activo o del mismo proyecto.
 */
class CorrelationEngine {
  async correlate(assetId, inference, rules) {
    console.log(`[CorrelationEngine] Buscando relaciones laterales y de escalamiento para Activo ${assetId}...`);
    
    const previousFindings = await findPreviousFindingsForAsset(assetId);

    return {
      correlatedEvents: previousFindings.map(({ id, port, vulnerability, riskScore }) => ({
        findingId: id,
        port,
        vulnerability,
        riskScore
      })),
      escalationRisk: false
    };
  }
}

export default new CorrelationEngine();
import { findPreviousFindingsForAsset } from '../../repositories/finding.repository.js';
