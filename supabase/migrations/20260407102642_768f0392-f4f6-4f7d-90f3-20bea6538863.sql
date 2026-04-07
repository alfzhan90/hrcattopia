
-- Add Freelancer to employment_type enum
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'Freelancer';

-- Add bank/phone fields to staff_profiles
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text;

-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid');

-- Create freelancer invoices table
CREATE TABLE public.freelancer_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_profile_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  month date NOT NULL,
  total_hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  total_payable numeric NOT NULL DEFAULT 0,
  invoice_number text NOT NULL DEFAULT '',
  e_invoice_id text,
  payment_due_date date,
  service_description text NOT NULL DEFAULT 'Casual Labour Services',
  status invoice_status NOT NULL DEFAULT 'draft',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(staff_profile_id, month)
);

-- Enable RLS
ALTER TABLE public.freelancer_invoices ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage freelancer invoices"
  ON public.freelancer_invoices
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view own invoices
CREATE POLICY "Staff can view own invoices"
  ON public.freelancer_invoices
  FOR SELECT
  TO authenticated
  USING (staff_profile_id IN (
    SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_freelancer_invoices_updated_at
  BEFORE UPDATE ON public.freelancer_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
