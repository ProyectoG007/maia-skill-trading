import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentLengthFrac, fieldWidthFromReference, roiDistance,
  crossSpeed, pxPerSecToReal, REF_PRESETS, VEHICLE_PRESETS, SCENARIOS,
  minPixelsForArea, recommendedRoiSpanM,
} from '../src/core/calibration.js';

test('segmentLengthFrac: barra horizontal es la diferencia simple de x', () => {
  assert.ok(Math.abs(segmentLengthFrac({x:0.2,y:0.5}, {x:0.6,y:0.5}, 0.75) - 0.4) < 1e-12);
});

test('segmentLengthFrac: barra inclinada usa distancia euclídea con aspecto', () => {
  // dx=0.3 del ancho, dy=0.4 del alto con aspecto 0.75 → dy=0.3 en unidades
  // de ancho → hipotenusa 3-4-5 escalada: 0.3√2... no: hypot(0.3, 0.3)
  const len = segmentLengthFrac({x:0.1,y:0.1}, {x:0.4,y:0.5}, 0.75);
  assert.ok(Math.abs(len - Math.hypot(0.3, 0.3)) < 1e-12);
});

test('segmentLengthFrac tiene piso para no dividir por cero después', () => {
  assert.equal(segmentLengthFrac({x:0.5,y:0.5}, {x:0.5,y:0.5}, 0.75), 0.01);
});

test('fieldWidthFromReference: A4 apaisada ocupando la mitad del encuadre → campo de 59,4 cm', () => {
  assert.ok(Math.abs(fieldWidthFromReference(29.7, 0.5) - 59.4) < 1e-9);
});

test('roiDistance escala la separación de líneas por el campo', () => {
  assert.ok(Math.abs(roiDistance(0.3, 0.7, 50) - 20) < 1e-12); // 40% de 50 cm
  assert.ok(Math.abs(roiDistance(0.7, 0.3, 50) - 20) < 1e-12); // orden indistinto
});

test('crossSpeed: cm → cm/s directo; m → km/h con factor 3,6', () => {
  assert.equal(crossSpeed(20, 2, 'cm'), 10);        // 20 cm en 2 s = 10 cm/s
  assert.ok(Math.abs(crossSpeed(10, 1, 'm') - 36) < 1e-12); // 10 m/s = 36 km/h
});

test('pxPerSecToReal convierte con la escala del encuadre', () => {
  // 60 px/s con campo de 50 cm en 120 px → 25 cm/s
  assert.ok(Math.abs(pxPerSecToReal(60, 50, 120, 'cm') - 25) < 1e-12);
  // misma cuenta en metros → *3.6 para km/h
  assert.ok(Math.abs(pxPerSecToReal(60, 50, 120, 'm') - 90) < 1e-9);
});

test('los presets de referencia traen los tamaños reales', () => {
  const card = REF_PRESETS.find(p => p.id === 'card');
  assert.equal(card.cm, 8.56);
  assert.ok(REF_PRESETS.every(p => p.cm > 0 && p.label.length > 0));
});

test('los presets vehiculares están en la escala de calle (metros, como cm)', () => {
  const sedan = VEHICLE_PRESETS.find(p => p.id === 'sedan');
  assert.equal(sedan.cm, 450); // 4,5 m
  assert.ok(VEHICLE_PRESETS.every(p => p.cm > 100)); // todo por encima de 1 m
});

test('los escenarios MESA y CALLE traen unidad, umbral y presets distintos', () => {
  assert.equal(SCENARIOS.mesa.unit, 'cm');
  assert.equal(SCENARIOS.calle.unit, 'm');
  assert.equal(SCENARIOS.mesa.presets, REF_PRESETS);
  assert.equal(SCENARIOS.calle.presets, VEHICLE_PRESETS);
  // CALLE tolera objetos más grandes como piso (ignora ruido chico en tránsito)
  assert.ok(SCENARIOS.calle.minAreaFrac > SCENARIOS.mesa.minAreaFrac);
});

test('minPixelsForArea escala la fracción por el tamaño del buffer', () => {
  assert.equal(minPixelsForArea(0.005, 120, 90), 0.005 * 120 * 90);
  assert.equal(minPixelsForArea(0.02, 100, 100), 200);
});

test('recommendedRoiSpanM: más velocidad o menos tolerancia piden más distancia', () => {
  // 36 km/h = 10 m/s; jitter 5ms / error 5% → dt mínimo 0.1s → 1.0 m
  assert.ok(Math.abs(recommendedRoiSpanM(36) - 1.0) < 1e-9);
  // el doble de velocidad pide el doble de distancia para el mismo error
  assert.ok(Math.abs(recommendedRoiSpanM(72) - 2.0) < 1e-9);
  // exigir menos error (2%) pide más distancia que tolerar 5%
  assert.ok(recommendedRoiSpanM(36, { maxErrorFrac: 0.02 }) > recommendedRoiSpanM(36, { maxErrorFrac: 0.05 }));
});
