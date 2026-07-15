# MAIA Trading System — Protocolo B'H

**Sistema robusto de trading multi-agente** que integra análisis de mercado con IA (Tododeia/maia-skill), forecasting cuantitativo (TimesFM) y un motor de ejecución/backtesting (Superalgos), bajo la arquitectura de 10 capas del Protocolo B'H y el ciclo de desarrollo E5.

> 📄 **Spec técnico completo:** [SPEC.md](SPEC.md)
> 📋 **Backlog y pendientes:** [PENDIENTES.md](PENDIENTES.md)
> 📦 **Documentación del skill base (Tododeia):** [docs/TODODEIA_README.md](docs/TODODEIA_README.md)

---

## Principio de diseño

Un sistema de trading robusto **no es un solo programa**: es una tubería de 4 etapas con responsabilidades separadas, donde la IA propone pero **nunca ejecuta directamente**:

```
┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
│ 1. SEÑAL   │──▶│ 2. DECISIÓN│──▶│ 3. RIESGO  │──▶│ 4. EJECUCIÓN│
│ (análisis) │   │ (estrategia)│   │ (determinista│  │ (exchange) │
│ LLM + ML   │   │ LLM + reglas│   │  SIN LLM)  │   │ Superalgos/ │
│            │   │             │   │            │   │ CCXT        │
└────────────┘   └────────────┘   └────────────┘   └────────────┘
      ▲                                  │
      │          feedback loop           ▼
      └──────── 5. MEMORIA + MÉTRICAS ◀──┘
                (precisión histórica, PnL, logs)
```

**Regla de oro:** la capa de riesgo es código determinista (límites de posición, stop-loss, drawdown máximo, kill-switch). Un LLM jamás tiene la última palabra sobre una orden real.

## Qué aporta cada repositorio analizado

| Repositorio | Qué es | Qué se toma | Capa B'H |
|---|---|---|---|
| **maia-skill-trading** (este repo, base de [Hainrixz/maia-skill](https://github.com/Hainrixz/maia-skill)) | Skill Claude Code "Tododeia": 5 agentes (4 sectoriales + 1 estrategia), perfiles de riesgo, precisión histórica, dashboard Next.js bilingüe | **Etapa 1 (Señal)** completa: orquestación multi-agente, esquemas JSON de reporte, tracking de accuracy, dashboard | 7 (Agentes) + 8 (UI) |
| **[ProyectoG007/Superalgos_trading](https://github.com/ProyectoG007/Superalgos_trading)** (fork de Superalgos v1.6.1) | Plataforma open-source completa: data mining de exchanges, diseñador visual de estrategias, backtesting, paper trading, ejecución live, Bitcoin-Factory (ML/TensorFlow) | **Etapas 3 y 4**: backtesting, paper/live trading vía exchanges, gestión de tareas 24/7. Se usa como *motor*, no como base del código propio | 1-4 (Infra, Datos, Ejecución) |
| **[ProyectoG007/TradingAgents](https://github.com/ProyectoG007/TradingAgents)** (fork, ya en tu cuenta) | Framework multi-agente LLM: analistas fundamental/técnico/sentimiento, debate bull vs bear, trader, risk manager | **Etapa 2 (Decisión)**: patrón de debate adversarial y risk manager como referencia de diseño | 7 (Agentes) |
| **[google-research/timesfm](https://github.com/google-research/timesfm)** (TimesFM, de tus capturas) | Modelo fundacional de Google para forecasting de series temporales, preentrenado, zero-shot | **Señal cuantitativa**: pronóstico de precios que complementa (y contrasta) el análisis LLM | 7 (Modelos) |
| **devmv1979-star/TradingMY** | ⚠️ No accesible desde esta sesión (pertenece a otro dueño y no existe fork bajo `ProyectoG007`) | Pendiente — ver [PENDIENTES.md](PENDIENTES.md#p0) | — |

## Arquitectura: mapeo a las 10 capas B'H

| Capa | Componente en este sistema |
|---|---|
| **1. Infraestructura** | Railway/Hetzner: contenedor para Superalgos headless + n8n; ejecución de skills en Claude Code |
| **2. Base de Datos** | PostgreSQL (Supabase): señales, órdenes, posiciones, PnL, historial de accuracy |
| **3. Orquestación** | n8n: cron de análisis diario, pipeline señal→decisión→riesgo→ejecución, alertas |
| **4. Skills & Tools** | Skill `investment-analysis` (Tododeia), APIs de mercado (CoinGecko, Yahoo, exchange), CCXT |
| **5. Persistencia & Vector** | pgvector: memoria RAG de reportes pasados, noticias y lecciones aprendidas por el agente |
| **6. Integración & Webhooks** | Webhooks n8n ↔ Superalgos Trading Signals; webhooks de exchange; TradingView (opcional) |
| **7. Agentes & LLM** | 5 agentes Tododeia (Claude API) + agente de decisión con debate bull/bear (patrón TradingAgents) + TimesFM para forecast |
| **8. UI/UX** | Dashboard Next.js (ya existe en `dashboard/`) extendido con vista de posiciones y PnL |
| **9. Canales** | Telegram/WhatsApp: alertas de señal, confirmación manual de órdenes, resumen diario |
| **10. Seguridad & Observabilidad** | API keys de exchange en secrets (solo-trade, sin retiro), kill-switch, logs estructurados, métricas de latencia y accuracy |

## Fases de implementación (resumen)

1. **F0 — Consolidación**: este repo como monorepo del sistema; specs y esquemas JSON congelados.
2. **F1 — Señal**: Tododeia productivo con salida a Postgres + TimesFM como señal cuantitativa.
3. **F2 — Decisión + Paper Trading**: agente de decisión (debate) → Superalgos en modo paper. **Mínimo 4 semanas en paper.**
4. **F3 — Capa de Riesgo**: módulo determinista con límites duros y kill-switch. Auditada con tests.
5. **F4 — Live (capital mínimo)**: ejecución real con posiciones chicas y confirmación por Telegram.
6. **F5 — Evolución**: loop de feedback accuracy/PnL → ajuste de prompts y estrategias.

El detalle de cada fase, esquemas de datos y criterios de aceptación está en [SPEC.md](SPEC.md).

## Estructura del repositorio

```
maia-skill-trading/
  SKILL.md              # Skill Tododeia (orquestador de análisis) — Etapa 1
  references/           # Prompts de los 5 agentes
  dashboard/            # Dashboard Next.js (UI, Capa 8)
  assets/               # Template HTML de respaldo
  SPEC.md               # Spec técnico del sistema completo (E1–E5)
  PENDIENTES.md         # Backlog priorizado
  docs/
    TODODEIA_README.md  # Documentación original del skill base
```

## Aviso legal

Este sistema es para fines informativos y educativos. No constituye asesoramiento financiero. El trading algorítmico puede producir pérdidas totales del capital. Operá siempre primero en paper trading y nunca con capital que no puedas perder.

## Licencia

MIT — ver [LICENSE](LICENSE)
