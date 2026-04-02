
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create enum for employment type
CREATE TYPE public.employment_type AS ENUM ('Monthly-FT', 'Hourly-FT');

-- Create enum for attendance status
CREATE TYPE public.attendance_status AS ENUM ('on_time', 'late', 'out_of_range');

-- Create branches table
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  radius_meters INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create staff_profiles table
CREATE TABLE public.staff_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  staff_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  ic_number TEXT NOT NULL,
  kwsp_number TEXT,
  socso_number TEXT,
  employment_type public.employment_type NOT NULL DEFAULT 'Monthly-FT',
  base_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  ot_rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  device_id TEXT,
  al_balance INT NOT NULL DEFAULT 14,
  mc_balance INT NOT NULL DEFAULT 14,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance_logs table
CREATE TABLE public.attendance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_out_time TIMESTAMP WITH TIME ZONE,
  check_in_lat FLOAT8,
  check_in_long FLOAT8,
  status public.attendance_status NOT NULL DEFAULT 'on_time',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_profiles_updated_at
  BEFORE UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create sequence for staff_id auto-generation
CREATE SEQUENCE IF NOT EXISTS staff_id_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_staff_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.staff_id = 'STF-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('staff_id_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_staff_id
  BEFORE INSERT ON public.staff_profiles
  FOR EACH ROW
  WHEN (NEW.staff_id IS NULL OR NEW.staff_id = '')
  EXECUTE FUNCTION public.generate_staff_id();

-- RLS Policies for branches
CREATE POLICY "Authenticated users can view branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert branches"
  ON public.branches FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update branches"
  ON public.branches FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete branches"
  ON public.branches FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for staff_profiles
CREATE POLICY "Admins can view all staff profiles"
  ON public.staff_profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Admins can insert staff profiles"
  ON public.staff_profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update staff profiles"
  ON public.staff_profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete staff profiles"
  ON public.staff_profiles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance_logs
CREATE POLICY "Users can view own or admin views all attendance"
  ON public.attendance_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
  ON public.attendance_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Admins can update attendance"
  ON public.attendance_logs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete attendance"
  ON public.attendance_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role or admin views all"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
