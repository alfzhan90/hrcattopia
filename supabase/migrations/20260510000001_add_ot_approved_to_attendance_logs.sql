alter table attendance_logs
  add column if not exists ot_approved boolean not null default false;
