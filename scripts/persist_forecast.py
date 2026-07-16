#!/usr/bin/env python3
"""
MAIA — Persistencia del forecast TimesFM (Capa 7 → resto del sistema)
════════════════════════════════════════════════════════════════════
Recibe por stdin la respuesta JSON de `POST /forecast` del servicio
services/timesfm/ y:
  1. La escribe como forecast_<SYMBOL>.json en el directorio de contexto
     compartido (MAIA_CONTEXT_DIR) — la consume TradingMY, ver
     src/context/external_context.py en ese repo.
  2. Si DATABASE_URL está seteada, inserta una fila en `forecasts`
     (db/schema.sql) y agrega el uuid como "forecast_id" al archivo,
     para que TradingMY pueda trazar decisión → forecast. Sin
     DATABASE_URL se omite sin error (degradación elegante).

Uso (el workflow n8n docs/n8n/forecast-timesfm.json hace exactamente esto):
    curl -s -X POST localhost:8900/forecast \
         -H "Content-Type: application/json" \
         -d '{"symbol": "EURUSD=X", "horizon_hours": 24}' \
      | python3 scripts/persist_forecast.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional


def safe_symbol(symbol: str) -> str:
    """Mismo saneado de símbolo que usa TradingMY para armar el nombre del archivo."""
    return symbol.replace("=X", "").replace("/", "")


def write_to_postgres(forecast: Dict[str, Any]) -> Optional[str]:
    """Inserta el forecast en Postgres y devuelve el uuid, o None sin DATABASE_URL."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return None

    import psycopg2  # import diferido: solo se necesita si hay DB configurada

    conn = psycopg2.connect(database_url)
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into forecasts
                    (symbol, horizon_hours, last_price, trend, quantile_spread_pct, raw_payload)
                values (%s, %s, %s, %s, %s, %s)
                returning id
                """,
                (
                    forecast.get("symbol"),
                    forecast.get("horizon_hours"),
                    forecast.get("last_price"),
                    forecast.get("trend"),
                    forecast.get("quantile_spread_pct"),
                    json.dumps(forecast),
                ),
            )
            return str(cur.fetchone()[0])
    finally:
        conn.close()


def write_context_file(forecast: Dict[str, Any]) -> Path:
    context_dir = Path(os.environ.get("MAIA_CONTEXT_DIR", "context_data"))
    context_dir.mkdir(parents=True, exist_ok=True)
    out_path = context_dir / f"forecast_{safe_symbol(forecast['symbol'])}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(forecast, f, ensure_ascii=False, indent=2)
    return out_path


def main() -> None:
    raw = sys.stdin.read()
    try:
        forecast = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"stdin no es JSON válido: {e}", file=sys.stderr)
        sys.exit(1)

    if "symbol" not in forecast or "forecast" not in forecast:
        # Respuesta de error del servicio (p.ej. {"detail": ...}) — fallar
        # explícito para que n8n marque el run como fallido.
        print(f"Respuesta inesperada del servicio TimesFM: {raw[:500]}", file=sys.stderr)
        sys.exit(1)

    # Primero Postgres (si hay), para incluir el id en el archivo.
    forecast_id = write_to_postgres(forecast)
    if forecast_id:
        forecast["forecast_id"] = forecast_id

    out_path = write_context_file(forecast)
    print(f"forecast escrito en: {out_path}")
    if forecast_id:
        print(f"fila insertada en forecasts (Postgres): {forecast_id}")
    else:
        print("DATABASE_URL no configurada — se omitió la escritura en Postgres (solo archivo)")


if __name__ == "__main__":
    main()
