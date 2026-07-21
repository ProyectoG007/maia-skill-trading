#!/usr/bin/env python3
"""
FORWARD PAPER TEST — Scalping EURUSD (educativo, NO ejecuta órdenes).
Corre la estrategia (congelada el 2026-07-21) sobre datos reales que llegan
DESPUÉS de esa fecha → validación out-of-sample genuina. Sin estado: recalcula
todo desde FORWARD_START en cada corrida (Yahoo guarda ~60 días de 5m).

Compara el resultado en vivo contra el backtest: 58% WR, +0.149R (spread 1 pip).
"""
import json, urllib.request
import numpy as np
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
FORWARD_START = datetime(2026, 7, 22, tzinfo=timezone.utc)  # día siguiente al freeze
SPREAD, RR, STOPMULT, TIMEOUT = 0.00010, 1.5, 2.0, 12       # params congelados
BT_WR, BT_EXP = 58, 0.149                                    # referencia del backtest

url = "https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=5m&range=1mo&includePrePost=true"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
d = json.load(urllib.request.urlopen(req, timeout=30))["chart"]["result"][0]
ts = d["timestamp"]; q = d["indicators"]["quote"][0]
O, H, L, C, TS = [], [], [], [], []
for i, t in enumerate(ts):
    if None in (q["open"][i], q["high"][i], q["low"][i], q["close"][i]): continue
    O.append(q["open"][i]); H.append(q["high"][i]); L.append(q["low"][i]); C.append(q["close"][i])
    TS.append(datetime.fromtimestamp(t, timezone.utc))
O, H, L, C = map(np.array, (O, H, L, C))
n = len(C)

def ema(a, p):
    k = 2/(p+1); o = np.empty_like(a); o[0] = a[0]
    for i in range(1, len(a)): o[i] = a[i]*k + o[i-1]*(1-k)
    return o
def rsi(a, p=7):
    dd = np.diff(a); up = np.where(dd>0, dd, 0.0); dn = np.where(dd<0, -dd, 0.0)
    ru = np.zeros(len(a)); rd = np.zeros(len(a))
    if len(a) > p: ru[p] = up[:p].mean(); rd[p] = dn[:p].mean()
    for i in range(p+1, len(a)):
        ru[i] = (ru[i-1]*(p-1)+up[i-1])/p; rd[i] = (rd[i-1]*(p-1)+dn[i-1])/p
    rs = ru/np.where(rd==0, 1e-9, rd); o = 100-100/(1+rs); o[:p] = 50; return o
def atr(H, L, C, p=14):
    tr = np.maximum(H[1:]-L[1:], np.maximum(abs(H[1:]-C[:-1]), abs(L[1:]-C[:-1])))
    o = np.zeros(len(C))
    if len(C) > p: o[p] = tr[:p].mean()
    for i in range(p+1, len(C)): o[i] = (o[i-1]*(p-1)+tr[i-1])/p
    o[:p] = o[p] if len(C) > p else 0.0001; return o

e9, e21, R7, A = ema(C, 9), ema(C, 21), rsi(C, 7), atr(H, L, C, 14)
trades = []
i = 22
while i < n-1:
    et = TS[i].astimezone(ET)
    if TS[i] < FORWARD_START or not (7 <= et.hour <= 16) or A[i] <= 0:
        i += 1; continue
    long = e9[i] > e21[i] and R7[i] < 40
    short = e9[i] < e21[i] and R7[i] > 60
    if not (long or short):
        i += 1; continue
    entry = C[i]; a = A[i]*STOPMULT
    stop, tgt = (entry-a, entry+a*RR) if long else (entry+a, entry-a*RR)
    r = None
    for j in range(i+1, min(i+1+TIMEOUT, n)):
        if long:
            if L[j] <= stop: r = -1.0; break
            if H[j] >= tgt: r = RR; break
        else:
            if H[j] >= stop: r = -1.0; break
            if L[j] <= tgt: r = RR; break
    if r is None:
        if i+TIMEOUT >= n:  # trade aún sin resolver (no cerró la ventana) → no contar
            break
        exitp = C[i+TIMEOUT]; r = ((exitp-entry) if long else (entry-exitp))/(a)
    r -= SPREAD/a
    trades.append((et, "LARGO" if long else "CORTO", round(r, 2)))
    i += TIMEOUT

print(f"═══ FORWARD PAPER TEST · Scalping EURUSD ═══")
print(f"Desde {FORWARD_START.date()} · datos reales · spread 1 pip · NO ejecuta\n")
if not trades:
    print("Aún sin trades resueltos en la ventana forward (arranca 2026-07-22).")
    print(f"Referencia backtest a batir: {BT_WR}% WR · +{BT_EXP}R por trade.")
else:
    rs = np.array([t[2] for t in trades]); w = (rs > 0).sum()
    print(f"Trades resueltos: {len(rs)}")
    print(f"  Win rate:     {w/len(rs)*100:.0f}%   (backtest: {BT_WR}%)")
    print(f"  Expectativa:  {rs.mean():+.3f}R   (backtest: +{BT_EXP}R)")
    print(f"  R total:      {rs.sum():+.1f}R")
    verdict = "aguanta el forward ✅" if rs.mean() > 0 else "por debajo del backtest ⚠️"
    print(f"  → {verdict}")
    print("\n  Últimos trades:")
    for et, side, r in trades[-8:]:
        print(f"    {et.strftime('%Y-%m-%d %H:%M ET')}  {side}  {r:+.2f}R")
print("\nEducativo, no consejo financiero.")
