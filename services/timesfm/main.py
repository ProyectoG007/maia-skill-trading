"""
MAIA — TimesFM Forecast Service
════════════════════════════════════════════
Microservicio FastAPI que expone forecasting cuantitativo de series
temporales usando TimesFM (Google Research) sobre datos OHLCV.

Cubre el módulo M2 (Señal cuantitativa) del SPEC.md — ver sección E2,
"Contratos JSON nuevos" para el detalle de `forecast.json`.

Uso local:
    pip install -r services/timesfm/requirements.txt
    python services/timesfm/main.py
    curl -X POST localhost:8900/forecast \
         -H "Content-Type: application/json" \
         -d '{"symbol": "EURUSD=X", "horizon_hours": 24}'
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Tuple

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("timesfm-service")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="MAIA TimesFM Forecast Service", version="1.0.0")

_MODEL = None  # lazy-loaded — el checkpoint pesa varios GB, no se carga hasta el primer request

_STEP_HOURS_BY_INTERVAL = {"1h": 1, "4h": 4, "1d": 24}


class ForecastRequest(BaseModel):
    symbol: str = Field(..., description="Simbolo yfinance, ej. 'EURUSD=X', 'BTC-USD'")
    horizon_hours: int = Field(24, ge=1, le=720)
    interval: str = Field("1h", description="Intervalo de las velas historicas: 1h, 4h, 1d")
    history_period: str = Field("60d", description="Periodo de historia a descargar (formato yfinance)")


class ForecastPoint(BaseModel):
    t: str
    mean: float
    q10: float
    q90: float


class ForecastResponse(BaseModel):
    schema_version: int = 1
    source: str = "timesfm"
    symbol: str
    generated_at: str
    horizon_hours: int
    last_price: float
    forecast: List[ForecastPoint]
    trend: str
    quantile_spread_pct: float


def _load_model():
    """Carga el checkpoint de TimesFM la primera vez que se necesita (lazy)."""
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    try:
        import timesfm
    except ImportError as e:
        raise RuntimeError(
            "El paquete 'timesfm' no esta instalado. "
            "Instalar con: pip install -r services/timesfm/requirements.txt"
        ) from e

    logger.info("Cargando modelo TimesFM (google/timesfm-2.0-500m-pytorch)...")
    _MODEL = timesfm.TimesFm(
        hparams=timesfm.TimesFmHparams(
            backend="cpu",
            horizon_len=128,
            input_patch_len=32,
            output_patch_len=128,
            num_layers=50,
            model_dims=1280,
        ),
        checkpoint=timesfm.TimesFmCheckpoint(
            huggingface_repo_id="google/timesfm-2.0-500m-pytorch"
        ),
    )
    logger.info("Modelo TimesFM cargado.")
    return _MODEL


def _download_history(symbol: str, interval: str, period: str) -> pd.DataFrame:
    df = yf.download(symbol, interval=interval, period=period, progress=False, auto_adjust=True)
    if df is None or df.empty:
        raise ValueError(f"Sin datos historicos para {symbol}")
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df


def _quantile_forecast(history: np.ndarray, horizon_hours: int) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Corre inferencia de TimesFM y devuelve (media, q10, q90) recortados al horizonte pedido."""
    model = _load_model()
    point_forecast, quantile_forecast = model.forecast([history], freq=[0])

    mean = np.asarray(point_forecast[0])[:horizon_hours]
    quantiles = np.asarray(quantile_forecast[0])[:horizon_hours]

    # TimesFM devuelve columnas [mean, q10, q20, ..., q90] — tomamos los extremos
    if quantiles.ndim == 2 and quantiles.shape[1] > 1:
        q10 = quantiles[:, 1]
        q90 = quantiles[:, -1]
    else:
        # Fallback conservador si el modelo no expone cuantiles (no debería pasar con el checkpoint 2.0)
        q10 = mean * 0.98
        q90 = mean * 1.02

    return mean, q10, q90


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _MODEL is not None}


@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest) -> ForecastResponse:
    try:
        df = _download_history(req.symbol, req.interval, req.history_period)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error descargando historico: {e}")

    close = df["Close"].to_numpy(dtype=float)
    last_price = float(close[-1])

    try:
        mean, q10, q90 = _quantile_forecast(close, req.horizon_hours)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en inferencia TimesFM: {e}")

    step_hours = _STEP_HOURS_BY_INTERVAL.get(req.interval, 1)
    n_points = min(req.horizon_hours, len(mean))
    if n_points == 0:
        raise HTTPException(status_code=500, detail="TimesFM no genero puntos de forecast")

    points = [
        ForecastPoint(
            t=f"+{(i + 1) * step_hours}h",
            mean=round(float(mean[i]), 6),
            q10=round(float(q10[i]), 6),
            q90=round(float(q90[i]), 6),
        )
        for i in range(n_points)
    ]

    last_point = points[-1]
    if last_point.mean > last_price:
        trend = "up"
    elif last_point.mean < last_price:
        trend = "down"
    else:
        trend = "flat"

    spread_pct = round(((last_point.q90 - last_point.q10) / last_price) * 100, 2) if last_price else 0.0

    return ForecastResponse(
        symbol=req.symbol,
        generated_at=datetime.now(timezone.utc).isoformat(),
        horizon_hours=req.horizon_hours,
        last_price=round(last_price, 6),
        forecast=points,
        trend=trend,
        quantile_spread_pct=spread_pct,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8900)
