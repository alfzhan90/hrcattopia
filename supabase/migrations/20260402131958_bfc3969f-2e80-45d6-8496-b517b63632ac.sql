
-- Enums
CREATE TYPE public.leave_type AS ENUM ('AL', 'MC', 'UPL');
CREATE TYPE public.payroll_status AS ENUM ('draft', 'released');

-- Public holidays
CREATE TABLE public.public_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  multiplier NUMERIC NOT NULL DEFAULT 2.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage holidays" ON public.public_holidays FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view holidays" ON public.public_holidays FOR SELECT TO authenticated
  USING (true);

-- Leave records
CREATE TABLE public.leave_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_profile_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_profile_id, date)
);
ALTER TABLE public.leave_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leave records" ON public.leave_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view own leave" ON public.leave_records FOR SELECT TO authenticated
  USING (staff_profile_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()));

-- Payroll runs
CREATE TABLE public.payroll_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month DATE NOT NULL,
  staff_profile_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  basic_pay NUMERIC NOT NULL DEFAULT 0,
  ot_pay NUMERIC NOT NULL DEFAULT 0,
  allowance NUMERIC NOT NULL DEFAULT 0,
  commission NUMERIC NOT NULL DEFAULT 0,
  holiday_pay NUMERIC NOT NULL DEFAULT 0,
  gross_pay NUMERIC NOT NULL DEFAULT 0,
  epf_employee NUMERIC NOT NULL DEFAULT 0,
  epf_employer NUMERIC NOT NULL DEFAULT 0,
  socso_employee NUMERIC NOT NULL DEFAULT 0,
  socso_employer NUMERIC NOT NULL DEFAULT 0,
  eis_employee NUMERIC NOT NULL DEFAULT 0,
  eis_employer NUMERIC NOT NULL DEFAULT 0,
  pcb NUMERIC NOT NULL DEFAULT 0,
  upl_deduction NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, staff_profile_id)
);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll" ON public.payroll_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view own released payslips" ON public.payroll_runs FOR SELECT TO authenticated
  USING (
    status = 'released' AND
    staff_profile_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid())
  );
