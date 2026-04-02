
ALTER TABLE public.attendance_logs
ADD COLUMN regular_hours numeric NOT NULL DEFAULT 0,
ADD COLUMN ot_hours numeric NOT NULL DEFAULT 0;
