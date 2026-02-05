-- Nexus Careers Remote Schema (Synchronized)
-- This file reflects the actual state of the production database.

-- 1. Profiles & Roles
CREATE TABLE IF NOT EXISTS public.students (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  college text NOT NULL,
  roll_number text NOT NULL,
  department text NOT NULL,
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
  verification_status text DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  skills text[] DEFAULT '{}'::text[],
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.admins (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  college text NOT NULL,
  role text NOT NULL,
  department text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  mobile_number text,
  employee_id text,
  mfa_enabled boolean DEFAULT false,
  mfa_method text DEFAULT 'otp'::text CHECK (mfa_method = ANY (ARRAY['otp'::text, 'employee_id'::text])),
  is_verified boolean DEFAULT false,
  verification_file_url text,
  CONSTRAINT admins_pkey PRIMARY KEY (id),
  CONSTRAINT admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  company_name text NOT NULL,
  industry text,
  website text,
  logo_url text,
  description text,
  location text,
  role text DEFAULT 'company'::text,
  created_at timestamp with time zone DEFAULT now(),
  is_verified boolean DEFAULT false,
  verification_file_url text,
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- 2. Core Entities
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  college_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  company text NOT NULL,
  description text NOT NULL,
  package_lpa double precision,
  min_cgpa double precision DEFAULT 0,
  allowed_departments text[] NOT NULL,
  college text NOT NULL,
  posted_by uuid,
  apply_link text NOT NULL,
  deadline date NOT NULL,
  status text DEFAULT 'active'::text,
  ai_analysis jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  is_corporate boolean DEFAULT false,
  jd_file_url text,
  assessment_start_date timestamp with time zone,
  assessment_end_date timestamp with time zone,
  interview_start_date timestamp with time zone,
  CONSTRAINT opportunities_pkey PRIMARY KEY (id),
  CONSTRAINT opportunities_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  status text DEFAULT 'applied'::text,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  current_stage text,
  CONSTRAINT applications_pkey PRIMARY KEY (id),
  CONSTRAINT applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT applications_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id)
);

-- 3. Additional Features
CREATE TABLE IF NOT EXISTS public.campus_resources (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lister_id uuid NOT NULL,
  college text NOT NULL,
  item_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  listing_type text DEFAULT 'service'::text,
  service_rate double precision,
  service_rate_unit text,
  image_url text,
  is_moderated boolean DEFAULT false,
  moderation_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT campus_resources_pkey PRIMARY KEY (id),
  CONSTRAINT campus_resources_lister_id_fkey FOREIGN KEY (lister_id) REFERENCES public.students(id)
);

CREATE TABLE IF NOT EXISTS public.student_queries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  student_name text NOT NULL,
  college text NOT NULL,
  query_message text NOT NULL,
  status text DEFAULT 'open'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT student_queries_pkey PRIMARY KEY (id),
  CONSTRAINT student_queries_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);

CREATE TABLE IF NOT EXISTS public.ax_tasks ( -- Renamed from ai_tasks to avoid conflict if needed, or stick to user's
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  task_name text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued'::text,
  result jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  topic text NOT NULL,
  score text,
  violations jsonb DEFAULT '[]'::jsonb,
  ai_report text,
  status text DEFAULT 'completed'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exam_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT exam_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
