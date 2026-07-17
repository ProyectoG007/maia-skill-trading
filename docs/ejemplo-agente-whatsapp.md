# Ejemplo resuelto — "Quiero un agente que responda WhatsApp, con memoria y persistencia"

> Este documento aplica el Spec (`spec-sistema-producto.md`) a un caso concreto,
> de punta a punta. Sirve como plantilla: cambiá el dominio y la receta es la misma.
> Al final: qué ganaste con el esquema y de qué problemas te salvaste.

---

## Fase 0 — Diagnóstico

Proyecto nuevo → no hay demo, ni nombre, ni landing. **Arranque: Fase 1.**
Se crea `producto/00-diagnostico.md` con el checklist en cero.

## Fase 1 — Núcleo demostrable (la parte técnica, resuelta)

### Arquitectura (la más simple que funciona)

```
WhatsApp del cliente
      │  mensaje
      ▼
Meta WhatsApp Cloud API  ──webhook──▶  Tu API (Next.js route / Express)
                                            │
                                            ├─▶ 1. Busca/crea la conversación en la DB
                                            ├─▶ 2. Arma contexto: perfil + resumen + últimos N mensajes
                                            ├─▶ 3. Llama a Claude API con ese contexto
                                            ├─▶ 4. Guarda mensaje y respuesta en la DB
                                            └─▶ 5. Responde vía Cloud API
                                            
DB Postgres (Supabase capa gratis) = memoria y persistencia
```

**Decisiones y por qué (regla "embeber > programar"):**

| Pieza | Elección | Por qué |
|---|---|---|
| Canal WhatsApp | **Meta WhatsApp Cloud API** (oficial, gratis hasta 1.000 conversaciones/mes) | No usar libs no oficiales tipo whatsapp-web.js en producción: Meta banea el número y perdés el canal entero |
| Servidor | Next.js API route en Vercel (o un Express chico en Railway) | Ya conocés el stack; el webhook es un solo endpoint |
| Cerebro | Claude API (`claude-haiku-4-5` para respuestas; escalar a Sonnet si hace falta) | Haiku es rápido/barato para chat; el modelo se cambia con una línea |
| Memoria/persistencia | **Postgres en Supabase** (capa gratis) | SQL simple, dashboard visual, backups incluidos. SQLite no sirve en serverless |

### Esquema de datos (memoria en 3 niveles)

```sql
-- Quién es (memoria de largo plazo, hechos estables)
CREATE TABLE contactos (
  telefono      TEXT PRIMARY KEY,
  nombre        TEXT,
  notas         JSONB DEFAULT '{}',   -- hechos aprendidos: "prefiere respuestas cortas", "es cliente desde..."
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- Qué se habló (persistencia total, auditable)
CREATE TABLE mensajes (
  id            BIGSERIAL PRIMARY KEY,
  telefono      TEXT REFERENCES contactos(telefono),
  rol           TEXT CHECK (rol IN ('usuario','agente')),
  contenido     TEXT,
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- De qué venimos hablando (memoria de mediano plazo)
CREATE TABLE resumenes (
  telefono      TEXT PRIMARY KEY REFERENCES contactos(telefono),
  resumen       TEXT,                  -- regenerado cada ~20 mensajes por el propio modelo
  actualizado   TIMESTAMPTZ DEFAULT now()
);
```

**Cómo se arma la "memoria" en cada mensaje:** contexto = `notas del contacto` +
`resumen` + `últimos 10-15 mensajes`. Cada ~20 mensajes, un llamado extra al modelo
regenera el resumen y actualiza `notas`. Con esto el agente "se acuerda" sin mandar
todo el historial (que sería caro y lento).

### El webhook (esqueleto real)

```ts
// app/api/whatsapp/route.ts
export async function GET(req: Request) {
  // Verificación única del webhook que exige Meta
  const url = new URL(req.url);
  if (url.searchParams.get("hub.verify_token") === process.env.VERIFY_TOKEN)
    return new Response(url.searchParams.get("hub.challenge"));
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return Response.json({ ok: true });      // status updates, ignorar

  const telefono = msg.from;
  const texto = msg.text?.body ?? "";

  const contexto = await armarContexto(telefono);     // notas + resumen + últimos mensajes
  const respuesta = await llamarClaude(contexto, texto);
  await guardarIntercambio(telefono, texto, respuesta);
  await enviarWhatsApp(telefono, respuesta);          // POST a graph.facebook.com/v21.0/{phone_id}/messages

  return Response.json({ ok: true });
}
```

### Pasos de setup (una tarde)

1. Cuenta en [developers.facebook.com](https://developers.facebook.com) → crear app → producto "WhatsApp" → te dan un número de prueba y token.
2. Proyecto en Supabase → correr el SQL de arriba → copiar `DATABASE_URL`.
3. Deploy del endpoint en Vercel → configurar la URL del webhook en Meta con tu `VERIFY_TOKEN`.
4. Mandarte un mensaje al número de prueba → ver la respuesta → **eso es el demo** (grabarlo, 30 seg).

**Salida Fase 1:** `producto/01-demo/demo.mp4` + `COMO-CORRERLO.md`. ✅ Puerta: cualquiera entiende el video.

## Fase 2 — Identidad

- Nombre del entregable: p. ej. **"Recepcionista IA"** — *"tu WhatsApp responde solo,
  se acuerda de cada cliente, vos mirás el resumen"*.
- Es para: negocios que pierden ventas por no contestar a tiempo.
- NO es para: quien quiere spam masivo (además viola términos de Meta), ni emergencias.

**Salida:** `producto/02-identidad.md`. ✅

## Fase 3 — Punto de conversión

- Landing de una página (Next.js/Vercel, misma cuenta): problema ("cada mensaje sin
  responder es una venta perdida") → demo → es para/no es para → FAQ → **un CTA**:
  Cal.com embebido para agendar demo de 15 min. Fallback: link `wa.me` propio debajo.

**Salida:** landing viva + `producto/03-landing.md`. ✅

## Fase 4 — Medición

- Vercel Analytics + evento `demo_agendada` al confirmar en Cal.com.
- UTMs: `?utm_source=ig&utm_medium=organic&utm_campaign=lanzamiento` (una fila por canal).

**Salida:** `producto/04-medicion.md`. ✅

## Fase 5 — Carpeta legal mínima ⚖️

Este producto **guarda conversaciones de terceros** → lo legal no es decorativo:

- **Aviso en el primer mensaje del bot:** "Soy un asistente automático de [negocio].
  Escribí HUMANO para hablar con una persona." (transparencia + opt-out).
- **Registro de datos:** teléfonos y mensajes en Supabase (región X), retención 12
  meses, borrado a pedido (`DELETE FROM ... WHERE telefono = ?` ya escrito como script).
- Borrador de Privacidad y T&C en `producto/05-legal/` — etiquetados `⚖️ REVISAR CON ABOGADO`.
- Cumplimiento de políticas de WhatsApp Business (no spam, ventana de 24 h, plantillas aprobadas para iniciar conversación).

**Salida:** carpeta completa. ✅ El día que factures y vayas al abogado, la reunión es 1 hora, no 5.

## Fases 6-7 — Tracción y cobro

- Compartir en comunidades de comercios/emprendedores locales con UTM por canal.
- Cobro: link de MercadoPago suscripción mensual. Meta ya cobra por conversación
  encima de la capa gratis → ese costo va dentro del precio.

---

## Qué ganaste aplicando el esquema

1. **Un camino en vez de un laberinto:** cada momento tiene UNA tarea siguiente clara. El proyecto no se estanca en "¿y ahora qué?".
2. **Demo antes que perfección:** en una tarde tenés algo mostrable, que es lo único que valida si a alguien le importa.
3. **Artefactos, no humo:** cada fase deja archivos en `producto/`. Cualquier agente (o vos en 6 meses) retoma el proyecto leyendo la carpeta, sin arqueología.
4. **Decisiones técnicas ya tomadas** con criterio (API oficial, Postgres, embeber terceros): no quemás días comparando opciones.
5. **La carpeta legal se arma sola de paso:** cuando llegue el abogado, le entregás registro de datos, borradores y log de decisiones. Pagás por revisar, no por reconstruir.
6. **Medición desde el día uno:** sabés qué canal funciona antes de gastar un peso en pauta.
7. **Replicabilidad:** el mismo Spec sirve para el bot de WhatsApp, para Tododeia, o para el próximo proyecto. El sistema es el activo, no cada landing individual.

## Problemas de los que te salvaste (ja)

- **El baneo de Meta:** usar la lib no oficial "porque es gratis" → número bloqueado con clientes adentro. La receta arranca por la API oficial.
- **El bot amnésico:** sin las 3 tablas, cada mensaje arranca de cero y el cliente repite todo → parece un contestador tonto, no un agente.
- **La factura sorpresa del modelo:** mandar TODO el historial en cada mensaje escala el costo por conversación; el esquema resumen+ventana lo mantiene chato.
- **El mes perdido programando un calendario/pagos propio** que Cal.com y MercadoPago resuelven en una hora.
- **El funnel muerto en silencio:** sin evento de conversión ni fallback, el iframe se cae o nadie convierte y no te enterás (el error que tiene Geremia&Co hoy).
- **La reunión legal caótica de 5 horas:** llegar al abogado sin saber qué datos guardás, dónde, ni qué prometiste en la landing = pagar honorarios por ordenar tu propio caos.
- **Formalizar antes de validar:** gastar en estructura/marca/sociedad para un producto que después nadie compra — exactamente el error inverso al que le pasa a los founders desordenados: los dos extremos queman plata.
- **El "lo arreglo después":** el disclaimer y el opt-out visibles desde el día uno cuestan 10 minutos; ponerlos después de un problema cuesta el negocio.
