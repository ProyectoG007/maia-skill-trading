import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Kalman2D } from '../src/core/kalman.js';

test('la primera medición inicializa el estado crudo, sin suavizar (velocidad 0)', () => {
  const kf = new Kalman2D();
  const out = kf.update(12, 34, 0.033);
  assert.equal(out.x, 12);
  assert.equal(out.y, 34);
  assert.equal(out.vx, 0);
  assert.equal(out.vy, 0);
});

test('converge a la velocidad real con mediciones sin ruido', () => {
  const kf = new Kalman2D();
  const dt = 1/30;
  let x = 0, y = 0, out;
  for (let i = 0; i < 30; i++){
    x += 50*dt; y += -30*dt;
    out = kf.update(x, y, dt);
  }
  assert.ok(Math.abs(out.vx - 50) < 2, `vx=${out.vx}`);
  assert.ok(Math.abs(out.vy - (-30)) < 2, `vy=${out.vy}`);
});

test('suaviza el ruido de medición: el error del filtro es menor que el de la medición cruda', () => {
  const kf = new Kalman2D({ processNoise: 4, measurementNoise: 9 });
  const dt = 1/30;
  const trueVx = 40, trueVy = 20;
  let trueX = 0, trueY = 0;
  let sumErrRaw = 0, sumErrFiltered = 0, samples = 0;
  for (let i = 0; i < 60; i++){
    trueX += trueVx*dt; trueY += trueVy*dt;
    // ruido determinístico (no aleatorio, para que el test sea reproducible)
    const noiseX = Math.sin(i*37.1)*3, noiseY = Math.sin(i*53.7+1)*3;
    const zx = trueX + noiseX, zy = trueY + noiseY;
    const out = kf.update(zx, zy, dt);
    if (i > 10){ // descartar el transitorio inicial de convergencia
      sumErrRaw += Math.hypot(zx-trueX, zy-trueY);
      sumErrFiltered += Math.hypot(out.x-trueX, out.y-trueY);
      samples++;
    }
  }
  assert.ok(samples > 0);
  assert.ok(sumErrFiltered < sumErrRaw, `filtrado=${sumErrFiltered} crudo=${sumErrRaw}`);
});

test('reset olvida el estado: la próxima medición vuelve a inicializar', () => {
  const kf = new Kalman2D();
  kf.update(0, 0, 0.033);
  kf.update(10, 10, 0.033);
  kf.reset();
  const out = kf.update(99, 99, 0.033);
  assert.equal(out.x, 99);
  assert.equal(out.vx, 0);
});

test('dt <= 0 se trata como reinicio en vez de dividir por cero', () => {
  const kf = new Kalman2D();
  kf.update(0, 0, 0.033);
  const out = kf.update(5, 5, 0);
  assert.equal(out.x, 5);
  assert.equal(out.vx, 0);
});
