-- 政治人物資料表（共用，所有人看到同一份）
create table if not exists politicians (
  alias text primary key,
  political_party_label text not null default '無特定政黨屬性',
  county text not null default '',
  bgw_spectrum text not null default '',
  national_affairs boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 每次更新時自動更新 updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger politicians_updated_at
  before update on politicians
  for each row execute function update_updated_at();

-- Row Level Security：允許所有人讀取、寫入（之後可加登入限制）
alter table politicians enable row level security;

create policy "allow_read" on politicians
  for select using (true);

create policy "allow_insert" on politicians
  for insert with check (true);

create policy "allow_update" on politicians
  for update using (true);

create policy "allow_delete" on politicians
  for delete using (true);
