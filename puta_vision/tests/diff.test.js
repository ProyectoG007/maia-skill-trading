import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGray, frameDiff, largestBrightRegion } from '../src/core/diff.js';

const W = 120, H = 90;

function solidFrame(r, g, b){
  const f = new Uint8ClampedArray(W*H*4);
  for (let i=0; i<f.length; i+=4){ f[i]=r; f[i+1]=g; f[i+2]=b; f[i+3]=255; }
  return f;
}
function paintRect(frame, x0, y0, x1, y1, r, g, b){
  for (let y=y0; y<=y1; y++){
    for (let x=x0; x<=x1; x++){
      const i = (y*W+x)*4;
      frame[i]=r; frame[i+1]=g; frame[i+2]=b;
    }
  }
}

test('toGray aplica los pesos de luminancia estándar', () => {
  const f = solidFrame(255, 0, 0);
  const g = toGray(f, W, H);
  assert.ok(Math.abs(g[0] - 255*0.299) < 1e-3);
});

test('frameDiff: sin cambios no hay objeto', () => {
  const a = solidFrame(50, 50, 50);
  const d = frameDiff(a, a, W, H);
  assert.equal(d.n, 0);
  assert.equal(d.cx, null);
  assert.equal(d.bbox, null);
});

test('frameDiff encuentra el centroide y bbox de un bloque que apareció', () => {
  const prev = solidFrame(50, 50, 50);
  const cur = solidFrame(50, 50, 50);
  paintRect(cur, 40, 30, 59, 49, 250, 250, 250); // bloque 20×20 centrado en (49.5, 39.5)
  const d = frameDiff(cur, prev, W, H);
  assert.equal(d.n, 400);
  assert.ok(Math.abs(d.cx - 49.5) < 1e-9);
  assert.ok(Math.abs(d.cy - 39.5) < 1e-9);
  assert.deepEqual(d.bbox, { minX:40, maxX:59, minY:30, maxY:49 });
});

test('frameDiff ignora cambios por debajo del umbral', () => {
  const prev = solidFrame(50, 50, 50);
  const cur = solidFrame(60, 60, 60); // dif RGB total = 30 < 84
  assert.equal(frameDiff(cur, prev, W, H).n, 0);
});

test('largestBrightRegion encuentra la mancha clara dominante', () => {
  const f = solidFrame(40, 40, 40);
  paintRect(f, 30, 20, 89, 59, 250, 250, 250);  // "hoja" grande y clara
  paintRect(f, 100, 80, 105, 85, 250, 250, 250); // manchita menor que no debe ganar
  const r = largestBrightRegion(f, W, H);
  assert.ok(r);
  assert.equal(r.minX, 30);
  assert.equal(r.maxX, 89);
  assert.equal(r.minY, 20);
  assert.equal(r.maxY, 59);
});

test('largestBrightRegion devuelve null sin nada claro contra el fondo', () => {
  assert.equal(largestBrightRegion(solidFrame(100, 100, 100), W, H), null);
});
