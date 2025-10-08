-- Customers table for Messenger users (and future channels)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  messenger_psid text unique,
  name text,
  phone text,
  created_at timestamp with time zone default now()
);

-- Session/cart state per PSID
create table if not exists public.bot_sessions (
  id uuid primary key default gen_random_uuid(),
  messenger_psid text not null,
  stage text default 'idle',
  cart_items jsonb default '[]'::jsonb,
  last_interaction_at timestamp with time zone default now()
);

-- Orders: add source channel
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'source'
  ) then
    alter table public.orders add column source text default 'pos'::text;
  end if;
end $$;

-- Optional RLS policies (adjust to your app's policies). Ensure only service role writes.
-- alter table public.customers enable row level security;
-- alter table public.bot_sessions enable row level security;


