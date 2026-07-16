# Informe de análisis: Geremia&Co — Landing "Diagnóstico Estratégico"

**URL analizada:** https://www.geremiaco.com/diagnostico
**Fecha del análisis:** 2026-07-16
**Objetivo:** extraer patrones de producto, funnel, copywriting y stack técnico aplicables a proyectos propios de desarrollo de software.

---

## 1. Qué es y qué vende

Geremia&Co es una consultora boutique (Argentina, `og:locale es_AR`) de estructuración legal y fiscal internacional para founders de startups. El producto de entrada es un **"Diagnóstico Estratégico™"**: una sesión de trabajo paga/agendada que funciona como puerta de acceso a servicios de mayor valor (reestructuración societaria, holdings, protección patrimonial).

**Propuesta de valor en una frase:** *"Tu startup ya está en otra etapa. Tu estructura legal y fiscal, no."*

Es un modelo clásico de **servicio productizado**: en lugar de vender "horas de abogado", empaquetan un entregable con nombre propio, alcance definido y un único CTA.

## 2. Estructura del funnel

El tráfico llega desde **Instagram Ads** (los parámetros `utm_source=ig`, `utm_medium=paid` y `fbclid` de la URL lo confirman) a una landing dedicada — no a la home. El recorrido:

1. **Anuncio pago en IG/Meta** → landing `/diagnostico` con UTMs completos por campaña, ad set y anuncio (`utm_campaign`, `utm_term`, `utm_content` con IDs de Meta).
2. **Awareness:** hero con la tensión central + sección de "3 problemas" (runway que se drena, estructura no lista para inversores, riesgo patrimonial).
3. **Consideración:** bio del founder con credenciales (Máster en Di Tella, LLM en UT Austin, Big Four, fintech), sección de "por qué los founders lo postergan" (objeciones psicológicas).
4. **Calificación:** sección explícita de "es para vos / no es para vos" que filtra leads antes de que agenden.
5. **Decisión:** FAQ extenso (~21 preguntas en 3 categorías espejo de los 3 problemas).
6. **Acción:** widget de agendamiento embebido (calendario con fecha/hora + captura de datos previa a la sesión).

No hay precio visible, no hay testimonios: la conversión descansa en autoridad personal + calificación honesta.

## 3. Stack técnico detectado

| Capa | Tecnología | Evidencia |
|---|---|---|
| Frontend | **Next.js (App Router)** en producción | rutas `/_next/static/chunks/main-app-*.js`, `/_next/image` |
| Agendamiento | **LeadConnector / GoHighLevel** (widget embebido en iframe) | `api.leadconnectorhq.com/widget/booking/...` |
| Analytics/Ads | **Meta Pixel** (id 1289743186671529) con evento PageView + noscript fallback | `fbevents.js`, `facebook.com/tr` |
| SEO | Title y meta description trabajados, OpenGraph completo (title, description, image, locale) | tags `<meta property="og:*">` |
| Internacionalización | Selector de idioma ES (preparado para multi-idioma) | header de la home |

Observaciones técnicas:

- **No usan Google Analytics ni GTM**: solo Meta Pixel. Coherente con que todo el tráfico pago viene de Meta — miden lo que necesitan y nada más.
- El agendamiento **no es custom**: delegan calendario, recordatorios y CRM a GoHighLevel vía iframe. Cero backend propio para la parte más crítica del funnel.
- Next.js probablemente esté desplegado como sitio estático/SSR simple; la página es esencialmente contenido + un embed.

## 4. Patrones de copywriting que funcionan

- **Tensión antes que solución:** el hero no describe el servicio, describe el desfase ("tu startup creció, tu estructura no").
- **Especificidad como señal de expertise:** mencionan "cap table", "flip societario", "Cayman Sandwich" sin simplificar de más. El lector técnico se siente reconocido.
- **Anti-hype / anti-venta:** "no es una llamada de ventas, es una sesión de trabajo", "te digo honestamente si no tiene sentido trabajar juntos". La honestidad explícita es el diferenciador.
- **Descalificación deliberada:** decir públicamente para quién NO es (pre-validación, 100% doméstico, buscadores de evasión) sube la calidad del lead y refuerza el posicionamiento.
- **Objeciones nombradas:** la sección "por qué lo postergás" ('lo arreglo después', asesores fragmentados, falsa confianza) desarma las excusas antes del CTA.
- **Marca en el entregable:** "Diagnóstico Estratégico™" — nombrar y marcar el servicio lo convierte en producto.

## 5. Lecciones aplicables a tus proyectos de software

Pensando en proyectos como **Tododeia** (skill de análisis de inversiones con dashboard Next.js) y futuros productos:

### Producto y posicionamiento
1. **Productizá el entregable.** No vendas "un skill de análisis"; vendé un "Informe de Oportunidades™" con nombre, alcance y formato fijo. Un output con marca es más fácil de comunicar, precificar y publicitar.
2. **Definí el anti-cliente.** Una sección "esto NO es para vos" (ej: "no es asesoramiento financiero", "no es para day-traders que buscan señales") filtra usuarios problemáticos y aumenta la confianza de los correctos.
3. **Autoridad > testimonios al inicio.** Si todavía no tenés casos de éxito, una bio sólida y honesta del creador (como hace Geremia) sostiene la conversión. No inventes social proof.

### Funnel y landing
4. **Landing dedicada por campaña, nunca la home.** `/diagnostico` existe solo para convertir tráfico pago. Si promocionás Tododeia, hacé una `/analisis` con un solo CTA.
5. **Un único CTA repetido.** Toda la página empuja a una sola acción (agendar). En un producto de software: "instalar" o "probar el demo", no cinco botones distintos.
6. **UTMs granulares desde el día uno.** La URL del anuncio lleva campaign/adset/ad IDs. Cualquier link que compartas o pagues debería llevar UTMs para saber qué canal convierte.
7. **La estructura problema → consecuencia → solución → objeciones → calificación → FAQ → CTA** es una plantilla reutilizable para cualquier landing técnica.

### Stack y decisiones de ingeniería
8. **No construyas lo que podés embeber.** El agendamiento (la pieza más crítica de su negocio) es un iframe de GoHighLevel. Equivalentes para vos: Cal.com/Calendly para llamadas, Stripe Payment Links para cobrar, Tally/Typeform para formularios. Backend propio solo cuando el embed se queda corto.
9. **Medí solo lo que vas a usar.** Un pixel bien puesto (con fallback `noscript`) vale más que GA4 + GTM + Hotjar sin nadie mirándolos. Elegí la herramienta del canal donde invertís.
10. **SEO/OG básico no es opcional:** title, description y OpenGraph con imagen hacen que cada link compartido en redes/WhatsApp se vea profesional. Es una hora de trabajo con retorno permanente.
11. **Next.js como default razonable** para landings de producto: imagen optimizada, SSR/SSG, deploy trivial en Vercel. Tu dashboard de Tododeia ya está en ese ecosistema — una landing del skill puede compartir stack.
12. **i18n desde el diseño:** ellos ya tienen selector de idioma; Tododeia ya es ES/EN. Mantener contenido separado de estructura (JSON/MDX por idioma) evita reescrituras.

### Lo que yo mejoraría de su implementación (errores a evitar)
- **Dependencia total del iframe de terceros:** si LeadConnector cae o cambia, el funnel muere. Tener un fallback (mailto/WhatsApp) es barato.
- **Sin evento de conversión visible más allá de PageView:** deberían disparar un evento `Schedule`/`Lead` del pixel al completar el booking para optimizar campañas. Si usás Meta Ads, configurá eventos de conversión reales, no solo PageView.
- **Cero prueba social:** funciona para un abogado con credenciales, pero en software vas a necesitar demos, screenshots o números de uso — el producto se puede mostrar, mostralo.
- **Título con marca duplicada** (`| Geremia&Co | Geremia&Co`): descuido menor de SEO; revisá siempre los templates de metadata.

## 6. Checklist rápido para tu próxima landing

- [ ] Nombre propio y marca para el entregable/producto
- [ ] Hero con tensión (problema del usuario), no con features
- [ ] Sección "para quién es / para quién no es"
- [ ] Objeciones respondidas antes del CTA + FAQ por categorías
- [ ] Un solo CTA, repetido 2–3 veces
- [ ] Booking/pago/form embebido de terceros (no custom) + fallback de contacto
- [ ] Pixel/analytics del canal de adquisición con eventos de conversión (no solo PageView)
- [ ] UTMs en todos los links pagos y compartidos
- [ ] Title, meta description y OpenGraph con imagen verificados
- [ ] Landing dedicada por campaña, separada de la home
