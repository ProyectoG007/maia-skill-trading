// Optical flow disperso (Lucas-Kanade iterativo Gauss-Newton, con pirámide
// de 2 niveles). Lógica pura: opera sobre buffers de luminancia
// (Float32Array) + dimensiones. Sigue puntos de textura individuales entre
// frames en vez de promediar píxeles que cambiaron: más robusto con luz
// variable o fondos con dibujos.

export const FLOW_DEFAULTS = {
  win: 2,           // ventana de (2*win+1)² px alrededor de cada punto
  maxPts: 24,
  minPts: 10,       // por debajo de esto se buscan puntos nuevos
  reseedEvery: 20,  // frames entre refrescos aunque haya puntos de sobra
  minForUse: 4,     // mínimo de puntos válidos para confiar en el promedio
  minDet: 1e-3,     // guarda numérica: matriz no invertible (zona sin textura)
  minCorner: 30,    // autovalor mínimo para aceptar un punto nuevo al sembrar
  minSpacing: 5,    // separación mínima entre puntos sembrados (px)
};

// Muestreo bilinear con clamp a bordes (coordenadas subpíxel).
export function sampleBil(g, W, H, x, y){
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x-x0, fy = y-y0;
  const cx0 = Math.min(W-1,Math.max(0,x0)), cx1 = Math.min(W-1,Math.max(0,x0+1));
  const cy0 = Math.min(H-1,Math.max(0,y0)), cy1 = Math.min(H-1,Math.max(0,y0+1));
  const v00=g[cy0*W+cx0], v10=g[cy0*W+cx1], v01=g[cy1*W+cx0], v11=g[cy1*W+cx1];
  return v00*(1-fx)*(1-fy) + v10*fx*(1-fy) + v01*(1-fx)*fy + v11*fx*fy;
}

// Puntaje "Shi-Tomasi": autovalor menor del tensor de estructura en (x,y).
// Alto en esquinas/textura, cercano a 0 en zonas lisas (problema de apertura).
export function cornerScore(g, W, H, x, y, win = FLOW_DEFAULTS.win){
  let sIx2=0, sIy2=0, sIxIy=0;
  for (let dy=-win; dy<=win; dy++){
    for (let dx=-win; dx<=win; dx++){
      const xx=x+dx, yy=y+dy;
      if (xx<1||xx>W-2||yy<1||yy>H-2) return 0;
      const ix=(g[yy*W+xx+1]-g[yy*W+xx-1])*0.5, iy=(g[(yy+1)*W+xx]-g[(yy-1)*W+xx])*0.5;
      sIx2+=ix*ix; sIy2+=iy*iy; sIxIy+=ix*iy;
    }
  }
  const tr = sIx2+sIy2, det = sIx2*sIy2 - sIxIy*sIxIy;
  return tr/2 - Math.sqrt(Math.max(0, tr*tr/4 - det));
}

// Lucas-Kanade iterativo de un punto entre dos frames. Gradiente espacial
// fijo del frame previo; solo el residuo temporal cambia entre iteraciones
// al refinar el desplazamiento (u,v), arrancando desde la estimación inicial
// (u0,v0) — 0,0 por defecto, o el resultado escalado del nivel grueso de la
// pirámide (ver trackPointPyramid). Devuelve la nueva posición o null si el
// punto no es seguible (sin textura, no converge, o salió del encuadre).
export function trackPoint(gp, gc, W, H, px0, py0, opts = FLOW_DEFAULTS, u0 = 0, v0 = 0){
  const win = opts.win, N = (2*win+1)**2;
  const gx = new Float32Array(N), gy = new Float32Array(N), gv = new Float32Array(N);
  let sIx2=0, sIy2=0, sIxIy=0, idx=0;
  for (let dy=-win; dy<=win; dy++){
    for (let dx=-win; dx<=win; dx++, idx++){
      const x=px0+dx, y=py0+dy;
      const ix=(sampleBil(gp,W,H,x+1,y)-sampleBil(gp,W,H,x-1,y))*0.5;
      const iy=(sampleBil(gp,W,H,x,y+1)-sampleBil(gp,W,H,x,y-1))*0.5;
      gx[idx]=ix; gy[idx]=iy; gv[idx]=sampleBil(gp,W,H,x,y);
      sIx2+=ix*ix; sIy2+=iy*iy; sIxIy+=ix*iy;
    }
  }
  const det = sIx2*sIy2 - sIxIy*sIxIy;
  if (Math.abs(det) < opts.minDet) return null;
  let u=u0, v=v0;
  for (let iter=0; iter<4; iter++){
    let sIxIt=0, sIyIt=0, idx2=0;
    for (let dy=-win; dy<=win; dy++){
      for (let dx=-win; dx<=win; dx++, idx2++){
        const it = sampleBil(gc, W, H, px0+dx+u, py0+dy+v) - gv[idx2];
        sIxIt += gx[idx2]*it; sIyIt += gy[idx2]*it;
      }
    }
    const du = (-sIy2*sIxIt + sIxIy*sIyIt)/det;
    const dv = (sIxIy*sIxIt - sIx2*sIyIt)/det;
    if (!isFinite(du) || !isFinite(dv)) return null;
    u += du; v += dv;
    if (Math.abs(du) < 0.02 && Math.abs(dv) < 0.02) break;
  }
  const nx = px0+u, ny = py0+v;
  if (nx<2 || nx>W-3 || ny<2 || ny>H-3) return null; // salió del encuadre útil
  return { x:nx, y:ny, u, v };
}

// Reduce a la mitad la resolución promediando bloques 2×2 (nivel grueso de
// la pirámide). Bordes impares se clampan al último píxel disponible.
export function downsample2x(g, W, H){
  const W2 = Math.ceil(W/2), H2 = Math.ceil(H/2);
  const out = new Float32Array(W2*H2);
  for (let y=0; y<H2; y++){
    for (let x=0; x<W2; x++){
      const x0=Math.min(2*x,W-1), x1=Math.min(2*x+1,W-1);
      const y0=Math.min(2*y,H-1), y1=Math.min(2*y+1,H-1);
      out[y*W2+x] = (g[y0*W+x0]+g[y0*W+x1]+g[y1*W+x0]+g[y1*W+x1]) / 4;
    }
  }
  return { g: out, W: W2, H: H2 };
}

// Lucas-Kanade de 2 niveles: sigue primero en una versión a mitad de
// resolución (donde el mismo desplazamiento real ocupa la mitad de píxeles,
// así que entra mejor en el radio de convergencia de la linealización) y usa
// ese resultado ×2 como estimación inicial para refinar en la resolución
// completa. Aproximadamente duplica el desplazamiento máximo por frame que
// se puede seguir respecto al LK de una sola escala.
export function trackPointPyramid(gp, gc, W, H, px0, py0, opts = FLOW_DEFAULTS){
  const coarseP = downsample2x(gp, W, H);
  const coarseC = downsample2x(gc, W, H);
  const coarse = trackPoint(coarseP.g, coarseC.g, coarseP.W, coarseP.H, px0/2, py0/2, opts);
  const u0 = coarse ? coarse.u*2 : 0;
  const v0 = coarse ? coarse.v*2 : 0;
  return trackPoint(gp, gc, W, H, px0, py0, opts, u0, v0);
}

// Busca puntos nuevos con buena textura dentro de `bbox` (la zona donde hubo
// movimiento), separados entre sí para no apilarlos en un mismo rincón.
export function seedPoints(gray, W, H, bbox, opts = FLOW_DEFAULTS){
  const x0=Math.max(2,bbox.minX), x1=Math.min(W-3,bbox.maxX);
  const y0=Math.max(2,bbox.minY), y1=Math.min(H-3,bbox.maxY);
  const cands = [];
  for (let y=y0; y<=y1; y+=4){
    for (let x=x0; x<=x1; x+=4){
      const s = cornerScore(gray, W, H, x, y, opts.win);
      if (s > opts.minCorner) cands.push({x, y, s});
    }
  }
  cands.sort((a,b) => b.s - a.s);
  const picked = [];
  for (const c of cands){
    if (picked.length >= opts.maxPts) break;
    if (picked.every(p => Math.hypot(p.x-c.x, p.y-c.y) > opts.minSpacing)) picked.push(c);
  }
  return picked;
}

// Estado del conjunto de puntos rastreados: sigue, resiembra y promedia.
export class FlowTracker {
  constructor(W, H, opts = {}){
    this.W = W; this.H = H;
    this.opts = { ...FLOW_DEFAULTS, ...opts };
    this.points = [];
    this.reseedCounter = 0;
  }

  clear(){
    this.points = [];
    this.reseedCounter = 0;
  }

  // Avanza todos los puntos de gp→gc (LK piramidal) y resiembra si hace falta.
  update(gp, gc, bbox){
    this.points = this.points
      .map(p => trackPointPyramid(gp, gc, this.W, this.H, p.x, p.y, this.opts))
      .filter(Boolean);
    this.reseedCounter++;
    if (this.points.length < this.opts.minPts || this.reseedCounter > this.opts.reseedEvery){
      for (const s of seedPoints(gc, this.W, this.H, bbox, this.opts)){
        if (this.points.length >= this.opts.maxPts) break;
        if (this.points.every(p => Math.hypot(p.x-s.x, p.y-s.y) > this.opts.minSpacing)){
          this.points.push({ x:s.x, y:s.y, u:0, v:0 });
        }
      }
      this.reseedCounter = 0;
    }
  }

  // Posición y desplazamiento promedio de los puntos, o null si hay menos de
  // `minForUse` (el llamador cae a diferencia de frames en ese caso). La
  // velocidad sale de los vectores u,v propios de cada punto — no de restar
  // posiciones promedio entre frames, que se distorsionaría con una resiembra.
  mean(){
    const n = this.points.length;
    if (n < this.opts.minForUse) return null;
    let sx=0, sy=0, su=0, sv=0;
    for (const p of this.points){ sx+=p.x; sy+=p.y; su+=p.u; sv+=p.v; }
    return { cx:sx/n, cy:sy/n, du:su/n, dv:sv/n, count:n };
  }
}
