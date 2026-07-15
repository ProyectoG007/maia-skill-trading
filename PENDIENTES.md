# PENDIENTES — Sistema de Trading MAIA

Backlog priorizado. Referencia técnica: [SPEC.md](SPEC.md) (v1.1).
Convención: **P0** = bloqueante · **P1** = fase actual · **P2** = siguiente fase · **P3** = mejora futura.

> Nota: TradingMY tiene su propio backlog interno en `TradingMY_claude/pendientes.md` (75/76 ítems completados). Este archivo cubre el **sistema integrado**.

---

## P0 — Bloqueantes / decisiones del owner

- [x] ~~Fork de TradingMY~~ → hecho: `ProyectoG007/TradingMY_claude` (analizado en SPEC v1.1).
- [ ] **Decidir motor crypto:** `CCXTBroker` dentro de TradingMY (recomendado) vs. fork de `freqtrade` como segundo motor.
- [ ] **Elegir exchange crypto** (Binance, Bybit o Kraken según disponibilidad regional).
- [ ] **Definir capital inicial** para fase live (no bloquea F1-F3).
- [ ] **Hosting:** Hetzner (recomendado) para TradingMY+TimesFM+n8n+Postgres; definir VPS Windows/Wine para `MT5Broker` (el paquete `MetaTrader5` no corre en Linux nativo).

## P1 — Fase F1: Integración de señales (2-3 semanas)

- [ ] 🐛 **Fix bug `symbol_map` en `TradingMY_claude/config.yaml`**: `"GBPUSD=X": "EURUSD"` debe ser `"GBPUSD"` — hoy una orden de GBPUSD se ejecutaría sobre EURUSD en MT5.
- [ ] Crear proyecto Postgres (Supabase) + extensión `pgvector`.
- [ ] Migrar TradingMY de SQLite a Postgres (SQLModel: cambiar connection string + migraciones).
- [ ] Crear tablas `macro_signals` y `forecasts` con FK desde `AgentDecision` (trazabilidad señal→decisión→orden).
- [ ] Crear `services/timesfm/`: FastAPI `POST /forecast` con `timesfm` de HF (`google/timesfm-2.0-500m-pytorch`) + OHLCV vía yfinance/ccxt.
- [ ] Extender Step 7 de `SKILL.md` (Tododeia): insertar `macro_context` en Postgres además de `output/history/`.
- [ ] Inyectar `macro_context` + `forecast` en `USER_PROMPT_TEMPLATE` del TradeAgent (`src/agents/prompts.py`).
- [ ] Montar n8n: cron diario de Tododeia + alerta si la señal macro tiene >24h (degradación elegante: el sistema opera igual sin ella).

## P2 — Fases F2/F3: Validación y riesgo

- [ ] Backtest A/B (con y sin contexto macro/quant) sobre ≥ 12 meses: esperanza matemática y drawdown no deben degradarse.
- [ ] Correr paper/demo (SimulatedBroker o MT5 demo) ≥ 4 semanas con ≥ 20 decisiones evaluadas.
- [ ] Implementar en RiskManager la **regla de divergencia** (TimesFM contradice al agente con spread de cuantiles bajo → WAIT) + tests.
- [ ] Implementar la **regla de contexto macro** (sector contrario con accuracy > 60% → sizing 50% o WAIT) + tests.
- [ ] Implementar `CCXTBroker` sobre `broker_base.py` (si se decide esa vía) → paper crypto.
- [ ] Job semanal n8n: cruzar accuracy macro (Tododeia) con win rate real (TradingMY) y ajustar pesos del prompt.
- [ ] Verificar que la suite existente de TradingMY (119+ tests) siga verde tras cada integración.

## P2 — Dashboards (Capa 8)

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
- [ ] CI (GitHub Actions) en ambos repos: lint + tests (TradingMY ya tiene pytest; falta pipeline).
- [ ] `.env.example` unificado del sistema (DB, Claude API, exchange, Telegram, MT5) — TradingMY ya trae uno propio, extenderlo.
- [ ] Documentar en `docs/` el despliegue completo del stack (Hetzner + VPS MT5).

---

*Última actualización: 2026-07-15 — SPEC v1.1 (incorpora análisis de TradingMY).*
