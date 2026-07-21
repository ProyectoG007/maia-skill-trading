# PENDIENTES — Sistema de Trading MAIA

Backlog priorizado. Referencia técnica: [SPEC.md](SPEC.md) (v1.1).
Convención: **P0** = bloqueante · **P1** = fase actual · **P2** = siguiente fase · **P3** = mejora futura.

> Nota: TradingMY tiene su propio backlog interno en `TradingMY_claude/pendientes.md`. Este archivo cubre el **sistema integrado**.

---

## 🟢 Estado actual (resumen ejecutivo)

Todo el stack está **desplegado y corriendo 24/7** en producción:

| Pieza | URL / ubicación | Estado |
|---|---|---|
| API de trading | https://tradingmy-api-production.up.railway.app | ✅ healthy |
| Scheduler (paper/demo) | Railway (SimulatedBroker) | ✅ tick 30s sobre EURUSD/GBPUSD/USDJPY/SPY |
| Forecast TimesFM | Railway interno `:8900` | ✅ healthy |
| n8n | https://n8n-production-f32e.up.railway.app | ✅ corriendo |
| Dashboard TradingMY | https://tradingmy-dashboard.vercel.app | ✅ conectado a la API |
| Dashboard Tododeia | https://tododeia-dashboard.vercel.app | ✅ publicado |
| Base de datos | Supabase `maia-trading` (`xtjffjxzwxxqmhhvlkxd`) | ✅ esquema aplicado |
| Estrategia London Breakout | activa en demo sobre EURUSD | ✅ registrando señales |

**Tests:** TradingMY **236/236** · maia-skill-trading **21/21**.

**Faltan solo pasos manuales del owner** (ver P0). Nada bloquea el desarrollo.

---

## P0 — Bloqueantes / decisiones del owner

- [x] ~~Fork de TradingMY~~ → `ProyectoG007/TradingMY_claude`.
- [x] ~~Crear proyecto Postgres~~ → Supabase `maia-trading` (free $0/mes), esquema aplicado.
- [x] **Decidir motor crypto:** confirmado — `CCXTBroker` dentro de TradingMY (implementado y conectado, ver P2).
- [x] **Hosting:** hecho — stack 24/7 en Railway (`maia-trading`): api + scheduler + timesfm + n8n, con volúmenes, variables y dominios. Dashboards de Vercel conectados.
- [ ] ⚠️ **Cargar secretos en Railway** (servicios `tradingmy-api` y `tradingmy-scheduler` → Variables): `DATABASE_URL` (contraseña de Supabase) y `ANTHROPIC_API_KEY`. Sin ellos: DB cae a SQLite local y el TradeAgent no corre. Nota: EURUSD ya NO depende de la API de Claude (usa London Breakout, estrategia mecánica).
- [ ] ⚠️ **Abrir n8n y crear la cuenta owner** en https://n8n-production-f32e.up.railway.app (la primera visita define el dueño — está público hasta entonces). Después importar los dos workflows de `docs/n8n/`.
- [ ] **Elegir exchange crypto** (Binance/Bybit/Kraken) — `CCXTBroker` es agnóstico (corre contra testnet de Binance por default).
- [ ] **Definir capital inicial** para fase live (no bloquea F1-F3).
- [ ] **VPS Windows para `MT5Broker`** — el paquete `MetaTrader5` no corre en Linux nativo (pendiente de fase live real).
- [ ] **Bot de Telegram** (opcional, para seguimiento sin gasto de tokens) — crear bot con @BotFather + chat ID, para que un script diario mande los resúmenes al celular (Opción C acordada). Ver "Seguimiento automático" abajo.

## P1 — Fase F1: Integración de señales

- [x] 🐛 Fix bug `symbol_map` en `config.yaml` (`GBPUSD=X`).
- [x] 🐛 Fix bug de formato en `USER_PROMPT_TEMPLATE` (ternarios dentro de `.format()`).
- [x] `services/timesfm/`: FastAPI `POST /forecast` con TimesFM de HF + OHLCV vía yfinance. **+ `Dockerfile`** para desplegarlo (Railway).
- [x] Step 7b de `SKILL.md` (Tododeia): `scripts/persist_macro_context.py` escribe `macro_context.json` + Postgres opcional.
- [x] `src/context/external_context.py`: lee macro + forecast, valida frescura, formatea para el prompt.
- [x] Inyectar `external_context` en el TradeAgent y en `TradingScheduler._tick()`.
- [x] `db/schema.sql`: esquema completo aplicado al proyecto real.
- [x] `docs/n8n/senal-macro-diaria.json`: workflow importable (Tododeia diario).
- [x] Proyecto Postgres (Supabase) creado, esquema + tablas de TradingMY aplicadas.
- [x] `dashboard/api/database.py` lee `DATABASE_URL` (Postgres o SQLite).
- [x] FK `AgentDecision` → `macro_signals`/`forecasts` (columnas `macro_signal_id`/`forecast_id`, migración v4, `load_context_refs()`).
- [x] Workflow n8n del forecast TimesFM por símbolo — `docs/n8n/forecast-timesfm.json` + `scripts/persist_forecast.py`.
- [ ] **Completar `DATABASE_URL`** con la contraseña de Supabase (paso manual, ver P0).
- [ ] Instalar `services/timesfm/` en host con CPU/GPU y probar la descarga real del checkpoint (~2GB) — el servicio ya está desplegado en Railway con volumen; falta validar la primera inferencia real.
- [ ] Instalar Claude Code CLI + credenciales en el host de n8n para el nodo "Ejecutar Tododeia" en producción.

## P2 — Fases F2/F3: Validación y riesgo

- [x] 🐛 Hallazgo que corrige el SPEC: el "backtest A/B con/sin contexto" no es viable (no hay historial de contexto pasado). Reemplazado por paper trading en vivo con reglas activas.
- [x] Regla de **divergencia** (TimesFM vs agente) + tests — `src/context/context_rules.py`.
- [x] Regla de **contexto macro** (sector contrario con accuracy > 60%) + tests.
- [x] **`CCXTBroker` completo y conectado** — `src/execution/ccxt_broker.py`: posiciones spot emuladas, `market_order`/`close_position` (total y parcial)/`modify_position`/`get_positions` con precio y PnL en vivo. **Conectado al `TradingScheduler`** (`platform: ccxt` en config, credenciales por env). Candado `TRADINGMY_CONFIRM_LIVE=1` para salir de sandbox. 34 tests.
- [~] **Correr paper/demo ≥ 4 semanas con ≥ 20 decisiones** — **EN CURSO**: el scheduler 24/7 registra decisiones desde el despliegue; London Breakout activo sobre EURUSD (2026-07-21). Falta acumular las 4 semanas.
- [ ] Job semanal n8n: cruzar accuracy macro (Tododeia) con win rate real (TradingMY).
- [x] Suite de TradingMY verde tras cada integración — **236/236 tests**.

## P2 — Estrategias aplicadas + seguimiento (sesión de trading 2026-07-21)

- [x] **Estrategia formal London Breakout** — `src/strategy/london_breakout.py`: ruptura del rango de Londres (03:00–09:00 ET) en la apertura NY (+30 min, barra 10:00 ET) + filtro de tendencia (EMA10 de cierres diarios, sin lookahead). Registrada en el motor (`main.py` strategy_map, API `VALID_STRATEGIES`), backtesteable desde el dashboard, parámetros en `config.yaml`. Validada en backtest 12-24m: **mejor borde en EURUSD** (PF ~1.05-1.36, WR ~57-61%, sobrevive a costos dobles y a 2 años); **confirmado que perjudica índices** (US30 PF 0.73) → el filtro favorece divisas/oro. 7 tests.
- [x] **London Breakout activa en vivo (demo)** sobre EURUSD — `_live_london_breakout()` en el scheduler + `live_strategy_map` en config. Registra señales reales en el dashboard (página Decisiones, etiqueta `london_breakout`). No requiere `ANTHROPIC_API_KEY` (mecánica).
- [x] **Campo `strategy` en `AgentDecision`** — columna + migración v5 + expuesto en `/api/decisions`, para filtrar/resumir por estrategia.
- [x] **`USDJPY=X` agregado** a los símbolos del scheduler (seguimiento carry-trade BoJ 1%).
- [x] **Análisis educativos con datos reales** (carpeta `paper-scenarios/`, NO ejecutan órdenes):
  - `track_jpy.py` — seguimiento paper del escenario yen (2 escenarios: fade inmediato vs confirmación).
  - `btc_carry_risk.py` + `ESTRUCTURA_carry_btc.md` — estructura de riesgo carry-unwind sobre BTC (4 factores: presión yen, vol BTC, acople BTC↔yen, VIX → puntaje 0-100).
  - `us30_london_breakout.py` / `_v2.py` — backtests de la estrategia (base / +costos / +filtro), multi-activo.
- [x] **Seguimiento automático (rutinas de Claude):** diaria (yen + riesgo BTC, días hábiles 21:00 UTC) y semanal (London Breakout EURUSD, lunes 22:00 UTC).
- [ ] **Migrar el seguimiento diario a script puro (Opción C)** — script Python que calcula y manda por Telegram sin gastar tokens de Claude; dejar solo el análisis semanal con Claude. Depende del bot de Telegram (P0).
- [ ] Validar el resultado **forward** de London Breakout vs backtest tras ~4 semanas de señales acumuladas.
- [ ] Extender London Breakout a otros símbolos (GBPUSD, XAU) tras confirmar EURUSD en vivo.

## P2 — Dashboards (Capa 8)

- [x] **Dashboard Tododeia en Vercel** — https://tododeia-dashboard.vercel.app (Next.js).
- [x] **Dashboard TradingMY en Vercel** — https://tradingmy-dashboard.vercel.app, conectado a la API real (CORS + `VITE_API_URL`/`VITE_WS_URL`).
- [ ] Dashboard TradingMY: mostrar el contexto macro/forecast que influyó en cada decisión (el campo `strategy`, `macro_signal_id`, `forecast_id` ya viajan en la API — falta la UI).
- [ ] Dashboard Tododeia: leer accuracy desde Postgres; vista "qué pasó con mis señales".
- [ ] Unificar acceso: decidir si ambos dashboards conviven o se consolidan.

## P3 — Fases F4/F5: Live y evolución

- [ ] MT5 real (FTMO): `TRADINGMY_CONFIRM_LIVE=1` + aprobación manual Telegram los primeros 60 días.
- [ ] Crypto live solo tras ciclo propio de paper con EM > 0.
- [ ] Evaluar patrón debate bull/bear (ref `ProyectoG007/TradingAgents`) para el TradeAgent, con A/B.
- [ ] Memoria RAG (pgvector): indexar lecciones de trades cerrados y reportes macro.
- [ ] Optimización de costos de tokens (agentes sectoriales de Tododeia a modelo más económico).
- [ ] Sync trimestral de forks con upstream.
- [ ] Decidir destino del fork Superalgos.

## Deuda técnica / higiene

- [x] **CI (GitHub Actions)** en ambos repos — `.github/workflows/ci.yml` (pytest en push/PR). maia corre en verde; en `TradingMY_claude` (privado) falta habilitar billing de Actions o hacerlo público. Suite validada localmente.
- [x] 🐛 Fix pins rotos del fork (aparecieron al containerizar): `pandas-ta` retirado de PyPI → `pandas-ta-classic`; `MetaTrader5` sin wheel Linux (excluido del Dockerfile); conflicto pandas/numpy 2; `websockets` viejo para yfinance; falta `pyarrow`. Todos corregidos → el build de Railway pasa.
- [ ] `install.sh` y docs de Tododeia apuntan a `Hainrixz/maia-skill`; actualizar si el fork diverge.
- [ ] `.env.example` unificado del sistema (DB, Claude API, exchange, Telegram, MT5).
- [ ] Documentar en `docs/` el despliegue completo del stack (ya existe `docs/deploy/railway.md` + `docker-compose.yml`; falta el VPS MT5).
- [ ] Lint (ruff) en CI — pendiente (requiere limpiar el código existente primero).

---

*Última actualización: 2026-07-21 — Sesión de trading: `CCXTBroker` conectado al scheduler; trazabilidad señal→decisión; workflow n8n de forecast; CI en ambos repos; **stack completo desplegado en Railway** (fix de 5 pins rotos del fork); **estrategia London Breakout** creada, validada, integrada al motor y activada en vivo (demo) sobre EURUSD; análisis educativos (yen, riesgo BTC) y 3 rutinas de seguimiento automático. Tests 236/236 (TradingMY) + 21/21 (maia).*
