// Renderiza el panel de historial: lista de mediciones con foto-finish.

const $ = id => document.getElementById(id);

function fmtTime(ts){
  return new Date(ts).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

export function render(log){
  const list = $('historyList');
  list.innerHTML = '';
  if (!log.length){
    const empty = document.createElement('div');
    empty.className = 'histEmpty';
    empty.textContent = 'Sin mediciones todavía — cada cruce medido queda acá.';
    list.appendChild(empty);
  } else {
    for (const e of log){
      const row = document.createElement('div');
      row.className = 'histRow';

      const thumb = document.createElement(e.photoDataUrl ? 'img' : 'div');
      thumb.className = 'histThumb';
      if (e.photoDataUrl) thumb.src = e.photoDataUrl;
      else thumb.textContent = '—';

      const info = document.createElement('div');
      info.className = 'histInfo';
      const speed = document.createElement('div');
      speed.className = 'histSpeed';
      speed.textContent = e.speed.toFixed(1) + ' ' + e.unit;
      const meta = document.createElement('div');
      meta.className = 'histMeta';
      meta.textContent = `${fmtTime(e.timestamp)} · ${e.dtSec.toFixed(2)}s · ${e.dir} · ${e.mode.toUpperCase()}`;
      info.appendChild(speed); info.appendChild(meta);

      row.appendChild(thumb); row.appendChild(info);
      list.appendChild(row);
    }
  }
  $('histCount').textContent = log.length + (log.length === 1 ? ' medición guardada' : ' mediciones guardadas');
}
