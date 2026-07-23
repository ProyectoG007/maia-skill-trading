# CLAUDE.md — Control de TradingMY por chat

Guía para Claude cuando el usuario quiere **pilotear el motor TradingMY hablando**.
El servidor MCP (`server.py`) expone 22 herramientas que llaman a la API de
TradingMY. Este archivo te dice qué hace cada una, cómo combinarlas, y las
reglas de seguridad.

> Requisito: la API de TradingMY debe estar corriendo
> (`uvicorn dashboard.api.main:app --port 8000`). Si algo da error de conexión,
> lo primero es `health`.

## Mapa de habilidades (22 herramientas)

### 🔎 Consulta (solo lectura — usá libremente)
| Herramienta | Para responder… |
|---|---|
| `health` | ¿la API responde? |
| `get_scheduler_status` | ¿el motor está corriendo? cada cuánto, cuántos jobs |
| `get_overview` | balance, PnL, posiciones, últimas operaciones |
| `get_stats` | win rate, expectancy, PnL de operaciones cerradas |
| `get_analytics` | curva de equity, métricas por símbolo/estrategia |
| `get_risk` | drawdown diario/total y límites (FTMO) |
| `get_history` | historial mensual (PnL, win rate, profit factor) |
| `list_decisions` | últimas decisiones del agente + su razonamiento |
| `list_open_positions` | qué hay abierto ahora (con `order_id`) |
| `list_strategies` | estrategias disponibles del motor |
| `get_live_strategy` | qué estrategia en vivo tiene cada símbolo |
| `get_control` | régimen, freno de emergencia, máx. operaciones |
| `get_daily_instructions` | límites de hoy (trades, símbolos, sesiones) |

### 🧪 Análisis
| Herramienta | Qué hace |
|---|---|
| `run_backtest` | backtest real (symbol, strategy, interval, period, cash) |

### ⚙️ Escritura de control (cambia comportamiento — confirmá si hay duda)
| Herramienta | Efecto |
|---|---|
| `set_control` | régimen / freno de emergencia / máx. shots |
| `set_live_strategy` · `stop_live_strategy` | activa/para una estrategia por símbolo |
| `set_daily_instructions` | fija límites del día (el scheduler los cumple) |
| `start_scheduler` · `stop_scheduler` | prende/apaga el motor entero |

### 🔴 Escritura sobre operaciones (SIEMPRE confirmar antes)
| Herramienta | Efecto |
|---|---|
| `close_position(order_id, volume=0)` | cierra una operación (0 = total) |
| `modify_position(order_id, sl, tp)` | mueve SL/TP de una operación |

## Reglas de seguridad (importante)

1. **Antes de cerrar/modificar una operación** (`close_position`, `modify_position`):
   primero `list_open_positions` para confirmar el `order_id` y mostrárselo al
   usuario. Pedí confirmación explícita antes de ejecutar. Nunca adivines un id.
2. **`stop_scheduler` apaga TODO** el análisis y la operativa. Confirmá antes.
   No es lo mismo que el freno de emergencia (`set_control emergency_brake`),
   que solo bloquea abrir nuevas posiciones pero sigue mirando el mercado.
3. **Solo `london_breakout` corre en vivo de verdad.** Si el usuario activa otra
   estrategia en vivo, avisale que caerá al agente por defecto (la tool ya lo dice).
4. **Los cambios de control/estrategia son en memoria**: un reinicio del
   scheduler vuelve a `config.yaml`. Las instrucciones diarias y el control dual
   sí quedan en la base de datos.
5. **Los backtests bajan datos de Yahoo**: desde datacenters puede dar 429; en la
   máquina del usuario funciona normal.

## Recetas de conversación

- **"¿Cómo venimos hoy?"** → `get_overview` + `get_risk` + `get_daily_instructions`.
- **"Probá london breakout en EURUSD últimos 3 meses"** → `run_backtest(symbol="EURUSD=X", strategy="london_breakout", interval="1h", period="3mo")`.
- **"Poné todo en modo conservador y activá el freno"** → `set_control(regime="conservative", emergency_brake=True)`.
- **"Hoy máximo 3 trades y solo EURUSD"** → `set_daily_instructions(max_trades=3, allowed_symbols="EURUSD=X")`.
- **"¿Qué tengo abierto?"** → `list_open_positions`. **"Cerrá la #1234"** → confirmar → `close_position(1234)`.
- **"Subile el stop a 1.0850 a la #1234"** → confirmar → `modify_position(1234, sl=1.0850)`.
- **"Pará todo"** → confirmar → `stop_scheduler`. **"Arrancá de nuevo"** → `start_scheduler`.
- **"Activá london breakout en GBPUSD en vivo"** → `set_live_strategy("GBPUSD=X", "london_breakout")`.

## Configuración

El servidor apunta a `TRADINGMY_API_URL` (default `http://localhost:8000`).
Si la API está en otro lado (Railway, otro puerto), setealo en la config del MCP
(ver `README.md`).
