import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supportsVideoFrameCallback, createScheduler } from '../src/core/frameLoop.js';

test('supportsVideoFrameCallback: true solo si el video tiene el método', () => {
  assert.equal(supportsVideoFrameCallback({ requestVideoFrameCallback(){} }), true);
  assert.equal(supportsVideoFrameCallback({}), false);
  assert.equal(supportsVideoFrameCallback(null), false);
});

test('createScheduler usa rVFC cuando el video lo soporta', () => {
  let rvfcCalls = 0, rafCalls = 0;
  const video = { requestVideoFrameCallback(cb){ rvfcCalls++; cb(); return 1; } };
  const raf = cb => { rafCalls++; cb(); return 2; };
  const s = createScheduler(video, raf);
  let ran = false;
  s.schedule(() => { ran = true; });
  assert.equal(s.useRVFC, true);
  assert.equal(rvfcCalls, 1);
  assert.equal(rafCalls, 0);
  assert.equal(ran, true);
});

test('createScheduler cae a rAF sin rVFC', () => {
  let rafCalls = 0;
  const video = {};
  const raf = cb => { rafCalls++; cb(); return 2; };
  const s = createScheduler(video, raf);
  let ran = false;
  s.schedule(() => { ran = true; });
  assert.equal(s.useRVFC, false);
  assert.equal(rafCalls, 1);
  assert.equal(ran, true);
});

test('cancel() usa cancelVideoFrameCallback con rVFC', () => {
  let cancelled = null;
  const video = {
    requestVideoFrameCallback(){ return 42; },
    cancelVideoFrameCallback(h){ cancelled = h; },
  };
  const s = createScheduler(video, () => {});
  s.schedule(() => {});
  s.cancel();
  assert.equal(cancelled, 42);
});

test('cancel() usa cancelAnimationFrame sin rVFC', () => {
  let cancelled = null;
  const s = createScheduler({}, () => 7, h => { cancelled = h; });
  s.schedule(() => {});
  s.cancel();
  assert.equal(cancelled, 7);
});

test('cancel() sin haber programado nada no hace nada (no explota)', () => {
  const s = createScheduler({}, () => 7, () => { throw new Error('no debería llamarse'); });
  assert.doesNotThrow(() => s.cancel());
});
