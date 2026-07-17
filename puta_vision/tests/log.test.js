import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogEntry, addEntry, toCSV } from '../src/core/log.js';

function sampleEntry(overrides = {}){
  return createLogEntry({
    timestamp: 1700000000000,
    speed: 42.5,
    unit: 'km/h',
    dtSec: 0.31,
    dir: '→',
    mode: 'flow',
    scenario: 'calle',
    ...overrides,
  });
}

test('createLogEntry guarda todos los campos, foto opcional en null por defecto', () => {
  const e = sampleEntry();
  assert.equal(e.speed, 42.5);
  assert.equal(e.photoDataUrl, null);
  const withPhoto = createLogEntry({ timestamp: 1, speed: 1, unit: 'cm/s', dtSec: 1, dir: '→', mode: 'diff', scenario: 'mesa', photoDataUrl: 'data:image/jpeg;base64,xyz' });
  assert.equal(withPhoto.photoDataUrl, 'data:image/jpeg;base64,xyz');
});

test('addEntry antepone la más nueva primero', () => {
  let log = [];
  log = addEntry(log, sampleEntry({ timestamp: 1 }));
  log = addEntry(log, sampleEntry({ timestamp: 2 }));
  assert.equal(log.length, 2);
  assert.equal(log[0].timestamp, 2);
  assert.equal(log[1].timestamp, 1);
});

test('addEntry recorta al máximo de entradas, descartando las más viejas', () => {
  let log = [];
  for (let i = 0; i < 5; i++) log = addEntry(log, sampleEntry({ timestamp: i }), 3);
  assert.equal(log.length, 3);
  assert.deepEqual(log.map(e => e.timestamp), [4, 3, 2]);
});

test('toCSV genera encabezado y una fila por medición, sin la foto', () => {
  const log = [sampleEntry({ timestamp: Date.UTC(2024, 0, 15, 10, 30, 0) })];
  const csv = toCSV(log);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'fecha_hora,velocidad,unidad,tiempo_cruce_s,sentido,modo,escenario');
  assert.ok(lines[1].startsWith('2024-01-15T10:30:00'));
  assert.ok(lines[1].includes('42.5,km/h,0.31,→,flow,calle'));
  assert.ok(!csv.includes('base64'));
});

test('toCSV escapa comas y comillas si algún campo las tuviera', () => {
  const log = [sampleEntry({ dir: 'a,"raro"' })];
  const csv = toCSV(log);
  assert.ok(csv.includes('"a,""raro"""'));
});

test('toCSV con registro vacío deja solo el encabezado', () => {
  assert.equal(toCSV([]), 'fecha_hora,velocidad,unidad,tiempo_cruce_s,sentido,modo,escenario');
});
