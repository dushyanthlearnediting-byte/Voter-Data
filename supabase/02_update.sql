-- RUN THIS AFTER the first SQL (tables + security). Safe to run more than once.

-- 1. Email on each profile (shown in the Users page; filled in by the manage-users function)
alter table public.profiles add column if not exists email text;
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- 2. Status values used by the app screens
-- Replace the former house field while preserving existing voter data.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'voters' and column_name = 'house_number'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'voters' and column_name = 'booth_name'
  ) then
    alter table public.voters rename column house_number to booth_name;
  end if;
end $$;
alter table public.voters add column if not exists booth_name text;
alter table public.voters add column if not exists ward_serial integer;

alter table public.voters drop constraint if exists voters_status_check;
update public.voters
set status = case status
  when 'Not visited' then 'not_visited'
  when 'Visited' then 'visited'
  when 'Follow-up needed' then 'follow_up'
  else status
end;
alter table public.voters alter column status set default 'not_visited';
alter table public.voters
  add constraint voters_status_check check (status in ('not_visited', 'visited', 'follow_up'));

-- 3. Extra indexes for speed
create index if not exists voters_created_by_idx on public.voters (created_by);
create index if not exists voters_status_idx on public.voters (status);

-- 4. Dashboard numbers, calculated inside the database.
--    "security invoker" means the ward-wise security rules still apply:
--    a Sub-Admin only gets numbers for their own ward.
create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from voters),
    'todaysEntries', (
      select count(*) from voters
      where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
    ),
    'statusBreakdown', jsonb_build_object(
      'not_visited', (select count(*) from voters where status = 'not_visited'),
      'visited',     (select count(*) from voters where status = 'visited'),
      'follow_up',   (select count(*) from voters where status = 'follow_up')
    ),
    'wardCounts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'wardId', w.id,
          'wardName', coalesce(w.name, 'Ward ' || w.ward_number),
          'count', coalesce(c.n, 0)
        ) order by w.ward_number
      )
      from wards w
      left join (select ward_id, count(*) as n from voters group by ward_id) c on c.ward_id = w.id
    ), '[]'::jsonb),
    'contributors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'userId', x.user_id,
          'name', x.name,
          'wardId', x.ward_id,
          'wardName', x.ward_name,
          'total', x.total,
          'visited', x.visited,
          'notVisited', x.not_visited,
          'followUp', x.follow_up,
          'todays', x.todays,
          'lastEntryAt', x.last_entry_at
        ) order by x.last_entry_at desc
      )
      from (
        select
          p.id as user_id,
          p.full_name as name,
          p.ward_id,
          coalesce(w.name, 'Ward ' || w.ward_number) as ward_name,
          count(*) as total,
          count(*) filter (where v.status = 'visited') as visited,
          count(*) filter (where v.status = 'not_visited') as not_visited,
          count(*) filter (where v.status = 'follow_up') as follow_up,
          count(*) filter (
            where (v.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
          ) as todays,
          max(v.created_at) as last_entry_at
        from voters v
        join profiles p on p.id = v.created_by and p.role = 'data_entry'
        left join wards w on w.id = p.ward_id
        group by p.id, p.full_name, p.ward_id, w.name, w.ward_number
      ) x
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.dashboard_stats() to authenticated;

notify pgrst, 'reload schema';
