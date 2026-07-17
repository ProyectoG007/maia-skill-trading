import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentBlobs, BlobTracker } from '../src/core/blobs.js';

const W = 120, H = 90;

function solidFrame(v){
  const f = new Uint8ClampedArray(W*H*4);
  for (let i=0; i<f.length; i+=4){ f[i]=v; f[i+1]=v; f[i+2]=v; f[i+3]=255; }
  return f;
}
function paintRect(frame, x0, y0, x1, y1, v){
  for (let y=y0; y<=y1; y++){
    for (let x=x0; x<=x1; x++){
      const i = (y*W+x)*4;
      frame[i]=v; frame[i+1]=v; frame[i+2]=v;
    }
  }
}

test('segmentBlobs separa dos objetos que se movieron a la vez', () => {
  const prev = solidFrame(50);
  const cur = solidFrame(50);
  paintRect(cur, 10, 10, 24, 24, 250);  // 15×15 = 225 px, arriba-izquierda
  paintRect(cur, 80, 60, 99, 79, 250); // 20×20 = 400 px, abajo-derecha, separado
  const blobs = segmentBlobs(cur, prev, W, H, { minAreaFrac: 0.005 }); // 0.5% de 10800 = 54
  assert.equal(blobs.length, 2);
  const [a, b] = blobs.sort((x, y) => x.n - y.n);
  assert.equal(a.n, 225);
  assert.ok(Math.abs(a.cx - 17) < 1e-9 && Math.abs(a.cy - 17) < 1e-9);
  assert.equal(b.n, 400);
  assert.deepEqual(b.bbox, { minX:80, maxX:99, minY:60, maxY:79 });
});

test('segmentBlobs descarta manchas menores al área mínima', () => {
  const prev = solidFrame(50);
  const cur = solidFrame(50);
  paintRect(cur, 10, 10, 12, 12, 250); // 3×3 = 9 px, ruido chico
  paintRect(cur, 50, 50, 69, 69, 250); // 20×20 = 400 px, objeto real
  const blobs = segmentBlobs(cur, prev, W, H, { minAreaFrac: 0.005 }); // piso 54 px
  assert.equal(blobs.length, 1);
  assert.equal(blobs[0].n, 400);
});

test('segmentBlobs devuelve vacío sin movimiento', () => {
  const f = solidFrame(50);
  assert.deepEqual(segmentBlobs(f, f, W, H), []);
});

test('BlobTracker mantiene el mismo id cuando el blob se desplaza poco', () => {
  const t = new BlobTracker({ maxMatchDist: 15 });
  const f1 = t.update([{ cx:10, cy:10, n:100, bbox:{minX:5,maxX:15,minY:5,maxY:15} }]);
  const id1 = f1[0].id;
  const f2 = t.update([{ cx:13, cy:11, n:105, bbox:{minX:8,maxX:18,minY:6,maxY:16} }]);
  assert.equal(f2[0].id, id1);
});

test('BlobTracker asigna id nuevo a un blob lejano (objeto distinto)', () => {
  const t = new BlobTracker({ maxMatchDist: 15 });
  const f1 = t.update([{ cx:10, cy:10, n:100, bbox:{minX:5,maxX:15,minY:5,maxY:15} }]);
  const id1 = f1[0].id;
  const f2 = t.update([
    { cx:11, cy:10, n:100, bbox:{minX:6,maxX:16,minY:5,maxY:15} },  // el mismo de antes
    { cx:90, cy:70, n:200, bbox:{minX:80,maxX:100,minY:60,maxY:80} }, // uno nuevo, lejos
  ]);
  assert.equal(f2.length, 2);
  const same = f2.find(b => Math.abs(b.cx - 11) < 1);
  const fresh = f2.find(b => Math.abs(b.cx - 90) < 1);
  assert.equal(same.id, id1);
  assert.notEqual(fresh.id, id1);
});

test('BlobTracker no reconecta un id a través de un hueco sin blobs', () => {
  const t = new BlobTracker({ maxMatchDist: 15 });
  const f1 = t.update([{ cx:10, cy:10, n:100, bbox:{minX:5,maxX:15,minY:5,maxY:15} }]);
  const id1 = f1[0].id;
  t.update([]); // el objeto desapareció un frame
  const f3 = t.update([{ cx:10, cy:10, n:100, bbox:{minX:5,maxX:15,minY:5,maxY:15} }]); // reaparece igual
  assert.notEqual(f3[0].id, id1, 'sin blob rastreado en el medio, debe ser un id nuevo');
});

test('BlobTracker.hitTest encuentra el blob bajo un punto y null fuera de todos', () => {
  const t = new BlobTracker();
  t.update([
    { cx:10, cy:10, n:100, bbox:{minX:5,maxX:15,minY:5,maxY:15} },
    { cx:90, cy:70, n:200, bbox:{minX:80,maxX:100,minY:60,maxY:80} },
  ]);
  const idA = t.hitTest(10/120, 10/90, 120, 90);
  const idB = t.hitTest(90/120, 70/90, 120, 90);
  const idNone = t.hitTest(60/120, 40/90, 120, 90);
  assert.ok(idA !== null && idB !== null && idA !== idB);
  assert.equal(idNone, null);
});

test('BlobTracker.reset olvida los ids rastreados', () => {
  const t = new BlobTracker({ maxMatchDist: 15 });
  const f1 = t.update([{ cx:10, cy:10, n:100, bbox:{minX:5,maxX:15,minY:5,maxY:15} }]);
  const id1 = f1[0].id;
  t.reset();
  const f2 = t.update([{ cx:10, cy:10, n:100, bbox:{minX:5,maxX:15,minY:5,maxY:15} }]);
  assert.notEqual(f2[0].id, id1);
});

test('BlobTracker.largest devuelve el de mayor área y null sin blobs', () => {
  const t = new BlobTracker();
  assert.equal(t.largest(), null);
  t.update([
    { cx:10, cy:10, n:50,  bbox:{minX:5,maxX:15,minY:5,maxY:15} },
    { cx:90, cy:70, n:400, bbox:{minX:80,maxX:100,minY:60,maxY:80} },
  ]);
  assert.equal(t.largest().n, 400);
});
