#!/usr/bin/env python3
"""
Backtest SCALPING EURUSD 5m — validación honesta (educativo, NO ejecuta órdenes).
Descuenta SPREAD (lo que mata al scalping). Datos reales de Yahoo.

Estrategia base: tendencia (EMA9 vs EMA21) + pullback (RSI7), en sesión LON/NY.
  LONG : EMA9>EMA21 y RSI7<40 → entra; stop=entry-ATR, target=entry+ATR*RR
  SHORT: EMA9<EMA21 y RSI7>60 → entra; espejo.
Salida: stop / target intrabar, o timeout a N velas. Resultado en R neto de spread.
"""
import json, urllib.request, sys
import numpy as np
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
SPREAD = float(sys.argv[1]) if len(sys.argv) > 1 else 0.00006  # 0.6 pip round-turn
RR = float(sys.argv[2]) if len(sys.argv) > 2 else 1.5
RSI_LONG, RSI_SHORT = 40, 60
TIMEOUT = 12
STOPMULT = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0  # punto dulce validado

url = "https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=5m&range=1mo&includePrePost=true"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
d = json.load(urllib.request.urlopen(req, timeout=30))["chart"]["result"][0]
ts = d["timestamp"]; q = d["indicators"]["quote"][0]
O, H, L, C, T = [], [], [], [], []
for i, t in enumerate(ts):
    if None in (q["open"][i], q["high"][i], q["low"][i], q["close"][i]): continue
    O.append(q["open"][i]); H.append(q["high"][i]); L.append(q["low"][i]); C.append(q["close"][i])
    T.append(datetime.fromtimestamp(t, timezone.utc).astimezone(ET))
O, H, L, C = map(np.array, (O, H, L, C))
n = len(C)

def ema(a, p):
    k = 2/(p+1); out = np.empty_like(a); out[0] = a[0]
    for i in range(1, len(a)): out[i] = a[i]*k + out[i-1]*(1-k)
    return out
def rsi(a, p=7):
    d = np.diff(a); up = np.where(d>0, d, 0.0); dn = np.where(d<0, -d, 0.0)
    ru = np.zeros(len(a)); rd = np.zeros(len(a)); ru[p] = up[:p].mean(); rd[p] = dn[:p].mean()
    for i in range(p+1, len(a)):
        ru[i] = (ru[i-1]*(p-1)+up[i-1])/p; rd[i] = (rd[i-1]*(p-1)+dn[i-1])/p
    rs = ru/np.where(rd==0, 1e-9, rd); out = 100-100/(1+rs); out[:p] = 50; return out
def atr(H, L, C, p=14):
    tr = np.maximum(H[1:]-L[1:], np.maximum(abs(H[1:]-C[:-1]), abs(L[1:]-C[:-1])))
    out = np.zeros(len(C)); out[p] = tr[:p].mean()
    for i in range(p+1, len(C)): out[i] = (out[i-1]*(p-1)+tr[i-1])/p
    out[:p] = tr[:p].mean() if len(tr)>=p else 0.0001; return out

e9, e21, R7, A = ema(C, 9), ema(C, 21), rsi(C, 7), atr(H, L, C, 14)
trades = []
i = 22
while i < n-1:
    hr = T[i].hour
    if not (7 <= hr <= 16) or A[i] <= 0:
        i += 1; continue
    long = e9[i] > e21[i] and R7[i] < RSI_LONG
    short = e9[i] < e21[i] and R7[i] > RSI_SHORT
    if not (long or short):
        i += 1; continue
    entry = C[i]; a = A[i]
    a = a*STOPMULT
    if long: stop, tgt = entry-a, entry+a*RR
    else:    stop, tgt = entry+a, entry-a*RR
    risk = a
    r = None
    for j in range(i+1, min(i+1+TIMEOUT, n)):
        if long:
            if L[j] <= stop: r = -1.0; break
            if H[j] >= tgt: r = RR; break
        else:
            if H[j] >= stop: r = -1.0; break
            if L[j] <= tgt: r = RR; break
    if r is None:  # timeout: salida a mercado
        exitp = C[min(i+TIMEOUT, n-1)]
        r = ((exitp-entry) if long else (entry-exitp))/risk
    r -= SPREAD/risk  # costo spread en R
    trades.append(r)
    i += TIMEOUT  # no re-entrar dentro del trade

import os
if os.environ.get("HALF")=="1": t=np.array(trades[:len(trades)//2])
elif os.environ.get("HALF")=="2": t=np.array(trades[len(trades)//2:])
else: t=np.array(trades)
w=(t>0).sum()
print(f"SCALP EURUSD 5m · spread {SPREAD*10000:.1f} pip · RR {RR} · {n} velas (~1 mes)")
print(f"  Trades: {len(t)} | Win rate: {w/len(t)*100:.0f}% | Exp: {t.mean():+.3f}R | Total: {t.sum():+.1f}R")
print(f"  {'✅ positivo' if t.sum()>0 else '❌ negativo'} neto de spread")
