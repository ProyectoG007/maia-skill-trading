"""
Tests para scripts/persist_macro_context.py
════════════════════════════════════════════
Cubre: reducción de REPORT_DATA -> macro_context.json y escritura a
archivo. La escritura a Postgres se omite en tests (requiere DATABASE_URL).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from scripts.persist_macro_context import build_macro_context, write_context_file, write_to_postgres


SAMPLE_REPORT = {
    "generated_at": "2026-07-15T12:00:00Z",
    "risk_profile": "moderate",
    "macro_environment": {"interest_rate_outlook": "falling"},
    "warnings": ["Alta volatilidad esperada"],
    "historical_accuracy": {"accuracy_pct": 62},
    "sectors": {
        "forex": {
            "sector_outlook": "bearish",
            "sector_summary": "DXY sube por tasas",
            "top_pick": "USD/JPY",
            "assets": [
                {
                    "symbol": "EURUSD",
                    "sentiment": "bearish",
                    "recommendation": "sell",
                    "confidence": 7,
                    "reasoning": "DXY fuerte",
                }
            ],
        },
        "crypto": {
            "sector_outlook": "bullish",
            "sector_summary": "BTC rompe resistencia",
            "top_pick": "BTC",
            "assets": [],
        },
    },
}


class TestBuildMacroContext:
    def test_has_schema_version_and_source(self):
        result = build_macro_context(SAMPLE_REPORT)
        assert result["schema_version"] == 1
        assert result["source"] == "tododeia"

    def test_reduces_sectors_correctly(self):
        result = build_macro_context(SAMPLE_REPORT)
        assert result["sectors"]["forex"]["outlook"] == "bearish"
        assert result["sectors"]["forex"]["top_pick"] == "USD/JPY"
        assert result["sectors"]["crypto"]["outlook"] == "bullish"

    def test_preserves_warnings_and_risk_profile(self):
        result = build_macro_context(SAMPLE_REPORT)
        assert result["warnings"] == ["Alta volatilidad esperada"]
        assert result["risk_profile"] == "moderate"

    def test_accuracy_applied_to_all_sectors(self):
        result = build_macro_context(SAMPLE_REPORT)
        assert result["accuracy_last_30d"]["forex"] == 0.62
        assert result["accuracy_last_30d"]["crypto"] == 0.62

    def test_missing_accuracy_yields_empty_dict(self):
        report = {**SAMPLE_REPORT, "historical_accuracy": {}}
        result = build_macro_context(report)
        assert result["accuracy_last_30d"] == {}

    def test_missing_sectors_yields_empty_dict(self):
        result = build_macro_context({"generated_at": "2026-07-15T12:00:00Z"})
        assert result["sectors"] == {}


class TestWriteContextFile:
    def test_writes_valid_json_to_context_dir(self, tmp_path, monkeypatch):
        monkeypatch.setenv("MAIA_CONTEXT_DIR", str(tmp_path))
        macro_context = build_macro_context(SAMPLE_REPORT)
        out_path = write_context_file(macro_context)

        assert out_path == tmp_path / "macro_context.json"
        assert out_path.exists()
        loaded = json.loads(out_path.read_text(encoding="utf-8"))
        assert loaded["sectors"]["forex"]["outlook"] == "bearish"

    def test_creates_context_dir_if_missing(self, tmp_path, monkeypatch):
        nested = tmp_path / "nested" / "context"
        monkeypatch.setenv("MAIA_CONTEXT_DIR", str(nested))
        write_context_file(build_macro_context(SAMPLE_REPORT))
        assert nested.exists()


class TestWriteToPostgres:
    def test_noop_without_database_url(self, monkeypatch):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        assert write_to_postgres(SAMPLE_REPORT) == 0
