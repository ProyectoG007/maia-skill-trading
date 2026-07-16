# Guía práctica: qué hacen ellos y cómo lo replicás vos

Versión en criollo del informe técnico (`informe-analisis-geremiaco.md`).
Sin jerga: qué es la maquinaria que viste en ese anuncio, qué te aporta,
y cómo armás la tuya con tus proyectos.

---

## 1. Qué están haciendo ellos, explicado simple

Lo que viste no es "una página web". Es una **máquina de convertir desconocidos en clientes**, con 4 piezas:

1. **Un anuncio en Instagram** que apunta a gente con un problema específico (founders con la parte legal desordenada).
2. **Una página que hace UNA sola cosa:** convencerte de agendar una reunión. No tiene menú, no tiene "conocé nuestros servicios", no te distrae. Todo empuja a un solo botón.
3. **Un calendario embebido** (alquilado a un tercero, no lo programaron ellos) donde reservás fecha y dejás tus datos.
4. **Un contador invisible** (el pixel de Meta) que le avisa a Instagram "esta persona entró", para que Instagram aprenda a quién mostrarle el anuncio.

El truco de fondo: **no venden horas de abogado, venden un producto con nombre** ("Diagnóstico Estratégico™"). Precio cerrado, alcance cerrado, nombre propio. Eso es lo que lo hace publicitable.

**La parte legal es el 10% de lo que viste. El otro 90% es marketing y producto — y eso lo podés copiar entero sin abogado.**

## 2. Qué te aporta a vos, concretamente

Vos ya tenés algo que ellos no: un producto de software que se puede mostrar funcionando (Tododeia genera un dashboard real). Ellos venden humo hasta la reunión; vos podés mostrar el resultado en un video de 30 segundos.

Lo que te falta (y ellos tienen) es la maquinaria alrededor:

| Ellos tienen | Vos hoy | Cómo lo cerrás |
|---|---|---|
| Producto con nombre y marca | "Un skill de Claude Code" | Ponerle nombre al ENTREGABLE, no a la herramienta |
| Página de una sola acción | README en GitHub | Landing de una página con un solo botón |
| Forma de capturar interesados | Nada | Calendario, formulario o lista de espera embebida |
| Medición de quién entra | Nada | Un pixel/analytics del canal que uses |

## 3. La receta, paso a paso (para replicar vos mismo)

### Paso 1 — Nombrá el entregable (0 pesos, 1 hora)
Regla: la gente no compra herramientas, compra resultados con nombre.
- Mal: "un skill multi-agente de análisis de inversiones"
- Bien: "**Informe Tododeia**: tu análisis de mercado semanal en 10 minutos"

Escribí en una frase: *para quién es + qué problema le saca de encima*.
Ellos usan: "tu startup creció, tu estructura no". La tuya podría ser:
"pasás horas leyendo noticias de mercado y igual no sabés qué mirar".

### Paso 2 — Armá la landing (1 día)
Una sola página, este orden exacto (es la plantilla de ellos, funciona):

1. **El problema** (no el producto): la frustración del usuario en sus palabras.
2. **La consecuencia** de no resolverlo: tiempo perdido, decisiones a ciegas.
3. **La solución con nombre** + demo: acá vos ganás — mostrá el dashboard real, video o GIF.
4. **Quién sos** y por qué hiciste esto (honesto, sin inflar).
5. **Para quién es / para quién NO es**: esto genera más confianza que cualquier testimonio. Ej: "NO es asesoramiento financiero, NO da señales de trading".
6. **Preguntas frecuentes**: escribí las objeciones reales ("¿necesito saber programar?", "¿cuánto sale?", "¿mis datos?").
7. **El botón** (uno solo, repetido 2-3 veces en la página).

Herramientas: ya sabés Next.js (el dashboard de Tododeia lo usa) → landing en Next.js + deploy gratis en Vercel. Si querés cero código: Carrd (~19 USD/año).

### Paso 3 — Embebé, no programes (2 horas)
La lección más importante de ingeniería que dan ellos: **la pieza más crítica de su negocio (el calendario) es alquilada**, un iframe de un tercero. No perdieron un mes programando un sistema de reservas.

Tu equivalente según qué necesites:
- **Agendar llamadas/demos** → Cal.com (gratis, open source) o Calendly
- **Cobrar** → Stripe Payment Links o Mercado Pago (un link, cero código)
- **Lista de espera / formulario** → Tally (gratis) o Typeform
- **Soporte/contacto** → un link de WhatsApp (`wa.me/tunumero`)

Regla: programás backend propio SOLO cuando el servicio alquilado se queda corto. Antes no.

**Y el error de ellos que vos evitás:** si el iframe se cae, su negocio muere. Poné siempre un plan B visible (un mail o WhatsApp debajo del botón).

### Paso 4 — Medí quién entra (2 horas)
Ellos usan solo el pixel de Meta porque solo pagan anuncios en Meta. Lógica: **medí únicamente el canal que usás**, no instales 5 herramientas.

- Si todavía no pagás anuncios: Vercel Analytics o Plausible te alcanza (¿cuánta gente entra y de dónde?).
- El día que pagues anuncios en Meta/Instagram: instalá el pixel Y configurá el evento de conversión (cuando alguien completa el form/agenda). Ellos solo miden "entró a la página" — ese es su error, Instagram optimiza mejor si le avisás quién CONVIRTIÓ, no solo quién entró.
- **UTMs en todo link que compartas**: son etiquetas en la URL (`?utm_source=twitter&utm_campaign=lanzamiento`) que te dicen de dónde vino cada visita. Gratis, y es la diferencia entre adivinar y saber qué canal te trae gente.

### Paso 5 — Tráfico (recién acá, no antes)
Ellos pagan anuncios porque su cliente paga miles de dólares. Vos empezá gratis:
1. Compartir en comunidades donde ya está tu usuario (X, Reddit, Discords de trading/Claude Code).
2. El propio GitHub del skill con link a la landing.
3. Anuncios pagos SOLO cuando la landing ya convierte tráfico gratis (si no convierte gratis, pagar solo quema plata más rápido).

## 4. Qué es del abogado y qué es tuyo

| Lo hacés vos (esta guía) | Lo hace el abogado (cuando facture en serio) |
|---|---|
| Nombre y marca del producto | Registro de marca |
| Landing, funnel, medición | Términos y condiciones, privacidad |
| Disclaimer visible ("no es asesoramiento financiero") | Revisar ese disclaimer* |
| Cobrar por links de pago | Estructura societaria/impuestos cuando haya volumen |

*Ojo con lo tuyo específicamente: un producto de análisis de inversiones necesita el disclaimer de "esto no es asesoramiento financiero" desde el día UNO, bien visible. Ponelo ya (en el dashboard y en la landing); que un abogado lo pula después. Es la única urgencia legal real que tenés.

La secuencia sana: **primero validá que alguien quiere pagar** (pasos 1-5), **después** pagale a un abogado para formalizar. Al revés es quemar plata en estructura para un producto que quizás nadie compra — irónicamente, lo mismo que Geremia le critica a los founders.

## 5. Plan concreto de 2 semanas

- **Días 1-2:** nombre del entregable + la frase de una línea + grabar un demo del dashboard (30-60 seg).
- **Días 3-5:** landing en Next.js/Vercel con la estructura de 7 bloques del Paso 2.
- **Día 6:** embeber Tally (lista de espera) o Cal.com (demos 1-a-1). Fallback de contacto visible.
- **Día 7:** analytics + UTMs armadas para cada lugar donde vas a compartir.
- **Semana 2:** compartir en 3-5 comunidades, mirar los números: ¿de dónde entran? ¿cuántos dejan el mail? Iterar el texto de la landing según lo que pregunten.

Meta realista: si de 100 visitas 3-5 dejan el mail o agendan, la landing funciona y tenés algo. Si entran 100 y convierten 0, el problema es el mensaje (volvé al Paso 1), no el código.

---

**La idea central para llevarte:** ellos convirtieron conocimiento (derecho fiscal) en un producto con nombre, una página de una sola acción, y piezas alquiladas para todo lo demás. Vos tenés conocimiento (trading + IA) y además software que se puede mostrar. La receta es la misma y ninguna pieza requiere permiso, plata grande, ni depender de nadie.
