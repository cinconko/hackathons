create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  nick       text        not null check (char_length(nick) between 2 and 14),
  time_ms    integer     not null check (time_ms between 20000 and 7200000),
  created_at timestamptz not null default now()
);

alter table public.scores add column if not exists run_id uuid unique;

create index if not exists scores_rank_idx on public.scores (time_ms, id);

-- RLS on with no policies on purpose: the public anon key can do nothing; only api/scores.ts (service role, server-side) writes.
alter table public.scores enable row level security;
