# MAIA TimesFM Forecast Service

Microservicio FastAPI que expone forecasting cuantitativo de series temporales
usando [TimesFM](https://github.com/google-research/timesfm) de Google Research
sobre datos OHLCV. Es el módulo **M2 (Señal cuantitativa)** del sistema —
ver [`SPEC.md`](../../SPEC.md), sección E2.

## Por qué existe

El [TradeAgent de TradingMY](https://github.com/ProyectoG007/TradingMY_claude)
decide con indicadores técnicos + contexto macro de Tododeia, pero ninguno de
los dos da un **pronóstico numérico con incertidumbre**. TimesFM es un modelo
fundacional preentrenado (zero-shot) que sí lo hace, y sirve para contrastar
la dirección que propone el LLM (regla de divergencia, planificada para F3).

## Instalación

```bash
pip install -r services/timesfm/requirements.txt
```

> El primer arranque descarga el checkpoint `google/timesfm-2.0-500m-pytorch`
> desde Hugging Face (~2GB). Se cachea localmente para arranques siguientes.

## Uso

```bash
python services/timesfm/main.py
# Sirve en http://localhost:8900
```

```bash
curl -X POST localhost:8900/forecast \
  -H "Content-Type: application/json" \
  -d '{"symbol": "EURUSD=X", "horizon_hours": 24, "interval": "1h"}'
```

Respuesta (`forecast.json`, `schema_version: 1` — ver contrato completo en `SPEC.md`):

```json
{
  "schema_version": 1,
  "source": "timesfm",
  "symbol": "EURUSD=X",
  "generated_at": "2026-07-15T12:00:00+00:00",
  "horizon_hours": 24,
  "last_price": 1.0842,
  "forecast": [
    {"t": "+1h", "mean": 1.0844, "q10": 1.0838, "q90": 1.085}
  ],
  "trend": "up",
  "quantile_spread_pct": 0.4
}
```

## Integración con TradingMY

TradingMY lee este forecast desde un archivo compartido, no llamando a este
servicio directamente (desacople entre etapas — ver arquitectura en `SPEC.md`).
El flujo esperado:

1. n8n (o un cron) llama a `POST /forecast` para cada símbolo activo.
2. Guarda la respuesta como `forecast_<SYMBOL>.json` en el directorio
   compartido `MAIA_CONTEXT_DIR` (mismo que usa `macro_context.json` de
   Tododeia — ver `TradingMY_claude/src/context/external_context.py`).
3. `TradingScheduler` lo levanta automáticamente en cada tick para el
   símbolo primario, con degradación elegante si el archivo no existe o
   está vencido (> 6 horas).

## Endpoints

| Endpoint | Método | Descripción |
|---|---|---|
| `/forecast` | POST | Genera un forecast para un símbolo |
| `/health` | GET | Estado del servicio y si el modelo ya está cargado |

## Notas

- El modelo se carga *lazy* (primer request), no al arrancar el proceso —
  evita cargar ~2GB en memoria si el servicio está inactivo.
- Corre en CPU por defecto (`backend="cpu"` en `TimesFmHparams`). Con GPU
  disponible, cambiar a `"gpu"` reduce significativamente la latencia.
- Sin conexión a internet en el primer arranque, la descarga del checkpoint
  falla — cachear la imagen de Docker con el modelo ya descargado para producción.
