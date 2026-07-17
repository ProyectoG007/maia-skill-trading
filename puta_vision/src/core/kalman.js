// Filtro de Kalman 2D de velocidad constante, para suavizar la trayectoria
// del objeto seguido sin el retardo de una media móvil exponencial (EMA):
// una EMA reacciona a los cambios de velocidad con demora (tarda varios
// frames en "alcanzar" un cambio real); un Kalman con modelo de velocidad
// constante predice el siguiente estado y corrige con la medición, así que
// sigue cambios reales de velocidad más rápido mientras sigue promediando
// el ruido de una medición puntual mala.
//
// Estado x = [px, py, vx, vy]. Solo se mide posición (px,py) — la velocidad
// es inferida por el filtro a partir de cómo cambia la posición medida en
// el tiempo, con el ruido de proceso modelado como aceleración blanca
// discreta (DWNA), la formulación estándar para este tipo de seguimiento.

function mul4(A, B){
  const C = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i=0; i<4; i++) for (let j=0; j<4; j++){
    let s = 0;
    for (let k=0; k<4; k++) s += A[i][k]*B[k][j];
    C[i][j] = s;
  }
  return C;
}
function transpose4(A){
  const T = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i=0; i<4; i++) for (let j=0; j<4; j++) T[j][i] = A[i][j];
  return T;
}
function add4(A, B){
  const C = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i=0; i<4; i++) for (let j=0; j<4; j++) C[i][j] = A[i][j] + B[i][j];
  return C;
}

export class Kalman2D {
  constructor({ processNoise = 4, measurementNoise = 9 } = {}){
    this.q = processNoise;       // cuánto se espera que cambie la velocidad real entre frames
    this.r = measurementNoise;   // cuánto ruido se espera en cada medición de posición
    this.x = null;                // [px, py, vx, vy]
    this.P = null;                // covarianza 4×4
  }

  // Olvida el estado: la próxima medición reinicializa el filtro desde cero
  // (usar cuando el objeto seguido cambia — nueva selección, cámara reiniciada).
  reset(){
    this.x = null;
    this.P = null;
  }

  // zx, zy: medición de posición; dt: segundos desde la medición anterior.
  // Devuelve {x, y, vx, vy} suavizados. Sin estado previo (o dt inválido),
  // inicializa con la medición cruda y velocidad 0 — no hay nada que suavizar
  // todavía en la primera muestra.
  update(zx, zy, dt){
    if (!this.x || dt <= 0){
      this.x = [zx, zy, 0, 0];
      this.P = [[100,0,0,0],[0,100,0,0],[0,0,100,0],[0,0,0,100]];
      return { x: zx, y: zy, vx: 0, vy: 0 };
    }

    // --- predicción ---
    const F = [[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]];
    const dt2 = dt*dt, dt3 = dt2*dt;
    const q = this.q;
    const Q = [
      [q*dt3/3, 0,       q*dt2/2, 0      ],
      [0,       q*dt3/3, 0,       q*dt2/2],
      [q*dt2/2, 0,       q*dt,    0      ],
      [0,       q*dt2/2, 0,       q*dt   ],
    ];
    const xPred = [
      this.x[0] + dt*this.x[2],
      this.x[1] + dt*this.x[3],
      this.x[2],
      this.x[3],
    ];
    const PPred = add4(mul4(mul4(F, this.P), transpose4(F)), Q);

    // --- corrección --- (H mide solo posición: H=[[1,0,0,0],[0,1,0,0]])
    const r = this.r;
    const S00 = PPred[0][0] + r, S01 = PPred[0][1];
    const S10 = PPred[1][0],     S11 = PPred[1][1] + r;
    const det = S00*S11 - S01*S10;
    const Si00 = S11/det, Si01 = -S01/det, Si10 = -S10/det, Si11 = S00/det;

    const innovX = zx - xPred[0], innovY = zy - xPred[1];
    const K = [0,1,2,3].map(i => [
      PPred[i][0]*Si00 + PPred[i][1]*Si10,
      PPred[i][0]*Si01 + PPred[i][1]*Si11,
    ]);
    const xNew = [0,1,2,3].map(i => xPred[i] + K[i][0]*innovX + K[i][1]*innovY);
    const PNew = [0,1,2,3].map(i => [0,1,2,3].map(j =>
      PPred[i][j] - K[i][0]*PPred[0][j] - K[i][1]*PPred[1][j]
    ));

    this.x = xNew;
    this.P = PNew;
    return { x: xNew[0], y: xNew[1], vx: xNew[2], vy: xNew[3] };
  }
}
