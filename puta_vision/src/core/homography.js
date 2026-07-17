// Corrección de perspectiva por homografía de 4 puntos (DLT).
// Lógica pura: sin DOM. Permite medir correctamente aunque la cámara no
// esté perpendicular a la calzada — el resto del sistema asume que todo el
// plano de movimiento está a la distancia calibrada y de frente; esto lo
// reemplaza por una proyección real del plano marcado por el usuario.
//
// El usuario marca las 4 esquinas de un rectángulo real conocido (ej. un
// tramo de carril) en la imagen; `computeHomography` resuelve la matriz que
// lleva esos puntos de imagen a las coordenadas reales (en metros) del
// rectángulo. Con esa matriz, la posición de cualquier objeto en la imagen
// se puede convertir a su posición real en el plano — de ahí sale una
// velocidad correcta sin importar el ángulo de la cámara.

// Elimina Gauss-Jordan con pivoteo parcial para A·u = b (A es n×n). Muta A
// y b. Devuelve el vector solución, o null si el sistema es singular
// (puntos degenerados, ej. colineales — no determinan una homografía).
function solveLinearSystem(A, b, n){
  for (let col = 0; col < n; col++){
    let pivotRow = col, maxAbs = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++){
      if (Math.abs(A[row][col]) > maxAbs){ maxAbs = Math.abs(A[row][col]); pivotRow = row; }
    }
    if (maxAbs < 1e-10) return null; // singular
    if (pivotRow !== col){
      [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }
    const pivot = A[col][col];
    for (let row = 0; row < n; row++){
      if (row === col) continue;
      const factor = A[row][col] / pivot;
      if (factor === 0) continue;
      for (let k = col; k < n; k++) A[row][k] -= factor * A[col][k];
      b[row] -= factor * b[col];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

// Resuelve la homografía 3×3 (con h33 fijado en 1) que lleva cada punto de
// `src` al correspondiente en `dst`, usando exactamente 4 correspondencias
// (DLT). Devuelve una matriz plana de 9 elementos (row-major), o null si
// los puntos son degenerados (ej. 3 o más colineales).
export function computeHomography(src, dst){
  if (src.length !== 4 || dst.length !== 4) throw new Error('se necesitan exactamente 4 puntos de cada lado');

  const A = [], b = [];
  for (let i = 0; i < 4; i++){
    const { x, y } = src[i], { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x*X, -y*X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x*Y, -y*Y]); b.push(Y);
  }

  const u = solveLinearSystem(A, b, 8);
  if (!u) return null;
  return [u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7], 1];
}

// Aplica la homografía a un punto (x,y) → (x',y') con división por la
// coordenada homogénea. Con H degenerado en ese punto (w≈0) devuelve null.
export function applyHomography(H, x, y){
  const w = H[6]*x + H[7]*y + H[8];
  if (Math.abs(w) < 1e-10) return null;
  return { x: (H[0]*x + H[1]*y + H[2]) / w, y: (H[3]*x + H[4]*y + H[5]) / w };
}

// Inversa de una homografía 3×3 (adjugada / determinante). Sirve para
// proyectar puntos del plano real de vuelta a la imagen — por ejemplo para
// dibujar una grilla de verificación sobre el video. null si no invertible.
export function invertHomography(H){
  const [a,b,c, d,e,f, g,h,i] = H;
  const det = a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
  if (Math.abs(det) < 1e-10) return null;
  const invDet = 1/det;
  return [
    (e*i - f*h) * invDet, (c*h - b*i) * invDet, (b*f - c*e) * invDet,
    (f*g - d*i) * invDet, (a*i - c*g) * invDet, (c*d - a*f) * invDet,
    (d*h - e*g) * invDet, (b*g - a*h) * invDet, (a*e - b*d) * invDet,
  ];
}
