/**
 * Inference Engine
 * 
 * Se encarga de interpretar y normalizar los datos en bruto 
 * reportados por el auditor o herramientas externas.
 */
class InferenceEngine {
  async analyze(assetId, rawData) {
    // Lógica para extraer datos estructurados del JSON crudo
    const result = {
      assetId,
      os: rawData.os || null,
      port: rawData.port ? parseInt(rawData.port, 10) : null,
      service: rawData.service || null,
      version: rawData.version || null,
      vulnerability: rawData.vulnerability || null,
      tags: Array.isArray(rawData.tags)
        ? rawData.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : []
    };

    console.log(`[InferenceEngine] Analizado hallazgo para Activo ${assetId}`);
    return result;
  }
}

export default new InferenceEngine();
