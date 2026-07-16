# Deploy del stack MAIA en Railway

Guía para dejar el sistema corriendo 24/7 en [Railway](https://railway.app):
TradingMY (API + scheduler), TimesFM y n8n. La base de datos **no** se
despliega acá — ya existe en Supabase (proyecto `maia-trading`, ref
`xtjffjxzwxxqmhhvlkxd`).

> **Alternativa sin Railway:** el `docker-compose.yml` de la raíz levanta el
> mismo stack en cualquier VPS con Docker (`docker compose up -d`). Railway
> es la opción recomendada por simplicidad de operación (logs, restarts,
> dominios), no por necesidad técnica.

## Qué corre dónde

| Servicio | Origen | Puerto | Notas |
|---|---|---|---|
| `tradingmy-api` | repo `TradingMY_claude`, `docker/Dockerfile.api` | 8000 | Dashboard API (FastAPI + WebSocket) |
| `tradingmy-scheduler` | mismo Dockerfile, otro start command | — | `python main.py --mode live --demo true` |
| `timesfm` | repo `maia-skill-trading`, `services/timesfm/Dockerfile` | 8900 | Descarga ~2GB de HF en el primer boot |
| `n8n` | imagen `n8nio/n8n` | 5678 | Workflow `docs/n8n/senal-macro-diaria.json` |
| Postgres | **Supabase (ya existe)** | — | Solo falta la contraseña en `DATABASE_URL` |
| Dashboards web | **Vercel (ya desplegados)** | — | tododeia-dashboard.vercel.app / tradingmy-dashboard.vercel.app |

**Fuera de alcance:** `MT5Broker` no corre en Linux (el paquete `MetaTrader5`
es solo Windows). El scheduler acá corre con SimulatedBroker/CCXTBroker;
MT5 real requiere el VPS Windows (pendiente P0).

## Paso a paso

### 1. Cuenta y proyecto

1. Crear cuenta en railway.app (GitHub login recomendado — da acceso directo
   a los repos `ProyectoG007/*`).
2. `New Project` → nombre sugerido: `maia-trading`.

### 2. Servicio `tradingmy-api`

1. `New Service` → `GitHub Repo` → `ProyectoG007/TradingMY_claude`,
   rama `claude/f1-integracion-senales` (o `main` cuando se mergee).
2. Settings → Build: `Dockerfile Path` = `docker/Dockerfile.api`.
3. Settings → Deploy → Start Command:
   `uvicorn dashboard.api.main:app --host 0.0.0.0 --port 8000`
4. Settings → Networking → `Generate Domain` (puerto 8000). Anotar la URL:
   es la que va en `VITE_API_URL` del dashboard en Vercel.
5. Variables (ver sección Variables abajo).

### 3. Servicio `tradingmy-scheduler`

Igual que el anterior (mismo repo y Dockerfile) pero:

- Start Command: `python main.py --mode live --demo true`
- Sin dominio público (no expone puerto).
- Mismas variables.

### 4. Servicio `timesfm`

1. `New Service` → `GitHub Repo` → `ProyectoG007/maia-skill-trading`.
2. Settings → Build: `Dockerfile Path` = `services/timesfm/Dockerfile`,
   `Root Directory` = `services/timesfm`.
3. Volumen: montar un Volume en `/root/.cache/huggingface` (≥ 5GB) para no
   re-descargar el checkpoint en cada deploy.
4. El primer deploy tarda varios minutos en estar healthy (descarga ~2GB).
   Verificar: `GET /health` → `{"status": "ok"}`.
5. Dominio interno alcanza (`timesfm.railway.internal`); solo n8n y el
   scheduler lo consumen.

### 5. Servicio `n8n`

1. `New Service` → `Docker Image` → `n8nio/n8n:latest`.
2. Volumen en `/home/node/.n8n`.
3. Variables: `GENERIC_TIMEZONE=UTC`, `N8N_DIAGNOSTICS_ENABLED=false`.
4. `Generate Domain` (puerto 5678) y proteger con auth
   (`N8N_BASIC_AUTH_ACTIVE=true`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`).
5. Importar `docs/n8n/senal-macro-diaria.json` desde la UI.
6. **Pendiente conocido (P1):** el nodo "Ejecutar Tododeia" necesita Claude
   Code CLI instalado en el host — en Railway eso implica una imagen custom
   de n8n. Hasta resolverlo, ese workflow corre solo en un host propio.

### 6. Directorio compartido (Capa 6)

`macro_context.json` y `forecast_<SYMBOL>.json` viajan por `MAIA_CONTEXT_DIR`.
En Railway los servicios **no comparten filesystem**: crear un Volume por
servicio no sirve para compartir. Opciones, en orden de preferencia:

1. **Postgres como transporte** (recomendado): con `DATABASE_URL` seteada,
   `scripts/persist_macro_context.py` ya escribe en `macro_signals`/`forecasts`
   y TradingMY puede leer de ahí — el archivo compartido pasa a ser solo
   cache local. Es la razón por la que la contraseña de Supabase es el paso
   manual más importante.
2. Un solo servicio "monolito" con compose (VPS propio) donde el volumen
   `maia_context` sí se comparte — ver `docker-compose.yml`.

### 7. Conectar los dashboards de Vercel

En Vercel → proyecto `tradingmy-dashboard` → Settings → Environment
Variables: `VITE_API_URL=https://<dominio-de-tradingmy-api>.up.railway.app`
y redeploy. (La UI ya lee `VITE_API_URL`/`VITE_WS_URL` desde el build.)

## Variables de entorno (api y scheduler)

| Variable | Valor | Obligatoria |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:<PASSWORD>@db.xtjffjxzwxxqmhhvlkxd.supabase.co:5432/postgres` | Sí (sin ella cae a SQLite local) |
| `ANTHROPIC_API_KEY` | clave de console.anthropic.com | Sí (TradeAgent) |
| `MAIA_CONTEXT_DIR` | `/shared` (compose) o `/app/context_data` (Railway) | No (default `context_data`) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | alertas | No |
| `TRADINGMY_CONFIRM_LIVE` | **NO setear** hasta F4 (live real) | — |

## Verificación post-deploy

```bash
curl https://<api>.up.railway.app/health          # → 200
curl https://<api>.up.railway.app/api/overview    # → JSON con balance
curl https://<timesfm-interno>:8900/health        # → {"status":"ok"} (desde n8n)
```

Y en https://tradingmy-dashboard.vercel.app el indicador "API conectada"
debe pasar a verde tras setear `VITE_API_URL`.

## Costos estimados

- Railway Hobby: $5/mes de crédito incluido; este stack (4 servicios chicos,
  sin GPU) ronda ese orden. TimesFM en CPU es lo más pesado (RAM ~2-4GB).
- Supabase: plan free ya en uso ($0).
- Vercel: hobby ($0).
