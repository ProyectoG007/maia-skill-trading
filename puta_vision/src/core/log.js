// Registro de mediciones: estructura de cada entrada y su exportación a CSV.
// Lógica pura: sin localStorage, sin canvas — la persistencia y la captura
// de foto-finish son responsabilidad de la capa UI (ver SPEC F4).

// Crea una entrada de medición. `photoDataUrl` es opcional (dataURL JPEG del
// frame en el instante del cruce, capturado por la UI); sin foto, null.
export function createLogEntry({ timestamp, speed, unit, dtSec, dir, mode, scenario, photoDataUrl = null }){
  return { timestamp, speed, unit, dtSec, dir, mode, scenario, photoDataUrl };
}

// Antepone la entrada más nueva primero y recorta a `maxEntries` (por
// defecto ilimitado) para no dejar crecer el registro sin límite.
export function addEntry(log, entry, maxEntries = Infinity){
  const next = [entry, ...log];
  return next.length > maxEntries ? next.slice(0, maxEntries) : next;
}

const CSV_HEADERS = ['fecha_hora', 'velocidad', 'unidad', 'tiempo_cruce_s', 'sentido', 'modo', 'escenario'];

function csvEscape(value){
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Serializa el registro a CSV (sin las fotos: son dataURLs enormes, no
// tienen sentido en una hoja de cálculo). Una fila por medición, la más
// reciente primero — mismo orden que el registro en memoria.
export function toCSV(log){
  const rows = log.map(e => [
    new Date(e.timestamp).toISOString(),
    e.speed.toFixed(1),
    e.unit,
    e.dtSec.toFixed(2),
    e.dir,
    e.mode,
    e.scenario,
  ].map(csvEscape).join(','));
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}
