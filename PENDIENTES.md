# PENDIENTES — Sistema de Trading MAIA

Backlog priorizado. Referencia técnica: [SPEC.md](SPEC.md) (v1.1).
Convención: **P0** = bloqueante · **P1** = fase actual · **P2** = siguiente fase · **P3** = mejora futura.

> Nota: TradingMY tiene su propio backlog interno en `TradingMY_claude/pendientes.md` (75/76 ítems completados). Este archivo cubre el **sistema integrado**.

---

## P0 — Bloqueantes / decisiones del owner

- [x] ~~Fork de TradingMY~~ → hecho: `ProyectoG007/TradingMY_claude` (analizado en SPEC v1.1).
- [x] ~~Crear proyecto Postgres~~ → hecho: Supabase `maia-trading` (ref `xtjffjxzwxxqmhhvlkxd`, org LogisticAs.Dev, free $0/mes), `db/schema.sql` + tablas propias de TradingMY aplicadas. Falta un paso manual tuyo: la contraseña de conexión (ver `.env.example`).
- [x] **Decidir motor crypto:** confirmado — `CCXTBroker` dentro de TradingMY. Ver ítem en P2 (implementado esta noche).
- [ ] **Elegir exchange crypto** (Binance, Bybit o Kraken según disponibilidad regional) — el `CCXTBroker` es agnóstico al exchange (usa la librería `ccxt`), pero corre por default contra el testnet de Binance hasta que definas cuál preferís.
- [ ] **Definir capital inicial** para fase live (no bloquea F1-F3).
- [x] **Hosting:** hecho — stack 24/7 provisionado en Railway (proyecto `maia-trading`): `tradingmy-api` (https://tradingmy-api-production.up.railway.app, healthy), `tradingmy-scheduler` (corriendo en demo, descargando datos), `timesfm` (interno, con volumen para el checkpoint) y `n8n` (https://n8n-production-f32e.up.railway.app). Dashboard de Vercel conectado a la API (CORS + `VITE_API_URL` horneada). **Faltan 3 pasos manuales tuyos:** (1) `DATABASE_URL` y `ANTHROPIC_API_KEY` como variables en `tradingmy-api` y `tradingmy-scheduler`; (2) abrir n8n YA y crear la cuenta owner (la primera visita define el dueño — está público hasta entonces) e importar los dos workflows de `docs/n8n/`; (3) VPS Windows para `MT5Broker` sigue pendiente (el paquete `MetaTrader5` no corre en Linux nativo).

## P1 — Fase F1: Integración de señales (2-3 semanas)

- [x] 🐛 **Fix bug `symbol_map` en `TradingMY_claude/config.yaml`**: `"GBPUSD=X": "EURUSD"` → `"GBPUSD"` corregido (rama `claude/f1-integracion-senales`).
- [x] 🐛 **Fix bug de formato en `USER_PROMPT_TEMPLATE`** (hallado al integrar): ternarios/aritmética dentro de `{...}` no son válidos para `str.format()` — `TradeAgent.analyze()` crasheaba con cualquier dato real. Corregido precalculando los valores antes del `.format()`.
- [x] Crear `services/timesfm/`: FastAPI `POST /forecast` con `timesfm` de HF (`google/timesfm-2.0-500m-pytorch`) + OHLCV vía yfinance.
- [x] Extender Step 7 de `SKILL.md` (Tododeia): nuevo Step 7b, escribe `macro_context.json` al directorio compartido (`scripts/persist_macro_context.py`) + Postgres opcional si `DATABASE_URL` está seteada.
- [x] Módulo `src/context/external_context.py` en TradingMY: lee `macro_context.json` + `forecast_<SYMBOL>.json`, valida frescura, formatea para el prompt. 17 tests.
- [x] Inyectar `external_context` en `USER_PROMPT_TEMPLATE` del TradeAgent y en `TradingScheduler._tick()` para el símbolo primario.
- [x] `db/schema.sql`: esquema completo (`macro_signals`, `forecasts`, `signals`, `decisions`, `orders`, `signal_outcomes`, `memory_embeddings` con pgvector) — **aplicado** al proyecto real.
- [x] `docs/n8n/senal-macro-diaria.json`: workflow importable (cron 06:00 UTC → Tododeia headless → persistencia). Falta cablear alerta de fallo real.
- [x] **Proyecto Postgres (Supabase) creado y `db/schema.sql` aplicado**: `maia-trading`, ref `xtjffjxzwxxqmhhvlkxd`, plan free ($0/mes). También se aplicaron las tablas propias de TradingMY (`trade`, `dailysnapshot`, `configoverride`, `openposition`, `traderinstruction`, `agentdecision`, `signal`) para que `dashboard/api/database.py` pueda apuntar ahí directamente.
- [x] `dashboard/api/database.py` (TradingMY) ahora lee `DATABASE_URL` del entorno — Postgres si está seteada, SQLite si no (degradación elegante, mismo criterio que el resto del sistema).
- [ ] **Completar la conexión real**: falta que copies la contraseña de la base desde el dashboard de Supabase (Project Settings → Database) a tu `.env` — la API no la expone por seguridad, es el único paso manual. Instrucciones en `.env.example` de ambos repos.
- [x] FK desde `AgentDecision` (TradingMY) hacia `macro_signals`/`forecasts` — hecho: columnas `macro_signal_id`/`forecast_id` (uuid blando, nullable) aplicadas en Supabase y en la migración v4 de TradingMY. `persist_macro_context.py` ahora escribe los ids insertados en `macro_context.json` (`signal_ids`), y el scheduler los guarda en cada decisión vía `load_context_refs()`.
- [ ] Instalar `services/timesfm/` en un host con GPU/CPU suficiente y probar la descarga real del checkpoint (~2GB) — no se pudo ejecutar en este sandbox (sin `timesfm`/`torch` instalables offline).
- [x] Workflow n8n para el forecast de TimesFM por símbolo — hecho: `docs/n8n/forecast-timesfm.json` (cron cada 4h → `/forecast` por símbolo → `scripts/persist_forecast.py`, que escribe `forecast_<SYMBOL>.json` + inserta en `forecasts` con `forecast_id` en el archivo si hay `DATABASE_URL`).
- [ ] Instalar Claude Code CLI + credenciales en el host de n8n para que el nodo "Ejecutar Tododeia" funcione en producción.

## P2 — Fases F2/F3: Validación y riesgo

- [x] 🐛 **Hallazgo que corrige el SPEC**: el "backtest A/B con y sin contexto macro/quant" no es viable — no existe historial de qué contexto había disponible en cada fecha pasada (Tododeia/TimesFM nunca corrieron hacia atrás). Reemplazado por: backtest técnico puro (ya existe) + validación en paper trading en vivo con las reglas de contexto activas. Ver detalle en `SPEC.md` F2 y `TradingMY_claude/pendientes.md` ítem 85.
- [x] Implementar en el Risk Engine la **regla de divergencia** (TimesFM contradice al agente con spread de cuantiles bajo → reduce tamaño o bloquea) + tests — `TradingMY_claude/src/context/context_rules.py`, 16 tests.
- [x] Implementar la **regla de contexto macro** (sector contrario con accuracy > 60% → reduce tamaño) + tests — mismo módulo.
- [ ] Correr paper/demo (SimulatedBroker o MT5 demo) ≥ 4 semanas con ≥ 20 decisiones evaluadas — requiere que el sistema esté desplegado 24/7 (depende de P0: hosting).
- [x] Implementar `CCXTBroker` sobre `broker_base.py` → `TradingMY_claude/src/execution/ccxt_broker.py`, modo paper/testnet (Binance por default), 21 tests. Falta: elegir exchange real, conectarlo al `TradingScheduler` (hoy solo instancia MT5Broker/SimulatedBroker), y `modify_position`/`close_position` (SL/TP en spot).
- [ ] Job semanal n8n: cruzar accuracy macro (Tododeia) con win rate real (TradingMY) y ajustar pesos del prompt.
- [x] Verificar que la suite existente de TradingMY siga verde tras cada integración — **174/174 tests** tras F1+F3+CCXTBroker.

## P2 — Dashboards (Capa 8)

- [x] **Dashboard Tododeia publicado en Vercel**: https://tododeia-dashboard.vercel.app (Next.js, datos estáticos del último reporte; falta conectarlo a Postgres, ver ítem abajo).
- [x] **Dashboard TradingMY publicado en Vercel**: https://tradingmy-dashboard.vercel.app (UI Vite/React). La API/WS ahora es configurable vía `VITE_API_URL`/`VITE_WS_URL` (commit en `TradingMY_claude`); hasta que la API viva en Railway, la UI muestra "desconectado" — es esperado. Al desplegar la API: setear `VITE_API_URL` en Vercel y redeploy (ver `docs/deploy/railway.md` §7).
- [ ] Dashboard TradingMY: mostrar el contexto macro y el forecast que influyeron en cada decisión (página Decisiones).
- [ ] Dashboard Tododeia (Next.js): leer accuracy desde Postgres; agregar vista "qué pasó con mis señales" (macro_signals → resultado real).
- [ ] Unificar acceso: decidir si ambos dashboards conviven o se consolida en uno.

## P3 — Fases F4/F5: Live y evolución

- [ ] MT5 real (FTMO): `TRADINGMY_CONFIRM_LIVE=1` + aprobación manual Telegram obligatoria los primeros 60 días.
- [ ] Crypto live solo tras ciclo propio de paper con EM > 0.
- [ ] Evaluar patrón debate bull/bear (referencia `ProyectoG007/TradingAgents`) para el TradeAgent, con A/B.
- [ ] Memoria RAG (pgvector): indexar lecciones de trades cerrados y reportes macro; el TradeAgent consulta antes de decidir.
- [ ] Optimización de costos de tokens (agentes sectoriales de Tododeia a modelo más económico si accuracy no se degrada).
- [ ] Sync trimestral de forks con upstream: TradingMY, Superalgos, freqtrade, TradingAgents.
- [ ] Decidir destino del fork Superalgos: laboratorio de data mining crypto o archivo.

## Deuda técnica / higiene

- [ ] `install.sh` y docs de Tododeia apuntan a `Hainrixz/maia-skill`; actualizar si el fork diverge.
- [x] CI (GitHub Actions) en ambos repos — hecho: `.github/workflows/ci.yml` en cada repo (pytest en push/PR; TradingMY excluye MetaTrader5 por ser solo-Windows; maia además valida los JSON de n8n). **Verificado:** maia corre en verde. **Paso manual tuyo:** en `TradingMY_claude` el job muere al instante sin runner porque el repo es privado y los minutos de Actions requieren facturación/límite de gasto habilitado (Settings → Billing) — o hacer el repo público. La suite igual está validada localmente (229/229). Lint queda para después (no hay config de ruff aún).
- [ ] `.env.example` unificado del sistema (DB, Claude API, exchange, Telegram, MT5) — TradingMY ya trae uno propio, extenderlo.
- [ ] Documentar en `docs/` el despliegue completo del stack (Hetzner + VPS MT5).

---

*Última actualización: 2026-07-16 — stack 24/7 en Railway provisionado y verde (api + scheduler + timesfm + n8n); dashboard TradingMY en Vercel conectado a la API real.*
