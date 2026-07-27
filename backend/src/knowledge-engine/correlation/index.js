import { findPreviousFindingsForAsset } from '../../repositories/finding.repository.js';

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

    const repeatedVulnerability = inference.vulnerability
      ? previousFindings.filter(({ vulnerability }) => vulnerability === inference.vulnerability)
      : [];
    const criticalHistory = previousFindings.filter(({ riskScore }) => riskScore >= 70);
    const distinctPorts = new Set([
      inference.port,
      ...previousFindings.map(({ port }) => port)
    ].filter(Boolean));
    const signals = [
      ...(repeatedVulnerability.length ? [{
        type: 'REPEATED_VULNERABILITY',
        count: repeatedVulnerability.length,
        value: inference.vulnerability
      }] : []),
      ...(criticalHistory.length ? [{
        type: 'CRITICAL_HISTORY',
        count: criticalHistory.length
      }] : []),
      ...(distinctPorts.size >= 3 ? [{
        type: 'MULTIPLE_EXPOSED_SERVICES',
        count: distinctPorts.size
      }] : [])
    ];

    return {
      correlatedEvents: previousFindings.map(({ id, port, vulnerability, riskScore }) => ({
        findingId: id,
        port,
        vulnerability,
        riskScore
      })),
      signals,
      escalationRisk: signals.length > 0,
      summary: signals.length
        ? `Se detectaron ${signals.length} señales de correlación en el activo.`
        : 'No se detectaron señales de escalamiento en el historial del activo.'
    };
  }
}

export default new CorrelationEngine();
