# n8n — Orquestación del sistema MAIA

Ver `SPEC.md` (Capa 3, Orquestación) y `PENDIENTES.md` (F1).

## Workflow: Señal Macro Diaria

Archivo: [`senal-macro-diaria.json`](senal-macro-diaria.json) — importable directo en n8n
(Workflows → Import from File).

**Qué hace:**

1. **Cron 06:00 UTC** — dispara antes de la apertura de sesión London.
2. **Ejecutar Tododeia (Claude headless)** — corre el skill `investment-analysis`
   en modo no interactivo (`claude -p`) sobre el checkout del repo en el host.
   Requiere que `claude` (Claude Code CLI) esté instalado y autenticado en la
   máquina donde corre n8n, y `ANTHROPIC_API_KEY`/credenciales configuradas.
3. **Persistir macro_context.json** — corre `scripts/persist_macro_context.py`
   sobre el reporte recién generado (Step 7b del `SKILL.md`).
4. **Fallo?** — nodo IF que chequea el exit code del paso anterior. Placeholder:
   conectar a una alerta (Telegram, email) en la salida "true" — no viene
   cableado en el JSON base para no asumir credenciales.

**Requisitos antes de activar:**

- Claude Code CLI instalado y autenticado en el host de n8n (o en el
  contenedor si n8n corre en Docker con acceso al filesystem del repo).
- `MAIA_CONTEXT_DIR` seteado como variable de entorno, apuntando al mismo
  volumen que lee `TradingMY` (`src/context/external_context.py`).
- Opcional: `DATABASE_URL` si ya existe el proyecto Postgres (ver P0 en
  `PENDIENTES.md`) — si no está seteada, el script solo escribe el archivo
  compartido y el sistema sigue funcionando igual.

**Pendiente (no incluido en este workflow):**

- Nodo de alerta real ante fallo (Telegram/email) — cablear cuando se
  definan las credenciales de notificación del owner.
- Workflow equivalente para el forecast de TimesFM por símbolo (llamar a
  `POST /forecast` del servicio en `services/timesfm/` y escribir
  `forecast_<SYMBOL>.json` en el mismo `MAIA_CONTEXT_DIR`).
