// Wiring de la app: junta los módulos core (lógica pura) con la capa UI.
// Todo el estado mutable de la aplicación vive acá.

import { toGray, largestBrightRegion } from './core/diff.js';
import { CrossingTracker } from './core/crossing.js';
import {
  segmentLengthFrac, fieldWidthFromReference, roiDistance,
  crossSpeed, pxPerSecToReal, SCENARIOS, recommendedRoiSpanM,
} from './core/calibration.js';
import { FlowTracker } from './core/flow.js';
import { segmentBlobs, BlobTracker } from './core/blobs.js';
import { computeHomography, invertHomography, applyHomography } from './core/homography.js';
import { createLogEntry, addEntry, toCSV } from './core/log.js';
import { Kalman2D } from './core/kalman.js';
import { createScheduler } from './core/frameLoop.js';
import { W, openCamera, createProcessor, createSnapshotter } from './ui/camera.js';
import * as overlay from './ui/overlay.js';
import * as readout from './ui/readout.js';
import * as controls from './ui/controls.js';
import * as history from './ui/history.js';
import * as storage from './ui/storage.js';
import { setupInstallBanner } from './ui/installBanner.js';

const MAX_LOG_ENTRIES = 30;

const $ = id => document.getElementById(id);
const video = $('video');
const wrap = $('videoWrap');
const overlayCanvas = $('overlay');
const octx = overlayCanvas.getContext('2d');
const chart = $('chart');
const cctx = chart.getContext('2d');

const cam = createProcessor();
const crossing = new CrossingTracker();
const blobTracker = new BlobTracker();
const snapshotter = createSnapshotter();
const kalman = new Kalman2D();
let flow = new FlowTracker(W, cam.H);
let log = storage.loadLog();
const scheduler = createScheduler(video, requestAnimationFrame, cancelAnimationFrame);

const state = {
  running: false,
  trackMode: 'flow',        // 'diff' | 'flow'
  scenario: 'mesa',         // 'mesa' | 'calle'
  lineA: 0.30, lineB: 0.70,
  calibMode: false,
  calP1: {x:0.30, y:0.55}, calP2: {x:0.70, y:0.55},
  maxCross: 0,
  continuousSpeed: 0,
  history: new Array(120).fill(0),
  frames: 0, lastFpsT: performance.now(),
  prev: null, grayPrev: null,
  prevT: null,
  lostT: null,
  usingPerspLast: false,   // detecta el cambio de espacio (px/m) para resetear el Kalman
  selectedBlobId: null,     // null = elegir automáticamente el más grande
  lastBlobs: [],            // para dibujar todos los recuadros detectados
  perspMode: false,         // panel de marcado de plano abierto
  perspPoints: [            // 4 esquinas (fracción de encuadre), orden:
    {x:0.15, y:0.85},       // cerca-izquierda
    {x:0.85, y:0.85},       // cerca-derecha
    {x:0.65, y:0.35},       // lejos-derecha
    {x:0.35, y:0.35},       // lejos-izquierda
  ],
  perspPreview: null,       // {H,Hinv,widthM,lengthM} en vivo mientras se ajusta
  perspective: null,        // {H,Hinv,widthM,lengthM} aplicado
  perspectiveOn: false,     // toggle FOV/PLANO
};

const fov = () => parseFloat($('fov').value) || 50;
const unit = () => $('unitSel').value;
const refSizeCm = () => $('refSel').value === 'custom'
  ? (parseFloat($('refCustom').value) || 10)
  : parseFloat($('refSel').value);
const fmtCm = v => v.toFixed(2).replace(/\.?0+$/,'');

// ---------- Tamaños de canvas ----------
function sizeCanvases(){
  overlayCanvas.width = wrap.clientWidth;
  overlayCanvas.height = wrap.clientHeight;
  chart.width = chart.clientWidth * 2;
  chart.height = 160;
  drawFrame(null, null);
}
window.addEventListener('resize', sizeCanvases);
new ResizeObserver(sizeCanvases).observe(wrap);
video.addEventListener('loadedmetadata', () => {
  if (cam.setup(video)){ state.prev = null; flow = new FlowTracker(W, cam.H); }
  requestAnimationFrame(sizeCanvases);
});

// ---------- Dibujo por frame ----------
function drawFrame(cx, cy){
  const w = overlayCanvas.width, h = overlayCanvas.height;
  octx.clearRect(0, 0, w, h);
  if (state.calibMode){
    overlay.drawCalibBar(octx, w, h, state.calP1, state.calP2, fmtCm(refSizeCm()) + ' cm');
    return;
  }
  if (state.perspMode){
    overlay.drawPerspQuad(octx, w, h, state.perspPoints);
    if (state.perspPreview){
      overlay.drawPerspGrid(octx, w, h, state.perspPreview.Hinv, state.perspPreview.widthM, state.perspPreview.lengthM, W, cam.H);
    }
    return;
  }
  overlay.drawLines(octx, w, h, state.lineA, state.lineB, crossing.state === 'timing');
  if (state.lastBlobs.length > 1){
    overlay.drawBlobs(octx, w, h, state.lastBlobs, state.selectedBlobId, W, cam.H);
  }
  if (state.trackMode === 'flow' && flow.points.length){
    overlay.drawFlowPoints(octx, w, h, flow.points, W, cam.H);
  }
  if (cx !== null) overlay.drawCrosshair(octx, w, h, cx, cy, W, cam.H);
}

// ---------- Cruce ----------
function resetCross(){
  crossing.reset();
  readout.roiState('ESPERANDO OBJETO', '');
}

function logMeasurement(v, distUnit, ev){
  const entry = createLogEntry({
    timestamp: Date.now(),
    speed: v,
    unit: distUnit === 'm' ? 'km/h' : 'cm/s',
    dtSec: ev.dtSec,
    dir: ev.dir,
    mode: state.trackMode,
    scenario: state.scenario,
    photoDataUrl: video.videoWidth ? snapshotter.capture(video) : null,
  });
  log = addEntry(log, entry, MAX_LOG_ENTRIES);
  storage.saveLog(log);
  history.render(log);
}

function handleCrossEvent(ev, distReal, distUnit){
  if (!ev) return;
  if (ev.type === 'armed'){
    readout.roiState('⏱ CRONOMETRANDO ' + ev.dir, 'timing');
  } else if (ev.type === 'measured'){
    const v = crossSpeed(distReal, ev.dtSec, distUnit);
    readout.measurement(v, ev.dtSec);
    if (v > state.maxCross){ state.maxCross = v; readout.max(v); }
    readout.roiState('✓ MEDIDO — listo para el próximo', 'done');
    logMeasurement(v, distUnit, ev);
  } else if (ev.type === 'timeout'){
    readout.roiState('ESPERANDO OBJETO', '');
  }
  // 'discarded': ruido, sin cambio visible
}

// ---------- Loop principal ----------
function loop(){
  if (!state.running) return;
  scheduler.schedule(loop);

  const now = performance.now();
  state.frames++;
  if (now - state.lastFpsT >= 1000){
    readout.fps(state.frames);
    state.frames = 0; state.lastFpsT = now;
  }

  if (!cam.width) return;
  const frame = cam.grab(video);
  const gray = toGray(frame, W, cam.H);

  let cx = null, cy = null;

  if (state.prev && state.prev.length === frame.length){
    const blobs = segmentBlobs(frame, state.prev, W, cam.H, {
      minAreaFrac: SCENARIOS[state.scenario].minAreaFrac,
    });
    const tracked = blobTracker.update(blobs);
    state.lastBlobs = tracked;
    readout.blobInfo(tracked.length + (tracked.length === 1 ? ' objeto detectado' : ' objetos detectados'));

    // el elegido a mano si sigue vivo; si no, el más grande (auto)
    let target = state.selectedBlobId !== null ? blobTracker.get(state.selectedBlobId) : null;
    if (!target){
      target = blobTracker.largest();
      state.selectedBlobId = target ? target.id : null;
    }

    if (target){
      state.lostT = null;
      cx = target.cx; cy = target.cy; // centroide del blob elegido (respaldo)

      if (state.trackMode === 'flow' && state.grayPrev){
        flow.update(state.grayPrev, gray, target.bbox);
        const m = flow.mean();
        if (m){ cx = m.cx; cy = m.cy; } // promedio de puntos seguidos: más estable
        readout.ptCount(flow.points.length + ' pts');
      }

      // posición en el plano real si la corrección de perspectiva está activa
      const usingPersp = state.perspectiveOn && state.perspective;
      const worldPos = usingPersp ? applyHomography(state.perspective.H, cx, cy) : null;

      // el Kalman opera en px o en metros según el modo; si el espacio
      // cambió de un frame al otro, reiniciar para no mezclar escalas
      if (usingPersp !== state.usingPerspLast){ kalman.reset(); state.usingPerspLast = usingPersp; }

      // velocidad continua (secundaria) — suavizada por Kalman en vez de EMA:
      // reacciona a un cambio real de velocidad más rápido que una media
      // móvil, sin dejar de promediar el ruido de una medición puntual mala.
      // La detección de cruce (abajo) sigue usando la posición cruda, sin
      // este suavizado, para no perder precisión en la interpolación sub-frame.
      if (state.prevT){
        const dt = (now - state.prevT)/1000;
        const posX = worldPos ? worldPos.x : cx, posY = worldPos ? worldPos.y : cy;
        const k = kalman.update(posX, posY, dt);
        const speedPerSec = Math.hypot(k.vx, k.vy);
        state.continuousSpeed = worldPos ? speedPerSec * 3.6 : pxPerSecToReal(speedPerSec, fov(), W, unit());
      }
      state.prevT = now;

      // máquina de estados del cruce (pausada durante calibración)
      if (!state.calibMode){
        if (worldPos){
          const fxWorld = worldPos.x / state.perspective.lengthM;
          handleCrossEvent(crossing.update(fxWorld, now, 0, 1), state.perspective.lengthM, 'm');
        } else {
          handleCrossEvent(
            crossing.update(cx / W, now, state.lineA, state.lineB),
            roiDistance(state.lineA, state.lineB, fov()), unit(),
          );
        }
      }
    } else {
      state.continuousSpeed *= 0.85;
      if (state.continuousSpeed < 0.05){ state.continuousSpeed = 0; kalman.reset(); }
      // si el objeto desapareció, olvidar su última posición tras 0.5s
      // (evita "cruces" falsos cuando reaparece en otro lado)
      if (state.lostT === null) state.lostT = now;
      if (now - state.lostT > 500) crossing.forgetPosition();
      // si desapareció a mitad del cruce, desarmar tras 1.5s
      if (crossing.state === 'timing' && now - crossing.t0 > 1500) resetCross();
      // sin objeto no hay nada válido para seguir: descartar puntos viejos
      if (flow.points.length){
        flow.clear();
        readout.ptCount(state.trackMode === 'flow' ? '0 pts' : '—');
      }
    }

    readout.continuous(state.continuousSpeed);
    state.history.push(state.continuousSpeed); state.history.shift();
    overlay.drawChart(cctx, chart.width, chart.height, state.history);
  }

  state.prev = frame.slice(0);
  state.grayPrev = gray;
  drawFrame(cx, cy);
}

// ---------- Calibración ----------
function updateRoiDist(){
  readout.roiDist(roiDistance(state.lineA, state.lineB, fov()), unit());
}
function segFrac(){
  const aspect = overlayCanvas.width ? overlayCanvas.height / overlayCanvas.width : 0.75;
  return segmentLengthFrac(state.calP1, state.calP2, aspect);
}
function updateCalibInfo(){
  const fieldCm = fieldWidthFromReference(refSizeCm(), segFrac());
  readout.calibInfo('La barra mide ' + fmtCm(refSizeCm()) + ' cm → campo visible: ' + fieldCm.toFixed(1) + ' cm');
}
function updateScenarioHint(){
  const scen = SCENARIOS[state.scenario];
  let txt = scen.hint;
  if (state.scenario === 'calle'){
    const span40 = recommendedRoiSpanM(40).toFixed(1);
    const span100 = recommendedRoiSpanM(100).toFixed(1);
    txt += ` Separación A–B recomendada: ≥${span40} m para tránsito urbano (~40 km/h), `
         + `≥${span100} m para ruta (~100 km/h).`;
  }
  readout.scenarioHint(txt);
}
function exitCalib(){
  state.calibMode = false;
  controls.setCalibPanelVisible(false);
  resetCross();
  if (!state.running) drawFrame(null, null);
}

// ---------- Corrección de perspectiva (homografía de 4 puntos) ----------
// Puntos marcados (fracción de encuadre) → espacio de píxeles del buffer de
// proceso, mismo sistema de coordenadas que usan los centroides de blobs.
function perspSrcPx(){
  return state.perspPoints.map(p => ({ x: p.x * W, y: p.y * cam.H }));
}
function perspDstM(widthM, lengthM){
  // orden: cerca-izq(0,0), cerca-der(0,ancho), lejos-der(largo,ancho), lejos-izq(largo,0)
  return [
    { x: 0, y: 0 }, { x: 0, y: widthM },
    { x: lengthM, y: widthM }, { x: lengthM, y: 0 },
  ];
}
function computePersp(){
  const widthM = parseFloat($('perspWidth').value) || 3.5;
  const lengthM = parseFloat($('perspLength').value) || 10;
  const H = computeHomography(perspSrcPx(), perspDstM(widthM, lengthM));
  if (!H) return null;
  const Hinv = invertHomography(H);
  if (!Hinv) return null;
  return { H, Hinv, widthM, lengthM };
}
function updatePerspPreview(){
  state.perspPreview = computePersp();
  readout.perspInfo(state.perspPreview
    ? `Plano: ${state.perspPreview.widthM} × ${state.perspPreview.lengthM} m — listo para aplicar`
    : 'Ajustá las 4 esquinas: no forman un rectángulo válido');
  if (!state.running) drawFrame(null, null);
}
function exitPersp(){
  state.perspMode = false;
  controls.setPerspPanelVisible(false);
  if (!state.running) drawFrame(null, null);
}

// ---------- Botones y arrastre ----------
controls.setupPointerDrag(wrap, state, {
  linesChanged(){ updateRoiDist(); if (!state.running) drawFrame(null, null); },
  calibChanged(){ updateCalibInfo(); if (!state.running) drawFrame(null, null); },
  dragEnd(){ resetCross(); },
  blobTap(fx, fy){
    if (state.calibMode || state.perspMode) return;
    state.selectedBlobId = blobTracker.hitTest(fx, fy, W, cam.H);
  },
  perspChanged(){ updatePerspPreview(); },
});

controls.setupButtons({
  async start(){
    if (state.running){
      state.running = false;
      controls.setStartButton(false);
      readout.status('PAUSADO', false);
      return;
    }
    try {
      await openCamera(video);
      if (cam.setup(video)){ state.prev = null; flow = new FlowTracker(W, cam.H); }
      requestAnimationFrame(sizeCanvases);
      state.running = true;
      state.prev = null; state.grayPrev = null; state.prevT = null;
      flow.clear();
      blobTracker.reset();
      kalman.reset();
      state.usingPerspLast = false;
      state.selectedBlobId = null;
      state.lastBlobs = [];
      resetCross();
      controls.setStartButton(true);
      readout.status('● MIDIENDO', true);
      loop();
    } catch(e){
      readout.status('SIN PERMISO DE CÁMARA', false);
      alert('No se pudo acceder a la cámara: ' + e.message);
    }
  },

  reset(){
    state.maxCross = 0;
    readout.resetMeasurements();
    resetCross();
  },

  setMode(m){
    state.trackMode = m;
    controls.setModeUI(m);
    flow.clear();
    readout.ptCount(m === 'flow' ? '0 pts' : '—');
  },

  setScenario(s){
    state.scenario = s;
    const scen = SCENARIOS[s];
    controls.setScenarioUI(s);
    readout.scenarioLabel(s === 'mesa' ? 'objeto chico, cerca' : 'vehículo, cámara fija');
    controls.populateRefPresets(scen.presets);
    $('unitSel').value = scen.unit;
    $('fov').value = scen.defaultFov;
    readout.unitLabel(scen.unit);
    updateRoiDist();
    updateCalibInfo();
    updateScenarioHint();
  },

  fovInput(){ updateRoiDist(); },
  unitChange(){ updateRoiDist(); readout.unitLabel(unit()); },

  calibOpen(){
    if (!video.videoWidth){
      alert('Primero iniciá la cámara, después calibrá.');
      return;
    }
    if (state.perspMode) exitPersp();
    state.calibMode = true;
    controls.setCalibPanelVisible(true);
    readout.roiState('📐 CALIBRANDO — alineá la barra con el objeto', 'timing');
    updateCalibInfo();
    if (!state.running) drawFrame(null, null);
  },

  calibDetect(){
    if (!video.videoWidth || !cam.width) return;
    const rgba = cam.grab(video);
    const r = largestBrightRegion(rgba, W, cam.H);
    if (!r){
      readout.calibInfo('No detecté un objeto claro contra el fondo — acomodá la barra a mano.');
      return;
    }
    const cy = (r.minY + r.maxY + 1) / 2 / cam.H;
    state.calP1.x = r.minX / W;        state.calP1.y = cy;
    state.calP2.x = (r.maxX + 1) / W;  state.calP2.y = cy;
    updateCalibInfo();
    if (!state.running) drawFrame(null, null);
  },

  calibApply(){
    const fieldCm = fieldWidthFromReference(refSizeCm(), segFrac());
    const isM = unit() === 'm';
    $('fov').value = isM ? (fieldCm/100).toFixed(2) : fieldCm.toFixed(1);
    updateRoiDist();
    exitCalib();
  },

  calibCancel(){ exitCalib(); },

  refChange(){
    $('refCustom').hidden = $('refSel').value !== 'custom';
    updateCalibInfo();
  },
  refCustomInput(){ updateCalibInfo(); },

  setMeas(mode){
    if (mode === 'plano' && !state.perspective){
      // nada aplicado todavía: abrir el marcado en vez de "activar" nada
      this.perspOpen();
      return;
    }
    state.perspectiveOn = mode === 'plano';
    controls.setMeasUI(mode);
  },

  perspOpen(){
    if (!video.videoWidth){
      alert('Primero iniciá la cámara, después marcá el plano.');
      return;
    }
    if (state.calibMode) exitCalib();
    state.perspMode = true;
    controls.setPerspPanelVisible(true);
    updatePerspPreview();
    if (!state.running) drawFrame(null, null);
  },

  perspApply(){
    const calc = computePersp();
    if (!calc){
      readout.perspInfo('Ajustá las 4 esquinas: no forman un rectángulo válido.');
      return;
    }
    state.perspective = calc;
    state.perspectiveOn = true;
    controls.setMeasUI('plano');
    readout.perspStatusLabel(`plano ${calc.widthM}×${calc.lengthM} m`);
    exitPersp();
  },

  perspCancel(){ exitPersp(); },
  perspDimsInput(){ updatePerspPreview(); },

  exportCsv(){
    if (!log.length) return;
    const blob = new Blob([toCSV(log)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `radar-mediciones-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  clearLog(){
    if (log.length && !confirm('¿Borrar las ' + log.length + ' mediciones guardadas?')) return;
    log = [];
    storage.clearLog();
    history.render(log);
  },
});

// ---------- Arranque ----------
controls.populateRefPresets(SCENARIOS[state.scenario].presets);
updateRoiDist();
updateScenarioHint();
history.render(log);
sizeCanvases();

setupInstallBanner($('installBanner'), $('installBtn'), $('installDismiss'));
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
