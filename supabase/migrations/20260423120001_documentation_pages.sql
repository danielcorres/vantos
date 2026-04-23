-- ============================================================
-- Documentación editable (playbook y futuros documentos por slug)
-- Lectura: authenticated. Escritura: owner y director.
-- ============================================================

create table if not exists public.documentation_pages (
  slug text primary key,
  title text not null default '',
  body_html text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id) on delete set null
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_documentation_pages_updated_at') then
    create trigger trg_documentation_pages_updated_at
    before update on public.documentation_pages
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.documentation_pages enable row level security;

drop policy if exists documentation_pages_select_authenticated on public.documentation_pages;
create policy documentation_pages_select_authenticated
  on public.documentation_pages
  for select
  to authenticated
  using (true);

drop policy if exists documentation_pages_insert_owner_director on public.documentation_pages;
create policy documentation_pages_insert_owner_director
  on public.documentation_pages
  for insert
  to authenticated
  with check (public.auth_role() in ('owner', 'director'));

drop policy if exists documentation_pages_update_owner_director on public.documentation_pages;
create policy documentation_pages_update_owner_director
  on public.documentation_pages
  for update
  to authenticated
  using (public.auth_role() in ('owner', 'director'))
  with check (public.auth_role() in ('owner', 'director'));

drop policy if exists documentation_pages_delete_owner_director on public.documentation_pages;
create policy documentation_pages_delete_owner_director
  on public.documentation_pages
  for delete
  to authenticated
  using (public.auth_role() in ('owner', 'director'));

grant select, insert, update, delete on public.documentation_pages to authenticated;
