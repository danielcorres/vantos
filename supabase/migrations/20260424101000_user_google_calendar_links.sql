-- Tokens Google Calendar: solo Edge Functions (service_role). La app no lee refresh_token.
create table if not exists public.user_google_calendar_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token text null,
  access_token_expires_at timestamptz null,
  calendar_id text not null default 'primary',
  google_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_google_calendar_links_updated_at on public.user_google_calendar_links;
create trigger trg_user_google_calendar_links_updated_at
  before update on public.user_google_calendar_links
  for each row execute function public.set_updated_at();

alter table public.user_google_calendar_links enable row level security;

-- Sin políticas para authenticated/anon: acceso vía service_role en Edge Functions únicamente.
revoke all on public.user_google_calendar_links from authenticated;
revoke all on public.user_google_calendar_links from anon;
grant all on public.user_google_calendar_links to service_role;

comment on table public.user_google_calendar_links is 'OAuth Google Calendar por usuario; tokens solo desde Edge Functions.';
