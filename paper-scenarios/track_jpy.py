#!/usr/bin/env python3
"""
Seguimiento PAPER (educativo, NO ejecuta ordenes) del escenario carry-trade JPY.
Trae precios reales de Yahoo Finance y calcula P&L en multiplos de riesgo (R).
Anclado al 2026-07-21. Fuente: query1.finance.yahoo.com
"""
import json, urllib.request, sys
from datetime import datetime, timezone

# ── Constantes del escenario (definidas con datos reales del 2026-07-21) ──
ENTRY_A = 162.98      # Escenario A: short USD/JPY inmediato (fade del maximo)
STOP_A  = 163.60      # stop arriba del maximo 52w (163.04)
TGT1_A  = 160.00
TGT2_A  = 158.00
TRIGGER_B = 161.40    # Escenario B: short SOLO si cierre diario rompe este soporte
BTC_REF = 66561.0     # barometro de carry unwind

def yf(sym):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=5d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    d = json.load(urllib.request.urlopen(req, timeout=20))["chart"]["result"][0]["meta"]
    return d["regularMarketPrice"], d["chartPreviousClose"]

jpy, jpy_prev = yf("JPY=X")
btc, _ = yf("BTC-USD")

# Escenario A — short activo desde 162.98
risk_A = STOP_A - ENTRY_A
r_mult = (ENTRY_A - jpy) / risk_A           # R positivo = yen apreciandose (ganamos)
pnl_pct = (ENTRY_A - jpy) / ENTRY_A * 100
if jpy >= STOP_A:   status_A = "STOP TOCADO (-1R)"
elif jpy <= TGT2_A: status_A = "TARGET 2 alcanzado"
elif jpy <= TGT1_A: status_A = "TARGET 1 alcanzado"
else:               status_A = "abierto"

# Escenario B — flat hasta que rompa el soporte
status_B = "ACTIVADO (short)" if jpy < TRIGGER_B else f"esperando ruptura < {TRIGGER_B} (flat)"

btc_chg = (btc - BTC_REF) / BTC_REF * 100

print(f"=== SEGUIMIENTO PAPER JPY — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===")
print(f"USD/JPY actual: {jpy:.3f}  (prev {jpy_prev:.3f})")
print()
print(f"[A] Short inmediato @ {ENTRY_A} | stop {STOP_A} | tgt {TGT1_A}/{TGT2_A}")
print(f"    P&L: {pnl_pct:+.2f}%  |  {r_mult:+.2f}R  |  {status_A}")
print()
print(f"[B] Short por confirmacion (trigger < {TRIGGER_B})")
print(f"    Estado: {status_B}")
print()
print(f"[BTC] barometro carry-unwind: ${btc:,.0f}  ({btc_chg:+.1f}% vs ref ${BTC_REF:,.0f})")
print(f"    {'ALERTA: caida fuerte, posible carry unwind' if btc_chg <= -10 else 'sin senal de estres'}")
