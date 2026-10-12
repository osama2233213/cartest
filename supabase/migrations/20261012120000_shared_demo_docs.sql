-- Shared demo state: cars sellers list, deals, chat messages, notices and demo accounts.
-- Every browser syncs to this table so a seller's car and a buyer's message show up for everyone.
-- DEMO ONLY: the policies below let anyone with the publishable key read and write. Replace them with
-- per-user RLS before this holds real data.
create table if not exists public.shared_docs (
  id text primary key,
  data jsonb not null,
  rev bigint not null
);
create index if not exists shared_docs_rev_idx on public.shared_docs (rev);

grant select, insert, update, delete on public.shared_docs to anon, authenticated;
grant all on public.shared_docs to service_role;
alter table public.shared_docs enable row level security;
drop policy if exists "Demo shared docs open" on public.shared_docs;
create policy "Demo shared docs open" on public.shared_docs for all to anon, authenticated using (true) with check (true);
