// Selección de scheduler para el loop de captura (SPEC F6). requestVideoFrameCallback
// (rVFC) dispara en sincronía con cada frame decodificado del <video>, no con el
// refresco de pantalla como requestAnimationFrame (rAF) — en dispositivos que lo
// soportan (Chrome/Android) da FPS de análisis más altos y estables, evitando
// procesar el mismo frame de video dos veces o saltarse uno. Sin rVFC (Safari
// viejo, algunos WebViews) cae a rAF, que es el comportamiento previo a F6.
//
// `video` y `raf` se reciben como parámetros (en vez de leer `window`/`document`
// directo) para que este módulo siga siendo lógica pura testeable en Node, sin
// DOM real: los tests le pasan objetos simples con la misma forma.

export function supportsVideoFrameCallback(video){
  return !!(video && typeof video.requestVideoFrameCallback === 'function');
}

// Devuelve un scheduler con `schedule(cb)`: programa `cb` en el próximo frame
// disponible con la mejor API que exista, y `cancel()` para detener lo
// programado (usa el mismo mecanismo de cancelación que la API elegida).
export function createScheduler(video, raf, caf){
  const useRVFC = supportsVideoFrameCallback(video);
  let handle = null;
  return {
    useRVFC,
    schedule(cb){
      handle = useRVFC
        ? video.requestVideoFrameCallback(() => cb())
        : raf(() => cb());
    },
    cancel(){
      if (handle === null) return;
      if (useRVFC) video.cancelVideoFrameCallback(handle);
      else if (caf) caf(handle);
      handle = null;
    },
  };
}
