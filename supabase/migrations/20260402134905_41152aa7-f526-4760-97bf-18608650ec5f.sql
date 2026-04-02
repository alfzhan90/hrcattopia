
-- Add leave status enum
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected');

-- Add Emergency Leave to leave_type enum
ALTER TYPE public.leave_type ADD VALUE 'EL';

-- Update leave_records table
ALTER TABLE public.leave_records
  ADD COLUMN end_date date,
  ADD COLUMN reason text,
  ADD COLUMN mc_file_url text,
  ADD COLUMN status public.leave_status NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_by uuid,
  ADD COLUMN approved_at timestamp with time zone;

-- Backfill existing records as approved (they were admin-created)
UPDATE public.leave_records SET status = 'approved', end_date = date WHERE end_date IS NULL;

-- Create storage bucket for MC uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('mc-uploads', 'mc-uploads', false);

-- Storage policies: staff can upload to their own folder
CREATE POLICY "Users can upload MC files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mc-uploads');

CREATE POLICY "Users can view MC files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mc-uploads');

-- Allow staff to insert their own leave requests
CREATE POLICY "Staff can insert own leave requests"
ON public.leave_records FOR INSERT TO authenticated
WITH CHECK (
  staff_profile_id IN (
    SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()
  )
);
