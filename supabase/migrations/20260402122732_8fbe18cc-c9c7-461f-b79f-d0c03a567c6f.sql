CREATE POLICY "Staff can update own device_id"
ON public.staff_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);