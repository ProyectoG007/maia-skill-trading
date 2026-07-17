import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossTime, CrossingTracker } from '../src/core/crossing.js';

test('crossTime detecta cruce por cambio de lado e interpola el instante', () => {
  // de 0.2 a 0.6 entre t=1000 y t=1100; la línea 0.4 está a mitad del salto
  assert.equal(crossTime(0.2, 1000, 0.6, 1100, 0.4), 1050);
  // misma dirección pero la línea queda afuera del salto: no hay cruce
  assert.equal(crossTime(0.2, 1000, 0.35, 1100, 0.4), null);
  // sin posición previa no hay cruce
  assert.equal(crossTime(null, null, 0.6, 1100, 0.4), null);
  // tocar exactamente la línea cuenta como cruce
  assert.equal(crossTime(0.2, 1000, 0.4, 1100, 0.4), 1100);
});

test('cruce lento en varios frames: arma en A y mide en B', () => {
  const c = new CrossingTracker();
  const A = 0.3, B = 0.7;
  assert.equal(c.update(0.10, 0, A, B), null);          // acercándose
  const armed = c.update(0.35, 100, A, B);              // cruzó A (interp. en t=80)
  assert.equal(armed.type, 'armed');
  assert.equal(armed.dir, '→');
  assert.equal(c.update(0.50, 200, A, B), null);        // en el medio
  const done = c.update(0.75, 300, A, B);               // cruzó B (interp. en t=280)
  assert.equal(done.type, 'measured');
  assert.ok(Math.abs(done.dtSec - 0.2) < 1e-9);         // 280 - 80 = 200 ms
});

test('objeto rapidísimo: cruza ambas líneas en un solo frame y se mide igual', () => {
  const c = new CrossingTracker();
  c.update(0.05, 0, 0.3, 0.7);
  const done = c.update(0.95, 100, 0.3, 0.7);
  assert.equal(done.type, 'measured');
  // A se cruza en t=27.7, B en t=72.2 → dt ≈ 44.4 ms
  assert.ok(Math.abs(done.dtSec - (100 * 0.4/0.9)/1000) < 1e-9);
});

test('re-cruzar la línea de partida reinicia el cronómetro', () => {
  const c = new CrossingTracker();
  const A = 0.3, B = 0.7;
  c.update(0.10, 0, A, B);
  c.update(0.35, 100, A, B);           // armado, t0 = 80
  c.update(0.25, 200, A, B);           // vuelve a cruzar A → t0 se reinicia
  c.update(0.35, 300, A, B);           // vuelve a entrar (t0 de nuevo)
  const done = c.update(0.75, 400, A, B);
  assert.equal(done.type, 'measured');
  // el dt tiene que medirse desde el último re-cruce de A, no desde el primero
  assert.ok(done.dtSec < 0.15, `dt ${done.dtSec} debería ser < 0.15s`);
});

test('cruce instantáneo (ruido) se descarta', () => {
  const c = new CrossingTracker({ minDtMs: 20 });
  c.update(0.29, 0, 0.3, 0.7);
  // salto de A a B en 10 ms → dt del cruce < 20 ms → descartado
  const ev = c.update(0.71, 10, 0.3, 0.7);
  assert.equal(ev.type, 'discarded');
  assert.equal(c.state, 'idle');
});

test('timeout desarma el cronómetro', () => {
  const c = new CrossingTracker({ timeoutMs: 5000 });
  c.update(0.10, 0, 0.3, 0.7);
  c.update(0.35, 100, 0.3, 0.7);       // armado
  assert.equal(c.state, 'timing');
  const ev = c.update(0.40, 6000, 0.3, 0.7);
  assert.equal(ev.type, 'timeout');
  assert.equal(c.state, 'idle');
});

test('forgetPosition evita el cruce fantasma al reaparecer del otro lado', () => {
  const c = new CrossingTracker();
  c.update(0.10, 0, 0.3, 0.7);
  c.forgetPosition();                   // el objeto se perdió un rato
  // reaparece del otro lado: sin posición previa no debe armar nada
  assert.equal(c.update(0.90, 1000, 0.3, 0.7), null);
});

test('funciona en sentido inverso (B hacia A)', () => {
  const c = new CrossingTracker();
  const armed = (c.update(0.90, 0, 0.3, 0.7), c.update(0.65, 100, 0.3, 0.7));
  assert.equal(armed.type, 'armed');
  assert.equal(armed.dir, '←');
  const done = c.update(0.25, 300, 0.3, 0.7);
  assert.equal(done.type, 'measured');
});
