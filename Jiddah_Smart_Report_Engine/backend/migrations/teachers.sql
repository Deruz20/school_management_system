-- Teachers table migration for jiddah-smart-report API
-- Run in Supabase SQL Editor.
--
-- If you hit "column name does not exist", an older teachers table already exists.
-- This script migrates it OR recreates it (see OPTION B at the bottom).

-- ---------------------------------------------------------------------------
-- OPTION A (recommended): inspect, then migrate in place
-- ---------------------------------------------------------------------------

-- 1) See current columns (run alone first if unsure)
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'teachers'
-- order by ordinal_position;

-- 2) Rename common legacy column names to match the API
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers' and column_name = 'full_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers' and column_name = 'name'
  ) then
    alter table public.teachers rename column full_name to name;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers' and column_name = 'subject_specialization'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers' and column_name = 'subject'
  ) then
    alter table public.teachers rename column subject_specialization to subject;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers' and column_name = 'class_assigned'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers' and column_name = 'classes'
  ) then
    alter table public.teachers rename column class_assigned to classes;
  end if;
end $$;

-- 3) Add any missing columns the API expects
alter table public.teachers add column if not exists name text;
alter table public.teachers add column if not exists role text;
alter table public.teachers add column if not exists subject text default '';
alter table public.teachers add column if not exists classes text[] default '{}';
alter table public.teachers add column if not exists email text default '';
alter table public.teachers add column if not exists phone text default '';
alter table public.teachers add column if not exists status text default 'active';
alter table public.teachers add column if not exists avatar text;
alter table public.teachers add column if not exists joined date default current_date;
alter table public.teachers add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.teachers add column if not exists created_at timestamptz default now();
alter table public.teachers add column if not exists updated_at timestamptz default now();

-- Backfill name from first_name + last_name if those exist
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers' and column_name = 'first_name'
  ) then
    update public.teachers
    set name = trim(concat(coalesce(first_name, ''), ' ', coalesce(last_name, '')))
    where coalesce(name, '') = '';
  end if;
end $$;

-- Ensure id column exists as uuid PK (skip if your table already has a different PK strategy)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers' and column_name = 'id'
  ) then
    alter table public.teachers add column id uuid primary key default gen_random_uuid();
  end if;
end $$;

create index if not exists teachers_status_idx on public.teachers (status);
create index if not exists teachers_role_idx on public.teachers (role);

alter table public.teachers enable row level security;

drop policy if exists "teachers_select_authenticated" on public.teachers;
drop policy if exists "teachers_insert_authenticated" on public.teachers;
drop policy if exists "teachers_update_authenticated" on public.teachers;

create policy "teachers_select_authenticated"
  on public.teachers for select to authenticated using (true);

create policy "teachers_insert_authenticated"
  on public.teachers for insert to authenticated with check (true);

create policy "teachers_update_authenticated"
  on public.teachers for update to authenticated using (true) with check (true);

-- Seed only when table is empty
insert into public.teachers (name, role, subject, classes, email, phone, status)
select
  'Ustazah Maryam Aliyu',
  'Head Teacher',
  'Islamic Studies',
  array['P.5', 'P.6'],
  'maryam@jiddahschool.edu.ng',
  '+256 801 111 2222',
  'active'
where not exists (select 1 from public.teachers limit 1);

-- ---------------------------------------------------------------------------
-- OPTION B: nuclear reset (only if table is empty / wrong schema / no data to keep)
-- Uncomment and run INSTEAD of OPTION A if migration still fails.
-- ---------------------------------------------------------------------------
-- drop table if exists public.teachers cascade;
--
-- create table public.teachers (
--   id uuid primary key default gen_random_uuid(),
--   name text not null,
--   role text not null check (role in (
--     'Head Teacher', 'Class Teacher', 'Theology Instructor', 'Administrator', 'Support Staff'
--   )),
--   subject text default '',
--   classes text[] default '{}',
--   email text default '',
--   phone text default '',
--   status text not null default 'active' check (status in ('active', 'inactive')),
--   avatar text,
--   joined date default current_date,
--   created_by uuid references auth.users (id) on delete set null,
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now()
-- );
-- (then re-run indexes, RLS policies, and insert from OPTION A)
