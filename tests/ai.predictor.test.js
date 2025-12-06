import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { predictOutcome } from '../src/ai/predictor.js';

describe('AI Predictor (smoke)', () => {
  it('returns probabilities and rationale', () => {
    const sample = { home_last5: ['W','W','D','L','W'], away_last5: ['L','D','L','L','D'], venue: 'home' };
    const r = predictOutcome(sample);
    assert.ok(r.probabilities.home > 0);
    assert.ok(typeof r.rationale === 'string');
  });
});
