import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHomography, applyHomography, invertHomography } from '../src/core/homography.js';

// Un trapecio de perspectiva plausible: los tap points del usuario sobre un
// tramo de carril de 3,5 m de ancho por 10 m de largo, visto en ángulo (el
// borde cercano se ve más ancho que el lejano — perspectiva real, no afín).
const src = [
  { x: 20, y: 80 }, // cerca-izquierda
  { x: 100, y: 80 }, // cerca-derecha
  { x: 85, y: 20 },  // lejos-derecha
  { x: 35, y: 20 },  // lejos-izquierda
];
const WIDTH_M = 3.5, LENGTH_M = 10;
const dst = [
  { x: 0, y: 0 },
  { x: 0, y: WIDTH_M },
  { x: LENGTH_M, y: WIDTH_M },
  { x: LENGTH_M, y: 0 },
];

function closeTo(a, b, eps = 1e-6){
  return Math.abs(a - b) < eps;
}

test('computeHomography reproduce exactamente las 4 correspondencias que la definen', () => {
  const H = computeHomography(src, dst);
  assert.ok(H);
  for (let i = 0; i < 4; i++){
    const p = applyHomography(H, src[i].x, src[i].y);
    assert.ok(closeTo(p.x, dst[i].x, 1e-6), `punto ${i} x: ${p.x} vs ${dst[i].x}`);
    assert.ok(closeTo(p.y, dst[i].y, 1e-6), `punto ${i} y: ${p.y} vs ${dst[i].y}`);
  }
});

test('la homografía es genuinamente proyectiva: el punto medio de la imagen no es el punto medio del mundo', () => {
  // si fuera puramente afín, el centro del cuadrilátero de imagen mapearía
  // exactamente al centro del rectángulo real; con perspectiva real, no.
  const H = computeHomography(src, dst);
  const midSrc = { x: (src[0].x+src[2].x)/2, y: (src[0].y+src[2].y)/2 };
  const p = applyHomography(H, midSrc.x, midSrc.y);
  const midWorld = { x: LENGTH_M/2, y: WIDTH_M/2 };
  assert.ok(Math.abs(p.x - midWorld.x) > 1e-3 || Math.abs(p.y - midWorld.y) > 1e-3);
});

test('invertHomography deshace la transformación (mundo → imagen → mundo)', () => {
  const H = computeHomography(src, dst);
  const Hinv = invertHomography(H);
  assert.ok(Hinv);
  for (let i = 0; i < 4; i++){
    const back = applyHomography(Hinv, dst[i].x, dst[i].y);
    assert.ok(closeTo(back.x, src[i].x, 1e-6));
    assert.ok(closeTo(back.y, src[i].y, 1e-6));
  }
});

test('un punto arbitrario hace round-trip imagen→mundo→imagen', () => {
  const H = computeHomography(src, dst);
  const Hinv = invertHomography(H);
  const p0 = { x: 63, y: 45 }; // un punto cualquiera dentro del cuadrilátero
  const world = applyHomography(H, p0.x, p0.y);
  const back = applyHomography(Hinv, world.x, world.y);
  assert.ok(closeTo(back.x, p0.x, 1e-6));
  assert.ok(closeTo(back.y, p0.y, 1e-6));
});

test('computeHomography devuelve null con puntos de origen colineales (degenerado)', () => {
  const collinearSrc = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 5 },
  ];
  assert.equal(computeHomography(collinearSrc, dst), null);
});

test('invertHomography devuelve null para una matriz singular', () => {
  // una "homografía" con determinante 0 (fila duplicada)
  const singular = [1, 2, 3, 2, 4, 6, 0, 0, 1];
  assert.equal(invertHomography(singular), null);
});

test('applyHomography devuelve null cuando la coordenada homogénea es ~0', () => {
  const H = [1, 0, 0, 0, 1, 0, 1, 0, -5]; // w=0 cuando x=5
  assert.equal(applyHomography(H, 5, 3), null);
});
