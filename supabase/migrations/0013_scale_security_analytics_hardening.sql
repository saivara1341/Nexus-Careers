CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  email text,
  college text,
  roll_number text,
  department text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  email text,
  college text,
  role text,
  is_verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  email text,
  name text,
  company_name text,
  is_verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.student_registry (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  roll_number text,
  email text,
  college text,
  department text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text,
  company text,
  description text,
  college text,
  posted_by uuid,
  min_cgpa double precision DEFAULT 0,
  max_backlogs integer DEFAULT 0,
  deadline date,
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid,
  opportunity_id uuid,
  status text DEFAULT 'applied',
  current_stage text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS roll_number text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS department text;

ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'verified';
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS cgpa double precision DEFAULT 0;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS ug_cgpa double precision DEFAULT 0;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS passing_year integer;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS backlogs integer DEFAULT 0;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS roll_number text;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS department text;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending_registry';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cgpa double precision DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS ug_cgpa double precision DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS backlogs integer DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS passing_year integer;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS posted_by uuid;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS min_cgpa double precision DEFAULT 0;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS max_backlogs integer DEFAULT 0;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS opportunity_id uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'applied';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS current_stage text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc'::text, now());

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_notes text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS interview_at timestamptz;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS interview_link text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS offer_package_lpa double precision;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS offer_designation text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS offer_location text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS last_action_by uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id uuid,
  actor_role text,
  actor_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.platform_audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.platform_audit_logs ADD COLUMN IF NOT EXISTS actor_role text;
ALTER TABLE public.platform_audit_logs ADD COLUMN IF NOT EXISTS actor_name text;
ALTER TABLE public.platform_audit_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.platform_audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.platform_audit_logs ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE public.platform_audit_logs ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.platform_audit_logs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.company_recruiters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'recruiter',
  can_post_jobs boolean NOT NULL DEFAULT true,
  can_manage_pipeline boolean NOT NULL DEFAULT true,
  can_export_data boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.company_recruiters ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.company_recruiters ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.company_recruiters ADD COLUMN IF NOT EXISTS role text DEFAULT 'recruiter';
ALTER TABLE public.company_recruiters ADD COLUMN IF NOT EXISTS can_post_jobs boolean DEFAULT true;
ALTER TABLE public.company_recruiters ADD COLUMN IF NOT EXISTS can_manage_pipeline boolean DEFAULT true;
ALTER TABLE public.company_recruiters ADD COLUMN IF NOT EXISTS can_export_data boolean DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE '
      INSERT INTO public.company_recruiters (company_id, user_id, role, can_post_jobs, can_manage_pipeline, can_export_data)
      SELECT c.id, COALESCE(c.user_id, c.id), ''owner'', true, true, true
      FROM public.companies c
      WHERE COALESCE(c.user_id, c.id) IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = COALESCE(c.user_id, c.id))
        AND NOT EXISTS (
          SELECT 1 FROM public.company_recruiters existing
          WHERE existing.company_id = c.id
            AND existing.user_id = COALESCE(c.user_id, c.id)
        )
    ';
  ELSE
    EXECUTE '
      INSERT INTO public.company_recruiters (company_id, user_id, role, can_post_jobs, can_manage_pipeline, can_export_data)
      SELECT c.id, c.id, ''owner'', true, true, true
      FROM public.companies c
      WHERE c.id IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = c.id)
        AND NOT EXISTS (
          SELECT 1 FROM public.company_recruiters existing
          WHERE existing.company_id = c.id
            AND existing.user_id = c.id
        )
    ';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_college_department ON public.students(college, department);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON public.students(roll_number);
CREATE INDEX IF NOT EXISTS idx_student_registry_college_department ON public.student_registry(college, department);
CREATE INDEX IF NOT EXISTS idx_student_registry_email ON public.student_registry(email);
CREATE INDEX IF NOT EXISTS idx_student_registry_roll_number ON public.student_registry(roll_number);
CREATE INDEX IF NOT EXISTS idx_opportunities_college_status_deadline ON public.opportunities(college, status, deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_posted_by ON public.opportunities(posted_by);
CREATE INDEX IF NOT EXISTS idx_applications_student_status ON public.applications(student_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_opportunity_status ON public.applications(opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON public.applications(current_stage);
CREATE INDEX IF NOT EXISTS idx_company_recruiters_user ON public.company_recruiters(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_entity ON public.platform_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_actor ON public.platform_audit_logs(actor_id, created_at DESC);

CREATE OR REPLACE VIEW public.analytics_student_outcomes
WITH (security_invoker = true) AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.roll_number,
  s.email,
  s.college,
  s.department,
  s.section,
  COALESCE(s.ug_cgpa, s.cgpa, 0) AS cgpa,
  s.backlogs,
  COUNT(a.id) AS applied_count,
  COUNT(a.id) FILTER (WHERE a.status IN ('offered', 'hired')) AS placed_count,
  MAX(a.offer_package_lpa) FILTER (WHERE a.status IN ('offered', 'hired')) AS max_package_lpa,
  STRING_AGG(DISTINCT o.company, ', ') FILTER (WHERE a.status IN ('offered', 'hired')) AS placed_companies
FROM public.students s
LEFT JOIN public.applications a ON a.student_id = s.id
LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
GROUP BY s.id, s.name, s.roll_number, s.email, s.college, s.department, s.section, s.ug_cgpa, s.cgpa, s.backlogs;

CREATE OR REPLACE VIEW public.analytics_department_performance
WITH (security_invoker = true) AS
SELECT
  s.college,
  COALESCE(s.department, 'General') AS department,
  COUNT(DISTINCT s.id) AS total_students,
  COUNT(a.id) AS applied_count,
  COUNT(DISTINCT a.student_id) FILTER (WHERE a.id IS NOT NULL) AS students_applied,
  COUNT(DISTINCT a.student_id) FILTER (WHERE a.status IN ('offered', 'hired')) AS students_placed,
  ROUND((AVG(a.offer_package_lpa) FILTER (WHERE a.status IN ('offered', 'hired')))::numeric, 2) AS avg_package_lpa,
  MAX(a.offer_package_lpa) FILTER (WHERE a.status IN ('offered', 'hired')) AS max_package_lpa
FROM public.students s
LEFT JOIN public.applications a ON a.student_id = s.id
GROUP BY s.college, COALESCE(s.department, 'General');

CREATE OR REPLACE VIEW public.analytics_company_performance
WITH (security_invoker = true) AS
SELECT
  o.college,
  o.company,
  COUNT(DISTINCT o.id) AS posted_jobs,
  COUNT(a.id) AS applied_count,
  COUNT(a.id) FILTER (WHERE a.status IN ('shortlisted', 'qualified', 'verified')) AS shortlisted_count,
  COUNT(a.id) FILTER (WHERE a.current_stage ILIKE '%interview%') AS interview_count,
  COUNT(a.id) FILTER (WHERE a.status IN ('offered', 'hired')) AS placed_count,
  ROUND((AVG(a.offer_package_lpa) FILTER (WHERE a.status IN ('offered', 'hired')))::numeric, 2) AS avg_package_lpa,
  MAX(a.offer_package_lpa) FILTER (WHERE a.status IN ('offered', 'hired')) AS max_package_lpa
FROM public.opportunities o
LEFT JOIN public.applications a ON a.opportunity_id = o.id
GROUP BY o.college, o.company;

ALTER TABLE public.company_recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company recruiters can view their team" ON public.company_recruiters;
CREATE POLICY "Company recruiters can view their team"
ON public.company_recruiters
FOR SELECT
USING (user_id = auth.uid() OR company_id IN (SELECT c.id FROM public.companies c WHERE COALESCE(c.user_id, c.id) = auth.uid()));

DROP POLICY IF EXISTS "Company owners can manage recruiters" ON public.company_recruiters;
CREATE POLICY "Company owners can manage recruiters"
ON public.company_recruiters
FOR ALL
USING (company_id IN (SELECT c.id FROM public.companies c WHERE COALESCE(c.user_id, c.id) = auth.uid()))
WITH CHECK (company_id IN (SELECT c.id FROM public.companies c WHERE COALESCE(c.user_id, c.id) = auth.uid()));

DROP POLICY IF EXISTS "Trusted users can insert audit logs" ON public.platform_audit_logs;
CREATE POLICY "Trusted users can insert audit logs"
ON public.platform_audit_logs
FOR INSERT
WITH CHECK (auth.uid() = actor_id);

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.platform_audit_logs;
CREATE POLICY "Admins can read audit logs"
ON public.platform_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.id = auth.uid() OR admins.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Students create own applications" ON public.applications;
CREATE POLICY "Students create own applications"
ON public.applications
FOR INSERT
WITH CHECK (
  auth.uid() = student_id
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.student_registry r
      ON lower(r.email) = lower(s.email)
      OR lower(r.roll_number) = lower(s.roll_number)
    WHERE s.id = auth.uid()
      AND s.id = applications.student_id
      AND COALESCE(s.verification_status, '') = 'verified'
      AND COALESCE(r.is_verified, true) = true
      AND COALESCE(r.verification_status, 'verified') IN ('verified', 'approved')
      AND COALESCE(r.cgpa, r.ug_cgpa, 0) >= (
        SELECT COALESCE(o.min_cgpa, 0)
        FROM public.opportunities o
        WHERE o.id = applications.opportunity_id
      )
      AND COALESCE(r.backlogs, 0) <= (
        SELECT COALESCE(o.max_backlogs, 999)
        FROM public.opportunities o
        WHERE o.id = applications.opportunity_id
      )
  )
);

DROP POLICY IF EXISTS "Companies view applicants" ON public.applications;
CREATE POLICY "Companies view applicants"
ON public.applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.opportunities o
    LEFT JOIN public.company_recruiters cr ON cr.company_id IN (
      SELECT c.id FROM public.companies c WHERE c.id = o.posted_by OR c.user_id = o.posted_by
    )
    WHERE o.id = applications.opportunity_id
      AND (o.posted_by = auth.uid() OR (cr.user_id = auth.uid() AND cr.can_manage_pipeline))
  )
);

DROP POLICY IF EXISTS "Companies update applicants" ON public.applications;
CREATE POLICY "Companies update applicants"
ON public.applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.opportunities o
    LEFT JOIN public.company_recruiters cr ON cr.company_id IN (
      SELECT c.id FROM public.companies c WHERE c.id = o.posted_by OR c.user_id = o.posted_by
    )
    WHERE o.id = applications.opportunity_id
      AND (o.posted_by = auth.uid() OR (cr.user_id = auth.uid() AND cr.can_manage_pipeline))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.opportunities o
    LEFT JOIN public.company_recruiters cr ON cr.company_id IN (
      SELECT c.id FROM public.companies c WHERE c.id = o.posted_by OR c.user_id = o.posted_by
    )
    WHERE o.id = applications.opportunity_id
      AND (o.posted_by = auth.uid() OR (cr.user_id = auth.uid() AND cr.can_manage_pipeline))
  )
);
