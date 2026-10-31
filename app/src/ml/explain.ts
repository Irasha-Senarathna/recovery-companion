import { FEATURES } from './featureBuilder';
import { contributions, MODEL, type RiskModel } from './predict';

/** Plain-language reasons; labels live in i18n under `triggers.reasons`. */
export type Reason =
  | 'poor_sleep'
  | 'high_stress'
  | 'weekend'
  | 'low_mood'
  | 'strong_craving'
  | 'recent_cravings'
  | 'recent_stress'
  | 'recent_slip'
  | `tag_${string}`;

/** Tags that are never offered as a reason ("in pain" would invite medical framing). */
const SILENT_TAGS = new Set(['tag_pain']);

/**
 * Which reason each feature supports, and when it is actually true today: a
 * feature can push the score up just by being average, and that is no reason.
 * (The sleep + stress + weekend combination is covered by its three parts.)
 */
const REASONS: Record<string, [Reason, (value: number) => boolean]> = {
  sleep: ['poor_sleep', (v) => v <= 1],
  poor_sleep: ['poor_sleep', (v) => v === 1],
  stress: ['high_stress', (v) => v >= 3],
  high_stress: ['high_stress', (v) => v === 1],
  weekend: ['weekend', (v) => v === 1],
  mood: ['low_mood', (v) => v <= 1],
  craving: ['strong_craving', (v) => v >= 3],
  craving_recent: ['recent_cravings', (v) => v >= 2.5],
  stress_recent: ['recent_stress', (v) => v >= 3],
  slip_recent: ['recent_slip', (v) => v === 1],
};

function reasonFor(feature: string, value: number): Reason | null {
  const known = REASONS[feature];
  if (known) return known[1](value) ? known[0] : null;
  return feature.startsWith('tag_') && value === 1 && !SILENT_TAGS.has(feature)
    ? (feature as Reason)
    : null;
}

/** The strongest reasons that raised today's score (largest pull first). */
export function explain(features: readonly number[], limit = 3, m: RiskModel = MODEL): Reason[] {
  const pull = new Map<Reason, number>();
  contributions(features, m).forEach((c, i) => {
    const reason = reasonFor(FEATURES[i], features[i]);
    if (reason && c > 0) pull.set(reason, (pull.get(reason) ?? 0) + c);
  });
  return [...pull.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([reason]) => reason);
}
