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
│ Tododeia + │   │ TradeAgent │   │ DrawdownGrd│   │ MT5 / Simu- │
│ TimesFM    │   │ (Claude)   │   │ determinista│   │ lado / CCXT │
│            │   │            │   │  SIN LLM   │   │             │
└────────────┘   └────────────┘   └────────────┘   └────────────┘
      ▲            └───────── TradingMY (núcleo) ─────────┘
      │          feedback loop           │
      └──────── 5. MEMORIA + MÉTRICAS ◀──┘
                (accuracy, PnL, Kelly, rachas, logs)
```

**Regla de oro:** la capa de riesgo es código determinista (límites de posición, stop-loss, drawdown máximo, kill-switch). Un LLM jamás tiene la última palabra sobre una orden real.

## Qué aporta cada repositorio analizado

| Repositorio | Qué es | Qué se toma | Capa B'H |
|---|---|---|---|
| **[ProyectoG007/TradingMY_claude](https://github.com/ProyectoG007/TradingMY_claude)** (fork de devmv1979-star/TradingMY) | Sistema de trading algorítmico Python FTMO-compliant: TradeAgent con Claude, riesgo determinista (DrawdownGuard), brokers MT5/simulado, Telegram con aprobación manual, backtesting con Monte Carlo/Kelly, dashboard React, 119+ tests | **NÚCLEO OPERATIVO** — implementa las etapas 2, 3 y 4 completas. Se extiende, no se reconstruye | 2-4, 7-10 |
| **maia-skill-trading** (este repo, base de [Hainrixz/maia-skill](https://github.com/Hainrixz/maia-skill)) | Skill Claude Code "Tododeia": 5 agentes (4 sectoriales + 1 estrategia), perfiles de riesgo, precisión histórica, dashboard Next.js bilingüe | **Etapa 1 (Señal macro)**: contexto multi-sector diario que alimenta al TradeAgent | 7 (Agentes) + 8 (UI) |
| **[google-research/timesfm](https://github.com/google-research/timesfm)** (TimesFM, de tus capturas) | Modelo fundacional de Google para forecasting de series temporales, preentrenado, zero-shot | **Señal cuantitativa**: pronóstico con cuantiles que contrasta la decisión del LLM (regla de divergencia) | 7 (Modelos) |
| **[ProyectoG007/Superalgos_trading](https://github.com/ProyectoG007/Superalgos_trading)** (fork de Superalgos v1.6.1) | Plataforma open-source completa: data mining de exchanges, backtesting, paper/live crypto, Bitcoin-Factory (ML/TensorFlow) | **Opcional/laboratorio**: data mining y backtesting crypto; para producción crypto se prefiere `CCXTBroker` en TradingMY | 1-4 (opcional) |
| **[ProyectoG007/TradingAgents](https://github.com/ProyectoG007/TradingAgents)** (fork, ya en tu cuenta) | Framework multi-agente LLM: debate bull vs bear, trader, risk manager | Referencia de diseño para evolucionar el prompt del TradeAgent (fase E5) | 7 (Agentes) |

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

1. **F0 — Consolidación** ✅: análisis de los 4 repos, SPEC v1.1 y backlog.
2. **F1 — Integración de señales** 🔶 en curso: microservicio TimesFM, esquema Postgres, Tododeia persiste `macro_context.json`, TradeAgent de TradingMY lo recibe (junto al forecast) en su prompt. Falta crear el proyecto Postgres real (P0, pendiente de confirmación del owner) y correr `services/timesfm/` con el checkpoint descargado.
3. **F2 — Validación**: backtest A/B (con y sin contexto) + **mínimo 4 semanas en paper/demo**.
4. **F3 — Riesgo + crypto**: reglas de divergencia y contexto macro en el RiskManager; `CCXTBroker` para crypto spot.
5. **F4 — Live (capital mínimo)**: MT5 real (FTMO) con confirmación por Telegram los primeros 60 días.
6. **F5 — Evolución**: loop de feedback accuracy/PnL → ajuste de prompts y estrategias.

El detalle de cada fase, esquemas de datos y criterios de aceptación está en [SPEC.md](SPEC.md).

## Estructura del repositorio

```
maia-skill-trading/
  SKILL.md               # Skill Tododeia (orquestador de análisis) — Etapa 1
  references/             # Prompts de los 5 agentes
  dashboard/              # Dashboard Next.js (UI, Capa 8)
  assets/                 # Template HTML de respaldo
  services/timesfm/       # Microservicio de forecast cuantitativo (M2)
  scripts/
    persist_macro_context.py  # Tododeia -> macro_context.json (+ Postgres opcional)
  db/
    schema.sql             # Esquema Postgres completo (Capa 2 + pgvector)
  docs/
    TODODEIA_README.md      # Documentación original del skill base
    n8n/                    # Workflows de orquestación (Capa 3)
  tests/                   # Tests de scripts/ (pytest)
  SPEC.md                 # Spec técnico del sistema completo (E1–E5)
  PENDIENTES.md           # Backlog priorizado
  .env.example            # Variables de entorno del sistema
```

## Aviso legal

Este sistema es para fines informativos y educativos. No constituye asesoramiento financiero. El trading algorítmico puede producir pérdidas totales del capital. Operá siempre primero en paper trading y nunca con capital que no puedas perder.

## Licencia

MIT — ver [LICENSE](LICENSE)
