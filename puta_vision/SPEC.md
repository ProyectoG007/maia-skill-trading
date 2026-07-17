# SPEC — Radar de velocidad: modo vehicular y evolución del sistema

**Estado:** propuesta · **Rama de trabajo:** `claude/puta-vision-velocity-7uwyef`
**Base:** `puta_vision/index.html` v3 (cruce A→B + auto-calibración + optical flow), ya en `main`.
**Demo en vivo:** https://radar-velocidad.vercel.app

---

## 1. Objetivo

Llevar el radar de "objetos sobre una mesa" a **vehículos reales** (auto, moto,
camión) de forma incremental, y de paso reorganizar el código para poder crecer
sin que el archivo único se vuelva inmanejable.

**Recomendación adoptada (Opción 1 del análisis):** el sistema actual ya puede
medir vehículos sin tocar el algoritmo — lo que falta es soporte de *uso* a esa
escala (presets de calibración vehicular, filtro por tamaño de objeto, guía de
encuadre) y después las mejoras de precisión (homografía). Por eso la Fase 1 es
barata y el resto se apila encima.

## 2. Metodología de trabajo

**Primero la lógica, después la interfaz.** Cada feature se desarrolla en dos
pasos estrictos:

1. **Core (el "backend" de esta app):** funciones puras en módulos JS sin DOM,
   sin cámara y sin canvas. Reciben datos (posiciones, timestamps, matrices,
   configuración) y devuelven resultados. Se prueban con `node --test` sin
   navegador. *Una feature no pasa a UI hasta que su core tiene tests verdes.*
2. **UI:** recién con el core probado se conecta la interfaz (botones, overlay,
   lecturas) que consume esas funciones.

Esto ya se validó en la práctica: el fix del cruce y el Lucas-Kanade se
verificaron con pruebas sintéticas en Node antes de deployar. La regla acá lo
vuelve método.

**Definición de "hecho" por feature:** core con tests + UI conectada + probado
con cámara real en celular + README actualizado + deploy en Vercel.

## 3. Estructura de carpetas y archivos (objetivo)

Migración de archivo único → módulos ES nativos (sin bundler ni build: los
navegadores los cargan directo y Vercel los sirve tal cual; se mantiene el
espíritu "cero dependencias").

```
puta_vision/
├── index.html              ← estructura HTML + carga de módulos (fino)
├── styles.css              ← estilos (hoy embebidos en el HTML)
├── src/
│   ├── core/               ← LÓGICA PURA (sin DOM, testeable en Node)
│   │   ├── crossing.js     ← máquina de estados A→B, crossTime, interpolación
│   │   ├── calibration.js  ← escala px→unidades, presets, campo desde referencia
│   │   ├── flow.js         ← Lucas-Kanade: cornerScore, trackPoint, seed/update
│   │   ├── diff.js         ← diferencia de frames, centroide, bbox de movimiento
│   │   ├── blobs.js        ← [F2] componentes conexas + filtro por tamaño
│   │   ├── homography.js   ← [F3] matriz 4-puntos → plano, aplicar/invertir
│   │   ├── kalman.js       ← [F5] filtro 1D/2D para suavizar trayectoria
│   │   └── log.js          ← [F4] historial de mediciones, serialización CSV
│   ├── ui/
│   │   ├── camera.js       ← getUserMedia, canvas de proceso, loop de frames
│   │   ├── overlay.js      ← dibujo: líneas, retículo, puntos flow, cuadrilátero
│   │   ├── controls.js     ← botones, toggles, arrastre (pointer events)
│   │   └── readout.js      ← números, estado, gráfico de historial
│   └── main.js             ← wiring: junta core + ui, estado de la app
├── tests/
│   ├── crossing.test.js
│   ├── calibration.test.js
│   ├── flow.test.js        ← ya existe como prueba manual; se formaliza acá
│   ├── blobs.test.js
│   └── homography.test.js
├── manifest.json           ← [F6] PWA
├── sw.js                   ← [F6] service worker (cache offline)
├── README.md               ← documentación del sistema (ya existe)
└── SPEC.md                 ← este documento
```

Notas:
- `core/` **nunca** importa de `ui/`. La dirección de dependencia es una sola.
- Tests con `node --test` (runner nativo de Node, cero dependencias). Correr:
  `node --test puta_vision/tests/`.
- El deploy no cambia: Vercel sirve archivos estáticos, los módulos ES cargan
  con `<script type="module" src="src/main.js">`.

## 4. Fases planificadas

Orden por relación esfuerzo/impacto. Cada fase lista primero el core y después
la UI, según la metodología.

### Fase 0 — Refactor a módulos *(habilitador, sin features nuevas)*
Extraer el código actual del `index.html` a la estructura de arriba, sin
cambiar comportamiento.
- **Core:** mover `crossing`, `calibration`, `flow`, `diff` a `src/core/` como
  funciones puras (quitarles todo acceso a DOM/`$()`); escribir los tests que
  hoy son pruebas manuales (cruce por cambio de lado, interpolación sub-frame,
  LK recupera traslación conocida, conversión de unidades).
- **UI:** `index.html` queda como esqueleto que importa `main.js`; probar en
  celular que nada cambió (misma URL, mismo comportamiento).
- **Aceptación:** tests verdes + demo idéntica a la actual.

### Fase 1 — Modo vehicular *(la recomendación; barata porque el motor ya está)*
- **Core (`calibration.js`):**
  - Presets vehiculares: carril urbano AR (3,0 m), carril ruta (3,65 m), largo
    sedán (4,5 m), distancia entre postes (configurable). Misma mecánica que
    los presets A4/tarjeta.
  - Función `recommendedRoiSpan(fovM)` → sugiere separación mínima A–B para
    mantener el error del cronómetro < 5 % a la velocidad esperada.
  - Umbral de tamaño mínimo de objeto (fracción del área) configurable, para
    ignorar peatones/perros/ramas cuando se mide tránsito.
- **UI:**
  - Selector de escenario: `MESA` / `CALLE` — ajusta presets visibles, unidad
    por defecto (m → km/h) y umbral de tamaño.
  - Guía de encuadre en el hint: cámara fija (trípode/ventana), perpendicular
    a la calle, líneas bien separadas.
- **Aceptación:** medir un auto real con calibración por ancho de carril y
  obtener lecturas repetibles (±10 % entre pasadas a velocidad similar).

### Fase 2 — Multi-objeto (blobs)
- **Core (`blobs.js`):** segmentar la máscara de movimiento en componentes
  conexas; devolver lista `{bbox, centroide, área}`; asociación frame a frame
  por solapamiento/cercanía (IDs estables); filtro por área mínima/máxima.
- **UI:** tap sobre un blob para elegir cuál medir; los demás se ignoran.
  Retículo solo sobre el objetivo seleccionado.
- **Aceptación:** con dos objetos cruzando a la vez, el seleccionado se mide
  bien y el otro no contamina.

### Fase 3 — Homografía (precisión vehicular real)
El salto de "aproximado" a "confiable" cuando la cámara no está perpendicular.
- **Core (`homography.js`):** resolver la homografía 4-puntos (DLT 8×8 con
  eliminación gaussiana — sin librerías); `apply(H, punto)` e inversa; los
  cruces y velocidades se calculan en coordenadas del plano rectificado.
  Tests: proyectar un cuadrado conocido con H sintética y recuperarla.
- **UI:** modo "marcar plano": el usuario toca 4 esquinas de un rectángulo
  real conocido (ej. tramo de carril: 3,5 m × 10 m) e ingresa sus medidas;
  overlay dibuja el cuadrilátero y una grilla de verificación.
- **Aceptación:** medir el mismo vehículo desde cámara en ángulo (~30–45°) y
  desde perpendicular; las lecturas deben coincidir dentro del ±10 %.

### Fase 4 — Foto-finish + registro exportable
- **Core (`log.js`):** estructura de medición `{fecha, velocidad, unidad,
  tiempo, sentido, modo, calibración}`; persistencia en `localStorage`;
  serialización CSV. Captura del frame del instante de cruce (dataURL JPEG).
- **UI:** panel historial con miniaturas (foto-finish), botón EXPORTAR CSV,
  borrar registro.
- **Aceptación:** medir 10 cruces, cerrar y reabrir la página, exportar CSV
  con las 10 filas y sus fotos visibles en el historial.

### Fase 5 — Refinado de tracking
- **Core:** pirámide de 2 niveles para Lucas-Kanade (rango de desplazamiento
  ×2–3 por frame); `kalman.js` sobre la trayectoria (suaviza sin el retardo
  de la EMA).
- **UI:** nada nuevo — misma pantalla, lecturas más estables.
- **Aceptación:** test sintético de LK piramidal recuperando traslaciones
  grandes (5–8 px/frame) que el LK actual pierde.

### Fase 6 — PWA + captura a 60 FPS
- **Core/infra:** `manifest.json` + `sw.js` (cache de la app para uso
  offline); migrar el loop a `requestVideoFrameCallback` con fallback a
  `requestAnimationFrame`.
- **UI:** banner "instalar en pantalla de inicio".
- **Aceptación:** instalable en Android/iOS, abre sin conexión, FPS ≈ 60 en
  celulares que lo soporten.

## 5. Orden de ejecución y dependencias

```
F0 (refactor) ──► F1 (vehicular) ──► F3 (homografía) ──► F5 (tracking fino)
                      │
                      ├──► F2 (multi-objeto)
                      └──► F4 (registro/CSV)          F6 (PWA) — independiente, en cualquier momento post-F0
```

F0 es prerequisito de todo (sin módulos no hay tests por feature). F1 es la
entrega de valor inmediata. F3 depende de F1 solo conceptualmente (escenario
CALLE); F2 y F4 son paralelas entre sí.

## 6. Riesgos y decisiones tomadas

- **Sin bundler a propósito:** módulos ES nativos mantienen el proyecto
  clonable-y-listo. Si algún día se necesita minificar, se agrega después sin
  reestructurar.
- **Sin OpenCV.js:** decisión sostenida — 8 MB de descarga matan la gracia del
  proyecto; todo el CV se implementa a mano y se testea en Node.
- **Medición legal:** esto es una herramienta educativa/demo. No reemplaza un
  cinemómetro homologado y el spec no apunta a eso.
- **iOS y `requestVideoFrameCallback`:** soporte parcial en Safari viejo — por
  eso F6 exige fallback a `requestAnimationFrame`.
