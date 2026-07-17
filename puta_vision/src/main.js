// Wiring de la app: junta los módulos core (lógica pura) con la capa UI.
// Todo el estado mutable de la aplicación vive acá.

import { toGray, frameDiff, largestBrightRegion } from './core/diff.js';
import { CrossingTracker } from './core/crossing.js';
import {
  segmentLengthFrac, fieldWidthFromReference, roiDistance,
  crossSpeed, pxPerSecToReal,
} from './core/calibration.js';
import { FlowTracker } from './core/flow.js';
import { W, openCamera, createProcessor } from './ui/camera.js';
import * as overlay from './ui/overlay.js';
import * as readout from './ui/readout.js';
import * as controls from './ui/controls.js';

const $ = id => document.getElementById(id);
const video = $('video');
const wrap = $('videoWrap');
const overlayCanvas = $('overlay');
const octx = overlayCanvas.getContext('2d');
const chart = $('chart');
const cctx = chart.getContext('2d');

const cam = createProcessor();
const crossing = new CrossingTracker();
let flow = new FlowTracker(W, cam.H);

const state = {
  running: false,
  trackMode: 'flow',        // 'diff' | 'flow'
  lineA: 0.30, lineB: 0.70,
  calibMode: false,
  calP1: {x:0.30, y:0.55}, calP2: {x:0.70, y:0.55},
  maxCross: 0,
  ema: 0,
  history: new Array(120).fill(0),
  frames: 0, lastFpsT: performance.now(),
  prev: null, grayPrev: null,
  prevCx: null, prevCy: null, prevT: null,
  lostT: null,
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
  overlay.drawLines(octx, w, h, state.lineA, state.lineB, crossing.state === 'timing');
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

function handleCrossEvent(ev){
  if (!ev) return;
  if (ev.type === 'armed'){
    readout.roiState('⏱ CRONOMETRANDO ' + ev.dir, 'timing');
  } else if (ev.type === 'measured'){
    const v = crossSpeed(roiDistance(state.lineA, state.lineB, fov()), ev.dtSec, unit());
    readout.measurement(v, ev.dtSec);
    if (v > state.maxCross){ state.maxCross = v; readout.max(v); }
    readout.roiState('✓ MEDIDO — listo para el próximo', 'done');
  } else if (ev.type === 'timeout'){
    readout.roiState('ESPERANDO OBJETO', '');
  }
  // 'discarded': ruido, sin cambio visible
}

// ---------- Loop principal ----------
function loop(){
  if (!state.running) return;
  requestAnimationFrame(loop);

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
    const d = frameDiff(frame, state.prev, W, cam.H);
    const minPix = W * cam.H * 0.005;

    if (d.n > minPix){
      state.lostT = null;
      cx = d.cx; cy = d.cy; // centroide de diferencia de frames (respaldo)

      let flowPxPerSec = null;
      if (state.trackMode === 'flow' && state.grayPrev){
        flow.update(state.grayPrev, gray, d.bbox);
        const m = flow.mean();
        if (m){
          cx = m.cx; cy = m.cy; // promedio de puntos seguidos: más estable
          if (state.prevT) flowPxPerSec = Math.hypot(m.du, m.dv) / ((now - state.prevT)/1000);
        }
        readout.ptCount(flow.points.length + ' pts');
      }

      // velocidad continua (secundaria)
      if (state.prevT){
        const dt = (now - state.prevT)/1000;
        const pxPerSec = flowPxPerSec !== null ? flowPxPerSec
          : (state.prevCx !== null ? Math.hypot(cx-state.prevCx, cy-state.prevCy) / dt : 0);
        const real = pxPerSecToReal(pxPerSec, fov(), W, unit());
        state.ema = state.ema*0.6 + real*0.4;
      }
      state.prevCx = cx; state.prevCy = cy; state.prevT = now;

      // máquina de estados del cruce (pausada durante calibración)
      if (!state.calibMode){
        handleCrossEvent(crossing.update(cx / W, now, state.lineA, state.lineB));
      }
    } else {
      state.ema *= 0.85;
      if (state.ema < 0.05){ state.ema = 0; state.prevCx = null; }
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

    readout.continuous(state.ema);
    state.history.push(state.ema); state.history.shift();
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
function exitCalib(){
  state.calibMode = false;
  controls.setCalibPanelVisible(false);
  resetCross();
  if (!state.running) drawFrame(null, null);
}

// ---------- Botones y arrastre ----------
controls.setupPointerDrag(wrap, state, {
  linesChanged(){ updateRoiDist(); if (!state.running) drawFrame(null, null); },
  calibChanged(){ updateCalibInfo(); if (!state.running) drawFrame(null, null); },
  dragEnd(){ resetCross(); },
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
      state.prev = null; state.grayPrev = null;
      state.prevCx = null; state.prevT = null;
      flow.clear();
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

  fovInput(){ updateRoiDist(); },
  unitChange(){ updateRoiDist(); readout.unitLabel(unit()); },

  calibOpen(){
    if (!video.videoWidth){
      alert('Primero iniciá la cámara, después calibrá.');
      return;
    }
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
});

// ---------- Arranque ----------
updateRoiDist();
sizeCanvases();
