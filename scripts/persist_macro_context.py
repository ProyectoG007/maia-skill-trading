#!/usr/bin/env python3
"""
MAIA — Persistencia del contexto macro (Tododeia → resto del sistema)
════════════════════════════════════════════════════════════════════
Se ejecuta al final del Step 7 del skill Tododeia (ver SKILL.md, Step 7b).

Toma el REPORT_DATA que genera el orquestador y:
  1. Escribe macro_context.json (schema_version 1) en el directorio de
     contexto compartido — lo consume TradingMY, ver
     src/context/external_context.py en ese repo.
  2. Si DATABASE_URL está seteada, además inserta una fila por asset en
     la tabla macro_signals de Postgres (ver db/schema.sql). Si no está
     seteada, se omite sin error — el archivo compartido ya alcanza
     para que el sistema funcione (degradación elegante).

Uso:
    python scripts/persist_macro_context.py dashboard/public/data/report.json
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict


def build_macro_context(
    report: Dict[str, Any],
    signal_ids: Dict[str, Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    """Reduce el REPORT_DATA completo de Tododeia al contrato macro_context.json.

    signal_ids: {sector: {symbol: uuid}} de las filas insertadas en
    macro_signals — permite a TradingMY vincular cada AgentDecision con la
    señal que la influenció (trazabilidad señal→decisión). Ausente si no
    hay DATABASE_URL.
    """
    sectors = {}
    for sector_name, sector_data in (report.get("sectors") or {}).items():
        sectors[sector_name] = {
            "outlook": sector_data.get("sector_outlook", "neutral"),
            "summary": sector_data.get("sector_summary", ""),
            "top_pick": sector_data.get("top_pick", ""),
        }

    accuracy = {}
    hist = report.get("historical_accuracy") or {}
    if hist.get("accuracy_pct") is not None:
        accuracy_ratio = round(hist["accuracy_pct"] / 100, 2)
        for sector_name in sectors:
            accuracy[sector_name] = accuracy_ratio

    context = {
        "schema_version": 1,
        "source": "tododeia",
        "generated_at": report.get("generated_at"),
        "risk_profile": report.get("risk_profile", "moderate"),
        "sectors": sectors,
        "macro_environment": report.get("macro_environment", {}),
        "warnings": report.get("warnings", []),
        "accuracy_last_30d": accuracy,
    }
    if signal_ids:
        context["signal_ids"] = signal_ids
    return context


def write_context_file(macro_context: Dict[str, Any]) -> Path:
    context_dir = Path(os.environ.get("MAIA_CONTEXT_DIR", "context_data"))
    context_dir.mkdir(parents=True, exist_ok=True)
    out_path = context_dir / "macro_context.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(macro_context, f, ensure_ascii=False, indent=2)
    return out_path


def write_to_postgres(report: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
    """Inserta una fila por asset en macro_signals y devuelve los ids
    insertados como {sector: {symbol: uuid}}. Vacío si DATABASE_URL no
    está seteada (no-op) o si no había assets."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return {}

    import psycopg2  # import diferido: solo se necesita si hay DB configurada
    import psycopg2.extras

    rows = []
    for sector_name, sector_data in (report.get("sectors") or {}).items():
        for asset in sector_data.get("assets", []):
            rows.append((
                sector_name,
                asset.get("symbol"),
                asset.get("sentiment", "neutral"),
                asset.get("recommendation"),
                asset.get("confidence"),
                asset.get("reasoning"),
                json.dumps(asset),
            ))

    if not rows:
        return {}

    signal_ids: Dict[str, Dict[str, str]] = {}
    conn = psycopg2.connect(database_url)
    try:
        with conn, conn.cursor() as cur:
            inserted = psycopg2.extras.execute_values(
                cur,
                """
                insert into macro_signals
                    (sector, symbol, outlook, recommendation, confidence, reasoning, raw_payload)
                values %s
                returning id, sector, symbol
                """,
                rows,
                fetch=True,
            )
            for row_id, sector, symbol in inserted:
                signal_ids.setdefault(sector, {})[symbol] = str(row_id)
    finally:
        conn.close()
    return signal_ids


def main() -> None:
    if len(sys.argv) != 2:
        print("Uso: python scripts/persist_macro_context.py <path-a-report.json>", file=sys.stderr)
        sys.exit(1)

    report_path = Path(sys.argv[1])
    with open(report_path, encoding="utf-8") as f:
        report = json.load(f)

    # Primero Postgres (si hay), para incluir los ids en el archivo — es lo
    # que le permite a TradingMY trazar decisión → señal macro.
    signal_ids = write_to_postgres(report)

    macro_context = build_macro_context(report, signal_ids=signal_ids)
    out_path = write_context_file(macro_context)
    print(f"macro_context.json escrito en: {out_path}")

    if signal_ids:
        total = sum(len(v) for v in signal_ids.values())
        print(f"{total} fila(s) insertada(s) en macro_signals (Postgres) — ids incluidos en el archivo")
    else:
        print("DATABASE_URL no configurada — se omitió la escritura en Postgres (solo archivo)")


if __name__ == "__main__":
    main()
