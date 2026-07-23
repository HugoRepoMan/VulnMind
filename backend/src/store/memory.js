import { v4 as uuidv4 } from 'uuid';

export const store = {
  findings: [],
  assets: [
    { id: 'asset-1', name: 'web-prod-01', ip: '10.0.0.15', riskScore: 25 },
    { id: 'asset-2', name: 'db-main', ip: '192.168.1.50', riskScore: 10 },
    { id: 'asset-3', name: 'gateway', ip: '10.0.0.1', riskScore: 5 }
  ],
  
  addFinding(findingData, engineResult) {
    const newFinding = {
      id: uuidv4(),
      assetId: findingData.assetId,
      assetName: findingData.rawData.assetName || 'Activo Desconocido',
      port: findingData.rawData.port,
      vulnerability: findingData.rawData.vulnerability,
      severity: engineResult.calculatedRisk >= 70 ? 'Critical' : 
                engineResult.calculatedRisk >= 40 ? 'High' : 
                engineResult.calculatedRisk >= 20 ? 'Medium' : 'Low',
      riskScore: engineResult.calculatedRisk,
      recommendations: engineResult.recommendations,
      timestamp: new Date().toISOString()
    };
    
    this.findings.unshift(newFinding); // Añadir al inicio
    
    // Actualizar riesgo del activo si existe
    const asset = this.assets.find(a => a.id === findingData.assetId);
    if (asset) {
      asset.riskScore = Math.max(asset.riskScore, engineResult.calculatedRisk);
    }
    
    return newFinding;
  },
  
  getRecentFindings(limit = 5) {
    return this.findings.slice(0, limit);
  },
  
  getStats() {
    const totalRisk = this.assets.reduce((acc, curr) => acc + curr.riskScore, 0);
    const avgRisk = this.assets.length > 0 ? Math.round(totalRisk / this.assets.length) : 0;
    
    const criticalFindings = this.findings.filter(f => f.severity === 'Critical').length;
    const rulesMatched = this.findings.reduce((acc, curr) => acc + (curr.recommendations?.length || 1), 0);
    
    return {
      globalRisk: avgRisk,
      criticalFindings,
      totalAssets: this.assets.length,
      rulesMatched: rulesMatched + 150 // Simulando reglas base ya evaluadas
    };
  }
};
