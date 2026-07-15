# PENDIENTES — Sistema de Trading MAIA

Backlog priorizado. Referencia técnica: [SPEC.md](SPEC.md).
Convención: **P0** = bloqueante · **P1** = fase actual · **P2** = siguiente fase · **P3** = mejora futura.

---

## P0 — Bloqueantes / decisiones del owner

- [ ] <a id="p0"></a>**Fork de TradingMY**: `devmv1979-star/TradingMY` no fue accesible desde la sesión (repo de otro dueño, sin fork bajo `ProyectoG007`). Hacer fork a `ProyectoG007/TradingMY` (o iniciar una sesión con ese repo como fuente) para analizarlo e incorporar lo que aporte al SPEC.
- [ ] **Elegir exchange** para paper/live (Binance, Bybit o Kraken según disponibilidad regional) — bloquea F2.
- [ ] **Definir capital inicial** para F4 (live) — no bloquea F1-F3.
- [ ] **Elegir hosting** (Railway vs. Hetzner; recomendado Hetzner para Superalgos 24/7).

## P1 — Fase F1: Etapa Señal (2 semanas)

- [ ] Crear proyecto Postgres (Supabase) con las tablas `signals`, `decisions`, `orders`, `signal_outcomes` del SPEC + extensión `pgvector`.
- [ ] Modificar `SKILL.md` (Step 7): además de `output/history/`, insertar el reporte en la tabla `signals` (una fila por asset con recomendación).
- [ ] Crear `services/timesfm/`: microservicio FastAPI con endpoint `POST /forecast` usando `timesfm` de Hugging Face (`google/timesfm-2.0-500m-pytorch`) + OHLCV vía ccxt.
- [ ] Montar n8n y crear workflow cron diario: análisis Tododeia + forecast TimesFM → Postgres.
- [ ] Definir universo v1 de símbolos (BTC/USDT, ETH/USDT + top picks dinámicos de Tododeia).

## P2 — Fases F2/F3: Decisión, Paper Trading y Riesgo

- [ ] Crear `services/decision/`: agente de decisión (Claude API) con patrón debate bull/bear tomado de `ProyectoG007/TradingAgents` como referencia.
- [ ] Memoria RAG (pgvector): indexar reportes históricos y lecciones de trades cerrados; el agente de decisión consulta antes de decidir.
- [ ] Desplegar Superalgos headless en Docker; configurar data mining del exchange elegido.
- [ ] Conector señal → Superalgos (Trading Signals / webhook) en modo **paper**.
- [ ] Crear `services/risk/`: Risk Engine determinista con las 7 reglas del SPEC, config YAML y tests unitarios al 100%.
- [ ] Bot de Telegram: alertas de señal, veredictos de riesgo, comando `/kill`.
- [ ] Backtest de la estrategia base en Superalgos con ≥ 12 meses de datos.
- [ ] Correr **mínimo 4 semanas de paper trading** con ≥ 20 señales evaluadas.
- [ ] Job semanal n8n de evaluación de señales vencidas → `signal_outcomes` (loop de accuracy).

## P2 — Dashboard (Capa 8)

- [ ] Extender el dashboard Next.js existente: vista de posiciones abiertas, PnL acumulado, historial de órdenes y veredictos de riesgo.
- [ ] Gráfico de accuracy por agente/sector a lo largo del tiempo (dato ya disponible en `signal_outcomes`).
- [ ] Leer datos desde Postgres en lugar de solo `report.json` estático.

## P3 — Fases F4/F5: Live y Evolución

- [ ] API keys de exchange **solo-trade (sin retiro)** en secrets del hosting; nunca en el repo.
- [ ] Flujo de confirmación humana por Telegram para órdenes live (obligatorio los primeros 60 días).
- [ ] Kill-switch automático por drawdown diario > 3% (probado con simulación).
- [ ] Optimización de costos de tokens: evaluar modelo más económico para agentes sectoriales.
- [ ] Sync trimestral del fork `Superalgos_trading` con upstream (`Superalgos/Superalgos`).
- [ ] Evaluar `TradingAgents-CN` por si aporta mejoras sobre el TradingAgents original.
- [ ] Multi-exchange y ejecución en sectores no-crypto (solo tras 90 días live positivos).

## Deuda técnica / higiene del repo

- [ ] El `install.sh` y el README de Tododeia apuntan a `Hainrixz/maia-skill`; actualizar referencias al fork propio si se divergen.
- [ ] Agregar CI (GitHub Actions): lint + tests del dashboard y de los futuros `services/`.
- [ ] `.env.example` con todas las variables (DB, Claude API, exchange, Telegram) documentadas.
- [ ] Documentar en `docs/` el procedimiento de despliegue de Superalgos headless.

---

*Última actualización: 2026-07-15 — generado junto con SPEC.md v1.0.*
