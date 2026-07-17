// Cámara y buffer de proceso: getUserMedia + canvas reducido de 120px de
// ancho del que se leen los píxeles que consumen los módulos core.

export const W = 120;

export async function openCamera(video){
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode:'environment', width:{ideal:640}, height:{ideal:480} },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

export function createProcessor(){
  const proc = document.createElement('canvas');
  const pctx = proc.getContext('2d', { willReadFrequently: true });
  return {
    H: 90,
    get width(){ return proc.width; },
    // Ajusta el alto del buffer a la relación de aspecto real del video.
    // Devuelve true si el tamaño cambió (el llamador debe descartar `prev`).
    setup(video){
      const h = Math.round(W * video.videoHeight / video.videoWidth) || 90;
      if (h !== this.H || !proc.width){
        this.H = h; proc.width = W; proc.height = h;
        return true;
      }
      return false;
    },
    // Captura el frame actual del video y devuelve sus píxeles RGBA.
    grab(video){
      pctx.drawImage(video, 0, 0, W, this.H);
      return pctx.getImageData(0, 0, W, this.H).data;
    },
  };
}
