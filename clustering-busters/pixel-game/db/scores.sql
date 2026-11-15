-- The leaderboard's one table (Supabase Postgres, store "ringfall-leaderboard").
-- Run once; safe to run again. api/scores.ts is the only thing that reads or writes it.
--
-- Row level security is on with no policies: the public anon key can do nothing at all. The API
-- uses the service-role key, on the server only. The checks repeat src/game/leaderboard.ts, so
-- even a bad write that got past the API could not store a nonsense name or time.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  nick       text        not null check (char_length(nick) between 2 and 14),
  time_ms    integer     not null check (time_ms between 20000 and 7200000),
  created_at timestamptz not null default now()
);

-- the board: fastest first, an equal time keeps the earlier one first
create index if not exists scores_rank_idx on public.scores (time_ms, id);

alter table public.scores enable row level security;
