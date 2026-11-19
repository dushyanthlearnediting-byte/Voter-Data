-- Run after 01_schema.sql and 02_update.sql.
-- Adds persistent message settings and paginated voter search for the live app.

create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (true);

drop policy if exists app_settings_admin_insert on public.app_settings;
create policy app_settings_admin_insert on public.app_settings for insert to authenticated
  with check (public.app_role() = 'admin');

drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.app_role() = 'admin')
  with check (public.app_role() = 'admin');

grant select, insert, update on public.app_settings to authenticated;

insert into public.app_settings (setting_key, setting_value)
values (
  'message_template',
  'Namaste (name), your voter ID is (VoterId). Please visit (booth) on election day. - Ward (ward)'
)
on conflict (setting_key) do nothing;

create or replace function public.search_voters_page(
  search_term text default null,
  requested_ward_id uuid default null,
  requested_status text default null,
  requested_page integer default 1,
  requested_page_size integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      greatest(coalesce(requested_page, 1), 1) as page,
      greatest(1, least(coalesce(requested_page_size, 50), 200)) as page_size
  ),
  filtered as (
    select
      v.*,
      coalesce(w.name, 'Ward ' || w.ward_number) as _ward_name,
      w.ward_number as _ward_number
    from public.voters v
    left join public.wards w on w.id = v.ward_id
    where
      (
        nullif(trim(search_term), '') is null
        or v.full_name ilike '%' || trim(search_term) || '%'
        or v.voter_id ilike '%' || trim(search_term) || '%'
        or coalesce(v.phone, '') ilike '%' || trim(search_term) || '%'
        or coalesce(v.ward_serial::text, '') ilike '%' || trim(search_term) || '%'
      )
      and (requested_ward_id is null or v.ward_id = requested_ward_id)
      and (requested_status is null or v.status = requested_status)
  ),
  page_rows as (
    select filtered.*
    from filtered
    order by created_at desc, id
    limit (select page_size from params)
    offset ((select page - 1 from params) * (select page_size from params))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'page', (select page from params),
    'totalPages', greatest(
      1,
      ceil((select count(*) from filtered)::numeric / (select page_size from params))::integer
    ),
    'data', coalesce((
      select jsonb_agg(
        (to_jsonb(p) - '_ward_name' - '_ward_number')
        || jsonb_build_object(
          'ward',
          jsonb_build_object(
            'id', p.ward_id,
            'name', p._ward_name,
            'ward_number', p._ward_number
          )
        )
        order by p.created_at desc, p.id
      )
      from page_rows p
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.search_voters_page(text, uuid, text, integer, integer) from public;
revoke all on function public.search_voters_page(text, uuid, text, integer, integer) from anon;
grant execute on function public.search_voters_page(text, uuid, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
