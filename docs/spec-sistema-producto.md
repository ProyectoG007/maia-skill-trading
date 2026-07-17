# SPEC — Sistema de productización de proyectos de software

> **Propósito:** documento ejecutable por un agente (Claude Code u otro) o por un humano.
> Convierte cualquier proyecto de software — en cualquier etapa — en un producto ordenado:
> con nombre, estructura, forma de captar usuarios, medición y carpeta legal preparada.
>
> **Qué NO es:** asesoramiento legal ni financiero. Las secciones legales generan
> *borradores y checklists para llevarle a un abogado*, no reemplazan al abogado.
> El objetivo es que cuando llegue ese momento, el proceso sea productivo y no caótico.

---

## Cómo usar este Spec (instrucciones para el agente)

1. Leé el proyecto (README, código, docs) y completá el **Diagnóstico de etapa** (Fase 0).
2. Ejecutá las fases **en orden desde donde el diagnóstico indique**. Cada fase tiene:
   - **Entrada** (qué necesitás para empezar),
   - **Tareas** (qué hacer),
   - **Salida** (artefactos concretos que deben existir al terminar),
   - **Puerta** (condición para pasar a la siguiente; si no se cumple, no avances).
3. Todo artefacto se guarda en el repo del proyecto bajo `producto/` (crear si no existe).
4. Lo que requiera decisión del dueño (nombre, precio, canal) se presenta como
   máximo 3 opciones con recomendación, nunca como pregunta abierta.
5. Lo legal se marca siempre con `⚖️ REVISAR CON ABOGADO` — se redacta el borrador
   igual, pero queda etiquetado.

---

## Fase 0 — Diagnóstico de etapa

**Entrada:** acceso al repo/proyecto.
**Tareas:** responder este checklist con evidencia (archivo o link, no "creo que sí"):

| # | Pregunta | Si NO → empezar en |
|---|---|---|
| 1 | ¿El proyecto funciona de punta a punta (demo posible)? | Fase 1 |
| 2 | ¿El entregable tiene nombre propio y frase de una línea? | Fase 2 |
| 3 | ¿Existe landing/página con un solo CTA? | Fase 3 |
| 4 | ¿Hay forma de captar interesados (form/calendario/lista)? | Fase 3 |
| 5 | ¿Hay medición (analytics + UTMs definidas)? | Fase 4 |
| 6 | ¿Existe carpeta legal mínima (disclaimer, T&C borrador, registro de datos)? | Fase 5 |
| 7 | ¿Hay usuarios reales usándolo? | Fase 6 |
| 8 | ¿Alguien pagó o hay canal de cobro listo? | Fase 7 |

**Salida:** `producto/00-diagnostico.md` con el checklist completo y la fase de arranque.
**Puerta:** ninguna — esta fase siempre se completa.

---

## Fase 1 — Núcleo demostrable

**Entrada:** proyecto en cualquier estado.
**Tareas:**
- Definir el **camino feliz único**: la secuencia mínima entrada→salida que muestra el valor.
- Hacer que ese camino corra confiablemente (aunque el resto esté crudo).
- Grabar/generar un demo de 30-60 segundos (video, GIF o secuencia de capturas).
**Salida:** `producto/01-demo/` con el asset del demo + `COMO-CORRERLO.md`.
**Puerta:** una persona que no sos vos puede ver el demo y entender qué hace en <1 minuto.

## Fase 2 — Identidad del producto

**Entrada:** demo funcionando.
**Tareas:**
- Nombrar el **entregable** (lo que recibe el usuario), no la tecnología.
- Escribir: frase de una línea (para quién + qué problema saca de encima),
  párrafo de 3 líneas, y la lista **"es para / NO es para"**.
- Verificar que el nombre no choque con marcas obvias (búsqueda web + registro de
  marcas local). `⚖️ REVISAR CON ABOGADO` si se va a registrar.
**Salida:** `producto/02-identidad.md`.
**Puerta:** el dueño aprobó nombre y frase (presentar 3 opciones con recomendación).

## Fase 3 — Punto de conversión

**Entrada:** identidad aprobada.
**Tareas:**
- Landing de UNA página, estructura fija: problema → consecuencia → solución con
  nombre + demo → quién sos → es para/no es para → FAQ (objeciones reales) → CTA único.
- El CTA se resuelve **embebiendo servicios, no programando**: Tally/Typeform (lista de
  espera), Cal.com (demos), Stripe/MercadoPago links (cobro). Backend propio solo si
  el servicio embebido se queda corto.
- **Fallback obligatorio:** debajo del CTA embebido, un contacto directo (mail o
  wa.me) por si el tercero se cae.
**Salida:** landing deployada (Vercel u otro) + `producto/03-landing.md` con URL y decisiones.
**Puerta:** la landing carga, el CTA funciona de punta a punta (test real), fallback visible.

## Fase 4 — Medición

**Entrada:** landing viva.
**Tareas:**
- Instalar UNA herramienta de analytics acorde al canal (Vercel Analytics/Plausible
  si tráfico orgánico; pixel del canal si hay pauta) — no instalar de más.
- Definir el **evento de conversión** (form enviado / reserva hecha) y verificar que
  dispara. Medir solo PageView es error conocido.
- Tabla de UTMs: una fila por canal donde se va a compartir
  (`utm_source`, `utm_medium`, `utm_campaign`).
**Salida:** `producto/04-medicion.md` con herramienta, eventos y tabla de UTMs.
**Puerta:** una visita de prueba con UTM aparece en el dashboard de analytics.

## Fase 5 — Carpeta legal mínima (borradores para el abogado)

**Entrada:** se sabe qué hace el producto y qué datos toca.
**Tareas (todo `⚖️ REVISAR CON ABOGADO`):**
- **Disclaimer** visible según el dominio (finanzas → "no es asesoramiento financiero";
  salud → equivalente; datos de terceros → aviso de tratamiento).
- **Registro de datos**: tabla de qué datos personales se guardan, dónde, por cuánto
  tiempo y cómo se borran (esto es lo primero que pide cualquier abogado o auditoría).
- Borrador de Términos y Condiciones + Privacidad (plantilla honesta, corta).
- **Log de decisiones** (`DECISIONES.md`): fecha, decisión, por qué. Es la memoria
  que hace productiva la primera reunión con el abogado.
**Salida:** `producto/05-legal/` con los 4 documentos.
**Puerta:** el disclaimer está VISIBLE en el producto y la landing (esto no espera al abogado).

## Fase 6 — Tracción

**Entrada:** fases 3-5 completas.
**Tareas:**
- Compartir en 3-5 comunidades donde ya está el usuario (con UTM por canal).
- Registrar semanalmente: visitas, conversiones, de dónde, qué preguntan.
- Iterar la landing con las objeciones reales que aparezcan (van al FAQ).
- Pauta paga SOLO si la conversión orgánica ≥ ~3% (si no convierte gratis, pagar
  solo acelera la pérdida).
**Salida:** `producto/06-traccion.md` actualizado semanalmente.
**Puerta:** ≥1 canal identificado que trae usuarios de forma repetible.

## Fase 7 — Cobro y formalización

**Entrada:** usuarios reales y repetibles.
**Tareas:**
- Activar cobro por link (Stripe/MercadoPago) — sin backend de pagos propio.
- Recién acá: reunión con abogado/contador llevando `producto/05-legal/` completo
  (estructura, impuestos, marca). La carpeta convierte una reunión cara y caótica
  en una revisión corta.
**Salida:** canal de cobro activo + `producto/07-formalizacion.md` con lo acordado.
**Puerta:** primer cobro real procesado.

---

## Reglas transversales (aplican en toda fase)

1. **Embeber > programar** para todo lo que no sea el núcleo del producto.
2. **Un solo CTA** por página/mensaje.
3. **Todo link compartido lleva UTM.**
4. **Nada legal se publica sin etiqueta** `⚖️` en el borrador interno.
5. **Validar antes de formalizar**: la plata en abogados/estructura va después de la
   evidencia de demanda, no antes.
6. Cada fase deja artefactos en `producto/` — si no quedó archivo, la fase no pasó.
