-- Feature Pack 2: bonus, announcements, disciplinary, onboarding, shift swaps

-- 1. Bonus column on payroll_runs
alter table public.payroll_runs
  add column if not exists bonus decimal(10,2) not null default 0;

-- 2. Announcements
create table if not exists public.announcements (
  id uuid not null default gen_random_uuid() primary key,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  expires_at date,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.announcements enable row level security;

create policy "Admin full access announcements"
  on public.announcements for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Staff read active announcements"
  on public.announcements for select to authenticated
  using (is_active = true and (expires_at is null or expires_at >= current_date));

create trigger update_announcements_updated_at
  before update on public.announcements
  for each row execute function public.update_updated_at_column();

-- 3. Disciplinary records
create table if not exists public.disciplinary_records (
  id uuid not null default gen_random_uuid() primary key,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  type text not null check (type in ('verbal_warning','written_warning','show_cause','suspension','final_warning')),
  description text not null,
  issued_date date not null default current_date,
  issued_by uuid references auth.users(id),
  created_at timestamp with time zone not null default now()
);

alter table public.disciplinary_records enable row level security;

create policy "Admin full access disciplinary_records"
  on public.disciplinary_records for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 4. Onboarding tasks
create table if not exists public.onboarding_tasks (
  id uuid not null default gen_random_uuid() primary key,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  task_name text not null,
  completed boolean not null default false,
  completed_at timestamp with time zone,
  completed_by uuid references auth.users(id),
  sort_order int not null default 0,
  created_at timestamp with time zone not null default now()
);

alter table public.onboarding_tasks enable row level security;

create policy "Admin full access onboarding_tasks"
  on public.onboarding_tasks for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 5. Shift swaps
create table if not exists public.shift_swaps (
  id uuid not null default gen_random_uuid() primary key,
  requester_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  target_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  requester_schedule_id uuid not null references public.schedules(id) on delete cascade,
  target_schedule_id uuid references public.schedules(id) on delete set null,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.shift_swaps enable row level security;

create policy "Admin full access shift_swaps"
  on public.shift_swaps for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Staff read own shift_swaps"
  on public.shift_swaps for select to authenticated
  using (
    requester_profile_id in (select id from public.staff_profiles where user_id = auth.uid())
    or target_profile_id in (select id from public.staff_profiles where user_id = auth.uid())
  );

create policy "Staff insert shift_swaps"
  on public.shift_swaps for insert to authenticated
  with check (
    requester_profile_id in (select id from public.staff_profiles where user_id = auth.uid())
  );

create policy "Staff update as target"
  on public.shift_swaps for update to authenticated
  using (
    target_profile_id in (select id from public.staff_profiles where user_id = auth.uid())
    and status = 'pending'
  )
  with check (status in ('accepted','rejected'));

create trigger update_shift_swaps_updated_at
  before update on public.shift_swaps
  for each row execute function public.update_updated_at_column();
