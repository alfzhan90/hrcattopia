-- HR Feature Pack: leave balances, allowances, salary advances, probation tracking

-- 1. New columns on staff_profiles
alter table public.staff_profiles
  add column if not exists employment_start_date date,
  add column if not exists probation_end_date date,
  add column if not exists probation_confirmed boolean not null default false;

-- 2. Custom allowances per staff
create table if not exists public.staff_allowances (
  id uuid not null default gen_random_uuid() primary key,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  name text not null,
  amount decimal(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.staff_allowances enable row level security;

create policy "Admin full access staff_allowances"
  on public.staff_allowances for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Staff read own allowances"
  on public.staff_allowances for select to authenticated
  using (staff_profile_id in (
    select id from public.staff_profiles where user_id = auth.uid()
  ));

create trigger update_staff_allowances_updated_at
  before update on public.staff_allowances
  for each row execute function public.update_updated_at_column();

-- 3. Salary advances
create table if not exists public.salary_advances (
  id uuid not null default gen_random_uuid() primary key,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  amount decimal(10,2) not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deducted')),
  approved_by uuid references auth.users(id),
  approved_at timestamp with time zone,
  deduct_month text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.salary_advances enable row level security;

create policy "Admin full access salary_advances"
  on public.salary_advances for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Staff read own salary_advances"
  on public.salary_advances for select to authenticated
  using (staff_profile_id in (
    select id from public.staff_profiles where user_id = auth.uid()
  ));

create policy "Staff insert own salary_advances"
  on public.salary_advances for insert to authenticated
  with check (
    staff_profile_id in (select id from public.staff_profiles where user_id = auth.uid())
    and requested_by = auth.uid()
  );

create trigger update_salary_advances_updated_at
  before update on public.salary_advances
  for each row execute function public.update_updated_at_column();
