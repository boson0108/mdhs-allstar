-- Mingdao All-Star Vote — V1 production schema
-- Run this entire file in a NEW Supabase project's SQL Editor.
-- This version submits male 2 + female 2 as ONE atomic ballot.

create extension if not exists pgcrypto;

do $$ begin
  create type public.vote_category as enum ('male','female');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.election_status as enum ('draft','open','closed');
exception when duplicate_object then null;
end $$;

create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status public.election_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- Singleton table: V1 intentionally supports exactly ONE admin account.
create unique index if not exists one_open_election
on public.elections ((status))
where status = 'open';

create table if not exists public.admin_config (
  singleton boolean primary key default true check (singleton = true),
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.admin_config(singleton, user_id)
values (true, null)
on conflict (singleton) do nothing;

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  category public.vote_category not null,
  name text not null check (char_length(name) between 1 and 40),
  class_name text not null check (char_length(class_name) between 1 and 30),
  jersey_number int not null check (jersey_number between 0 and 99),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row = one student's complete male+female ballot.
create table if not exists public.ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique (election_id, user_id)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.ballots(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ballot_id, candidate_id)
);

-- Once a candidate has votes, do not move them between divisions/elections.
create or replace function public.protect_voted_candidate_group()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.category is distinct from old.category or new.election_id is distinct from old.election_id)
     and exists (select 1 from public.votes v where v.candidate_id = old.id) then
    raise exception '已有投票紀錄的候選人不能變更組別或屆別';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_voted_candidate_group on public.candidates;
create trigger protect_voted_candidate_group
before update on public.candidates
for each row execute function public.protect_voted_candidate_group();

-- Confirm the authenticated Supabase user is a confirmed school account.
create or replace function public.is_school_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(coalesce(u.email, '')) like '%@ms.mingdao.edu.tw'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_config a
    where a.singleton = true and a.user_id = auth.uid()
  );
$$;

alter table public.elections enable row level security;
alter table public.admin_config enable row level security;
alter table public.candidates enable row level security;
alter table public.ballots enable row level security;
alter table public.votes enable row level security;

-- Elections
DROP POLICY IF EXISTS "school reads elections" ON public.elections;
CREATE POLICY "school reads elections" ON public.elections
FOR SELECT TO authenticated
USING (public.is_school_user());

DROP POLICY IF EXISTS "admin manages elections" ON public.elections;
CREATE POLICY "admin manages elections" ON public.elections
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admin singleton: only the configured admin can see its row. No client-side writes.
DROP POLICY IF EXISTS "admin reads own config" ON public.admin_config;
CREATE POLICY "admin reads own config" ON public.admin_config
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Candidates: students see active candidates, admin sees/manages all candidates.
DROP POLICY IF EXISTS "school reads active candidates" ON public.candidates;
CREATE POLICY "school reads active candidates" ON public.candidates
FOR SELECT TO authenticated
USING (public.is_school_user() AND active = true);

DROP POLICY IF EXISTS "admin manages candidates" ON public.candidates;
CREATE POLICY "admin manages candidates" ON public.candidates
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Students can only read whether THEY have submitted. No direct inserts/updates/deletes.
DROP POLICY IF EXISTS "user reads own ballot" ON public.ballots;
CREATE POLICY "user reads own ballot" ON public.ballots
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "admin reads ballots" ON public.ballots;
CREATE POLICY "admin reads ballots" ON public.ballots
FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "admin reads votes" ON public.votes;
CREATE POLICY "admin reads votes" ON public.votes
FOR SELECT TO authenticated
USING (public.is_admin());

-- Atomic vote submission: exactly 2 male + 2 female, one submission per account.
create or replace function public.submit_complete_ballot(
  p_male_candidate_ids uuid[],
  p_female_candidate_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_election uuid;
  v_ballot uuid;
  v_count int;
begin
  if v_user is null or not public.is_school_user() then
    raise exception '僅限已驗證的明道學校帳號投票';
  end if;

  if coalesce(array_length(p_male_candidate_ids, 1), 0) <> 2
     or coalesce(array_length(p_female_candidate_ids, 1), 0) <> 2 then
    raise exception '男子組與女子組都必須剛好選擇 2 位候選人';
  end if;

  if p_male_candidate_ids[1] = p_male_candidate_ids[2]
     or p_female_candidate_ids[1] = p_female_candidate_ids[2] then
    raise exception '同一組不能重複投給同一位候選人';
  end if;

  select e.id into v_election
  from public.elections e
  where e.status = 'open'
  order by e.created_at desc
  limit 1;

  if v_election is null then
    raise exception '目前沒有開放中的投票';
  end if;

  select count(*) into v_count
  from public.candidates c
  where c.id = any(p_male_candidate_ids)
    and c.election_id = v_election
    and c.category = 'male'
    and c.active = true;
  if v_count <> 2 then
    raise exception '男子組候選人資料無效';
  end if;

  select count(*) into v_count
  from public.candidates c
  where c.id = any(p_female_candidate_ids)
    and c.election_id = v_election
    and c.category = 'female'
    and c.active = true;
  if v_count <> 2 then
    raise exception '女子組候選人資料無效';
  end if;

  insert into public.ballots(election_id, user_id)
  values(v_election, v_user)
  returning id into v_ballot;

  insert into public.votes(ballot_id, candidate_id)
  select v_ballot, u.candidate_id
  from unnest(p_male_candidate_ids || p_female_candidate_ids) as u(candidate_id);

  return v_ballot;
exception
  when unique_violation then
    raise exception '這個學校帳號已完成本次投票，不能再次投票';
end;
$$;

revoke all on function public.submit_complete_ballot(uuid[], uuid[]) from public;
grant execute on function public.submit_complete_ballot(uuid[], uuid[]) to authenticated;

-- Student results: available only after submitting the complete ballot. Admin can always view.
create or replace function public.get_results()
returns table(
  id uuid,
  name text,
  class_name text,
  jersey_number int,
  category public.vote_category,
  photo_url text,
  active boolean,
  votes bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election uuid;
begin
  if auth.uid() is null or not public.is_school_user() then
    raise exception '未登入';
  end if;

  select e.id into v_election
  from public.elections e
  where e.status in ('open', 'closed')
  order by e.created_at desc
  limit 1;

  if v_election is null then
    raise exception '目前沒有可查看的投票';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.ballots b
    where b.election_id = v_election and b.user_id = auth.uid()
  ) then
    raise exception '完成投票後才能查看即時票數';
  end if;

  return query
  select c.id, c.name, c.class_name, c.jersey_number, c.category,
         c.photo_url, c.active, count(v.id)::bigint
  from public.candidates c
  left join public.votes v on v.candidate_id = c.id
  where c.election_id = v_election and c.active = true
  group by c.id
  order by c.category, count(v.id) desc, c.name;
end;
$$;

revoke all on function public.get_results() from public;
grant execute on function public.get_results() to authenticated;

-- Admin results include inactive candidates, which is useful for auditing historical totals.
create or replace function public.admin_results()
returns table(
  id uuid,
  name text,
  class_name text,
  jersey_number int,
  category public.vote_category,
  photo_url text,
  active boolean,
  votes bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select e.id into v_election
  from public.elections e
  order by e.created_at desc
  limit 1;

  return query
  select c.id, c.name, c.class_name, c.jersey_number, c.category,
         c.photo_url, c.active, count(v.id)::bigint
  from public.candidates c
  left join public.votes v on v.candidate_id = c.id
  where c.election_id = v_election
  group by c.id
  order by c.category, count(v.id) desc, c.name;
end;
$$;

revoke all on function public.admin_results() from public;
grant execute on function public.admin_results() to authenticated;

-- Admin-only traceability: one row per individual vote, including the authenticated school email.
create or replace function public.admin_voter_records()
returns table(
  ballot_id uuid,
  user_id uuid,
  email text,
  submitted_at timestamptz,
  candidate_id uuid,
  candidate_name text,
  class_name text,
  jersey_number int,
  category public.vote_category
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select e.id into v_election
  from public.elections e
  order by e.created_at desc
  limit 1;

  return query
  select b.id, b.user_id, lower(u.email)::text, b.submitted_at,
         c.id, c.name, c.class_name, c.jersey_number, c.category
  from public.ballots b
  join auth.users u on u.id = b.user_id
  join public.votes v on v.ballot_id = b.id
  join public.candidates c on c.id = v.candidate_id
  where b.election_id = v_election
  order by b.submitted_at desc, lower(u.email), c.category, c.name;
end;
$$;

revoke all on function public.admin_voter_records() from public;
grant execute on function public.admin_voter_records() to authenticated;

-- Candidate photos
insert into storage.buckets (id, name, public)
values ('candidate-photos', 'candidate-photos', true)
on conflict (id) do update set public = true;

DROP POLICY IF EXISTS "public candidate photos" ON storage.objects;
CREATE POLICY "public candidate photos" ON storage.objects
FOR SELECT
USING (bucket_id = 'candidate-photos');

DROP POLICY IF EXISTS "admin uploads candidate photos" ON storage.objects;
CREATE POLICY "admin uploads candidate photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'candidate-photos' AND public.is_admin());

DROP POLICY IF EXISTS "admin updates candidate photos" ON storage.objects;
CREATE POLICY "admin updates candidate photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'candidate-photos' AND public.is_admin())
WITH CHECK (bucket_id = 'candidate-photos' AND public.is_admin());

DROP POLICY IF EXISTS "admin deletes candidate photos" ON storage.objects;
CREATE POLICY "admin deletes candidate photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'candidate-photos' AND public.is_admin());

-- Initial election
insert into public.elections(title, status)
select '2026 明道班際籃球明星賽', 'draft'
where not exists (select 1 from public.elections);

-- AFTER you sign in once with your own school Google account, set the ONE admin:
-- update public.admin_config
-- set user_id = (select id from auth.users where lower(email) = lower('YOUR_ID@ms.mingdao.edu.tw'))
-- where singleton = true;
