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

- [x] 🐛 **Fix bug `symbol_map` en `TradingMY_claude/config.yaml`**: `"GBPUSD=X": "EURUSD"` → `"GBPUSD"` corregido (rama `claude/f1-integracion-senales`).
- [x] 🐛 **Fix bug de formato en `USER_PROMPT_TEMPLATE`** (hallado al integrar): ternarios/aritmética dentro de `{...}` no son válidos para `str.format()` — `TradeAgent.analyze()` crasheaba con cualquier dato real. Corregido precalculando los valores antes del `.format()`.
- [x] Crear `services/timesfm/`: FastAPI `POST /forecast` con `timesfm` de HF (`google/timesfm-2.0-500m-pytorch`) + OHLCV vía yfinance.
- [x] Extender Step 7 de `SKILL.md` (Tododeia): nuevo Step 7b, escribe `macro_context.json` al directorio compartido (`scripts/persist_macro_context.py`) + Postgres opcional si `DATABASE_URL` está seteada.
- [x] Módulo `src/context/external_context.py` en TradingMY: lee `macro_context.json` + `forecast_<SYMBOL>.json`, valida frescura, formatea para el prompt. 17 tests.
- [x] Inyectar `external_context` en `USER_PROMPT_TEMPLATE` del TradeAgent y en `TradingScheduler._tick()` para el símbolo primario.
- [x] `db/schema.sql`: esquema completo (`macro_signals`, `forecasts`, `signals`, `decisions`, `orders`, `signal_outcomes`, `memory_embeddings` con pgvector) — listo para aplicar en cuanto exista el proyecto Supabase.
- [x] `docs/n8n/senal-macro-diaria.json`: workflow importable (cron 06:00 UTC → Tododeia headless → persistencia). Falta cablear alerta de fallo real.
- [ ] **Crear el proyecto Postgres (Supabase) y aplicar `db/schema.sql`** — bloqueado en P0 (decisión de owner: no se crea infraestructura facturable sin confirmación).
- [ ] Migrar TradingMY de SQLite a Postgres una vez exista el proyecto (SQLModel: cambiar connection string).
- [ ] FK desde `AgentDecision` (TradingMY) hacia `macro_signals`/`forecasts` para trazabilidad completa señal→decisión→orden (depende de la migración a Postgres).
- [ ] Instalar `services/timesfm/` en un host con GPU/CPU suficiente y probar la descarga real del checkpoint (~2GB) — no se pudo ejecutar en este sandbox (sin `timesfm`/`torch` instalables offline).
- [ ] Workflow n8n para el forecast de TimesFM por símbolo (llamar `/forecast` → escribir `forecast_<SYMBOL>.json`) — falta, solo está el de Tododeia.
- [ ] Instalar Claude Code CLI + credenciales en el host de n8n para que el nodo "Ejecutar Tododeia" funcione en producción.

## P2 — Fases F2/F3: Validación y riesgo

- [x] 🐛 **Hallazgo que corrige el SPEC**: el "backtest A/B con y sin contexto macro/quant" no es viable — no existe historial de qué contexto había disponible en cada fecha pasada (Tododeia/TimesFM nunca corrieron hacia atrás). Reemplazado por: backtest técnico puro (ya existe) + validación en paper trading en vivo con las reglas de contexto activas. Ver detalle en `SPEC.md` F2 y `TradingMY_claude/pendientes.md` ítem 85.
- [x] Implementar en el Risk Engine la **regla de divergencia** (TimesFM contradice al agente con spread de cuantiles bajo → reduce tamaño o bloquea) + tests — `TradingMY_claude/src/context/context_rules.py`, 16 tests.
- [x] Implementar la **regla de contexto macro** (sector contrario con accuracy > 60% → reduce tamaño) + tests — mismo módulo.
- [ ] Correr paper/demo (SimulatedBroker o MT5 demo) ≥ 4 semanas con ≥ 20 decisiones evaluadas — requiere que el sistema esté desplegado 24/7 (depende de P0: hosting).
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

*Última actualización: 2026-07-15 — SPEC v1.2 (F1 y F3 en curso: contexto externo + reglas de riesgo implementadas y testeadas; falta infraestructura real).*
