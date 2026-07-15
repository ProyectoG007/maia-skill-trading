-- MAIA Trading System — Esquema Postgres (Supabase)
-- ════════════════════════════════════════════════════════════════
-- Ver SPEC.md (sección E2) para el rol de cada tabla en el pipeline
-- Señal → Decisión → Riesgo → Ejecución, y los contratos JSON que
-- alimentan macro_signals y forecasts.
--
-- Uso: correr contra un proyecto Supabase vacío, o vía
-- `mcp__Supabase__apply_migration` una vez creado el proyecto
-- (ver PENDIENTES.md, P0 — decisión pendiente del owner).

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ── Señal macro (Tododeia — Capa 7, corre 1x/día) ────────────────
create table if not exists macro_signals (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  sector          text not null,              -- 'crypto' | 'stocks' | 'forex' | 'materials'
  symbol          text not null,
  outlook         text not null,               -- 'bullish' | 'bearish' | 'neutral'
  recommendation  text,                        -- 'buy' | 'hold' | 'sell'
  confidence      numeric(4,1),
  reasoning       text,
  raw_payload     jsonb not null
);
create index if not exists idx_macro_signals_symbol on macro_signals (symbol, created_at desc);
create index if not exists idx_macro_signals_sector on macro_signals (sector, created_at desc);

-- ── Forecast cuantitativo (TimesFM — Capa 7, servicio bajo demanda) ─
create table if not exists forecasts (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  symbol               text not null,
  horizon_hours        int not null,
  last_price           numeric not null,
  trend                text not null,          -- 'up' | 'down' | 'flat'
  quantile_spread_pct  numeric,
  raw_payload          jsonb not null
);
create index if not exists idx_forecasts_symbol on forecasts (symbol, created_at desc);

-- ── Señales consolidadas (Etapa 1) ───────────────────────────────
create table if not exists signals (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  source            text not null,             -- 'tododeia' | 'timesfm'
  symbol            text not null,
  direction         text not null,             -- 'buy' | 'sell' | 'hold'
  confidence        numeric(3,1) not null,
  horizon           text not null,              -- '1d' | '7d' | '30d'
  price_at_signal   numeric not null,
  forecast_price    numeric,                    -- solo timesfm
  raw_payload       jsonb not null
);
create index if not exists idx_signals_symbol on signals (symbol, created_at desc);

-- ── Decisiones (Etapa 2 — TradeAgent, fusión de señales + riesgo) ─
create table if not exists decisions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  signal_ids      uuid[] not null default '{}',
  symbol          text not null,
  action          text not null,               -- 'open_long' | 'close' | 'no_trade'
  size_pct        numeric,
  stop_loss       numeric,
  take_profit     numeric,
  reasoning       text not null,
  risk_profile    text not null
);
create index if not exists idx_decisions_symbol on decisions (symbol, created_at desc);

-- ── Órdenes (Etapas 3-4 — veredicto de riesgo + ejecución) ───────
create table if not exists orders (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  decision_id         uuid references decisions (id),
  risk_verdict        text not null,           -- 'approved' | 'rejected' | 'resized'
  risk_reasons        text[],
  mode                text not null,           -- 'paper' | 'live'
  status              text not null,           -- 'pending_confirm' | 'sent' | 'filled' | 'cancelled'
  exchange_order_id   text,
  filled_price        numeric,
  filled_at           timestamptz
);
create index if not exists idx_orders_decision on orders (decision_id);

-- ── Resultado real de cada señal (loop de accuracy — cierra E5) ──
create table if not exists signal_outcomes (
  id              uuid primary key default gen_random_uuid(),
  signal_id       uuid references signals (id),
  evaluated_at    timestamptz not null default now(),
  price_actual    numeric not null,
  was_correct     boolean not null,
  pnl_pct         numeric
);
create index if not exists idx_signal_outcomes_signal on signal_outcomes (signal_id);

-- ── Memoria RAG (Capa 5) — embeddings de reportes y lecciones ────
-- Dimensión 1536 asume embeddings tipo text-embedding-3-small/OpenAI;
-- ajustar si se usa otro proveedor.
create table if not exists memory_embeddings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  kind          text not null,                 -- 'macro_report' | 'trade_lesson'
  content       text not null,
  embedding     vector(1536),
  metadata      jsonb
);
create index if not exists idx_memory_embeddings_kind on memory_embeddings (kind);
