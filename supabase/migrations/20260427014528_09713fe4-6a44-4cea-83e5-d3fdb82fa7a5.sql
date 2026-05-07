CREATE INDEX IF NOT EXISTS idx_attendance_logs_manager_notes
  ON public.attendance_logs (manager_notes)
  WHERE manager_notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_check_in
  ON public.attendance_logs (user_id, check_in_time DESC);