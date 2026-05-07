
-- 1. Add area_manager to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'area_manager';
