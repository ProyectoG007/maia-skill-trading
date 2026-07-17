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
3. **Centroide** — se promedian las coordenadas de todos los píxeles en movimiento.
   Si hay menos del 0,5 % del área en movimiento, se considera que no hay objeto.
4. **Máquina de estados del cruce** — ver abajo.
5. **Velocidad continua (secundaria)** — el desplazamiento del centroide entre frames
   se convierte a unidades reales con la calibración y se suaviza con una media móvil
   exponencial (EMA, factor 0,6/0,4). Alimenta la celda "Continua" y el gráfico.

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

1. **Optical flow (Lucas-Kanade)** — reemplazar el centroide de diferencia de frames
   por seguimiento de features. Mucho más robusto con fondos texturados y luz cambiante.
   Implementable en JS puro (~80 líneas) para no perder el "cero dependencias"
   (OpenCV.js resolvería lo mismo pero pesa ~8 MB).
2. ~~**Auto-calibración con objeto de referencia**~~ — ✅ **hecho**: detección
   automática del objeto por umbral adaptativo + barra ajustable a mano, con presets
   (A4, tarjeta, CD) y tamaño personalizado.
3. **Multi-objeto** — segmentar los píxeles en movimiento en blobs (componentes
   conexas) y asignar un ID por objeto. Habilita medir varios cruces simultáneos
   y filtrar ruido por tamaño de blob.
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

```
puta_vision/
├── index.html   ← toda la app: HTML + CSS + JS, sin dependencias
└── README.md
```

Para desplegar alcanza con servir `index.html` por HTTPS (Vercel, Netlify,
GitHub Pages — cualquiera sirve tal cual, sin build).
