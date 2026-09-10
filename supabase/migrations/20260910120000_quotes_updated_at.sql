-- Add updated_at column to quotes table and keep it current via trigger

alter table quotes
  add column if not exists updated_at timestamptz not null default now();

-- Backfill existing rows with created_at if available, else now()
update quotes
  set updated_at = coalesce(created_at, now())
  where updated_at = now();

-- Trigger to auto-update on every row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quotes_set_updated_at on quotes;
create trigger quotes_set_updated_at
  before update on quotes
  for each row execute function set_updated_at();
