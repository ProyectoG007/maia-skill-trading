# SPEC — Sistema Robusto de Trading MAIA (Protocolo B'H / Ciclo E5)

**Versión:** 1.1 · **Fecha:** 2026-07-15 · **Owner:** ProyectoG007
**Cambio v1.1:** se analizó `TradingMY` (fork `ProyectoG007/TradingMY_claude`) — pasa a ser el **núcleo operativo** del sistema. Superalgos se reclasifica como componente opcional/laboratorio.

Este documento sigue el **Protocolo E5** (Entendimiento → Estructuración → Ejecución → Evaluación → Evolución) y mapea cada componente a las **10 capas B'H**.

---

## E1 — Entendimiento

### Requerimiento

Construir un sistema de trading robusto que:

1. **Analice** mercados (crypto, acciones, forex, materias primas) con agentes IA.
2. **Pronostique** precios con un modelo cuantitativo (TimesFM) para contrastar la opinión de los LLM.
3. **Decida** operaciones combinando ambas señales con un perfil de riesgo.
4. **Ejecute** primero simulado (paper/demo), después real, con gestión de riesgo determinista.
5. **Aprenda**: registre cada llamada (señal → resultado real) y ajuste su comportamiento.

### Inputs / Outputs / Contexto (definición E1)

| Elemento | Definición |
|---|---|
| **Inputs** | OHLCV (yfinance/MT5/ccxt), research macro multi-sector (Tododeia), forecast cuantitativo (TimesFM), perfil de riesgo e instrucciones diarias del trader |
| **Contexto RAG** | Reportes históricos de Tododeia, historial de decisiones del agente (`AgentDecision`), accuracy por sector, lecciones de trades cerrados |
| **Output esperado** | Decisiones estructuradas (`TradeDecision`), órdenes con SL/TP y scaling out, dashboard con PnL/accuracy, alertas y aprobación por Telegram |
| **No-objetivos (v1)** | HFT/scalping, derivados complejos, apalancamiento fuera de FTMO, multi-exchange simultáneo |

### Análisis de los repositorios fuente

#### 1. `TradingMY` (`ProyectoG007/TradingMY_claude`, fork de `devmv1979-star/TradingMY`) — LEÍDO ✅ → **NÚCLEO OPERATIVO**

- **Qué es:** sistema de trading algorítmico completo en Python 3.11 (~5.000 líneas core + dashboard FastAPI/React), orientado a **FTMO Challenge** (forex + SPY vía MetaTrader5, con broker simulado para paper).
- **Ya implementa el pipeline completo de 4 etapas:**
  - *Señal:* `src/signals/` (pandas-ta) + `src/strategy/` (RSI+EMA, MACD+BB, multi-voter, StrategyBuilder que genera estrategias desde lenguaje natural vía Telegram).
  - *Decisión:* `src/agents/trade_agent.py` — TradeAgent con Claude API, salida Pydantic `TradeDecision` (action/confidence/SL/TP1/TP2), validada contra límites FTMO.
  - *Riesgo:* `src/risk/` — PositionSizer, RiskManager y **DrawdownGuard determinista** (para a -4% diario / -8% total, margen sobre las reglas FTMO -5%/-10%).
  - *Ejecución:* `src/execution/` — `broker_base.py` (interfaz), `SimulatedBroker` (slippage/spread), `MT5Broker` (con bloqueo `TRADINGMY_CONFIRM_LIVE=1` para live real), OrderManager con timeout y scaling out.
  - *Feedback:* SQLite+SQLModel (trades, decisiones, snapshots), analytics (Kelly, Monte Carlo, esperanza matemática, rachas, win rate por hora/día/activo), 119-138 tests.
  - *Canales:* Telegram completo — alertas, `/status`, `/plan` (instrucciones diarias en lenguaje natural), **aprobación manual con botones inline** y `auto_approve_above: 85`.
- **Debilidades:** solo MT5/yfinance (sin crypto nativo); SQLite (no Postgres); sin señal macro externa ni forecast cuantitativo; el TradeAgent razona solo con indicadores técnicos del momento; fork con bug conocido en `config.yaml` (`symbol_map` de GBPUSD apunta a EURUSD).
- **Veredicto:** **es la columna vertebral del sistema.** No se reconstruye nada de lo que ya tiene: se **extiende** con las señales de Tododeia y TimesFM como contexto del TradeAgent, y con un `CCXTBroker` para crypto spot.

#### 2. `maia-skill-trading` (este repo, base de `Hainrixz/maia-skill` — Tododeia) — LEÍDO ✅ → **CAPA DE SEÑAL MACRO**

- **Qué es:** skill de Claude Code con 5 agentes (4 sectoriales: crypto/stocks/forex/commodities + 1 estrategia) que hace research web en vivo, rankea por riesgo ajustado, trackea accuracy histórica y sirve dashboard Next.js bilingüe.
- **Fortalezas:** visión macro multi-sector que TradingMY no tiene; esquemas JSON probados; perfiles de riesgo; verificación cruzada de fuentes; tracking de precisión.
- **Debilidades:** no ejecuta; datos de web research (no tick-level); output pensado para humanos.
- **Veredicto:** **proveedor de contexto macro** del TradeAgent: "el sector forex está bearish por X, el DXY sube, evento Y esta semana". Corre 1×/día vía cron y persiste señales estructuradas que TradingMY consume.

#### 3. `ProyectoG007/Superalgos_trading` (fork de Superalgos v1.6.1) — LEÍDO ✅ → **OPCIONAL / LABORATORIO CRYPTO**

- **Qué es:** plataforma Node.js masiva (~6.800 archivos): data mining de exchanges, diseñador visual de estrategias, backtesting, paper/live crypto (CCXT), Bitcoin-Factory (ML/TensorFlow).
- **Veredicto v1.1:** dado que TradingMY ya cubre backtesting y ejecución, Superalgos **deja de ser crítico**. Queda como: (a) laboratorio de data mining/backtesting crypto, (b) referencia de diseño. Para operar crypto en producción es más simple agregar `CCXTBroker` a TradingMY (misma interfaz `broker_base.py`) que operar el monolito. Reevaluar si el volumen crypto lo justifica.

#### 4. Complementos

- **TimesFM** (`google-research/timesfm`): modelo fundacional de forecasting de Google (HF: `google/timesfm-2.0-500m-pytorch`), zero-shot. Aporta el **forecast cuantitativo** con cuantiles que le falta al TradeAgent. Precedente en el ecosistema: Bitcoin-Factory de Superalgos.
- **`ProyectoG007/TradingAgents` / `TradingAgents-CN`** (forks en tu cuenta): patrón de **debate bull vs. bear + risk manager** — referencia para evolucionar el prompt del TradeAgent (E5), no se integra código.
- **`ProyectoG007/freqtrade`** (fork detectado en tu cuenta): bot crypto Python maduro; alternativa a `CCXTBroker` propio si se prioriza crypto — decisión abierta.

### Gate E1 → E2

- ✅ Alcance v1: lo que TradingMY ya opera (EURUSD, GBPUSD, SPY) + BTC/ETH cuando exista `CCXTBroker`.
- ✅ La IA propone (TradeAgent), el riesgo determinista dispone (DrawdownGuard/RiskManager), el humano confirma (aprobación Telegram ya implementada).
- ⚠️ Decisiones abiertas al final del documento.

---

## E2 — Estructuración

### Arquitectura v1.1

```
            CAPA 3: n8n / APScheduler (cron diario + ticks del scheduler)
 ┌───────────────────────────────────────────────────────────────────────┐
 │  [SEÑAL MACRO - 1×/día]              [SEÑAL QUANT - por tick]         │
 │  ┌──────────────────┐                ┌──────────────────┐             │
 │  │ Tododeia (skill) │                │ TimesFM Service  │             │
 │  │ 5 agentes web    │                │ FastAPI /forecast│             │
 │  └────────┬─────────┘                └────────┬─────────┘             │
 │           │ macro_context.json                │ forecast.json         │
 │           ▼                                   ▼                       │
 │  ┌────────────────────────────────────────────────────────┐           │
 │  │              TRADINGMY (núcleo operativo)              │           │
 │  │                                                        │           │
 │  │  Scheduler ──▶ TradeAgent (Claude)                     │           │
 │  │                  │ TradeDecision (Pydantic)            │           │
 │  │                  ▼                                     │           │
 │  │  RiskManager + DrawdownGuard (determinista, FTMO)      │           │
 │  │                  │ aprobada/rechazada/resized          │           │
 │  │                  ▼                                     │           │
 │  │  OrderManager ──▶ SimulatedBroker | MT5Broker | CCXT*  │           │
 │  │       │                                    (*nuevo)   │           │
 │  │       ▼ fills, PnL, snapshots                          │           │
 │  │  DB (SQLite → Postgres) + Analytics (Kelly/MC/rachas)  │           │
 │  └───────┬──────────────────────────┬─────────────────────┘           │
 │          ▼                          ▼                                 │
 │  Dashboard FastAPI+React     Telegram (alertas, /plan,                │
 │  (+ dashboard Next.js         aprobación manual inline)               │
 │    de Tododeia)                                                       │
 └───────────────────────────────────────────────────────────────────────┘
     Superalgos (opcional): data mining / backtesting crypto de laboratorio
```

### Capas B'H por módulo

| Módulo | Capas B'H | Estado |
|---|---|---|
| M1 Señal macro (Tododeia) | 4, 7 | ✅ Existe — falta persistir a DB compartida |
| M2 Señal quant (TimesFM) | 4, 7 | 🆕 Microservicio FastAPI a crear |
| M3 Decisión (TradeAgent) | 7 | ✅ Existe en TradingMY — falta inyectar M1+M2 al prompt |
| M4 Riesgo (RiskManager/DrawdownGuard) | 10 | ✅ Existe, testeado — falta regla de divergencia |
| M5 Ejecución (brokers) | 1, 6 | ✅ MT5+Simulado — 🆕 CCXTBroker para crypto |
| M6 Datos & memoria | 2, 5 | ✅ SQLite — migrar a Postgres+pgvector (Supabase) |
| M7 Orquestación | 3, 6 | ✅ APScheduler interno — 🆕 n8n para el cron macro |
| M8 UI | 8 | ✅ 2 dashboards (React de TradingMY + Next.js de Tododeia) |
| M9 Canales | 9 | ✅ Telegram completo en TradingMY |
| M10 Observabilidad | 10 | ✅ Prometheus + logs — falta consolidar métricas de accuracy macro |

### Contratos JSON nuevos (Capa 6)

**`macro_context.json` (M1 Tododeia → M3 TradeAgent), 1×/día:**

```json
{
  "schema_version": 1,
  "source": "tododeia",
  "generated_at": "2026-07-15T12:00:00Z",
  "risk_profile": "moderate",
  "sectors": {
    "forex": {"outlook": "bearish", "summary": "...", "top_pick": "USD/JPY"},
    "crypto": {"outlook": "bullish", "summary": "...", "top_pick": "BTC"}
  },
  "macro_environment": {"interest_rate_outlook": "falling", "geopolitical_risk": "medium", "key_factors": ["..."]},
  "warnings": ["..."],
  "accuracy_last_30d": {"forex": 0.62, "crypto": 0.58}
}
```

**`forecast.json` (M2 TimesFM → M3), por símbolo/tick:**

```json
{
  "schema_version": 1,
  "source": "timesfm",
  "symbol": "EURUSD",
  "generated_at": "2026-07-15T12:00:00Z",
  "horizon_hours": 24,
  "last_price": 1.0842,
  "forecast": [{"t": "+4h", "mean": 1.0851, "q10": 1.0829, "q90": 1.0873}],
  "trend": "up",
  "quantile_spread_pct": 0.4
}
```

Ambos se inyectan en `USER_PROMPT_TEMPLATE` del TradeAgent (`src/agents/prompts.py`) como bloques de contexto adicionales, y se persisten en DB.

### Modelo de datos

TradingMY ya tiene modelos SQLModel (trades, `AgentDecision`, snapshots, `TraderInstructions`, `ChatMessage`). Cambios:

1. **Migración SQLite → Postgres (Supabase)** — SQLModel lo soporta con cambiar la connection string; habilita acceso multi-servicio (n8n, Tododeia, dashboards).
2. **Tablas nuevas:** `macro_signals` (output Tododeia por sector/asset) y `forecasts` (output TimesFM), con FK desde `AgentDecision` para trazabilidad señal→decisión→orden→resultado.
3. **pgvector** para memoria RAG (Capa 5): embeddings de reportes macro y lecciones de trades cerrados.

### Reglas de riesgo (M4) — estado

Ya implementadas en TradingMY: sizing 1%/trade, freno -4% diario / -8% total (margen FTMO), máx. 3 posiciones, SL obligatorio validado en TradeDecision, aprobación manual con timeout, kill-switch (`/brake on`).

**A agregar:**
- **Regla de divergencia:** si TimesFM contradice la dirección del TradeAgent con `quantile_spread_pct` bajo (alta confianza quant) → forzar WAIT.
- **Regla de contexto macro:** si Tododeia marca el sector del símbolo como contrario con accuracy_30d > 60% → reducir sizing al 50% o WAIT (configurable).

---

## E3 — Ejecución (plan por fases)

### F0 — Consolidación ✅ (esta entrega)
Análisis de los 4 repos, SPEC v1.1, backlog.

### F1 — Integración de señales (2-3 semanas)
1. Postgres (Supabase): migrar TradingMY de SQLite + crear `macro_signals`/`forecasts` + pgvector.
2. `services/timesfm/`: FastAPI `POST /forecast {symbol, horizon}`; datos vía yfinance/ccxt.
3. Tododeia: extender Step 7 del SKILL.md para insertar `macro_context` en Postgres.
4. TradingMY: inyectar ambos contextos en el prompt del TradeAgent; guardar FKs en `AgentDecision`.
5. n8n: cron diario que corre Tododeia y verifica la frescura de señales (alerta si >24h sin señal macro — el sistema sigue operando sin ella, degradación elegante).
6. Fix del bug `symbol_map` GBPUSD en config.

### F2 — Validación en paper/demo (≥ 4 semanas corriendo)
1. Backtest de las estrategias activas con el motor existente (walk-forward, Monte Carlo) **con y sin** contexto macro/quant para medir si las señales nuevas realmente mejoran (A/B).
2. Correr SimulatedBroker o MT5 demo con el pipeline completo.
3. Gate de salida: ≥ 20 decisiones evaluadas; esperanza matemática > 0; el A/B muestra que el contexto no degrada.

### F3 — Reglas de riesgo nuevas + crypto (en paralelo con F2)
1. Implementar reglas de divergencia y contexto macro en RiskManager, con tests.
2. `CCXTBroker` implementando `broker_base.py` (crypto spot, exchange a definir) → paper primero.
3. (Alternativa a evaluar: usar el fork de freqtrade para crypto y dejar TradingMY solo forex/FTMO.)

### F4 — Live
- MT5 real (FTMO) con `TRADINGMY_CONFIRM_LIVE=1` + aprobación manual Telegram los primeros 60 días.
- Crypto live solo tras su propio ciclo de paper.

### F5 — Evolución (continuo) — ver E5

### Estándares E3
- Límites de capa intactos: señal no conoce broker; riesgo no llama LLMs; todo intercambio JSON versionado (`schema_version`).
- Fallos aislados: caída de TimesFM/Tododeia degrada a operación técnica pura (comportamiento actual de TradingMY), nunca bloquea el scheduler.

---

## E4 — Evaluación

| Prueba | Criterio de aceptación |
|---|---|
| Suite existente TradingMY | 119+ tests siguen verdes tras cada integración |
| Reglas de riesgo nuevas | Tests unitarios: divergencia y contexto macro con casos borde |
| Integración señal→decisión | `macro_context` + `forecast` presentes en el prompt y trazables por FK en `AgentDecision` |
| Webhooks/endpoints (Capa 6) | `/forecast` y endpoints dashboard responden 200 bajo carga (50 req/min) |
| Latencia | Forecast TimesFM < 30s; tick completo del scheduler < 2 min |
| A/B backtest | EM y drawdown con contexto ≥ sin contexto en ≥ 12 meses de datos |
| Paper | ≥ 4 semanas, ≥ 20 decisiones, EM > 0 |
| Kill-switch | Simulación de DD diario -4% detiene aperturas y alerta Telegram < 1 min |
| Precisión RAG | Agente cita lección histórica relevante cuando existe (evaluación manual muestral) |

---

## E5 — Evolución

- **Loop de accuracy doble:** (a) el que ya trae Tododeia (macro por sector) y (b) el de TradingMY (win rate real por hora/día/activo). Job semanal n8n cruza ambos: "el sector que Tododeia peor predice es X → bajar su peso en el prompt".
- **Evolución del TradeAgent:** incorporar patrón debate bull/bear (referencia TradingAgents) si el A/B lo justifica.
- **Costos:** medir tokens/corrida (logs Capa 10); evaluar modelo más económico para agentes sectoriales de Tododeia.
- **Mantenimiento:** sync trimestral de forks con upstream (Superalgos, freqtrade, TradingAgents); upgrade de TimesFM.
- **Escalado:** más símbolos/sesiones solo tras 90 días live con EM positiva.

---

## Decisiones abiertas (owner)

1. **Crypto:** ¿`CCXTBroker` dentro de TradingMY (recomendado, menos piezas) o freqtrade como segundo motor?
2. **Exchange crypto** (Binance/Bybit/Kraken según región) y **capital inicial** de F4.
3. **Hosting** del stack (TradingMY + TimesFM + n8n + Postgres): Hetzner recomendado; nota: `MT5Broker` requiere Windows o Wine para el paquete `MetaTrader5` — definir dónde corre esa pieza (VPS Windows es lo usual para FTMO).
4. **Superalgos:** ¿mantener el fork como laboratorio o archivarlo hasta que crypto escale?
