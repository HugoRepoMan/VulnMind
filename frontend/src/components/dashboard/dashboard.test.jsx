import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RiskCards from './RiskCards';
import RecentFindings from './RecentFindings';
import FindingInsight from './FindingInsight';

describe('dashboard components', () => {
  test('renders metrics returned by the backend', () => {
    render(<RiskCards stats={{
      globalRisk: 72,
      criticalFindings: 3,
      analyzedAssets: 4,
      totalAssets: 6,
      rulesMatched: 9
    }} />);

    expect(screen.getByText('72/100')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4/6')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  test('selects a recent finding with an accessible button', () => {
    const onSelect = vi.fn();
    const finding = {
      id: 'finding-1',
      vulnerability: 'CVE-2026-10001',
      assetName: 'gateway',
      timestamp: '2026-07-27T12:00:00.000Z',
      severity: 'Critical'
    };
    render(<RecentFindings findings={[finding]} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /CVE-2026-10001/i }));
    expect(onSelect).toHaveBeenCalledWith(finding);
  });

  test('shows explainability, risk contributions and timeline', () => {
    render(<FindingInsight finding={{
      id: 'finding-1',
      assetName: 'gateway',
      vulnerability: 'CVE-2026-10001',
      riskScore: 88,
      severity: 'Critical',
      explanation: 'La regla crítica elevó el riesgo.',
      recommendations: ['Aislar activo'],
      analysis: {
        engineVersion: '2.0',
        riskBreakdown: {
          contributions: [{ ruleId: 'rule-1', ruleName: 'Regla crítica', score: 88 }]
        },
        correlation: { summary: 'Sin historial', signals: [] },
        timelineEvents: [{ step: 'RISK_CALCULATED', detail: 'Riesgo listo' }]
      }
    }} />);

    expect(screen.getByText('La regla crítica elevó el riesgo.')).toBeInTheDocument();
    expect(screen.getByText('Regla crítica')).toBeInTheDocument();
    expect(screen.getByText('+88')).toBeInTheDocument();
    expect(screen.getByText('Aislar activo')).toBeInTheDocument();
    expect(screen.getByText(/RISK CALCULATED/)).toBeInTheDocument();
  });
});
