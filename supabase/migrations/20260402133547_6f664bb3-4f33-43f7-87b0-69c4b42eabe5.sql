ALTER TABLE public.attendance_logs
  ADD COLUMN rest_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN net_hours numeric NOT NULL DEFAULT 0;