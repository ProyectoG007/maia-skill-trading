# MCP TradingMY

Servidor **MCP** para pilotear el motor **TradingMY** desde Claude (Desktop o Code),
hablándole en lenguaje natural en vez de abrir el dashboard y apretar botones.

Es el mismo patrón del tutorial de @imoxtrading con StrategyQuant X, pero para
**tu** motor: el MCP no toca nada del motor, solo traduce "herramientas" →
llamadas HTTP a la API FastAPI que TradingMY **ya expone**.

```
Claude  ──(MCP)──►  server.py  ──(HTTP)──►  API TradingMY (:8000)  ──►  motor/DB
```

## Herramientas expuestas

| Herramienta | Qué hace | Endpoint TradingMY |
|---|---|---|
| `list_strategies` | Lista las estrategias del motor | (local) |
| `run_backtest` | Corre un backtest real (backtesting.py + Yahoo) | `POST /api/backtest` |
| `get_stats` | Estadísticas de operaciones cerradas | `GET /api/stats` |
| `get_analytics` | Analítica agregada (equity, por símbolo/estrategia) | `GET /api/analytics` |
| `list_decisions` | Últimas decisiones del agente + razonamiento | `GET /api/decisions` |
| `get_scheduler_status` | ¿Corriendo? intervalo, jobs | `GET /api/scheduler-status` |
| `get_risk` | Riesgo / cumplimiento FTMO | `GET /api/risk` |
| `get_overview` | Balance, PnL, posiciones | `GET /api/overview` |
| `health` | ¿La API responde? (diagnóstico) | `GET /health` |

## Requisitos

1. **La API de TradingMY corriendo.** Desde la raíz del repo `tradingmy_claude`:
   ```bash
   uvicorn dashboard.api.main:app --host 127.0.0.1 --port 8000
   ```
2. **Python 3.10+** y las dependencias de este server:
   ```bash
   cd mcp-tradingmy
   pip install -r requirements.txt
   ```

## Configuración en Claude Desktop

Abrí `claude_desktop_config.json`
(Ajustes → Desarrollador → *Servidores MCP locales* → **Editar configuración**)
y agregá el bloque `tradingmy`:

```json
{
  "mcpServers": {
    "tradingmy": {
      "command": "python",
      "args": ["/RUTA/ABSOLUTA/a/maia-skill-trading/mcp-tradingmy/server.py"],
      "env": {
        "TRADINGMY_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

Cerrá y reabrí Claude. Si el JSON queda mal, Claude avisa: corregilo y reabrí.

> **Nota:** reemplazá `/RUTA/ABSOLUTA/...` por la ruta real en tu máquina.
> En Windows usá doble barra: `"C:\\Users\\...\\server.py"`.

### Variante "igual que el video" (transporte HTTP con `mcp-remote`)

El video usa `npx mcp-remote http://localhost:8080/mcp` porque SQX expone MCP por
HTTP. Acá el server es Python local, así que **stdio** (el bloque de arriba) es lo
más simple y no necesita nada extra. Si algún día querés exponerlo por HTTP como
SQX, se puede cambiar `mcp.run()` por transporte HTTP y usar el mismo patrón
`mcp-remote`. Para uso local, quedate con stdio.

## Probarlo

Con la API arriba, preguntale a Claude cosas como:

- *"Listá las estrategias de TradingMY"*
- *"Corré un backtest de london_breakout en EURUSD, 1h, 3 meses"*
- *"¿Cómo está el riesgo FTMO ahora?"*
- *"Mostrame las últimas 10 decisiones del agente en EURUSD"*
- *"¿Está corriendo el scheduler?"*

## Diferencia honesta con StrategyQuant X

SQX **genera/optimiza** miles de estrategias; TradingMY **ejecuta y mide** las
que vos definís. La mecánica MCP (pilotear por chat) es idéntica; la capacidad
de "fabricar estrategias solo" no está — habría que construirla aparte.

## Notas

- Los backtests bajan datos de Yahoo Finance. Desde IPs de datacenter compartidas
  Yahoo puede devolver **429 (rate limit)**; en tu máquina local funciona normal.
- El server es **desacoplado**: si movés la API a Railway, cambiás
  `TRADINGMY_API_URL` y listo, sin tocar código.
