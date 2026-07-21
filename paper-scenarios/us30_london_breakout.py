#!/usr/bin/env python3
"""
ESTRATEGIA: Ruptura del rango de Londres en la apertura de NY — US30 (YM=F).
Educativo, NO ejecuta órdenes. Backtest 12 meses con datos reales de Yahoo (1h).

Reglas:
  · Rango Londres = máx/mín de la sesión de Londres previa a NY (03:00–09:00 ET).
  · Checkpoint = 10:00 ET (= +30 min de la apertura NY 09:30). Precio = open de esa barra.
      - open > techo Londres  → LARGO (compra)
      - open < piso  Londres  → CORTO (venta)
      - dentro del rango       → sin trade
  · Stop = extremo opuesto del rango (largo→piso, corto→techo). Riesgo = |entrada−stop|.
  · Salida = cierre de NY (16:00 ET), salvo que el stop se toque antes (−1R).
  · Resultado en R (múltiplos de riesgo), escala-independiente → sirve para otros activos.

Parametrizable por símbolo: cambiar SYMBOL (probar EURUSD=X, etc. tras validar en US30).
"""
import json, urllib.request, sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from collections import defaultdict

SYMBOL = sys.argv[1] if len(sys.argv) > 1 else "YM=F"
RANGE  = sys.argv[2] if len(sys.argv) > 2 else "1y"
INTERVAL = "1h"
ET = ZoneInfo("America/New_York")
LON_HOURS = range(3, 9)   # 03:00–08:00 ET (Londres previo a NY)
CHECK_HOUR = 10           # 10:00 ET = +30 min de apertura NY
CLOSE_HOUR = 16           # cierre NY

url = f"https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval={INTERVAL}&range={RANGE}&includePrePost=true"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
d = json.load(urllib.request.urlopen(req, timeout=30))["chart"]["result"][0]
ts = d["timestamp"]; q = d["indicators"]["quote"][0]

days = defaultdict(list)
for i, t in enumerate(ts):
    o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
    if None in (o, h, l, c): continue
    dt = datetime.fromtimestamp(t, timezone.utc).astimezone(ET)
    days[dt.date()].append((dt.hour, o, h, l, c))

trades = []
counts = {"LARGO": 0, "CORTO": 0, "DENTRO": 0}
for day, db in sorted(days.items()):
    if day.weekday() >= 5: continue
    lon = [b for b in db if b[0] in LON_HOURS]
    check = next((b for b in db if b[0] == CHECK_HOUR), None)
    post = [b for b in db if CHECK_HOUR <= b[0] <= CLOSE_HOUR]
    if len(lon) < 4 or not check or not post: continue
    hi = max(b[2] for b in lon); lo = min(b[3] for b in lon)
    entry = check[1]
    if entry > hi:   side = "LARGO"
    elif entry < lo: side = "CORTO"
    else:            counts["DENTRO"] += 1; continue
    counts[side] += 1
    stop = lo if side == "LARGO" else hi
    risk = abs(entry - stop)
    if risk == 0: continue
    # ¿se tocó el stop antes del cierre?
    stopped = False
    for b in post:
        if side == "LARGO" and b[3] <= stop: stopped = True; break
        if side == "CORTO" and b[2] >= stop: stopped = True; break
    exit_px = stop if stopped else post[-1][4]
    r = (exit_px - entry) / risk if side == "LARGO" else (entry - exit_px) / risk
    if stopped: r = -1.0
    trades.append({"day": day, "side": side, "r": r, "risk": risk,
                   "month": day.strftime("%Y-%m")})

n = len(trades)
wins = [t for t in trades if t["r"] > 0]
wr = len(wins)/n*100 if n else 0
tot_r = sum(t["r"] for t in trades)
avg_r = tot_r/n if n else 0
longs = [t for t in trades if t["side"] == "LARGO"]
shorts = [t for t in trades if t["side"] == "CORTO"]

print(f"═══ ESTRATEGIA RUPTURA LONDRES · {SYMBOL} · {RANGE} · barras {INTERVAL} ═══")
print(f"Datos reales Yahoo · checkpoint +30min (10:00 ET) · salida cierre NY\n")
print(f"SEÑALES:  LARGO {counts['LARGO']}  ·  CORTO {counts['CORTO']}  ·  sin trade {counts['DENTRO']}")
print(f"TRADES ejecutados: {n}\n")
if n:
    print(f"  Win rate:      {wr:.0f}%  ({len(wins)}/{n})")
    print(f"  R total:       {tot_r:+.1f}R")
    print(f"  Expectativa:   {avg_r:+.2f}R por trade")
    print(f"  Mejor / peor:  {max(t['r'] for t in trades):+.1f}R / {min(t['r'] for t in trades):+.1f}R")
    def stat(g):
        if not g: return "  (sin trades)"
        return f"n={len(g)}  WR {sum(1 for t in g if t['r']>0)/len(g)*100:.0f}%  exp {sum(t['r'] for t in g)/len(g):+.2f}R  tot {sum(t['r'] for t in g):+.1f}R"
    print(f"\n  LARGOS:  {stat(longs)}")
    print(f"  CORTOS:  {stat(shorts)}")
    # Mensual
    bym = defaultdict(list)
    for t in trades: bym[t["month"]].append(t["r"])
    print(f"\n  Por mes (trades · WR · R total):")
    for m in sorted(bym):
        rs = bym[m]; w = sum(1 for r in rs if r>0)/len(rs)*100
        print(f"    {m}:  {len(rs):2d}  ·  {w:3.0f}%  ·  {sum(rs):+5.1f}R")
print("\nEducativo, NO consejo financiero.")
