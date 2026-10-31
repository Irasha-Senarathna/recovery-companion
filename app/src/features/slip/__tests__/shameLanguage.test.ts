import en from '../../../i18n/locales/en.json';

/**
 * Safety rule 5, applied hard to the words people read right after a slip:
 * no failure, no reset, no "losing" what was built, no blame. (The general
 * locale test covers every screen; this list is stricter for these ones.)
 */
const BANNED = [
  /\bfail(ed|ure|ures|ing)?\b/i,
  /\breset(s|ting)?\b(?! *to nothing)/i,
  /\bstart(ing)? (over|again)\b/i,
  /\bback to (day )?(zero|0|one|1)\b/i,
  /\bsquare one\b/i,
  /\b(lost|lose|losing) (your|all|everything)\b/i,
  /\bruin(ed|s)?\b/i,
  /\bwast(e|ed)\b/i,
  /\bstreak\b/i,
  /\b(clean|dirty|sober)\b/i,
  /\baddicts?\b/i,
  /\brelapsed?\b/i,
  /\b(should have|shouldn't have|why did you)\b/i,
  /\b(weak|weakness|shame|ashamed|disappoint\w*|guilt\w*)\b/i,
  /\bbroke(n)? (your|the)\b/i,
];

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const namespaces = { slip: en.slip, progress: en.progress, goals: en.goals };

describe.each(Object.entries(namespaces))('no shame language in "%s"', (_, texts) => {
  const all = strings(texts);

  it.each(BANNED.map((p) => [p.source, p]))('never says %s', (_, pattern) => {
    // "Nothing is reset" is the one allowed use: it says the opposite.
    const offending = all.filter(
      (text) => (pattern as RegExp).test(text) && !/nothing is reset/i.test(text),
    );
    expect(offending).toEqual([]);
  });
});

describe('the slip message keeps what was built', () => {
  it('always says the strong days are still theirs', () => {
    expect(en.slip.stillCounts_other).toMatch(/still yours/);
    expect(en.slip.notTheEnd).toMatch(/Nothing is reset/);
  });
});
