-- Repair migration for deployed databases that are behind the app contract.
-- Apply this in Supabase before end-to-end role onboarding QA.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.students (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  college text NOT NULL DEFAULT 'Anurag University',
  roll_number text NOT NULL,
  department text NOT NULL DEFAULT 'General',
  ug_cgpa double precision DEFAULT 0,
  backlogs integer DEFAULT 0,
  ug_passout_year integer,
  tenth_percentage double precision,
  inter_diploma_percentage double precision,
  personal_email text,
  mobile_number text,
  section text,
  gender text,
  level integer DEFAULT 1,
  xp integer DEFAULT 0,
  xp_to_next_level integer DEFAULT 100,
  linkedin_profile_url text,
  github_profile_url text,
  verification_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  skills text[] DEFAULT '{}',
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.admins (
  id uuid NOT NULL,
  email text NOT NULL,
  college text NOT NULL DEFAULT 'Anurag University',
  department text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT admins_pkey PRIMARY KEY (id),
  CONSTRAINT admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid NOT NULL,
  email text NOT NULL,
  company_name text NOT NULL,
  industry text,
  website text,
  logo_url text,
  description text,
  location text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.student_registry (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  roll_number text NOT NULL,
  email text NOT NULL,
  college text NOT NULL DEFAULT 'Anurag University',
  department text NOT NULL DEFAULT 'General',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT student_registry_pkey PRIMARY KEY (id)
);

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS admin_role text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS verification_file_url text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS biometric_registered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_method text DEFAULT 'otp',
  ADD COLUMN IF NOT EXISTS is_incubation_lead boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS incubation_cell_name text,
  ADD COLUMN IF NOT EXISTS incubation_services text[] DEFAULT '{}';

UPDATE public.admins
SET
  name = COALESCE(name, split_part(email, '@', 1), 'Admin'),
  full_name = COALESCE(full_name, name, split_part(email, '@', 1), 'Admin'),
  admin_role = COALESCE(admin_role, role, 'University TPO'),
  role = COALESCE(role, 'University TPO'),
  is_verified = COALESCE(is_verified, true);

ALTER TABLE public.student_registry
  ADD COLUMN IF NOT EXISTS cgpa double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ug_cgpa double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backlogs integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ug_passout_year integer,
  ADD COLUMN IF NOT EXISTS passing_year integer DEFAULT extract(year from now())::integer + 1,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS is_whitelisted boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_modified_by_id uuid,
  ADD COLUMN IF NOT EXISTS last_modified_by_name text,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cgpa double precision DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS passing_year integer DEFAULT extract(year from now())::integer + 1;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS role text DEFAULT 'company';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS verification_file_url text;

UPDATE public.companies
SET
  name = COALESCE(name, company_name, split_part(email, '@', 1), 'Company User'),
  role = COALESCE(role, 'company'),
  is_verified = COALESCE(is_verified, true);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own admin profile" ON public.admins;
CREATE POLICY "Users can create own admin profile"
ON public.admins
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own admin profile" ON public.admins;
CREATE POLICY "Users can update own admin profile"
ON public.admins
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own admin profile" ON public.admins;
CREATE POLICY "Users can read own admin profile"
ON public.admins
FOR SELECT
USING (auth.uid() = id);

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

DROP POLICY IF EXISTS "Users can create own student profile" ON public.students;
CREATE POLICY "Users can create own student profile"
ON public.students
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own student profile" ON public.students;
CREATE POLICY "Users can update own student profile"
ON public.students
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own student profile" ON public.students;
CREATE POLICY "Users can read own student profile"
ON public.students
FOR SELECT
USING (auth.uid() = id);
