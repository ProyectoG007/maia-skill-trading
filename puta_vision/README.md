# ◉ Radar — Medidor de velocidad con la cámara

Radar de velocidad que corre entero en el navegador del celular. Un solo archivo HTML,
sin backend, sin dependencias, sin build. Apuntás la cámara, definís una zona de medición
con dos líneas, y cualquier objeto que la cruce queda cronometrado y convertido a velocidad
real (cm/s o km/h).

**Demo en vivo:** https://radar-velocidad.vercel.app

## Uso rápido

1. Abrí la página en el celular (necesita HTTPS para que el navegador habilite la cámara).
2. Tocá **▶ INICIAR** y aceptá el permiso de cámara (usa la trasera por defecto).
3. Arrastrá las líneas **A** y **B** sobre el video para delimitar la zona de medición.
4. En **CALIBRACIÓN**, ingresá el ancho real que abarca el encuadre completo
   (ej: si la cámara ve 50 cm de mesa, ponés `50` y elegís `cm`).
5. Pasá un objeto entre las líneas: el radar muestra la velocidad del cruce,
   el tiempo que tardó, la máxima registrada y un gráfico de historial.

Con `cm` el resultado se muestra en **cm/s**; con `m`, en **km/h**.

## Cómo funciona

El procesamiento corre en un loop de `requestAnimationFrame` sobre una copia reducida
del video (120 px de ancho), lo que mantiene el costo por frame bajo incluso en
celulares modestos.

### Pipeline por frame

1. **Captura reducida** — el frame de video se dibuja en un canvas oculto de 120×N px
   y se leen sus píxeles RGB.
2. **Diferencia de frames** — cada píxel se compara con el frame anterior sumando las
   diferencias absolutas de R, G y B. Si supera el umbral (84), se considera "en movimiento".
   Esto siempre se calcula (da el centroide de respaldo, el recuadro de la zona en
   movimiento para sembrar el optical flow, y la señal de "hay objeto o no").
3. **Posición del objeto** — según el modo de seguimiento activo (**DIFF** o **FLOW**,
   ver abajo), la posición del objeto sale del centroide de la diferencia de frames o
   del promedio de los puntos rastreados por optical flow. Si hay menos del 0,5 % del
   área en movimiento, se considera que no hay objeto.
4. **Máquina de estados del cruce** — ver abajo.
5. **Velocidad continua (secundaria)** — en modo FLOW sale directamente del
   desplazamiento promedio de los puntos rastreados; en modo DIFF, de la diferencia de
   posición del centroide entre frames. Se convierte a unidades reales con la
   calibración y se suaviza con una media móvil exponencial (EMA, factor 0,6/0,4).
   Alimenta la celda "Continua" y el gráfico.

### Seguimiento: DIFF vs FLOW

El toggle arriba del video cambia cómo se calcula la posición del objeto:

- **DIFF** — el método original: centroide de los píxeles que cambiaron de brillo
  entre dos frames. Simple y barato, pero un cambio de luz ambiente (una nube, un
  flicker) también "cambia de brillo" y puede correr el centroide sin que nada
  se haya movido.
- **FLOW** (por defecto) — optical flow disperso Lucas-Kanade (ver abajo): sigue
  puntos de textura concretos del objeto en vez de un promedio de píxeles. Más
  estable con luz variable o fondos con dibujos, porque cada punto se ancla a un
  gradiente local, no a un umbral de brillo. Si el objeto es liso y sin textura
  (una pelota lisa de un solo color, por ejemplo), FLOW no encuentra buenos puntos
  para seguir y conviene volver a DIFF.

El contador junto al toggle muestra cuántos puntos está siguiendo FLOW en vivo, y
se ven como puntitos cian sobre el video.

### Optical flow disperso (Lucas-Kanade)

Implementado en JS puro (sin OpenCV.js, que pesa ~8 MB y rompería el "cero
dependencias"). Es Lucas-Kanade clásico de una sola escala (sin pirámide de
resolución), iterativo tipo Gauss-Newton:

1. **Selección de puntos (`seedPoints`)** — dentro del recuadro donde hubo
   movimiento, se evalúan candidatos cada 4 px con el puntaje Shi-Tomasi (el
   autovalor menor del tensor de estructura 2×2 de gradientes locales: alto en
   esquinas y texturas, ~0 en zonas lisas donde cualquier desplazamiento es
   ambiguo — el "problema de apertura"). Se toman los de mejor puntaje,
   separados al menos 5 px entre sí, hasta 24 puntos.
2. **Seguimiento (`trackPoint`)** — para cada punto, se resuelve el sistema
   2×2 de Lucas-Kanade sobre una ventana de 5×5 px: gradiente espacial fijo del
   frame anterior, residuo temporal recalculado en cada iteración con muestreo
   bilinear (subpíxel) sobre el frame actual, 4 iteraciones de Gauss-Newton.
   Un punto se descarta si su matriz de gradientes no es invertible (zona sin
   textura) o si termina fuera del encuadre útil.
3. **Resiembra** — si quedan menos de 10 puntos válidos, o cada 20 frames por
   las dudas, se buscan puntos nuevos para no perder cobertura a medida que el
   objeto se mueve o gira.
4. **Uso del resultado** — con 4 puntos válidos o más, la posición del objeto es
   el promedio de sus posiciones, y la velocidad continua sale directamente del
   promedio de sus vectores de desplazamiento (no de restar posiciones promedio
   entre frames, que se distorsionaría si hubo resiembra en el medio). Por debajo
   de ese umbral, el frame cae de nuevo en modo DIFF automáticamente para esa
   iteración, sin que el usuario note nada raro.

**Limitación**: al no tener pirámide de resolución, este Lucas-Kanade sigue bien
desplazamientos de hasta ~2-3 px por frame por punto; objetos muy rápidos a FPS
bajo pueden perder puntos y caer a DIFF más seguido. Una pirámide de 2-3 niveles
(seguir primero en la imagen reducida a la mitad, refinar en la original) es la
mejora natural si hace falta más rango.

### Medición por cruce A→B (la medición principal)

Es el método de los radares reales: en vez de estimar velocidad frame a frame,
se cronometra cuánto tarda el objeto en recorrer una distancia conocida.

```
velocidad = distancia real entre A y B / tiempo de cruce
```

La máquina de estados tiene dos estados:

- **idle** → cuando el centroide cruza cualquiera de las dos líneas, arranca el
  cronómetro (funciona en ambos sentidos).
- **timing** → cuando cruza la línea opuesta, se detiene el cronómetro y se publica
  la velocidad. Si vuelve a cruzar la línea de partida, el cronómetro se reinicia.
  Si pasan 5 s sin llegar a la otra línea (o el objeto desaparece 1,5 s), se desarma.

### Detección de cruce por cambio de lado

El detalle que hace que funcione con objetos rápidos: una línea se considera cruzada
cuando el centroide **cambió de lado** entre el frame anterior y el actual
(`(prevX - línea) * (x - línea) <= 0`), no cuando pasa "cerca" de ella. Un objeto
veloz que salta la línea entre dos frames dispara el cruce igual.

Además, el instante exacto del cruce se **interpola linealmente** entre los dos frames
según qué fracción del salto corresponde a la línea. Eso da una resolución temporal
mejor que el período de frame (a 30 FPS, mejor que 33 ms), y permite medir incluso
un objeto que cruza **las dos líneas dentro de un mismo frame**.

Salvaguardas contra mediciones falsas:

- Cruces con `dt ≤ 20 ms` se descartan como ruido.
- Si el objeto desaparece más de 0,5 s, se olvida su última posición, para que algo
  que aparece del otro lado no registre un "cruce" fantasma.

### Calibración

La calibración es una sola cifra: el ancho real del campo visible completo. De ahí sale
la escala `unidades/píxel`, y la distancia A–B real es la fracción del ancho entre las
líneas multiplicada por ese valor (se muestra en vivo bajo el campo de calibración).
Para que sea válida, la cámara tiene que estar **fija** y el movimiento ocurrir
aproximadamente **a la distancia calibrada y perpendicular a la cámara**.

### Multi-objeto: elegir qué medir

Antes, todos los píxeles en movimiento se promediaban en un único centroide:
con dos autos cruzando a la vez, el radar terminaba midiendo un punto
fantasma entre ambos. Ahora:

1. Cada frame, `segmentBlobs` separa los píxeles en movimiento en
   componentes conexas (BFS 4-conexo) y descarta las menores al umbral de
   área mínima del escenario activo (mismo filtro que antes, ahora por
   objeto en vez de global).
2. `BlobTracker` les asigna una identidad estable entre frames por cercanía
   de centroide (matching voraz). Si un objeto desaparece, su id se pierde:
   algo que reaparece después en el mismo lugar es un objeto nuevo para el
   sistema, no un "fantasma" reconectado.
3. Todos los objetos detectados se dibujan como recuadros cian sobre el
   video. Sin elegir nada, el radar mide automáticamente el más grande.
   **Tocá un recuadro** para elegir ese objeto en cambio — se pone ámbar y
   el radar lo sigue por su id mientras siga vivo, ignorando a los demás
   (incluso si aparece uno más grande después). Si el elegido desaparece,
   vuelve a elegir automáticamente el más grande.
4. Tanto DIFF como FLOW ahora operan **dentro del recuadro del objeto
   elegido**, no sobre toda el área en movimiento del frame — así que FLOW
   ya no mezcla puntos de dos objetos distintos cuando hay más de uno.

### Corrección de perspectiva (homografía de 4 puntos)

El modelo de calibración por defecto (`fov` + líneas A–B) asume que la
cámara está **perpendicular** a la calzada y que todo el movimiento ocurre
a la distancia calibrada — razonable con una mesa, pero en la calle la
cámara casi siempre está en ángulo, y distintos puntos de la calzada están
a distinta distancia real de la cámara. La corrección de perspectiva
reemplaza ese modelo por una proyección real del plano de la calle.

1. Tocá **🔲 MARCAR / AJUSTAR PLANO**. Sobre el video aparece un
   cuadrilátero ámbar de 4 esquinas arrastrables.
2. Arrastrá cada esquina para que coincida con las 4 puntas de un
   rectángulo real conocido de la escena — típicamente un tramo de carril
   (dos líneas de cordón + dos marcas transversales separadas una
   distancia conocida). Mientras ajustás, se dibuja en vivo una **grilla de
   verificación cada metro**: si la grilla se ve prolija sobre la calzada
   real, el plano está bien marcado; si se ve torcida, hay que reajustar
   las esquinas.
3. Ingresá el **ancho** y **largo** reales del rectángulo en metros (por
   ejemplo, 3,5 m de ancho de carril × 10 m de tramo).
4. Tocá **✓ APLICAR**. El toggle **FOV / PLANO** pasa a PLANO automáticamente.

Con PLANO activo, la posición del objeto medido se convierte de píxeles de
imagen a coordenadas reales del plano (metros) en cada frame vía la
homografía, y la velocidad —tanto la continua como la del cruce A→B— se
calcula directamente en esas coordenadas reales. El cruce ya no necesita
las líneas A/B de pantalla: los bordes cercano y lejano del rectángulo
marcado **son** las dos líneas de medición (separadas exactamente el largo
ingresado), reutilizando sin cambios la misma máquina de estados de cruce.

Podés volver a **FOV** en cualquier momento con el toggle, sin perder el
plano marcado (basta con tocar PLANO de nuevo para reactivarlo, no hace
falta re-marcar las esquinas salvo que quieras ajustarlas).

**Matemática:** `computeHomography` resuelve la homografía 3×3 (con
`h33=1`) que lleva las 4 esquinas de imagen a las 4 esquinas reales por
eliminación gaussiana con pivoteo parcial sobre el sistema lineal de 8
ecuaciones que define el DLT (Direct Linear Transform) — devuelve `null`
ante puntos degenerados (3 o más colineales, que no determinan un
rectángulo). `applyHomography` proyecta cualquier punto de imagen al plano
real con la división proyectiva estándar; `invertHomography` calcula la
inversa (adjugada/determinante) para proyectar la grilla de verificación de
vuelta a la imagen.

### Escenario MESA / CALLE

Toggle arriba del video (debajo de DIFF/FLOW). Cambia tres cosas a la vez para
no tener que ajustarlas a mano cada vez:

- **Unidad por defecto:** MESA usa cm → cm/s; CALLE usa m → km/h.
- **Ancho de campo (`fov`) por defecto:** 50 (cm) en MESA, 15 (m) en CALLE —
  un punto de partida razonable para una calle vista de costado.
- **Presets de auto-calibración:** MESA ofrece hoja A4/tarjeta/CD; CALLE
  ofrece carril urbano (3,0 m), carril de ruta (3,65 m) y largo de sedán
  (4,5 m) — se usan igual que los de MESA (detectar o alinear la barra a
  mano), solo que ahora referencian objetos a escala de calle.
- **Umbral de tamaño mínimo:** en CALLE se exige que el área en movimiento
  sea al menos 1,5 % del encuadre (vs. 0,5 % en MESA) para contar como
  "hay un objeto" — filtra ruido chico (una hoja, un pájaro) al medir
  tránsito. No es segmentación por objeto (eso es F2 del roadmap), solo un
  piso de tamaño.

En CALLE también aparece una recomendación de separación mínima entre A y B
calculada con `recommendedRoiSpanM`: a mayor velocidad esperada, más larga
tiene que ser la zona de medición para que el error del cronómetro se
mantenga bajo (la lógica es la misma idea de "cuanto más corto el intervalo
cronometrado, más pesa cualquier imprecisión de reloj").

### Auto-calibración con objeto de referencia

Con **📐 AUTO-CALIBRAR CON OBJETO** no hace falta medir la escena con cinta métrica:

1. Poné un objeto de tamaño conocido **en el plano donde va a pasar lo que medís**
   (hoja A4, tarjeta de crédito, CD, o cualquier cosa cuyo tamaño ingreses en "Otro…").
2. Tocá **⌖ DETECTAR**: el radar busca la mancha brillante más grande del encuadre
   (umbral adaptativo sobre la luminancia media + componente conexa más grande por BFS)
   y ajusta la barra de medición a su ancho. Funciona mejor con un objeto claro contra
   fondo más oscuro; si no detecta nada, arrastrá las manijas de la barra a mano sobre
   los bordes del objeto.
3. Tocá **✓ APLICAR**: de la fracción del encuadre que ocupa la barra sale el ancho
   real del campo visible (`campo = tamaño_referencia / fracción`), y el valor se
   carga solo en la calibración (convertido a metros si estás midiendo en km/h).

La barra se puede inclinar: el largo se calcula en distancia euclídea real, así que
un objeto apoyado en diagonal calibra igual de bien. Durante la calibración el
cronómetro de cruce queda pausado.

## Limitaciones conocidas

- Mide velocidad **en el plano de la imagen**: el movimiento hacia/desde la cámara
  no se registra, y el movimiento oblicuo se subestima.
- **Un objeto a la vez**: con varios objetos moviéndose, el centroide es el promedio
  de todos y la medición pierde sentido.
- La diferencia de frames es sensible a **cambios bruscos de luz** (sombras, flicker
  de tubos fluorescentes) y a que la cámara se mueva: trípode o apoyo firme.
- La calibración manual asume distancia constante al plano de movimiento.

## Roadmap — de MVP a sistema avanzado

En orden de relación esfuerzo/impacto:

1. ~~**Optical flow (Lucas-Kanade)**~~ — ✅ **hecho**: seguimiento disperso de
   puntos de textura en JS puro, con toggle DIFF/FLOW para comparar en vivo.
   Pendiente natural: pirámide de resolución para aguantar objetos más rápidos.
2. ~~**Auto-calibración con objeto de referencia**~~ — ✅ **hecho**: detección
   automática del objeto por umbral adaptativo + barra ajustable a mano, con presets
   (A4, tarjeta, CD) y tamaño personalizado.
3. **Multi-objeto** — segmentar los píxeles en movimiento en blobs (componentes
   conexas) y asignar un ID por objeto. Habilita medir varios cruces simultáneos
   y filtrar ruido por tamaño de blob. Con FLOW ya implementado, esto también podría
   agrupar los puntos rastreados por clusters de posición/velocidad en vez de blobs
   de diferencia de frames.
4. **Foto-finish + registro** — capturar el frame en el instante de cada cruce y
   guardar un historial de mediciones (localStorage) con exportación CSV. Convierte
   la demo en herramienta: evidencia + datos.
5. **Corrección de perspectiva (homografía)** — marcar 4 puntos de referencia en el
   piso y medir sobre el plano real en vez del plano de imagen. Es lo que separa un
   juguete de un radar de tránsito.
6. **PWA** — manifest + service worker para instalarlo en la pantalla de inicio y
   que funcione offline.
7. **Filtro de Kalman** sobre la trayectoria del centroide — suaviza el ruido de
   detección sin el retardo de una EMA.
8. **`requestVideoFrameCallback`** — sincronizar el procesamiento con los frames
   reales del sensor (hasta 60 FPS en muchos celulares) en vez de con el repintado
   de pantalla.

## Estructura

Módulos ES nativos, sin bundler ni dependencias (ver SPEC.md, Fase 0):

```
puta_vision/
├── index.html              ← estructura HTML + carga de módulos
├── styles.css              ← estilos
├── src/
│   ├── core/               ← lógica pura (sin DOM, testeable en Node)
│   │   ├── crossing.js     ← máquina de estados A→B + interpolación de cruce
│   │   ├── calibration.js  ← escala px→unidades, presets, conversiones
│   │   ├── flow.js         ← Lucas-Kanade: corners, tracking, resiembra
│   │   ├── blobs.js        ← segmentación multi-objeto + tracking por id
│   │   ├── homography.js   ← corrección de perspectiva: DLT 4-puntos
│   │   └── diff.js         ← diferencia de frames, centroide, mancha brillante
│   ├── ui/
│   │   ├── camera.js       ← getUserMedia + buffer de proceso
│   │   ├── overlay.js      ← dibujo: líneas, barra, puntos, retículo, gráfico
│   │   ├── controls.js     ← botones, toggles, arrastre
│   │   └── readout.js      ← números y estados en pantalla
│   └── main.js             ← wiring: estado de la app + loop principal
├── tests/                  ← node --test (sin dependencias)
├── package.json            ← solo type:module + script de test
├── README.md
└── SPEC.md                 ← plan de evolución del sistema
```

Regla de arquitectura: `core/` nunca importa de `ui/`.

### Tests

```
cd puta_vision && npm test          # 47 tests de los módulos core
```

Para desplegar alcanza con servir la carpeta por HTTPS (Vercel, Netlify,
GitHub Pages — sirve tal cual, sin build). Al usar módulos ES, ya no se puede
abrir como `file://` — hace falta un servidor (local: `python3 -m http.server`).
