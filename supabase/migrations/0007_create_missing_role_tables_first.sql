-- Run this first if the Supabase SQL editor reports:
-- ERROR: relation "public.companies" does not exist

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid NOT NULL,
  user_id uuid,
  email text NOT NULL,
  company_name text NOT NULL,
  industry text,
  website text,
  logo_url text,
  description text,
  location text,
  created_at timestamptz DEFAULT now(),
  name text,
  role text DEFAULT 'company',
  is_verified boolean DEFAULT true,
  verification_file_url text,
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own company profile" ON public.companies;
CREATE POLICY "Users can create own company profile"
ON public.companies
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own company profile" ON public.companies;
CREATE POLICY "Users can update own company profile"
ON public.companies
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own company profile" ON public.companies;
CREATE POLICY "Users can read own company profile"
ON public.companies
FOR SELECT
USING (auth.uid() = id);
