"""
Tests para scripts/persist_forecast.py
════════════════════════════════════════
Cubre: escritura del archivo compartido, saneado del símbolo, no-op de
Postgres sin DATABASE_URL y rechazo de respuestas de error del servicio.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from scripts.persist_forecast import safe_symbol, write_context_file, write_to_postgres


SAMPLE_FORECAST = {
    "schema_version": 1,
    "source": "timesfm",
    "symbol": "EURUSD=X",
    "generated_at": "2026-07-16T12:00:00+00:00",
    "horizon_hours": 24,
    "last_price": 1.091,
    "forecast": [{"t": "2026-07-16T13:00:00+00:00", "mean": 1.092, "q10": 1.089, "q90": 1.095}],
    "trend": "up",
    "quantile_spread_pct": 0.55,
}


class TestSafeSymbol:
    def test_strips_yfinance_suffix(self):
        assert safe_symbol("EURUSD=X") == "EURUSD"

    def test_strips_slash_for_ccxt_pairs(self):
        assert safe_symbol("BTC/USDT") == "BTCUSDT"

    def test_plain_symbol_unchanged(self):
        assert safe_symbol("SPY") == "SPY"


class TestWriteContextFile:
    def test_writes_forecast_json_with_sanitized_name(self, tmp_path, monkeypatch):
        monkeypatch.setenv("MAIA_CONTEXT_DIR", str(tmp_path))
        out_path = write_context_file(dict(SAMPLE_FORECAST))
        assert out_path == tmp_path / "forecast_EURUSD.json"
        loaded = json.loads(out_path.read_text(encoding="utf-8"))
        assert loaded["trend"] == "up"

    def test_creates_context_dir_if_missing(self, tmp_path, monkeypatch):
        nested = tmp_path / "nested"
        monkeypatch.setenv("MAIA_CONTEXT_DIR", str(nested))
        write_context_file(dict(SAMPLE_FORECAST))
        assert nested.exists()

    def test_preserves_forecast_id_when_present(self, tmp_path, monkeypatch):
        monkeypatch.setenv("MAIA_CONTEXT_DIR", str(tmp_path))
        data = {**SAMPLE_FORECAST, "forecast_id": "uuid-fc"}
        out_path = write_context_file(data)
        loaded = json.loads(out_path.read_text(encoding="utf-8"))
        assert loaded["forecast_id"] == "uuid-fc"


class TestWriteToPostgres:
    def test_noop_without_database_url(self, monkeypatch):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        assert write_to_postgres(SAMPLE_FORECAST) is None


class TestMainRejectsErrors:
    def test_error_response_exits_nonzero(self, tmp_path, monkeypatch, capsys):
        import subprocess

        script = Path(__file__).parent.parent / "scripts" / "persist_forecast.py"
        result = subprocess.run(
            [sys.executable, str(script)],
            input='{"detail": "Sin datos historicos"}',
            capture_output=True,
            text=True,
            env={"MAIA_CONTEXT_DIR": str(tmp_path), "PATH": "/usr/bin:/bin:/usr/local/bin"},
        )
        assert result.returncode == 1
        assert "inesperada" in result.stderr

    def test_invalid_json_exits_nonzero(self, tmp_path):
        import subprocess

        script = Path(__file__).parent.parent / "scripts" / "persist_forecast.py"
        result = subprocess.run(
            [sys.executable, str(script)],
            input="not json",
            capture_output=True,
            text=True,
            env={"MAIA_CONTEXT_DIR": str(tmp_path), "PATH": "/usr/bin:/bin:/usr/local/bin"},
        )
        assert result.returncode == 1
