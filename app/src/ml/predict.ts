import model from './model.json';

/**
 * Logistic regression exported by ml/train.py. It was trained on made-up data
 * only, so its scores are a gentle hint, never a medical judgement.
 */
export type RiskModel = typeof model;
export const MODEL: RiskModel = model;

/** Each feature's pull on the score: weight × standardised value. */
export function contributions(features: readonly number[], m: RiskModel = MODEL): number[] {
  return features.map(
    (value, i) => (m.coefficients[i] * (value - m.scaler.mean[i])) / m.scaler.scale[i],
  );
}

/** sigmoid(w · standardised(x) + b), exactly as ml/export.py `predict`. */
export function predictRisk(features: readonly number[], m: RiskModel = MODEL): number {
  const z = contributions(features, m).reduce((sum, c) => sum + c, m.intercept);
  return 1 / (1 + Math.exp(-z));
}

export function isHarderDay(score: number, m: RiskModel = MODEL): boolean {
  return score >= m.threshold;
}
