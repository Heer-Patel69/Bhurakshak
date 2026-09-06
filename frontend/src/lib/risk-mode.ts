export type RiskMode = 'historical_2024' | 'current';
export function getRiskMode(): RiskMode {
  return typeof window !== 'undefined' && sessionStorage.getItem('risk_mode') === 'current' ? 'current' : 'historical_2024';
}
export function selectRiskMode(mode: RiskMode) {
  sessionStorage.setItem('risk_mode', mode);
  window.location.reload();
}
