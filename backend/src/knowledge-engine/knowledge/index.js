// import { PrismaClient } from '@prisma/client';
// const prisma = new PrismaClient();

/**
 * Knowledge Engine
 * 
 * Cruza los datos inferidos contra la Base de Conocimiento
 * (esquema 'knowledge') para encontrar reglas de seguridad.
 */
class KnowledgeEngine {
  async matchRules(inferenceResult) {
    // Aquí cruzamos con Prisma. Por ahora es un mock de reglas
    // Ejemplo real: 
    // const rules = await prisma.knowledgeRule.findMany({ where: { ... }});
    
    const matchedRules = [];

    // Lógica básica temporal
    if (inferenceResult.port === 21) {
      matchedRules.push({
        id: 'rule-ftp-001',
        baseRiskScore: 30,
        recommendation: 'Deshabilitar FTP anónimo y usar SFTP',
        mitreIds: ['T1040'],
        owaspIds: ['A05:2021-Security Misconfiguration']
      });
    }

    if (inferenceResult.vulnerability === 'CVE-2021-44228') {
      matchedRules.push({
        id: 'rule-log4j-001',
        baseRiskScore: 100,
        recommendation: 'Actualizar Log4j a versión >= 2.17.1',
        mitreIds: ['T1190'],
        owaspIds: ['A06:2021-Vulnerable and Outdated Components']
      });
    }

    console.log(`[KnowledgeEngine] ${matchedRules.length} reglas coincidieron`);
    return matchedRules;
  }
}

export default new KnowledgeEngine();
