CREATE POLICY "Staff can update own attendance"
ON public.attendance_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);