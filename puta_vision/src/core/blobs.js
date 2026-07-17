// Segmentación de píxeles en movimiento en objetos individuales (blobs) y
// seguimiento de identidad entre frames. Lógica pura: sin DOM, sin canvas.
// Habilita medir un objeto específico entre varios que se mueven a la vez,
// en vez de promediar todo en un único centroide confuso (ver SPEC F2).

// Encuentra todas las componentes conexas de píxeles en movimiento (BFS
// 4-conexo sobre la diferencia de frames) y descarta las menores a
// `minAreaFrac` del área total — el mismo filtro de tamaño que antes se
// aplicaba a un único centroide global, ahora por objeto.
export function segmentBlobs(cur, prev, W, H, { threshold = 84, minAreaFrac = 0.005 } = {}){
  const N = W*H;
  const moving = new Uint8Array(N);
  for (let i=0, p=0; i<cur.length; i+=4, p++){
    const d = Math.abs(cur[i]-prev[i]) + Math.abs(cur[i+1]-prev[i+1]) + Math.abs(cur[i+2]-prev[i+2]);
    if (d > threshold) moving[p] = 1;
  }

  const minPix = minAreaFrac * N;
  const seen = new Uint8Array(N);
  const qx = new Int32Array(N), qy = new Int32Array(N);
  const blobs = [];

  for (let p0=0; p0<N; p0++){
    if (seen[p0] || !moving[p0]) continue;
    let head=0, tail=0, n=0, sx=0, sy=0, minX=W, maxX=0, minY=H, maxY=0;
    seen[p0] = 1; qx[tail] = p0 % W; qy[tail] = (p0 / W) | 0; tail++;
    while (head < tail){
      const x = qx[head], y = qy[head]; head++; n++;
      sx += x; sy += y;
      if (x<minX)minX=x; if (x>maxX)maxX=x;
      if (y<minY)minY=y; if (y>maxY)maxY=y;
      if (x>0   && !seen[y*W+x-1] && moving[y*W+x-1]){ seen[y*W+x-1]=1; qx[tail]=x-1; qy[tail]=y; tail++; }
      if (x<W-1 && !seen[y*W+x+1] && moving[y*W+x+1]){ seen[y*W+x+1]=1; qx[tail]=x+1; qy[tail]=y; tail++; }
      if (y>0   && !seen[(y-1)*W+x] && moving[(y-1)*W+x]){ seen[(y-1)*W+x]=1; qx[tail]=x; qy[tail]=y-1; tail++; }
      if (y<H-1 && !seen[(y+1)*W+x] && moving[(y+1)*W+x]){ seen[(y+1)*W+x]=1; qx[tail]=x; qy[tail]=y+1; tail++; }
    }
    if (n >= minPix){
      blobs.push({ cx:sx/n, cy:sy/n, n, bbox:{minX, maxX, minY, maxY} });
    }
  }
  return blobs;
}

// Asigna identidad estable a los blobs entre frames por cercanía de
// centroide (matching voraz por distancia ascendente). Un blob que
// desaparece pierde su id: si algo reaparece en el mismo lugar más tarde,
// sin un blob rastreado en el medio con el que emparejar, recibe un id
// nuevo — no hay "fantasmas" que reconecten across un hueco.
export class BlobTracker {
  constructor({ maxMatchDist = 15 } = {}){
    this.maxMatchDist = maxMatchDist;
    this.nextId = 1;
    this.tracked = [];
  }

  update(blobs){
    const pairs = [];
    for (const t of this.tracked){
      for (let i=0; i<blobs.length; i++){
        const d = Math.hypot(t.cx - blobs[i].cx, t.cy - blobs[i].cy);
        if (d <= this.maxMatchDist) pairs.push({ t, i, d });
      }
    }
    pairs.sort((a, b) => a.d - b.d);

    const usedT = new Set(), usedB = new Set();
    const next = [];
    for (const p of pairs){
      if (usedT.has(p.t) || usedB.has(p.i)) continue;
      usedT.add(p.t); usedB.add(p.i);
      next.push({ id: p.t.id, ...blobs[p.i] });
    }
    for (let i=0; i<blobs.length; i++){
      if (usedB.has(i)) continue;
      next.push({ id: this.nextId++, ...blobs[i] });
    }

    this.tracked = next;
    return this.tracked;
  }

  // Id del blob rastreado cuyo bbox contiene el punto (fx,fy en fracción de
  // encuadre 0..1), o null si el punto cae fuera de todos. Se usa para que
  // el usuario elija tocando el video cuál objeto medir.
  hitTest(fx, fy, W, H){
    const x = fx * W, y = fy * H;
    for (const b of this.tracked){
      if (x >= b.bbox.minX && x <= b.bbox.maxX && y >= b.bbox.minY && y <= b.bbox.maxY) return b.id;
    }
    return null;
  }

  get(id){
    return this.tracked.find(b => b.id === id) || null;
  }

  // Olvida todo lo rastreado (usar al reiniciar la cámara: ids viejos no
  // deberían "engancharse" a objetos nuevos tras una pausa).
  reset(){
    this.tracked = [];
  }

  // El blob más grande del frame actual, o null si no hay ninguno.
  // Selección automática por defecto cuando no hay nada elegido a mano.
  largest(){
    return this.tracked.reduce((best, b) => (!best || b.n > best.n) ? b : best, null);
  }
}
