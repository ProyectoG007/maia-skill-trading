// Dibujo sobre el video (líneas A/B, barra de calibración, puntos de flow,
// retículo) y el gráfico de historial. Solo canvas: recibe todo por parámetro.

import { applyHomography } from '../core/homography.js';

export function drawLines(ctx, w, h, lineA, lineB, timing){
  [[lineA,'A'],[lineB,'B']].forEach(([f,name])=>{
    const x = f * w;
    ctx.strokeStyle = timing ? 'rgba(255,180,84,.95)' : 'rgba(95,212,196,.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10,8]);
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
    ctx.setLineDash([]);
    // etiqueta
    ctx.fillStyle = timing ? '#ffb454' : '#5fd4c4';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(name, x+6, 22);
    // manija de arrastre
    ctx.beginPath(); ctx.arc(x, h-24, 12, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(22,29,39,.9)'; ctx.fill();
    ctx.strokeStyle = timing ? '#ffb454' : '#5fd4c4'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = timing ? '#ffb454' : '#5fd4c4';
    ctx.fillText('⇔', x-8, h-18);
  });
}

export function drawCalibBar(ctx, w, h, p1, p2, label){
  const x1 = p1.x*w, y1 = p1.y*h, x2 = p2.x*w, y2 = p2.y*h;
  ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  [[x1,y1],[x2,y2]].forEach(([x,y])=>{
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(22,29,39,.85)'; ctx.fill();
    ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#ffb454'; ctx.fill();
  });
  ctx.fillStyle = '#ffb454'; ctx.font = 'bold 14px monospace';
  ctx.fillText(label, (x1+x2)/2 - ctx.measureText(label).width/2, Math.min(y1,y2) - 12);
}

// Cuadrilátero de 4 puntos (fracción de encuadre 0..1) que el usuario ajusta
// sobre un rectángulo real conocido, con manijas de arrastre en cada esquina.
export function drawPerspQuad(ctx, w, h, points){
  ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = p.x*w, y = p.y*h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath(); ctx.stroke();
  points.forEach(p => {
    const x = p.x*w, y = p.y*h;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(22,29,39,.85)'; ctx.fill();
    ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 2; ctx.stroke();
  });
}

// Grilla de verificación cada metro sobre el plano real marcado, proyectada
// de vuelta a la imagen con la inversa de la homografía — si el cuadrado
// está bien calibrado, se ve como una grilla de perspectiva prolija sobre
// la calzada real; si está torcida, delata que hay que reajustar el plano.
export function drawPerspGrid(ctx, w, h, Hinv, widthM, lengthM, procW, procH){
  if (!Hinv) return;
  const toScreen = (X, Y) => {
    const p = applyHomography(Hinv, X, Y);
    return p ? { x: p.x/procW*w, y: p.y/procH*h } : null;
  };
  const seg = (x1, y1, x2, y2) => {
    const a = toScreen(x1, y1), b = toScreen(x2, y2);
    if (!a || !b) return;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };
  ctx.strokeStyle = 'rgba(95,212,196,.55)'; ctx.lineWidth = 1;
  for (let x = 0; x <= lengthM + 1e-9; x++) seg(x, 0, x, widthM);
  for (let y = 0; y <= widthM + 1e-9; y++) seg(0, y, lengthM, y);
}

// Recuadros de todos los objetos en movimiento detectados este frame; el
// seleccionado (measuredId) se resalta en ámbar y grosor mayor, el resto en
// cian tenue — así se ve qué se está midiendo y qué se está ignorando.
export function drawBlobs(ctx, w, h, blobs, selectedId, procW, procH){
  for (const b of blobs){
    const selected = b.id === selectedId;
    const x = b.bbox.minX/procW*w, y = b.bbox.minY/procH*h;
    const bw = (b.bbox.maxX - b.bbox.minX + 1)/procW*w;
    const bh = (b.bbox.maxY - b.bbox.minY + 1)/procH*h;
    ctx.strokeStyle = selected ? 'rgba(255,180,84,.9)' : 'rgba(95,212,196,.5)';
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.strokeRect(x, y, bw, bh);
  }
}

export function drawFlowPoints(ctx, w, h, points, procW, procH){
  ctx.fillStyle = 'rgba(95,212,196,.8)';
  for (const p of points){
    ctx.beginPath();
    ctx.arc(p.x/procW*w, p.y/procH*h, 2.5, 0, Math.PI*2);
    ctx.fill();
  }
}

export function drawCrosshair(ctx, w, h, cx, cy, procW, procH){
  const x = cx/procW*w, y = cy/procH*h;
  ctx.strokeStyle = '#ffb454'; ctx.fillStyle = 'rgba(255,180,84,.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,16,0,Math.PI*2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x-26,y); ctx.lineTo(x-18,y); ctx.moveTo(x+18,y); ctx.lineTo(x+26,y);
  ctx.moveTo(x,y-26); ctx.lineTo(x,y-18); ctx.moveTo(x,y+18); ctx.lineTo(x,y+26);
  ctx.stroke();
}

export function drawChart(ctx, w, h, history){
  ctx.clearRect(0, 0, w, h);
  const peak = Math.max(...history, 1);
  ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 3; ctx.beginPath();
  history.forEach((val,i)=>{
    const x = i/(history.length-1)*w;
    const y = h - (val/peak)*(h-14) - 6;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();
}
