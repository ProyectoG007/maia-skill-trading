#!/usr/bin/env python3
"""
ESTRUCTURA DE RIESGO — Carry Unwind sobre Bitcoin (educativo, NO ejecuta órdenes)
════════════════════════════════════════════════════════════════════════════════
Estima con DATOS REALES el riesgo de que un deshielo del carry trade en yenes
(y otras divisas de financiación) arrastre a BTC hacia abajo.

IMPORTANTE — qué es y qué no es esto:
  · El monto EXACTO de BTC apalancado con dinero japonés NO es dato público.
    Nadie lo sabe con precisión. Por eso esta estructura NO inventa cifras de
    apalancamiento: usa PROXIES de mercado observables que se mueven cuando ese
    apalancamiento se estresa. Es una estimación de probabilidad, no una certeza.
  · Para afinarlo con datos "duros" se pueden enchufar después: COT de la CFTC
    (posición neta en futuros de yen), open interest y funding rate de perpetuos
    de BTC (Binance/Bybit/Deribit). Ver notas al pie.

LOS 4 FACTORES (cada uno 0–100, mayor = más riesgo de caída para BTC):
  F1 Presión del yen (30%)  — ¿se está apreciando el yen? (dispara el unwind)
  F2 Volatilidad BTC (25%)  — vol realizada; alta = estrés/desapalancamiento
  F3 Acople BTC↔yen (25%)   — ¿BTC ya cae cuando el yen sube? (carry activo)
  F4 Miedo global VIX (20%) — nivel de aversión al riesgo

Puntaje compuesto → bandas: <30 Bajo · 30–55 Medio · 55–75 Alto · >75 Extremo
Fuente de datos: query1.finance.yahoo.com
"""
import json, urllib.request
from datetime import datetime, timezone

W = {"yen": 0.30, "vol": 0.25, "corr": 0.25, "vix": 0.20}

def clamp(x, lo=0.0, hi=100.0): return max(lo, min(hi, x))

def yf_closes(sym, rng="3mo", interval="1d"):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval={interval}&range={rng}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    r = json.load(urllib.request.urlopen(req, timeout=25))["chart"]["result"][0]
    q = r["indicators"]["quote"][0]["close"]
    price = r["meta"]["regularMarketPrice"]
    return [c for c in q if c is not None], price

def rets(closes):
    return [(closes[i] - closes[i-1]) / closes[i-1] for i in range(1, len(closes))]

def stdev(xs):
    n = len(xs); m = sum(xs)/n
    return (sum((x-m)**2 for x in xs)/(n-1))**0.5 if n > 1 else 0.0

def corr(a, b):
    n = min(len(a), len(b)); a, b = a[-n:], b[-n:]
    ma, mb = sum(a)/n, sum(b)/n
    cov = sum((a[i]-ma)*(b[i]-mb) for i in range(n))
    sa = sum((x-ma)**2 for x in a)**0.5; sb = sum((x-mb)**2 for x in b)**0.5
    return cov/(sa*sb) if sa and sb else 0.0

# ── Datos ──
btc_c, btc = yf_closes("BTC-USD")
jpy_c, jpy = yf_closes("USDJPY=X")
_, vix = yf_closes("%5EVIX", rng="5d")

btc_r, jpy_r = rets(btc_c), rets(jpy_c)

# F1 — Presión del yen: cambio 20d de USD/JPY. Yen apreciándose (USD/JPY cae) = riesgo.
chg20 = (jpy_c[-1] - jpy_c[-21]) / jpy_c[-21] * 100 if len(jpy_c) > 21 else 0.0
f_yen = clamp(50 - chg20 * (50/3))     # -3% → 100 · 0% → 50 · +3% → 0

# F2 — Volatilidad realizada de BTC 14d, anualizada.
vol14 = stdev(btc_r[-14:]) * (365**0.5) * 100
f_vol = clamp((vol14 - 30) / 70 * 100)  # 30% → 0 · 100% → 100

# F3 — Acople: correlación entre returns de BTC y del YEN (−USD/JPY) en 20d.
neg_jpy = [-x for x in jpy_r]
c = corr(btc_r[-20:], neg_jpy[-20:])
f_corr = clamp((c + 0.2) / 0.8 * 100)   # -0.2 → 0 · +0.6 → 100

# F4 — VIX
f_vix = clamp((vix - 12) / 28 * 100)    # 12 → 0 · 40 → 100

score = f_yen*W["yen"] + f_vol*W["vol"] + f_corr*W["corr"] + f_vix*W["vix"]
band = ("EXTREMO" if score > 75 else "ALTO" if score > 55
        else "MEDIO" if score > 30 else "BAJO")

print(f"═══ RIESGO CARRY-UNWIND → BITCOIN — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ═══")
print(f"BTC ${btc:,.0f}  ·  USD/JPY {jpy:.2f}  ·  VIX {vix:.1f}\n")
print(f"  F1 Presión del yen (30%): {f_yen:5.1f}/100   (USD/JPY 20d: {chg20:+.2f}%)")
print(f"  F2 Volatilidad BTC (25%): {f_vol:5.1f}/100   (vol 14d anual.: {vol14:.0f}%)")
print(f"  F3 Acople BTC↔yen  (25%): {f_corr:5.1f}/100   (corr: {c:+.2f})")
print(f"  F4 Miedo global    (20%): {f_vix:5.1f}/100   (VIX: {vix:.1f})")
print(f"\n  ►► PUNTAJE COMPUESTO: {score:.0f}/100  →  RIESGO {band}")
print("\n  Lectura: mayor puntaje = mayor probabilidad de que un unwind del carry")
print("  presione a BTC. Es estimación por proxies, NO consejo financiero.")
print("  Datos duros para afinar (a futuro): COT yen (CFTC), OI+funding de perps BTC.")
