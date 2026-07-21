#!/usr/bin/env python3
"""
ESTRATEGIA v2: Ruptura rango Londres + COSTOS + FILTRO DE TENDENCIA. Educativo.
Compara: (A) base  (B) base+costos  (C) base+costos+filtro tendencia.

Filtro de tendencia (sin lookahead): EMA de cierres diarios (span 10). Para cada
día, se usa la EMA calculada HASTA EL DÍA ANTERIOR. Si cierre previo > EMA previa
→ tendencia alcista → solo se permiten LARGOS; si < → solo CORTOS. Descarta las
rupturas contra-tendencia (el chop que generaba los meses rojos).

Costos: round-turn (spread+comisión) en unidades de precio del activo, restado del
movimiento bruto antes de pasar a R. Defaults razonables por instrumento.
"""
import json, urllib.request, sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from collections import defaultdict

SYMBOL = sys.argv[1] if len(sys.argv) > 1 else "YM=F"
RANGE  = "1y"; INTERVAL = "1h"
ET = ZoneInfo("America/New_York")
LON_HOURS = range(3, 9); CHECK_HOUR = 10; CLOSE_HOUR = 16
EMA_SPAN = 10

# Costo round-turn en unidades de precio (spread+comisión estimados)
COST = {"YM=F": 3.0, "EURUSD=X": 0.00010, "GBPUSD=X": 0.00012, "GC=F": 0.5}.get(SYMBOL, 3.0)

url = f"https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval={INTERVAL}&range={RANGE}&includePrePost=true"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
d = json.load(urllib.request.urlopen(req, timeout=30))["chart"]["result"][0]
ts = d["timestamp"]; q = d["indicators"]["quote"][0]

days = defaultdict(list)
for i, t in enumerate(ts):
    o,h,l,c = q["open"][i],q["high"][i],q["low"][i],q["close"][i]
    if None in (o,h,l,c): continue
    dt = datetime.fromtimestamp(t, timezone.utc).astimezone(ET)
    days[dt.date()].append((dt.hour,o,h,l,c))

daily_close = {day: db[-1][4] for day, db in days.items() if db}
sdays = sorted(daily_close)
ema = {}; prev = None; k = 2/(EMA_SPAN+1)
for day in sdays:
    prev = daily_close[day] if prev is None else daily_close[day]*k + prev*(1-k)
    ema[day] = prev

def backtest(use_cost, use_filter):
    trades = []
    for idx, day in enumerate(sdays):
        db = days[day]
        if day.weekday() >= 5: continue
        lon = [b for b in db if b[0] in LON_HOURS]
        check = next((b for b in db if b[0] == CHECK_HOUR), None)
        post = [b for b in db if CHECK_HOUR <= b[0] <= CLOSE_HOUR]
        if len(lon) < 4 or not check or not post or idx == 0: continue
        hi = max(b[2] for b in lon); lo = min(b[3] for b in lon)
        entry = check[1]
        if entry > hi:   side = "LARGO"
        elif entry < lo: side = "CORTO"
        else: continue
        if use_filter:
            pday = sdays[idx-1]
            trend_up = daily_close[pday] > ema[pday]
            if (side == "LARGO") != trend_up:   # descartar contra-tendencia
                continue
        stop = lo if side == "LARGO" else hi
        risk = abs(entry - stop)
        if risk == 0: continue
        stopped = any((side=="LARGO" and b[3]<=stop) or (side=="CORTO" and b[2]>=stop) for b in post)
        exit_px = stop if stopped else post[-1][4]
        gross = (exit_px-entry) if side=="LARGO" else (entry-exit_px)
        if stopped: gross = -risk
        net = gross - (COST if use_cost else 0)
        trades.append(net/risk)
    return trades

def summ(name, tr):
    if not tr: return f"  {name:22}  (sin trades)"
    n=len(tr); w=sum(1 for r in tr if r>0)/n*100; tot=sum(tr); exp=tot/n
    return f"  {name:22}  n={n:3d}  WR {w:2.0f}%  exp {exp:+.3f}R  tot {tot:+5.1f}R"

A = backtest(False, False)
B = backtest(True, False)
C = backtest(True, True)
print(f"═══ {SYMBOL} · 12m · costo round-turn={COST} ═══")
print(summ("A base (bruto)", A))
print(summ("B +costos", B))
print(summ("C +costos+filtro tend", C))
