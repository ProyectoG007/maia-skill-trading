"""
MCP TradingMY — servidor MCP para pilotear el motor TradingMY desde Claude
════════════════════════════════════════════════════════════════════════════

Idea (igual que el video de @imoxtrading con StrategyQuant X): en vez de abrir
el dashboard y apretar botones, le hablás a Claude y Claude llama a la API de
TradingMY por vos.

Este servidor NO toca el motor. Solo traduce "herramientas MCP" → llamadas HTTP
a la API FastAPI que TradingMY ya expone (por defecto http://localhost:8000).
Si mañana movés la API a Railway, cambiás TRADINGMY_API_URL y listo.

Uso:
    pip install -r requirements.txt
    # (con la API de TradingMY corriendo en localhost:8000)
    python server.py            # transporte stdio (para Claude Desktop)

Config en claude_desktop_config.json → ver README.md
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# ── Configuración ────────────────────────────────────────────────────────────
# URL base de la API de TradingMY. Local por defecto; sobreescribible por env.
API_URL = os.environ.get("TRADINGMY_API_URL", "http://localhost:8000").rstrip("/")
TIMEOUT = float(os.environ.get("TRADINGMY_TIMEOUT", "120"))  # backtests tardan

mcp = FastMCP("tradingmy")

# Estrategias válidas (espejo de routes/backtest.py::VALID_STRATEGIES).
STRATEGIES = {
    "rsi_ema": "Cruce EMA + filtro RSI (tendencial simple).",
    "macd_bb": "MACD + Bandas de Bollinger (momentum + volatilidad).",
    "voter": "Ensemble: varias señales votan la dirección.",
    "london_breakout": "Ruptura del rango de sesión (validada en EURUSD).",
}


# ── Helpers HTTP ─────────────────────────────────────────────────────────────
def _get(path: str, params: dict | None = None) -> Any:
    """GET a la API de TradingMY. Devuelve JSON o un dict de error legible."""
    try:
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.get(f"{API_URL}{path}", params=params)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}", "detail": e.response.text[:500]}
    except httpx.RequestError as e:
        return {"error": "No pude conectar con la API de TradingMY",
                "url": API_URL, "detail": str(e),
                "hint": "¿Está corriendo el backend en ese puerto? (uvicorn main:app --port 8000)"}


def _post(path: str, payload: dict) -> Any:
    """POST a la API de TradingMY. Devuelve JSON o un dict de error legible."""
    try:
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.post(f"{API_URL}{path}", json=payload)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}", "detail": e.response.text[:500]}
    except httpx.RequestError as e:
        return {"error": "No pude conectar con la API de TradingMY",
                "url": API_URL, "detail": str(e),
                "hint": "¿Está corriendo el backend? (uvicorn main:app --port 8000)"}


# ── Herramientas MCP ─────────────────────────────────────────────────────────
@mcp.tool()
def list_strategies() -> dict:
    """Lista las estrategias disponibles en el motor TradingMY y qué hace cada una.
    Equivale a 'list_projects' del video, pero para tus estrategias."""
    return {"strategies": STRATEGIES, "count": len(STRATEGIES)}


@mcp.tool()
def run_backtest(
    symbol: str = "EURUSD=X",
    strategy: str = "rsi_ema",
    interval: str = "1h",
    period: str = "2y",
    cash: float = 10_000,
) -> dict:
    """Corre un backtest real con backtesting.py sobre datos de Yahoo Finance.

    Args:
        symbol: ticker Yahoo (ej. 'EURUSD=X', 'BTC-USD', 'AAPL').
        strategy: una de rsi_ema | macd_bb | voter | london_breakout.
        interval: 1m,5m,15m,30m,1h,4h,1d,1wk (5m solo ~60 días atrás).
        period: 1mo,3mo,6mo,1y,2y,5y,max.
        cash: capital inicial (100–10.000.000).

    Devuelve métricas: return %, win rate, # trades, drawdown, sharpe, etc.
    """
    if strategy not in STRATEGIES:
        return {"error": f"Estrategia inválida '{strategy}'",
                "valid": sorted(STRATEGIES.keys())}
    payload = {"symbol": symbol, "strategy": strategy,
               "interval": interval, "period": period, "cash": cash}
    return _post("/api/backtest", payload)


@mcp.tool()
def get_stats() -> dict:
    """Estadísticas de las operaciones cerradas reales (win rate, expectancy,
    PnL, drawdown…). Equivale a 'get_strategy_stats' del video."""
    return _get("/api/stats")


@mcp.tool()
def get_analytics() -> dict:
    """Analítica agregada del sistema (curva de equity, distribución de trades,
    métricas por símbolo/estrategia)."""
    return _get("/api/analytics")


@mcp.tool()
def list_decisions(limit: int = 20, symbol: str | None = None,
                   action: str | None = None) -> dict:
    """Últimas decisiones del agente IA con su razonamiento.

    Args:
        limit: cuántas devolver (default 20).
        symbol: filtrar por símbolo (ej. 'EURUSD=X'). Opcional.
        action: filtrar por acción (BUY / SELL / HOLD). Opcional.
    """
    params: dict[str, Any] = {"limit": limit}
    if symbol:
        params["symbol"] = symbol
    if action:
        params["action"] = action
    return _get("/api/decisions", params)


@mcp.tool()
def get_scheduler_status() -> dict:
    """Estado del scheduler (¿corriendo?, próxima ejecución, mapa de estrategias
    en vivo por símbolo). Es el equivalente a saber si un 'project' está activo."""
    return _get("/api/scheduler-status")


@mcp.tool()
def get_risk() -> dict:
    """Estado de riesgo / cumplimiento FTMO (drawdown diario y total, límites)."""
    return _get("/api/risk")


@mcp.tool()
def get_overview() -> dict:
    """Resumen general: balance, PnL, posiciones abiertas, últimas operaciones."""
    return _get("/api/overview")


@mcp.tool()
def health() -> dict:
    """Chequeo rápido: ¿la API de TradingMY responde? Útil para diagnosticar."""
    return _get("/health")


if __name__ == "__main__":
    # Transporte stdio: es el que usa Claude Desktop para servidores MCP locales.
    mcp.run()
