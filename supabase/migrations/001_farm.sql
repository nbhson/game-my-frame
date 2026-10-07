-- ============================================================
-- NÔNG TRẠI PIXEL — Supabase schema (multiplayer kiểu Avatar)
-- Chạy file này trong Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Hồ sơ người chơi (1 row / 1 nông dân)
create table if not exists profiles (
  id uuid primary key,
  name text not null default 'NôngDân',
  avatar int not null default 0,
  code text unique not null,          -- mã bạn bè 6 ký tự, vd: "A3F9K2"
  level int not null default 1,
  updated_at timestamptz not null default now()
);

-- 2. Snapshot nông trại (để bạn bè THĂM farm ngay cả khi chủ offline)
create table if not exists farms (
  player_id uuid primary key references profiles(id) on delete cascade,
  code text unique not null,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3. Bật RLS + policy mở cho demo (anonymous chơi ngay không cần login)
--    ⚠️ Production thật: thay bằng policy check auth.uid() = id
alter table profiles enable row level security;
alter table farms enable row level security;

drop policy if exists "open read profiles" on profiles;
drop policy if exists "open write profiles" on profiles;
drop policy if exists "open read farms" on farms;
drop policy if exists "open write farms" on farms;

create policy "open read profiles"  on profiles for select using (true);
create policy "open write profiles" on profiles for all using (true) with check (true);
create policy "open read farms"  on farms for select using (true);
create policy "open write farms" on farms for all using (true) with check (true);

-- 4. Realtime: bật presence + broadcast cho channel village
--    (Supabase Realtime mặc định đã bật cho broadcast/presence theo channel,
--     không cần replication. Chat dùng broadcast ephemeral, không lưu DB.)

-- 5. Dọn snapshot cũ (optional): giữ updated_at mới
create index if not exists farms_updated_idx on farms (updated_at desc);
create index if not exists profiles_code_idx on profiles (code);
create index if not exists farms_code_idx on farms (code);
