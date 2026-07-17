// Máquina de estados del cruce A→B.
// Lógica pura: recibe posiciones fraccionales (0..1) y timestamps en ms,
// devuelve eventos. No sabe nada de unidades ni de UI.

// Instante interpolado en que la posición cruzó `line` entre el frame
// anterior (prevFx@prevFxT) y el actual (fx@now), o null si no la cruzó.
// Detecta por cambio de lado, no por proximidad: un objeto rápido que salta
// la línea entre dos frames dispara el cruce igual, y la interpolación da
// resolución temporal mejor que el período de frame.
export function crossTime(prevFx, prevFxT, fx, now, line){
  if (prevFx === null) return null;
  if ((prevFx - line) * (fx - line) > 0) return null; // quedó del mismo lado
  if (fx === prevFx) return now;
  const frac = (line - prevFx) / (fx - prevFx);
  return prevFxT + frac * (now - prevFxT);
}

// Estados: idle → timing (cruzó primera línea) → idle (cruzó la otra: medido).
// Funciona en ambos sentidos. Si re-cruza la línea de partida, el cronómetro
// se reinicia; si tarda más de `timeoutMs`, se desarma.
export class CrossingTracker {
  constructor({ minDtMs = 20, timeoutMs = 5000 } = {}){
    this.minDtMs = minDtMs;
    this.timeoutMs = timeoutMs;
    this.reset();
  }

  reset(){
    this.state = 'idle';
    this.startLine = null;
    this.t0 = 0;
    this.prevFx = null;
    this.prevFxT = null;
  }

  // Olvida la última posición sin desarmar el cronómetro (objeto perdido
  // momentáneamente: evita "cruces" fantasma cuando algo reaparece lejos).
  forgetPosition(){
    this.prevFx = null;
    this.prevFxT = null;
  }

  // fx: posición fraccional del objeto; now: ms; a, b: líneas (fracciones).
  // Devuelve un evento o null:
  //   {type:'armed', dir}          arrancó el cronómetro
  //   {type:'measured', dtSec, dir} cruce completo medido
  //   {type:'discarded'}           cruce demasiado corto (ruido)
  //   {type:'timeout'}             se desarmó por tiempo
  // dir es '→' si el objeto fue de la línea izquierda a la derecha, '←' si
  // fue al revés — se usa para el registro de mediciones (SPEC F4).
  update(fx, now, a, b){
    const L = Math.min(a, b), R = Math.max(a, b);
    const tL = crossTime(this.prevFx, this.prevFxT, fx, now, L);
    const tR = crossTime(this.prevFx, this.prevFxT, fx, now, R);
    let event = null;

    if (this.state === 'idle'){
      if (tL !== null && tR !== null){
        // tan rápido que cruzó ambas líneas en un solo frame: medir igual
        event = this._finish(Math.abs(tR - tL), tL <= tR ? '→' : '←');
      } else if (tL !== null){
        this.state = 'timing'; this.startLine = 'L'; this.t0 = tL;
        event = { type:'armed', dir:'→' };
      } else if (tR !== null){
        this.state = 'timing'; this.startLine = 'R'; this.t0 = tR;
        event = { type:'armed', dir:'←' };
      }
    } else {
      const targetT = this.startLine === 'L' ? tR : tL;
      const backT   = this.startLine === 'L' ? tL : tR;
      if (targetT !== null){
        event = this._finish(targetT - this.t0, this.startLine === 'L' ? '→' : '←');
      } else if (backT !== null){
        this.t0 = backT; // volvió a cruzar la de partida: reiniciar
      } else if (now - this.t0 > this.timeoutMs){
        const prevFx = this.prevFx, prevFxT = this.prevFxT;
        this.reset();
        this.prevFx = prevFx; this.prevFxT = prevFxT;
        event = { type:'timeout' };
      }
    }

    this.prevFx = fx; this.prevFxT = now;
    return event;
  }

  _finish(dtMs, dir){
    this.state = 'idle'; this.startLine = null; this.t0 = 0;
    return dtMs > this.minDtMs ? { type:'measured', dtSec: dtMs/1000, dir } : { type:'discarded' };
  }
}
