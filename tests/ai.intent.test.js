import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../src/ai/intent.js';

describe('AI Intent classifier (smoke)', () => {
  it('recognizes command /start', async () => {
    const r = await classifyIntent('/start');
    assert.equal(r.intent, 'start');
  });

  it('detects odds intent from text', async () => {
    const r = await classifyIntent('Give me odds for Arsenal vs Chelsea');
    assert.equal(r.intent, 'odds');
  });
});
