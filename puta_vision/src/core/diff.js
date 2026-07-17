// Diferencia de frames y utilidades de imagen sobre buffers crudos.
// Lógica pura: sin DOM, sin canvas — recibe arrays RGBA/gris y dimensiones.

// Convierte un buffer RGBA a luminancia (Float32Array de W*H).
export function toGray(rgba, W, H){
  const g = new Float32Array(W*H);
  for (let i=0, p=0; i<rgba.length; i+=4, p++){
    g[p] = rgba[i]*.299 + rgba[i+1]*.587 + rgba[i+2]*.114;
  }
  return g;
}

// Compara dos frames RGBA píxel a píxel (suma de diferencias absolutas RGB
// contra `threshold`) y devuelve cuántos píxeles cambiaron, su centroide y
// el recuadro que los contiene. Sin píxeles en movimiento: n=0 y el resto null.
export function frameDiff(cur, prev, W, H, threshold = 84){
  let sx=0, sy=0, n=0, minX=W, maxX=0, minY=H, maxY=0;
  for (let i=0, p=0; i<cur.length; i+=4, p++){
    const d = Math.abs(cur[i]-prev[i]) + Math.abs(cur[i+1]-prev[i+1]) + Math.abs(cur[i+2]-prev[i+2]);
    if (d > threshold){
      const px = p % W, py = (p / W) | 0;
      sx += px; sy += py; n++;
      if (px<minX) minX=px; if (px>maxX) maxX=px;
      if (py<minY) minY=py; if (py>maxY) maxY=py;
    }
  }
  if (!n) return { n:0, cx:null, cy:null, bbox:null };
  return { n, cx:sx/n, cy:sy/n, bbox:{minX, maxX, minY, maxY} };
}

// Mancha brillante más grande del frame: umbral adaptativo sobre la
// luminancia media (+bias, tope `cap`) y componente conexa más grande por
// BFS 4-conexo. Devuelve su bbox y tamaño, o null si nada supera `minFrac`
// del área. Se usa para detectar el objeto de referencia al calibrar.
export function largestBrightRegion(rgba, W, H, { bias = 45, cap = 235, minFrac = 0.02 } = {}){
  const N = W*H;
  const luma = toGray(rgba, W, H);
  let mean = 0;
  for (let p=0; p<N; p++) mean += luma[p];
  mean /= N;
  const th = Math.min(cap, mean + bias);

  const seen = new Uint8Array(N);
  const qx = new Int32Array(N), qy = new Int32Array(N);
  let best = null;
  for (let p0=0; p0<N; p0++){
    if (seen[p0] || luma[p0] < th) continue;
    let head=0, tail=0, n=0, minX=W, maxX=0, minY=H, maxY=0;
    seen[p0] = 1; qx[tail] = p0 % W; qy[tail] = (p0 / W) | 0; tail++;
    while (head < tail){
      const x = qx[head], y = qy[head]; head++; n++;
      if (x<minX)minX=x; if (x>maxX)maxX=x;
      if (y<minY)minY=y; if (y>maxY)maxY=y;
      if (x>0   && !seen[y*W+x-1] && luma[y*W+x-1]>=th){ seen[y*W+x-1]=1; qx[tail]=x-1; qy[tail]=y; tail++; }
      if (x<W-1 && !seen[y*W+x+1] && luma[y*W+x+1]>=th){ seen[y*W+x+1]=1; qx[tail]=x+1; qy[tail]=y; tail++; }
      if (y>0   && !seen[(y-1)*W+x] && luma[(y-1)*W+x]>=th){ seen[(y-1)*W+x]=1; qx[tail]=x; qy[tail]=y-1; tail++; }
      if (y<H-1 && !seen[(y+1)*W+x] && luma[(y+1)*W+x]>=th){ seen[(y+1)*W+x]=1; qx[tail]=x; qy[tail]=y+1; tail++; }
    }
    if (!best || n > best.n) best = {n, minX, maxX, minY, maxY};
  }
  if (!best || best.n < N*minFrac) return null;
  return best;
}
