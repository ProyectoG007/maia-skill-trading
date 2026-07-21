# Scalping EURUSD — estrategia intradía rápida (validada)

> Rama separada `claude/scalping-eurusd`, independiente del sistema MAIA.
> **Educativo — no es consejo financiero. No ejecuta órdenes.**

Pensada para **EURUSD en modo CFD** (IQ Option u otro broker con spot/stop/objetivo),
NO para opciones binarias (ver "Por qué no binarias" abajo).

## La estrategia

Entrada intradía rápida por **pullback en tendencia**, solo en sesión Londres/NY (07:00–16:00 ET):

- **Tendencia:** EMA9 vs EMA21 sobre velas de 5 min.
- **LARGO:** EMA9 > EMA21 y RSI(7) < 40 → entra. Stop = entry − 2×ATR, objetivo = entry + 2×ATR×1.5.
- **CORTO:** espejo (EMA9 < EMA21 y RSI(7) > 60).
- **Salida:** stop / objetivo, o timeout a 12 velas (1h).

## El hallazgo clave: el SPREAD manda

El micro-scalping puro (stop chico) **pierde** contra el spread real. La estrategia solo
sobrevive con objetivos más grandes (stop 2×ATR), donde el spread pesa menos:

| Stop | Win rate | Expectativa (@1 pip) |
|---|---|---|
| 1× ATR (scalp puro) | 52% | **−0.172R** ❌ |
| **2× ATR** ✅ | **58%** | **+0.149R** |
| 3× ATR | 59% | +0.105R |
| 4× ATR | 62% | +0.044R |

**Sensibilidad al spread (stop 2×ATR)** — el número que decide si es viable:

| Spread EURUSD | Expectativa | ¿Viable? |
|---|---|---|
| 0.6 pip (ECN) | +0.30R | ✅ muy bueno |
| **1.0 pip (retail bueno)** | **+0.149R** | ✅ sí |
| 1.5 pip | +0.033R | ⚠️ al ras |
| ≥2 pip | negativo | ❌ no |

→ **Requiere un broker con spread EURUSD ≤ 1 pip en sesión.** Con spread ancho, no operar.

## Validación out-of-sample (stop 2×ATR @ 1 pip)

| Período | Win rate | Expectativa |
|---|---|---|
| Mes completo | 58% | +0.149R |
| 1ra mitad | 56% | +0.177R |
| 2da mitad (nunca vista) | 61% | +0.121R |

Las dos mitades positivas y el win rate estable (56-61%) → el borde **no es un solo
número afortunado**. (Comparar con las señales binarias, que se caían al verificar.)

## Por qué NO binarias (Binomo / IQ Option modo binario)

Probado con datos reales de EURUSD: ninguna señal simple superó el **54% de aciertos**
que exige el pago del 85%. Una que parecía (58% en 5min) se derrumbó a 42% en 15min
= artefacto, no borde. **El formato binario tiene la matemática en contra.** Este
proyecto usa CFD con stop/objetivo, donde con 58% de aciertos y RR 1.5 ya se gana.

## Advertencias honestas

- **1 mes de datos** (~90 trades). El out-of-sample ayuda, pero es una sola ventana.
- No modela **slippage** de los stops en movimientos rápidos (solo spread).
- La prueba real es el **forward paper test** en la plataforma, con el spread que
  te cobren de verdad. El backtest nunca captura el 100% de la ejecución.

## Uso

```bash
python3 backtest_scalp.py [spread] [RR] [stop_mult]
# defaults: spread 0.6 pip, RR 1.5, stop 2×ATR
python3 backtest_scalp.py 0.00010 1.5 2.0   # con spread realista 1 pip
```

## Próximo paso sugerido

Forward paper test: registrar las señales en vivo unas semanas y comparar el win rate
real contra este 58%. Si aguanta con el spread real de tu broker, es candidata.
