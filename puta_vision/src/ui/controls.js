// Interacción: arrastre de líneas A/B y de la barra de calibración sobre el
// video, más el cableado de botones y toggles. Todo vía callbacks: este
// módulo no conoce el estado de la app, solo lo notifica.

const $ = id => document.getElementById(id);

// state: {lineA, lineB, calibMode, calP1, calP2} (leído en vivo del llamador)
// on: {linesChanged, calibChanged, dragEnd}
export function setupPointerDrag(wrap, state, on){
  let dragging = null;  // 'A' | 'B'
  let calDrag = null;   // referencia a calP1/calP2

  wrap.addEventListener('pointerdown', e => {
    const r = wrap.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    if (state.calibMode){
      const d1 = Math.hypot(fx - state.calP1.x, fy - state.calP1.y);
      const d2 = Math.hypot(fx - state.calP2.x, fy - state.calP2.y);
      if (Math.min(d1, d2) < 0.15){
        calDrag = d1 < d2 ? state.calP1 : state.calP2;
        wrap.setPointerCapture(e.pointerId);
      }
      return;
    }
    const dA = Math.abs(fx - state.lineA), dB = Math.abs(fx - state.lineB);
    if (Math.min(dA, dB) < 0.12){
      dragging = dA < dB ? 'A' : 'B';
      wrap.setPointerCapture(e.pointerId);
    }
  });

  wrap.addEventListener('pointermove', e => {
    const r = wrap.getBoundingClientRect();
    if (calDrag){
      calDrag.x = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width));
      calDrag.y = Math.min(0.95, Math.max(0.05, (e.clientY - r.top) / r.height));
      on.calibChanged();
      return;
    }
    if (!dragging) return;
    const fx = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width));
    if (dragging === 'A') state.lineA = fx; else state.lineB = fx;
    on.linesChanged();
  });

  wrap.addEventListener('pointerup', () => {
    if (calDrag){ calDrag = null; return; }
    if (dragging){ dragging = null; on.dragEnd(); }
  });
}

// handlers: {start, reset, setMode, fovInput, unitChange,
//            calibOpen, calibDetect, calibApply, calibCancel,
//            refChange, refCustomInput}
export function setupButtons(handlers){
  $('startBtn').onclick = handlers.start;
  $('resetBtn').onclick = handlers.reset;
  $('modeDiff').onclick = () => handlers.setMode('diff');
  $('modeFlow').onclick = () => handlers.setMode('flow');
  $('fov').oninput = handlers.fovInput;
  $('unitSel').onchange = handlers.unitChange;
  $('calibBtn').onclick = handlers.calibOpen;
  $('calDetect').onclick = handlers.calibDetect;
  $('calApply').onclick = handlers.calibApply;
  $('calCancel').onclick = handlers.calibCancel;
  $('refSel').onchange = handlers.refChange;
  $('refCustom').oninput = handlers.refCustomInput;
}

export function setModeUI(mode){
  $('modeDiff').classList.toggle('active', mode === 'diff');
  $('modeFlow').classList.toggle('active', mode === 'flow');
}

export function setCalibPanelVisible(open){
  $('calibPanel').hidden = !open;
  $('calibBtn').hidden = open;
}

export function setStartButton(running){
  $('startBtn').textContent = running ? '⏸ PAUSAR' : '▶ INICIAR';
}
