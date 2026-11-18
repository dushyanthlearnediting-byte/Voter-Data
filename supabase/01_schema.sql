-- RUN THIS FIRST. Tables + ward-wise security. (Skip if you already ran it in Supabase.)
-- Change 15 at the bottom to the number of wards in your panchayat.

create table public.wards (
  id uuid primary key default gen_random_uuid(),
  ward_number int not null unique,
  name text
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null check (role in ('admin','sub_admin','data_entry')),
  ward_id uuid references public.wards(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ward_required check (role = 'admin' or ward_id is not null)
);

create table public.voters (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  relative_name text,
  voter_id text not null unique,
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  ward_id uuid not null references public.wards(id),
  age int check (age is null or age between 18 and 120),
  gender text,
  booth_name text,
  ward_serial integer,
  address text,
  status text not null default 'Not visited'
    check (status in ('Not visited','Visited','Follow-up needed')),
  notes text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.voters (ward_id);
create index on public.voters (phone);
create index on public.voters (full_name);

create or replace function public.voters_before_write()
returns trigger language plpgsql as $$
begin
  new.voter_id := upper(trim(new.voter_id));
  new.updated_at := now();
  return new;
end $$;

create trigger voters_before_write
before insert or update on public.voters
for each row execute function public.voters_before_write();

create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.app_ward()
returns uuid language sql stable security definer set search_path = public as $$
  select ward_id from public.profiles where id = auth.uid() and is_active;
$$;

alter table public.wards    enable row level security;
alter table public.profiles enable row level security;
alter table public.voters   enable row level security;

create policy wards_select on public.wards for select to authenticated
  using (public.app_role() = 'admin' or id = public.app_ward());

create policy wards_admin_write on public.wards for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.app_role() = 'admin'
    or (public.app_role() = 'sub_admin' and ward_id = public.app_ward())
  );

create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy voters_select on public.voters for select to authenticated
  using (
    public.app_role() = 'admin'
    or (public.app_role() in ('sub_admin','data_entry') and ward_id = public.app_ward())
  );

create policy voters_insert on public.voters for insert to authenticated
  with check (
    public.app_role() = 'admin'
    or (public.app_role() in ('sub_admin','data_entry') and ward_id = public.app_ward())
  );

create policy voters_update on public.voters for update to authenticated
  using (
    public.app_role() = 'admin'
    or (public.app_role() in ('sub_admin','data_entry') and ward_id = public.app_ward())
  )
  with check (
    public.app_role() = 'admin'
    or (public.app_role() in ('sub_admin','data_entry') and ward_id = public.app_ward())
  );

create policy voters_delete on public.voters for delete to authenticated
  using (
    public.app_role() = 'admin'
    or (public.app_role() = 'sub_admin' and ward_id = public.app_ward())
  );

insert into public.wards (ward_number, name)
select g, 'Ward ' || g from generate_series(1, 15) g;
