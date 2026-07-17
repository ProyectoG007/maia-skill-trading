// Lecturas en pantalla: números, estado del cruce, contadores.
// Único módulo que escribe texto en el DOM.

const $ = id => document.getElementById(id);

export function roiState(txt, cls){
  const el = $('roiState');
  el.textContent = txt; el.className = cls;
}

export function measurement(v, dtSec){
  $('roiSpeed').textContent = v.toFixed(1);
  $('crossT').textContent = dtSec.toFixed(2) + 's';
}

export function max(v){ $('max').textContent = v.toFixed(1); }
export function continuous(v){ $('speed').textContent = v.toFixed(1); }
export function fps(n){ $('fps').textContent = n; }
export function ptCount(txt){ $('ptCount').textContent = txt; }
export function status(txt, on){
  $('status').textContent = txt;
  $('status').className = on ? 'on' : '';
}
export function unitLabel(unit){
  $('roiUnit').textContent = unit === 'm' ? 'km/h' : 'cm/s';
}
export function roiDist(dist, unit){
  $('roiDist').textContent = 'Distancia A–B: ' + dist.toFixed(1) + ' ' + unit;
}
export function calibInfo(txt){ $('calibInfo').textContent = txt; }
export function scenarioLabel(txt){ $('scenarioLabel').textContent = txt; }
export function scenarioHint(txt){ $('scenarioHint').textContent = txt; }
export function blobInfo(txt){ $('blobInfo').textContent = txt; }
export function perspInfo(txt){ $('perspInfo').textContent = txt; }
export function perspStatusLabel(txt){ $('perspStatusLabel').textContent = txt; }

export function resetMeasurements(){
  $('max').textContent = '—';
  $('roiSpeed').textContent = '—';
  $('crossT').textContent = '—';
}
