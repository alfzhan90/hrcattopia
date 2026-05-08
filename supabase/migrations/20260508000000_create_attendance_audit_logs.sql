create table if not exists attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_log_id uuid references attendance_logs(id) on delete set null,
  action text not null check (action in ('add', 'edit', 'delete')),
  actor_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table attendance_audit_logs enable row level security;

create policy "Authenticated can insert audit logs"
  on attendance_audit_logs for insert
  to authenticated
  with check (true);

create policy "Authenticated can read audit logs"
  on attendance_audit_logs for select
  to authenticated
  using (true);
