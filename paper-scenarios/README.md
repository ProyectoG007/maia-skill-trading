# Seguimiento PAPER — Escenario carry-trade JPY (educativo)

**NO ejecuta órdenes reales.** Registra dos hipótesis con datos reales de Yahoo Finance
y reporta el P&L en múltiplos de riesgo (R). Anclado al 2026-07-21.

Contexto: suba de tasas del Banco de Japón al 1% (primera en ~30 años). Tesis: el
diferencial de tasas se achica → el yen tendería a apreciarse → conviene *vender* USD/JPY.
Pero al momento de armar esto, USD/JPY estaba en 162.98, **pegado a su máximo de 52
semanas** (yen débil): la tesis aún NO estaba confirmada por el precio.

## Los dos escenarios

| | Escenario A (agresivo) | Escenario B (disciplinado) |
|---|---|---|
| Idea | Fadear el máximo: short YA | Short solo si confirma |
| Entrada | 162.98 | cierre diario < 161.40 |
| Stop | 163.60 (sobre máx 52w) | sobre el nivel roto |
| Objetivos | 160.00 / 158.00 | 158 / 155 |
| Hasta gatillo | — | FLAT (mira, no opera) |

`BTC-USD` se sigue como **barómetro de carry unwind**: si cae fuerte alrededor de
eventos del BoJ, es señal de que el dinero apalancado en yenes se está deshaciendo.

## Uso
    python3 paper-scenarios/track_jpy.py

Un chequeo automático diario (rutina de Claude) corre esto con precios reales y reporta.
