# Estructura: cómo el carry trade puede tirar a Bitcoin para abajo

> Marco educativo para evaluar el riesgo. **No es consejo financiero.**
> El scorer que lo cuantifica con datos reales está en `btc_carry_risk.py`.

## 1. El mecanismo (por qué BTC depende del yen)

```
  Tasas Japón ~0%                     Tasas EE.UU./cripto altas
        │                                        │
        ▼                                        ▼
  Pedir yenes baratos ──► cambiar a USD ──► comprar activos de riesgo
  (financiación)          (JPY/USD)         (bonos, acciones, BTC apalancado)
        │                                        │
        └──────────── ganancia = diferencial de tasas ──────────┘

  Funciona MIENTRAS el yen esté quieto o débil.
```

El apalancamiento en cripto no se financia solo en dólares: parte se financia en
**divisas baratas** (yen sobre todo, también franco suizo). Nadie publica el monto
exacto —por eso se estima por proxies—, pero el patrón histórico es claro: cada vez
que el Banco de Japón endureció, BTC cayó fuerte (−23%, −30%, −31% en los episodios
que muestra el reel; agosto 2024 fue el más violento).

## 2. La cascada (por qué es no-lineal / violenta)

```
  Yen se aprecia
        │
        ▼
  La deuda en yenes se encarece  →  se cierra el carry (comprar yenes, vender USD)
        │
        ▼
  Venta de activos de riesgo  →  BTC baja
        │
        ▼
  Se tocan liquidaciones de posiciones apalancadas en BTC (perps/futuros)
        │
        ▼
  Cada liquidación fuerza MÁS venta  →  espiral  →  caída desproporcionada
```

La clave: **no es una tendencia suave, son días de latigazo.** El apalancamiento
convierte un movimiento del 3% en el yen en un −20/30% en BTC vía liquidaciones en
cadena. Por eso "tener razón en la dirección" no alcanza si no gestionás el tamaño.

## 3. La estructura de estimación (4 factores medibles)

No podemos ver el apalancamiento directamente, pero SÍ podemos medir las señales
que aparecen cuando se estresa. Cada factor 0–100, ponderado:

| Factor | Peso | Qué mide | Por qué importa |
|---|---|---|---|
| **F1 Presión del yen** | 30% | cambio 20d de USD/JPY | El yen apreciándose es el **gatillo** del unwind |
| **F2 Volatilidad BTC** | 25% | vol realizada 14d | Vol alta = desapalancamiento **en curso** |
| **F3 Acople BTC↔yen** | 25% | correlación BTC vs fuerza del yen | Si BTC ya cae cuando sube el yen, el carry está **activo** |
| **F4 Miedo global** | 20% | nivel del VIX | Confirma el **régimen risk-off** |

**Puntaje compuesto → bandas:** `<30 Bajo · 30–55 Medio · 55–75 Alto · >75 Extremo`

### Cómo leer cada factor
- **F1 alto** = el yen se está fortaleciendo → el gatillo se está apretando.
- **F2 alto** = ya hay estrés/liquidaciones moviéndose, no es teórico.
- **F3 alto** = la conexión carry↔BTC está "encendida" (lo más importante: sin
  acople, un yen fuerte no necesariamente pega en BTC).
- **F4 alto** = el mercado entero está en modo pánico, amplifica todo.

El peligro máximo es cuando **F1 y F3 suben juntos**: yen fortaleciéndose *y* BTC
acoplado a él. Ahí la estructura pasa a ALTO/EXTREMO y conviene reducir exposición.

## 4. Qué NO cubre esta estructura (honestidad)

- El **monto real** de BTC apalancado en yenes: no es público. Esto es estimación.
- Datos "duros" que la afinarían (integrables a futuro):
  - **COT de la CFTC** — posición neta de especuladores en futuros de yen (mide
    cuán cargado está el carry). Semanal, público.
  - **Open Interest + Funding rate** de perpetuos de BTC (Binance/Bybit/Deribit) —
    mide directamente el apalancamiento cripto y de qué lado está.
  - Estos se pueden enchufar como F5/F6 sin cambiar la arquitectura del scorer.

## 5. Uso

```bash
python3 paper-scenarios/btc_carry_risk.py      # lectura puntual con datos reales
```

El chequeo diario automático (rutina de Claude) corre esto junto al seguimiento
del yen y reporta la evolución del puntaje.
