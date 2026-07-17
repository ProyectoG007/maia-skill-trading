// Calibración y conversión de unidades.
// Lógica pura: fracciones de encuadre + tamaños reales → escala y velocidades.

// Objetos de referencia para auto-calibración (tamaño en cm).
export const REF_PRESETS = [
  { id:'a4l',    label:'Hoja A4 apaisada — 29,7 cm',   cm:29.7 },
  { id:'a4p',    label:'Hoja A4 vertical — 21,0 cm',   cm:21.0 },
  { id:'card',   label:'Tarjeta de crédito — 8,56 cm', cm:8.56 },
  { id:'cd',     label:'CD / DVD — 12,0 cm',           cm:12.0 },
];

// Largo de la barra de calibración como fracción del ancho del encuadre.
// Los píxeles son cuadrados, así que dy se lleva a unidades de ancho con la
// relación de aspecto (alto/ancho). Piso de 0.01 para no dividir por ~0.
export function segmentLengthFrac(p1, p2, aspect){
  return Math.max(0.01, Math.hypot(p2.x - p1.x, (p2.y - p1.y) * aspect));
}

// Ancho real del campo visible completo a partir de un objeto de referencia:
// campo = tamaño_referencia / fracción_del_encuadre_que_ocupa.
export function fieldWidthFromReference(refSizeCm, segFrac){
  return refSizeCm / Math.max(segFrac, 0.01);
}

// Distancia real entre las líneas A y B (misma unidad que `fov`).
export function roiDistance(lineA, lineB, fov){
  return Math.abs(lineB - lineA) * fov;
}

// Velocidad de un cruce: distancia / tiempo. Con unidad 'm' la entrada está
// en metros y la salida se convierte a km/h; con 'cm' queda en cm/s.
export function crossSpeed(dist, dtSec, unit){
  let v = dist / dtSec;
  if (unit === 'm') v *= 3.6;
  return v;
}

// Velocidad continua: píxeles/segundo → unidades reales usando la escala
// (fov = ancho real del campo; W = ancho del buffer de proceso en px).
export function pxPerSecToReal(pxPerSec, fov, W, unit){
  let real = pxPerSec * (fov / W);
  if (unit === 'm') real *= 3.6;
  return real;
}
