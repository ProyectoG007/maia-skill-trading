# SPEC — Sistema Robusto de Trading MAIA (Protocolo B'H / Ciclo E5)

**Versión:** 1.0 · **Fecha:** 2026-07-15 · **Owner:** ProyectoG007
**Estado:** Aprobación pendiente → luego F1

Este documento sigue el **Protocolo E5** (Entendimiento → Estructuración → Ejecución → Evaluación → Evolución) y mapea cada componente a las **10 capas B'H**.

---

## E1 — Entendimiento

### Requerimiento

Construir un sistema de trading robusto que:

1. **Analice** mercados (crypto, acciones, forex, materias primas) con agentes IA — ya resuelto en ~80% por el skill Tododeia de este repo.
2. **Pronostique** precios con un modelo cuantitativo (TimesFM) para contrastar la opinión de los LLM.
3. **Decida** operaciones combinando ambas señales con un perfil de riesgo.
4. **Ejecute** en exchange — primero simulado (paper), después real — usando Superalgos como motor.
5. **Aprenda**: registre cada llamada (señal → resultado real) y ajuste su comportamiento.

### Inputs / Outputs / Contexto (definición E1)

| Elemento | Definición |
|---|---|
| **Inputs** | Datos de mercado en vivo (web research + APIs), OHLCV histórico (Superalgos data mining), perfil de riesgo del usuario, historial de señales previas (RAG) |
| **Contexto RAG** | Reportes históricos (`output/history/*.json`), accuracy por agente/sector, lecciones de trades cerrados |
| **Output esperado** | Señales estructuradas (JSON), órdenes ejecutadas con gestión de riesgo, dashboard con PnL y accuracy, alertas por Telegram |
| **No-objetivos (v1)** | HFT/scalping (latencia LLM lo impide), derivados complejos, apalancamiento, multi-exchange simultáneo |

### Análisis de los repositorios fuente

#### 1. `maia-skill-trading` / `Hainrixz/maia-skill` (Tododeia) — LEÍDO ✅

- **Qué es:** Skill de Claude Code. Orquestador (`SKILL.md`) que lanza 4 agentes sectoriales en paralelo (crypto, stocks, forex, commodities) + 1 agente de estrategia que sintetiza, rankea por riesgo ajustado y asigna portafolio. Guarda historial (`output/history/YYYY-MM-DD.json`), trackea accuracy contra resultados reales, y sirve dashboard Next.js bilingüe (puerto 3420) con fallback HTML.
- **Fortalezas:** esquemas JSON ya definidos y probados; perfiles de riesgo; verificación cruzada de fuentes (2+ fuentes con agreement score); sentimiento social; tracking de precisión histórica; UI lista.
- **Debilidades para trading real:** no ejecuta órdenes; los datos vienen de web research (sin garantía de frescura/precisión tick-level); no hay backtesting; el output es un reporte, no una señal accionable por máquina.
- **Veredicto:** es la **Etapa 1 (Señal)** del sistema. Se extiende, no se reescribe.

#### 2. `ProyectoG007/Superalgos_trading` (fork de Superalgos v1.6.1) — LEÍDO ✅

- **Qué es:** Plataforma completa Node.js (~6.800 archivos): data mining de exchanges (OHLCV + indicadores), diseñador visual de estrategias, backtesting, paper trading, live trading (CCXT), TaskServer para bots 24/7, red de señales (Trading-Signals), Portfolio-Management, y **Bitcoin-Factory** (forecasting ML con TensorFlow — precedente directo de lo que haremos con TimesFM).
- **Fortalezas:** motor de ejecución y backtesting maduro y battle-tested; corre headless en Docker/cloud; maneja claves de exchange; simulación realista con slippage y fees.
- **Debilidades:** curva de aprendizaje alta; monolito grande; su UI visual no se integra con nuestro stack; el fork está desactualizado respecto a upstream.
- **Veredicto:** **motor de las Etapas 3-4 (Backtesting + Ejecución)**. Se usa como servicio externo (headless), NO se mezcla su código con este repo. La integración es por **Trading Signals / webhooks / archivos de señal**, no por código compartido.

#### 3. `devmv1979-star/TradingMY` — NO ACCESIBLE ⚠️

- Pertenece a otro dueño y no existe fork bajo `ProyectoG007`, por lo que esta sesión no pudo leerlo (restricción de scope entre owners).
- **Acción requerida (P0 en PENDIENTES.md):** hacer fork a `ProyectoG007/TradingMY` o iniciar una sesión con ese repo como fuente inicial. El spec reserva un slot para él en la Etapa que corresponda una vez analizado.

#### 4. Contexto adicional detectado

- **`ProyectoG007/TradingAgents` y `TradingAgents-CN`** (forks ya en tu cuenta): framework multi-agente LLM para trading (analistas fundamental/técnico/sentimiento/noticias, debate bull vs. bear, trader, equipo de riesgo). Aporta el patrón de **debate adversarial** para la Etapa 2 (Decisión).
- **TimesFM** (`google-research/timesfm`, de tus capturas de Instagram): modelo fundacional de series temporales de Google, zero-shot, disponible en Hugging Face (`google/timesfm-2.0-500m-pytorch`). Aporta el **forecast cuantitativo** que le falta a Tododeia.

### Criterio de "no ambigüedad" (gate E1 → E2)

- ✅ Alcance v1: crypto spot (BTC, ETH + descubrimiento dinámico), 1 exchange (Binance u otro disponible en tu región vía CCXT), timeframes 1h-1d.
- ✅ La IA propone, la capa de riesgo determinista dispone, el humano confirma (modo semi-automático en F4).
- ⚠️ Pendiente de decisión del owner: exchange concreto y capital inicial de F4 (no bloquea F1-F3).

---

## E2 — Estructuración

### Arquitectura general

```
                    CAPA 3 (n8n orquesta todo por cron/webhook)
 ┌──────────────────────────────────────────────────────────────────────┐
 │                                                                      │
 │  [ETAPA 1: SEÑAL]                [ETAPA 2: DECISIÓN]                 │
 │  ┌─────────────────┐             ┌──────────────────┐                │
 │  │ Tododeia        │  report.json│ Agente Decisión  │ decision.json  │
 │  │ 4 agentes + 1   ├────────────▶│ (debate bull/bear│───────┐        │
 │  │ estrategia      │             │  + risk manager) │       │        │
 │  └─────────────────┘             └──────────────────┘       │        │
 │  ┌─────────────────┐                    ▲                   ▼        │
 │  │ TimesFM Service │  forecast.json     │          [ETAPA 3: RIESGO] │
 │  │ (forecast quant)├────────────────────┘          ┌──────────────┐  │
 │  └─────────────────┘                               │ Risk Engine  │  │
 │           ▲                                        │ DETERMINISTA │  │
 │           │ OHLCV                                  │ (sin LLM)    │  │
 │  ┌────────┴────────┐                               └──────┬───────┘  │
 │  │ Superalgos      │◀──────── señal aprobada ─────────────┘          │
 │  │ Data Mining +   │          (webhook/signal)                       │
 │  │ Backtest +      │  [ETAPA 4: EJECUCIÓN]                           │
 │  │ Paper/Live      │─────▶ Exchange (CCXT)                           │
 │  └─────────────────┘                                                 │
 │           │                                                          │
 │           ▼ fills, PnL                                               │
 │  ┌─────────────────┐    ┌──────────────┐    ┌────────────────┐       │
 │  │ Postgres +      │───▶│ Dashboard    │    │ Telegram       │       │
 │  │ pgvector (memoria)   │ Next.js      │    │ (alertas/confirm)      │
 │  └─────────────────┘    └──────────────┘    └────────────────┘       │
 └──────────────────────────────────────────────────────────────────────┘
```

### Capas B'H tocadas por módulo

| Módulo | Capas B'H | Tecnología |
|---|---|---|
| M1 Señal LLM (Tododeia) | 4, 7 | Claude Code skill (existente, se extiende) |
| M2 Señal Quant (TimesFM) | 4, 7 | Python + `timesfm` (HF) como microservicio FastAPI |
| M3 Decisión | 7 | Agente LLM con patrón debate (ref. TradingAgents) |
| M4 Risk Engine | 10 | TypeScript/Python puro, testeado, sin LLM |
| M5 Ejecución | 1, 6 | Superalgos headless (Docker) + Trading Signals/webhook |
| M6 Datos & Memoria | 2, 5 | Postgres (Supabase) + pgvector |
| M7 Orquestación | 3, 6 | n8n (cron + webhooks) |
| M8 UI | 8 | Dashboard Next.js existente + vistas de posiciones/PnL |
| M9 Canales | 9 | Bot de Telegram (alertas + confirmación de órdenes) |
| M10 Observabilidad | 10 | Logs JSON estructurados, métricas, kill-switch |

### Modelo de datos (Postgres — Capa 2)

```sql
-- Señales generadas (Etapa 1)
CREATE TABLE signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT NOT NULL,           -- 'tododeia' | 'timesfm'
  symbol        TEXT NOT NULL,           -- 'BTC/USDT'
  direction     TEXT NOT NULL,           -- 'buy' | 'sell' | 'hold'
  confidence    NUMERIC(3,1) NOT NULL,   -- 0-10
  horizon       TEXT NOT NULL,           -- '1d' | '7d' | '30d'
  price_at_signal NUMERIC NOT NULL,
  forecast_price  NUMERIC,               -- solo timesfm
  raw_payload   JSONB NOT NULL           -- reporte completo del agente
);

-- Decisiones (Etapa 2): fusión de señales + perfil de riesgo
CREATE TABLE decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  signal_ids    UUID[] NOT NULL,
  symbol        TEXT NOT NULL,
  action        TEXT NOT NULL,           -- 'open_long' | 'close' | 'no_trade'
  size_pct      NUMERIC NOT NULL,        -- % del portafolio propuesto
  stop_loss     NUMERIC,
  take_profit   NUMERIC,
  reasoning     TEXT NOT NULL,
  risk_profile  TEXT NOT NULL
);

-- Veredictos del Risk Engine (Etapa 3) y órdenes (Etapa 4)
CREATE TABLE orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   UUID REFERENCES decisions(id),
  risk_verdict  TEXT NOT NULL,           -- 'approved' | 'rejected' | 'resized'
  risk_reasons  TEXT[],
  mode          TEXT NOT NULL,           -- 'paper' | 'live'
  status        TEXT NOT NULL,           -- 'pending_confirm' | 'sent' | 'filled' | 'cancelled'
  exchange_order_id TEXT,
  filled_price  NUMERIC,
  filled_at     TIMESTAMPTZ
);

-- Resultado real de cada señal (para accuracy — cierra el loop E5)
CREATE TABLE signal_outcomes (
  signal_id     UUID REFERENCES signals(id),
  evaluated_at  TIMESTAMPTZ NOT NULL,
  price_actual  NUMERIC NOT NULL,
  was_correct   BOOLEAN NOT NULL,
  pnl_pct       NUMERIC
);
```

Además: `pgvector` para embeddings de reportes/noticias (memoria RAG del agente de decisión, Capa 5).

### Contratos JSON entre etapas (Capa 6)

**`forecast.json` (M2 TimesFM → M3):**

```json
{
  "source": "timesfm",
  "symbol": "BTC/USDT",
  "generated_at": "2026-07-15T12:00:00Z",
  "horizon_hours": 168,
  "last_price": 67500.0,
  "forecast": [{"t": "+24h", "mean": 68200.0, "q10": 65900.0, "q90": 70100.0}],
  "trend": "up",
  "confidence_note": "quantile spread 6.2% — moderada"
}
```

**`decision.json` (M3 → M4 Risk Engine):** mismo shape que la tabla `decisions` (arriba).

**Señal aprobada (M4 → Superalgos):** webhook HTTP al TaskServer / Trading-Signals de Superalgos con `{symbol, action, size, stop_loss, take_profit, mode}`. Respuesta esperada HTTP 200 (estándar E4).

### Reglas del Risk Engine (M4 — deterministas, configurables en un YAML)

1. Tamaño máximo por posición: 5% del capital (2% en perfil conservador).
2. Exposición total máxima: 30% del capital; resto en stable/cash.
3. Stop-loss obligatorio en toda orden; rechazo si la decisión no lo trae.
4. Drawdown diario > 3% → kill-switch: cierra nuevas aperturas 24h y alerta por Telegram.
5. Máx. 3 órdenes/día; cooldown de 4h por símbolo.
6. Divergencia dura: si TimesFM y Tododeia se contradicen con confianza alta en ambos → `no_trade` forzado.
7. Modo live requiere confirmación humana por Telegram hasta acumular 60 días de track record.

---

## E3 — Ejecución (plan de construcción por fases)

### F0 — Consolidación (esta entrega)
- [x] Análisis de repos fuente y arquitectura.
- [x] `README.md`, `SPEC.md`, `PENDIENTES.md` en este repo.

### F1 — Etapa Señal (2 semanas)
- Extender `SKILL.md`/Step 7 para escribir cada reporte también en Postgres (tabla `signals`) además de `output/history/`.
- Microservicio `services/timesfm/` (FastAPI): endpoint `POST /forecast {symbol, horizon}` → usa OHLCV del exchange (ccxt) o del data mining de Superalgos; devuelve `forecast.json`.
- n8n: workflow cron diario → dispara análisis Tododeia + forecast TimesFM → inserta señales.

### F2 — Decisión + Paper (3 semanas)
- `services/decision/`: agente Claude API con debate bull/bear (2 pasadas) + síntesis; input = señales del día + memoria RAG; output = `decision.json`.
- Superalgos headless en Docker (Railway/Hetzner) con data mining del exchange elegido.
- Conector señal→Superalgos en modo **paper trading**.
- Gate de salida: **≥ 4 semanas de paper** con métricas registradas.

### F3 — Risk Engine (2 semanas, en paralelo con la corrida paper)
- `services/risk/`: módulo puro con las 7 reglas, config YAML, 100% cubierto por tests unitarios.
- Bot de Telegram (Capa 9): alertas de señal/rechazo y comando `/kill` manual.

### F4 — Live con capital mínimo
- API keys del exchange **solo-trade (sin retiros)**, en secrets del hosting (Capa 10).
- Confirmación humana por Telegram para cada orden live.
- Criterio de entrada: paper con win-rate y drawdown dentro de umbrales definidos al cierre de F2.

### F5 — Evolución (continuo) — ver E5

### Estándares de código (E3)
- Módulos respetan límites de capa: la señal no conoce al exchange; el riesgo no llama LLMs.
- Todo intercambio entre módulos = JSON versionado (`"schema_version": 1`).
- Manejo de errores localizado por módulo (el fallo de TimesFM no tumba a Tododeia; ya existe patrón `data_unavailable` en SKILL.md — se extiende).

---

## E4 — Evaluación

| Prueba | Criterio de aceptación |
|---|---|
| Unit tests Risk Engine | 100% de las reglas cubiertas; mutación de config YAML → comportamiento esperado |
| Integración señal→orden | Señal sintética atraviesa las 4 etapas y produce orden paper en < 60s |
| Webhooks (Capa 6) | Todos responden HTTP 200 bajo carga simulada (k6/artillery, 50 req/min) |
| Precisión RAG | El agente de decisión cita ≥1 lección histórica relevante cuando existe |
| Latencia IA | Análisis completo Tododeia < 10 min; forecast TimesFM < 30s |
| Backtest | Estrategia base backtesteada en Superalgos sobre ≥ 12 meses de datos antes de paper |
| Paper trading | ≥ 4 semanas, ≥ 20 señales evaluadas en `signal_outcomes` |
| Kill-switch | Simulación de drawdown 3% detiene aperturas y alerta en < 1 min |

---

## E5 — Evolución

- **Loop de accuracy (ya iniciado por Tododeia):** job semanal en n8n evalúa señales vencidas → llena `signal_outcomes` → recalcula accuracy por agente/sector → el reporte siguiente recibe ese contexto (el agente aprende qué sector viene fallando).
- **Optimización de costos:** revisar logs (Capa 10) de tokens por corrida; mover agentes sectoriales a modelo más barato si la accuracy no se degrada; cachear research intradía.
- **Refactor trimestral:** sync del fork de Superalgos con upstream; upgrade de TimesFM cuando salga versión nueva.
- **Documentación viva:** cada cambio de esquema JSON incrementa `schema_version` y se documenta en `docs/`.
- **Escalado:** multi-exchange y sectores no-crypto en ejecución solo después de 90 días de track record live positivo.

---

## Decisiones abiertas (requieren al owner)

1. **Exchange para F2/F4** (Binance, Bybit, Kraken — según disponibilidad regional).
2. **Capital inicial de F4.**
3. **TradingMY:** fork a `ProyectoG007` para analizarlo e integrarlo al spec (P0 en PENDIENTES.md).
4. **Hosting:** Railway (simple) vs. Hetzner (más barato para Superalgos 24/7 — recomendado por consumo de recursos del data mining).
