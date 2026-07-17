// Interacción: arrastre de líneas A/B y de la barra de calibración sobre el
// video, más el cableado de botones y toggles. Todo vía callbacks: este
// módulo no conoce el estado de la app, solo lo notifica.

const $ = id => document.getElementById(id);

// state: {lineA, lineB, calibMode, calP1, calP2, perspMode, perspPoints}
// (leído en vivo del llamador)
// on: {linesChanged, calibChanged, dragEnd, blobTap?, perspChanged}
// blobTap(fx, fy) se dispara con un toque que no arrastró ninguna línea ni la
// barra de calibración — se interpreta como "elegí este objeto para medir".
export function setupPointerDrag(wrap, state, on){
  let dragging = null;  // 'A' | 'B'
  let calDrag = null;   // referencia a calP1/calP2
  let perspDrag = null; // referencia a uno de los 4 state.perspPoints
  let tap = null;       // {fx, fy} de un pointerdown que podría ser un toque

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
    if (state.perspMode){
      let best = null, bestD = Infinity;
      for (const p of state.perspPoints){
        const d = Math.hypot(fx - p.x, fy - p.y);
        if (d < bestD){ bestD = d; best = p; }
      }
      if (bestD < 0.15){
        perspDrag = best;
        wrap.setPointerCapture(e.pointerId);
      }
      return;
    }
    const dA = Math.abs(fx - state.lineA), dB = Math.abs(fx - state.lineB);
    if (Math.min(dA, dB) < 0.12){
      dragging = dA < dB ? 'A' : 'B';
      wrap.setPointerCapture(e.pointerId);
    } else if (on.blobTap){
      tap = { fx, fy };
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
    if (perspDrag){
      perspDrag.x = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width));
      perspDrag.y = Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height));
      on.perspChanged();
      return;
    }
    if (dragging){
      const fx = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width));
      if (dragging === 'A') state.lineA = fx; else state.lineB = fx;
      on.linesChanged();
      return;
    }
    if (tap){
      const r2 = wrap.getBoundingClientRect();
      const fx = (e.clientX - r2.left) / r2.width, fy = (e.clientY - r2.top) / r2.height;
      if (Math.hypot(fx - tap.fx, fy - tap.fy) > 0.02) tap = null; // se movió: no es un toque
    }
  });

  wrap.addEventListener('pointerup', () => {
    if (calDrag){ calDrag = null; return; }
    if (perspDrag){ perspDrag = null; return; }
    if (dragging){ dragging = null; on.dragEnd(); return; }
    if (tap){ on.blobTap(tap.fx, tap.fy); tap = null; }
  });
}

// handlers: {start, reset, setMode, setScenario, fovInput, unitChange,
//            calibOpen, calibDetect, calibApply, calibCancel,
//            refChange, refCustomInput,
//            setMeas, perspOpen, perspApply, perspCancel, perspDimsInput,
//            exportCsv, clearLog}
export function setupButtons(handlers){
  $('startBtn').onclick = handlers.start;
  $('resetBtn').onclick = handlers.reset;
  $('modeDiff').onclick = () => handlers.setMode('diff');
  $('modeFlow').onclick = () => handlers.setMode('flow');
  $('scenMesa').onclick = () => handlers.setScenario('mesa');
  $('scenCalle').onclick = () => handlers.setScenario('calle');
  $('fov').oninput = handlers.fovInput;
  $('unitSel').onchange = handlers.unitChange;
  $('calibBtn').onclick = handlers.calibOpen;
  $('calDetect').onclick = handlers.calibDetect;
  $('calApply').onclick = handlers.calibApply;
  $('calCancel').onclick = handlers.calibCancel;
  $('refSel').onchange = handlers.refChange;
  $('refCustom').oninput = handlers.refCustomInput;
  $('measFov').onclick = () => handlers.setMeas('fov');
  $('measPlano').onclick = () => handlers.setMeas('plano');
  $('perspBtn').onclick = handlers.perspOpen;
  $('perspApply').onclick = handlers.perspApply;
  $('perspCancel').onclick = handlers.perspCancel;
  $('perspWidth').oninput = handlers.perspDimsInput;
  $('perspLength').oninput = handlers.perspDimsInput;
  $('exportCsvBtn').onclick = handlers.exportCsv;
  $('clearLogBtn').onclick = handlers.clearLog;
}

export function setModeUI(mode){
  $('modeDiff').classList.toggle('active', mode === 'diff');
  $('modeFlow').classList.toggle('active', mode === 'flow');
}

export function setScenarioUI(scenario){
  $('scenMesa').classList.toggle('active', scenario === 'mesa');
  $('scenCalle').classList.toggle('active', scenario === 'calle');
}

// Repuebla el <select> de objetos de referencia con los presets del
// escenario activo, siempre terminando en la opción "Otro…" (tamaño libre).
export function populateRefPresets(presets){
  const sel = $('refSel');
  sel.innerHTML = '';
  for (const p of presets){
    const opt = document.createElement('option');
    opt.value = p.cm;
    opt.textContent = p.label;
    sel.appendChild(opt);
  }
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'Otro…';
  sel.appendChild(custom);
}

export function setCalibPanelVisible(open){
  $('calibPanel').hidden = !open;
  $('calibBtn').hidden = open;
}

export function setMeasUI(mode){
  $('measFov').classList.toggle('active', mode === 'fov');
  $('measPlano').classList.toggle('active', mode === 'plano');
}

export function setPerspPanelVisible(open){
  $('perspPanel').hidden = !open;
  $('perspBtn').hidden = open;
}

export function setStartButton(running){
  $('startBtn').textContent = running ? '⏸ PAUSAR' : '▶ INICIAR';
}
