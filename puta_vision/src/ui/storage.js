// Persistencia del registro de mediciones en localStorage. Las fotos en
// base64 pesan; si se excede la cuota, se reintenta sin las fotos de las
// entradas más viejas antes de resignarse a no persistir ese guardado.

const KEY = 'radar_log_v1';
const KEEP_PHOTOS = 5; // conservar la foto solo de las N mediciones más recientes

export function loadLog(){
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLog(log){
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
    return true;
  } catch {
    try {
      const stripped = log.map((e, i) => i < KEEP_PHOTOS ? e : { ...e, photoDataUrl: null });
      localStorage.setItem(KEY, JSON.stringify(stripped));
      return true;
    } catch {
      return false; // sigue en memoria para esta sesión, no persistido
    }
  }
}

export function clearLog(){
  try { localStorage.removeItem(KEY); } catch { /* nada más que hacer */ }
}
