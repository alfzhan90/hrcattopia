
-- Company settings singleton table
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT '',
  ssm_number text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage company settings"
  ON public.company_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view company settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default empty row
INSERT INTO public.company_settings (company_name) VALUES ('');

-- Storage bucket for company logo
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

CREATE POLICY "Anyone can view company assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-assets');

CREATE POLICY "Admins can upload company assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update company assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete company assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-assets' AND has_role(auth.uid(), 'admin'::app_role));
