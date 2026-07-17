import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cornerScore, trackPoint, trackPointPyramid, downsample2x,
  seedPoints, FlowTracker, FLOW_DEFAULTS,
} from '../src/core/flow.js';

const W = 120, H = 90;

// Imagen sintética con textura suave (sumas de sinusoides): tiene gradientes
// reales en todos lados y se puede desplazar una cantidad exacta conocida.
function makeImg(shiftX, shiftY){
  const g = new Float32Array(W*H);
  for (let y=0; y<H; y++){
    for (let x=0; x<W; x++){
      const sx = x - shiftX, sy = y - shiftY;
      g[y*W+x] = 128 + 60*Math.sin(sx*0.35)*Math.cos(sy*0.28) + 30*Math.sin(sx*0.12 + sy*0.09);
    }
  }
  return g;
}

test('trackPoint recupera una traslación subpíxel conocida', () => {
  const gp = makeImg(0, 0);
  const gc = makeImg(2.3, -1.1);
  // buscar un punto con buena textura
  let best = null;
  for (let y=10; y<H-10; y+=3) for (let x=10; x<W-10; x+=3){
    const s = cornerScore(gp, W, H, x, y);
    if (!best || s > best.s) best = {x, y, s};
  }
  const r = trackPoint(gp, gc, W, H, best.x, best.y);
  assert.ok(r, 'el punto debería ser seguible');
  assert.ok(Math.abs(r.u - 2.3) < 0.3, `u=${r.u} esperado ~2.3`);
  assert.ok(Math.abs(r.v - (-1.1)) < 0.3, `v=${r.v} esperado ~-1.1`);
});

test('trackPointPyramid mantiene la precisión subpíxel en desplazamientos chicos', () => {
  const gp = makeImg(0, 0);
  const gc = makeImg(2.3, -1.1);
  let best = null;
  for (let y=10; y<H-10; y+=3) for (let x=10; x<W-10; x+=3){
    const s = cornerScore(gp, W, H, x, y);
    if (!best || s > best.s) best = {x, y, s};
  }
  const r = trackPointPyramid(gp, gc, W, H, best.x, best.y);
  assert.ok(r);
  assert.ok(Math.abs(r.u - 2.3) < 0.3, `u=${r.u}`);
  assert.ok(Math.abs(r.v - (-1.1)) < 0.3, `v=${r.v}`);
});

test('trackPointPyramid recupera un desplazamiento grande que el LK de una sola escala pierde', () => {
  // desplazamiento validado empíricamente: sobre esta textura, el LK de una
  // sola escala converge al periodo equivocado (error ~16px) mientras el
  // piramidal converge exacto (ver SPEC F5).
  const gp = makeImg(0, 0);
  const trueU = 6, trueV = 3;
  const gc = makeImg(trueU, trueV);
  let best = null;
  for (let y=15; y<H-15; y+=3) for (let x=15; x<W-15; x+=3){
    const s = cornerScore(gp, W, H, x, y);
    if (!best || s > best.s) best = {x, y, s};
  }
  const single = trackPoint(gp, gc, W, H, best.x, best.y);
  const pyr = trackPointPyramid(gp, gc, W, H, best.x, best.y);
  assert.ok(pyr, 'la versión piramidal debería converger');
  assert.ok(Math.abs(pyr.u - trueU) < 0.3, `pyr.u=${pyr.u}`);
  assert.ok(Math.abs(pyr.v - trueV) < 0.3, `pyr.v=${pyr.v}`);
  const singleErr = single ? Math.hypot(single.u - trueU, single.v - trueV) : Infinity;
  const pyrErr = Math.hypot(pyr.u - trueU, pyr.v - trueV);
  assert.ok(singleErr > 5, `el single-level debería fallar notoriamente (err=${singleErr})`);
  assert.ok(pyrErr < singleErr, 'el piramidal debe ser más preciso que el de una sola escala');
});

test('downsample2x promedia bloques 2×2 y reduce las dimensiones a la mitad', () => {
  const g = new Float32Array([
    10,20,30,40,
    10,20,30,40,
    100,100,100,100,
    100,100,100,100,
  ]);
  const { g: out, W: W2, H: H2 } = downsample2x(g, 4, 4);
  assert.equal(W2, 2); assert.equal(H2, 2);
  assert.equal(out[0], 15);  // bloque sup-izq: (10+20+10+20)/4
  assert.equal(out[1], 35);  // bloque sup-der: (30+40+30+40)/4
  assert.equal(out[2], 100); // bloque inf-izq
});

test('downsample2x clampa al último píxel con dimensiones impares', () => {
  const g = new Float32Array([10, 20, 30]);
  const { g: out, W: W2, H: H2 } = downsample2x(g, 3, 1);
  assert.equal(W2, 2); assert.equal(H2, 1);
  assert.equal(out[0], 15); // (10+20)/2
  assert.equal(out[1], 30); // (30+30)/2, clamp del borde
});

test('cornerScore es ~0 en zonas planas (problema de apertura)', () => {
  const flat = new Float32Array(W*H).fill(128);
  assert.equal(cornerScore(flat, W, H, 60, 45), 0);
  // y trackPoint rechaza el punto por matriz no invertible
  assert.equal(trackPoint(flat, flat, W, H, 60, 45), null);
});

test('seedPoints respeta el máximo y la separación mínima', () => {
  const g = makeImg(0, 0);
  const pts = seedPoints(g, W, H, { minX:0, maxX:W-1, minY:0, maxY:H-1 });
  assert.ok(pts.length > 0 && pts.length <= FLOW_DEFAULTS.maxPts);
  for (let i=0; i<pts.length; i++){
    for (let j=i+1; j<pts.length; j++){
      const d = Math.hypot(pts[i].x-pts[j].x, pts[i].y-pts[j].y);
      assert.ok(d > FLOW_DEFAULTS.minSpacing, `puntos ${i},${j} a ${d}px`);
    }
  }
});

test('FlowTracker: siembra, sigue el movimiento y promedia el desplazamiento', () => {
  const t = new FlowTracker(W, H);
  const bbox = { minX:20, maxX:100, minY:15, maxY:75 };
  const g0 = makeImg(0, 0), g1 = makeImg(1.5, 0.5), g2 = makeImg(3.0, 1.0);
  t.update(g0, g0, bbox);            // primer frame: solo siembra
  t.update(g0, g1, bbox);            // segundo: sigue el desplazamiento (1.5, 0.5)
  const m = t.mean();
  assert.ok(m && m.count >= FLOW_DEFAULTS.minForUse);
  assert.ok(Math.abs(m.du - 1.5) < 0.4, `du=${m.du} esperado ~1.5`);
  assert.ok(Math.abs(m.dv - 0.5) < 0.4, `dv=${m.dv} esperado ~0.5`);
  t.update(g1, g2, bbox);            // tercero: mismo paso de nuevo
  const m2 = t.mean();
  assert.ok(Math.abs(m2.du - 1.5) < 0.4, `du=${m2.du} esperado ~1.5`);
});

test('FlowTracker.mean devuelve null con menos puntos que minForUse', () => {
  const t = new FlowTracker(W, H);
  t.points = [{x:10,y:10,u:0,v:0}]; // 1 < 4
  assert.equal(t.mean(), null);
  t.clear();
  assert.equal(t.points.length, 0);
});
