// Calibración y conversión de unidades.
// Lógica pura: fracciones de encuadre + tamaños reales → escala y velocidades.

// Objetos de referencia para auto-calibración a escala de mesa (tamaño en cm).
export const REF_PRESETS = [
  { id:'a4l',    label:'Hoja A4 apaisada — 29,7 cm',   cm:29.7 },
  { id:'a4p',    label:'Hoja A4 vertical — 21,0 cm',   cm:21.0 },
  { id:'card',   label:'Tarjeta de crédito — 8,56 cm', cm:8.56 },
  { id:'cd',     label:'CD / DVD — 12,0 cm',           cm:12.0 },
];

// Referencias a escala vehicular (mismo mecanismo de calibración, tamaños en
// cm para reusar fieldWidthFromReference sin cambios: alinear la barra con
// un carril o un auto conocido en vez de sostener un objeto ante la cámara).
export const VEHICLE_PRESETS = [
  { id:'lane-urban', label:'Carril urbano — 3,0 m',  cm:300 },
  { id:'lane-route', label:'Carril de ruta — 3,65 m', cm:365 },
  { id:'sedan',      label:'Largo de sedán — 4,5 m',  cm:450 },
];

// Escenario de medición: ajusta la unidad por defecto, el umbral de tamaño
// mínimo de objeto (fracción del área del encuadre) para ignorar ruido chico
// (una hoja moviéndose, un perro) al medir tránsito, y los presets visibles.
export const SCENARIOS = {
  mesa: {
    label: 'MESA', unit: 'cm', defaultFov: 50, minAreaFrac: 0.005,
    presets: REF_PRESETS,
    hint: 'Objeto chico sobre una superficie, cámara cerca y perpendicular.',
  },
  calle: {
    label: 'CALLE', unit: 'm', defaultFov: 15, minAreaFrac: 0.015,
    presets: VEHICLE_PRESETS,
    hint: 'Vehículo en una calle: cámara fija (trípode/ventana), perpendicular '
        + 'a la calzada, líneas A y B bien separadas.',
  },
};

// Umbral en píxeles para considerar que "hay un objeto": la fracción mínima
// de área del escenario activo, aplicada al tamaño real del buffer de proceso.
export function minPixelsForArea(minAreaFrac, W, H){
  return minAreaFrac * W * H;
}

// Separación mínima recomendada entre A y B (en metros) para que el error
// relativo del cronómetro se mantenga por debajo de `maxErrorFrac` a la
// velocidad esperada, asumiendo una incertidumbre de cronometraje de
// `jitterSec` (precisión de reloj del navegador + resolución de la
// interpolación sub-frame del cruce). Cuanto más rápido el objeto o más
// exigente el error tolerado, más larga tiene que ser la zona de medición.
export function recommendedRoiSpanM(expectedSpeedKmh, { maxErrorFrac = 0.05, jitterSec = 0.005 } = {}){
  const speedMs = expectedSpeedKmh / 3.6;
  const minDtSec = jitterSec / maxErrorFrac;
  return speedMs * minDtSec;
}

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
