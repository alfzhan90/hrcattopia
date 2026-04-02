
ALTER TABLE public.branches
  ADD COLUMN grace_period_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN scheduled_start time NOT NULL DEFAULT '09:30';

ALTER TABLE public.attendance_logs
  ADD COLUMN late_minutes numeric NOT NULL DEFAULT 0,
  ADD COLUMN late_waived boolean NOT NULL DEFAULT false;

ALTER TABLE public.payroll_runs
  ADD COLUMN late_deduction numeric NOT NULL DEFAULT 0;
