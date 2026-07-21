# Backtest Scalping EURUSD — análisis mensual y total
Estrategia: pullback en tendencia (EMA9/21 + RSI7), sesión 07:00–16:00 ET, stop 2×ATR, RR 1.5, spread 1 pip. **Educativo, no consejo financiero.**

_Generado con datos reales de Yahoo Finance._

## ⚠️ Nota de datos importante
Yahoo entrega velas de **5 min solo ~3 meses**. El scalping real (5min) por eso cubre ~3 meses. Para 12 meses se usa un **proxy en velas de 1h** (misma lógica) — **NO es el scalping real, es referencia de largo plazo** (en 1h los objetivos son mucho más grandes, se comporta más como swing).

## 1) Scalping REAL (velas 5min) — últimos ~3 meses

**Total:** 242 trades · WR 50% · exp -0.057R · **-13.8R** · PF 0.88 · maxDD -26.4R

| Mes | Trades | Win rate | Exp/trade | R total | Largos (R/n) | Cortos (R/n) |
|---|---|---|---|---|---|---|
| 2026-04 | 7 | 29% | -0.452R | **-3.2R** | -3.4/4 | +0.2/3 |
| 2026-05 | 86 | 49% | -0.113R | **-9.7R** | -8.5/44 | -1.2/42 |
| 2026-06 | 91 | 45% | -0.131R | **-12.0R** | -16.5/40 | +4.5/51 |
| 2026-07 | 58 | 62% | +0.190R | **+11.0R** | -0.7/23 | +11.8/35 |

## 2) Proxy 12 meses (velas 1h — NO es scalping real)

**Total:** 104 trades · WR 48% · exp -0.046R · **-4.8R** · PF 0.89 · maxDD -14.5R

| Mes | Trades | Win rate | Exp/trade | R total | Largos (R/n) | Cortos (R/n) |
|---|---|---|---|---|---|---|
| 2025-07 | 3 | 67% | +0.862R | +2.6R | +1.1/2 | +1.5/1 |
| 2025-08 | 11 | 27% | -0.269R | -3.0R | -1.7/4 | -1.3/7 |
| 2025-09 | 7 | 29% | -0.319R | -2.2R | +0.1/3 | -2.4/4 |
| 2025-10 | 8 | 50% | -0.010R | -0.1R | -1.4/3 | +1.4/5 |
| 2025-11 | 8 | 50% | +0.186R | +1.5R | +1.6/3 | -0.1/5 |
| 2025-12 | 13 | 85% | +0.625R | +8.1R | +3.5/7 | +4.6/6 |
| 2026-01 | 8 | 50% | -0.039R | -0.3R | -2.0/3 | +1.7/5 |
| 2026-02 | 8 | 62% | +0.131R | +1.0R | +0.7/3 | +0.4/5 |
| 2026-03 | 9 | 44% | -0.276R | -2.5R | -0.9/5 | -1.6/4 |
| 2026-04 | 9 | 44% | -0.208R | -1.9R | -2.8/4 | +0.9/5 |
| 2026-05 | 9 | 22% | -0.650R | -5.8R | -2.6/4 | -3.2/5 |
| 2026-06 | 8 | 62% | -0.070R | -0.6R | -0.0/5 | -0.5/3 |
| 2026-07 | 3 | 0% | -0.572R | -1.7R | -0.1/1 | -1.6/2 |

## Lectura honesta

- El scalping real (5min) solo tiene ~3 meses de historia disponible gratis.
- El proxy de 1h da una idea de 12 meses pero **no es la misma estrategia**.
- Un backtest de 12 meses en 5min de verdad requiere datos históricos pagos.
- Un solo período no confirma un borde: la prueba real es el forward test en vivo.
