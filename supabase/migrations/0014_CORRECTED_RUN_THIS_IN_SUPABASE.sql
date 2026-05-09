-- VERIFIED CLEAN COPY 2026-05-08: no bare ALTER TABLE statements and no ADD COLUMN trailing commas.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Launch-readiness repair that can be applied after the earlier partial/failed 0013 run.
-- It keeps profile creation strict, makes placement progression server-controlled,
-- and adds the backend analytics/indexes needed for large student volumes.

CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  email text,
  college text,
  role text,
  admin_role text,
  is_verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  name text,
  email text,
  college text,
  roll_number text,
  department text,
  cgpa double precision DEFAULT 0,
  ug_cgpa double precision DEFAULT 0,
  backlogs integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  email text,
  name text,
  company_name text,
  role text DEFAULT 'company',
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
  cgpa double precision DEFAULT 0,
  ug_cgpa double precision DEFAULT 0,
  backlogs integer DEFAULT 0,
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

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS admin_role text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS employee_id text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS biometric_registered boolean DEFAULT false;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS roll_number text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cgpa double precision DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS ug_cgpa double precision DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS backlogs integer DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS passing_year integer;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS ug_passout_year integer;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS biometric_registered boolean DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending_registry';

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS role text DEFAULT 'company';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS verification_file_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS biometric_registered boolean DEFAULT false;

ALTER TABLE public.companies
  ALTER COLUMN is_verified SET DEFAULT false;

ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS roll_number text;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS cgpa double precision DEFAULT 0;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS ug_cgpa double precision DEFAULT 0;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS backlogs integer DEFAULT 0;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS passing_year integer;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS ug_passout_year integer;
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'verified';
ALTER TABLE public.student_registry ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true;

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS posted_by uuid;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS min_cgpa double precision DEFAULT 0;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_corporate boolean DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS type text DEFAULT 'job';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS max_backlogs integer DEFAULT 0;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS passing_year integer;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS apply_link text DEFAULT '#';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS allowed_departments text[] DEFAULT '{All}'::text[];
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS jd_file_url text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS assessment_start_date timestamptz;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS assessment_end_date timestamptz;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS interview_start_date timestamptz;

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS opportunity_id uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'applied';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS current_stage text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc'::text, now());
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_notes text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS interview_at timestamptz;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS interview_link text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS offer_package_lpa double precision;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS offer_designation text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS offer_location text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS last_action_by uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

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

CREATE TABLE IF NOT EXISTS public.student_certifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title text NOT NULL,
  issuer text,
  issue_date date,
  credential_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.student_achievements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.campus_resources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lister_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  college text,
  item_name text,
  description text,
  category text,
  listing_type text DEFAULT 'service',
  service_rate double precision,
  service_rate_unit text,
  image_url text,
  is_moderated boolean DEFAULT true,
  moderation_reason text,
  availability jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.campus_resources ADD COLUMN IF NOT EXISTS lister_id uuid;
ALTER TABLE public.campus_resources ADD COLUMN IF NOT EXISTS is_moderated boolean DEFAULT true;
ALTER TABLE public.campus_resources ADD COLUMN IF NOT EXISTS availability jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id uuid REFERENCES public.campus_resources(id) ON DELETE CASCADE,
  requester_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  offerer_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  status text DEFAULT 'requested',
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS requester_id uuid;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS offerer_id uuid;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.service_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_request_id uuid REFERENCES public.service_requests(id) ON DELETE CASCADE,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.service_feedback ADD COLUMN IF NOT EXISTS service_request_id uuid;

CREATE TABLE IF NOT EXISTS public.im_here_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  requester_name text,
  requester_role text DEFAULT 'student',
  college text,
  item_description text,
  location_description text,
  urgency timestamptz DEFAULT (now() + interval '1 hour'),
  status text DEFAULT 'open',
  offerer_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  offerer_name text,
  accepted_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.im_here_requests ADD COLUMN IF NOT EXISTS requester_id uuid;
ALTER TABLE public.im_here_requests ADD COLUMN IF NOT EXISTS offerer_id uuid;
ALTER TABLE public.im_here_requests ADD COLUMN IF NOT EXISTS urgency timestamptz DEFAULT (now() + interval '1 hour');
ALTER TABLE public.im_here_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.student_queries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  student_name text,
  college text,
  query_message text,
  status text DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.student_queries ADD COLUMN IF NOT EXISTS student_id uuid;

CREATE TABLE IF NOT EXISTS public.student_recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.company_recruiters (company_id, user_id, role, can_post_jobs, can_manage_pipeline, can_export_data)
SELECT c.id, COALESCE(c.user_id, c.id), 'owner', true, true, true
FROM public.companies c
WHERE COALESCE(c.user_id, c.id) IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = COALESCE(c.user_id, c.id))
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_recruiters existing
    WHERE existing.company_id = c.id
      AND existing.user_id = COALESCE(c.user_id, c.id)
  );

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins a
    WHERE (a.id = auth.uid() OR a.user_id = auth.uid())
      AND COALESCE(a.is_verified, true) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_post_for_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = _company_id
        AND COALESCE(c.is_verified, false) = true
        AND COALESCE(c.user_id, c.id) = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_recruiters cr
      JOIN public.companies c ON c.id = cr.company_id
      WHERE cr.company_id = _company_id
        AND cr.user_id = auth.uid()
        AND cr.can_post_jobs = true
        AND COALESCE(c.is_verified, false) = true
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_opportunity(_posted_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = _posted_by
        AND COALESCE(c.user_id, c.id) = auth.uid()
        AND COALESCE(c.is_verified, false) = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_recruiters cr
      JOIN public.companies c ON c.id = cr.company_id
      WHERE cr.company_id = _posted_by
        AND cr.user_id = auth.uid()
        AND cr.can_manage_pipeline = true
        AND COALESCE(c.is_verified, false) = true
    );
$$;

CREATE OR REPLACE FUNCTION public.student_has_verified_registry(_student_id uuid, _opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.opportunities o ON o.id = _opportunity_id
    JOIN public.student_registry r
      ON lower(r.email) = lower(s.email)
      OR lower(r.roll_number) = lower(s.roll_number)
    WHERE s.id = _student_id
      AND COALESCE(s.verification_status, '') IN ('verified', 'approved')
      AND COALESCE(r.is_verified, true) = true
      AND COALESCE(r.verification_status, 'verified') IN ('verified', 'approved')
      AND COALESCE(r.cgpa, r.ug_cgpa, s.ug_cgpa, s.cgpa, 0) >= COALESCE(o.min_cgpa, 0)
      AND COALESCE(r.backlogs, s.backlogs, 0) <= COALESCE(o.max_backlogs, 999)
      AND (
        o.passing_year IS NULL
        OR COALESCE(r.passing_year, r.ug_passout_year, s.passing_year, s.ug_passout_year) = o.passing_year
      )
      AND (
        'All' = ANY(COALESCE(o.allowed_departments, ARRAY['All']::text[]))
        OR COALESCE(s.department, 'General') = ANY(COALESCE(o.allowed_departments, ARRAY['All']::text[]))
      )
      AND COALESCE(o.status, 'active') = 'active'
      AND (o.deadline IS NULL OR o.deadline >= CURRENT_DATE)
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_untrusted_verification_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'companies' THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Company verification and role changes require a trusted administrator';
    END IF;
  ELSIF TG_TABLE_NAME = 'admins' THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.admin_role IS DISTINCT FROM OLD.admin_role THEN
      RAISE EXCEPTION 'Admin verification and role changes require a trusted administrator';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_student_academic_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.department IS DISTINCT FROM OLD.department
     OR NEW.ug_cgpa IS DISTINCT FROM OLD.ug_cgpa
     OR NEW.cgpa IS DISTINCT FROM OLD.cgpa
     OR NEW.backlogs IS DISTINCT FROM OLD.backlogs
     OR NEW.passing_year IS DISTINCT FROM OLD.passing_year
     OR NEW.ug_passout_year IS DISTINCT FROM OLD.ug_passout_year
     OR NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    RAISE EXCEPTION 'Academic and registry-backed placement fields require administrator verification';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_student_application_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _posted_by uuid;
BEGIN
  SELECT o.posted_by INTO _posted_by
  FROM public.opportunities o
  WHERE o.id = OLD.opportunity_id;

  IF auth.role() = 'service_role'
     OR public.is_platform_admin()
     OR public.can_manage_opportunity(_posted_by) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.student_id THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
       OR NEW.current_stage IS DISTINCT FROM OLD.current_stage
       OR NEW.candidate_notes IS DISTINCT FROM OLD.candidate_notes
       OR NEW.interview_at IS DISTINCT FROM OLD.interview_at
       OR NEW.interview_link IS DISTINCT FROM OLD.interview_link
       OR NEW.offer_package_lpa IS DISTINCT FROM OLD.offer_package_lpa
       OR NEW.offer_designation IS DISTINCT FROM OLD.offer_designation
       OR NEW.offer_location IS DISTINCT FROM OLD.offer_location
       OR NEW.status NOT IN ('applied', 'verifying', 'pending_verification') THEN
      RAISE EXCEPTION 'Student application updates are limited to proof submission and cannot advance placement status';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to update this application';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_company_verification_escalation ON public.companies;
CREATE TRIGGER trg_prevent_company_verification_escalation
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.prevent_untrusted_verification_changes();

DROP TRIGGER IF EXISTS trg_prevent_admin_verification_escalation ON public.admins;
CREATE TRIGGER trg_prevent_admin_verification_escalation
BEFORE UPDATE ON public.admins
FOR EACH ROW EXECUTE FUNCTION public.prevent_untrusted_verification_changes();

DROP TRIGGER IF EXISTS trg_prevent_student_academic_self_edit ON public.students;
CREATE TRIGGER trg_prevent_student_academic_self_edit
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.prevent_student_academic_self_edit();

DROP TRIGGER IF EXISTS trg_prevent_student_application_escalation ON public.applications;
CREATE TRIGGER trg_prevent_student_application_escalation
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.prevent_student_application_escalation();

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

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.im_here_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for demo" ON public.students;
DROP POLICY IF EXISTS "Admins can list all students" ON public.students;
DROP POLICY IF EXISTS "Users can create own student profile" ON public.students;
DROP POLICY IF EXISTS "Users can update own student profile" ON public.students;
DROP POLICY IF EXISTS "Users can read own student profile" ON public.students;
DROP POLICY IF EXISTS "Students read own profile" ON public.students;
DROP POLICY IF EXISTS "Students create own profile" ON public.students;
DROP POLICY IF EXISTS "Students update own profile" ON public.students;
CREATE POLICY "Students read own profile"
ON public.students FOR SELECT
USING (auth.uid() = id OR auth.uid() = user_id OR public.is_platform_admin());
CREATE POLICY "Students create own profile"
ON public.students FOR INSERT
WITH CHECK (auth.uid() = id AND COALESCE(user_id, id) = auth.uid());
CREATE POLICY "Students update own profile"
ON public.students FOR UPDATE
USING (auth.uid() = id OR auth.uid() = user_id OR public.is_platform_admin())
WITH CHECK (auth.uid() = id OR auth.uid() = user_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Enable all access for demo" ON public.admins;
DROP POLICY IF EXISTS "Users can create own admin profile" ON public.admins;
DROP POLICY IF EXISTS "Users can update own admin profile" ON public.admins;
DROP POLICY IF EXISTS "Users can read own admin profile" ON public.admins;
DROP POLICY IF EXISTS "Admins read provisioned admin rows" ON public.admins;
DROP POLICY IF EXISTS "Platform admins manage admins" ON public.admins;
CREATE POLICY "Admins read provisioned admin rows"
ON public.admins FOR SELECT
USING (auth.uid() = id OR auth.uid() = user_id OR public.is_platform_admin());
CREATE POLICY "Platform admins manage admins"
ON public.admins FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Users can create own company profile" ON public.companies;
DROP POLICY IF EXISTS "Users can update own company profile" ON public.companies;
DROP POLICY IF EXISTS "Users can read own company profile" ON public.companies;
DROP POLICY IF EXISTS "Companies read own profile" ON public.companies;
DROP POLICY IF EXISTS "Companies create pending own profile" ON public.companies;
DROP POLICY IF EXISTS "Companies update own non-verification profile" ON public.companies;
CREATE POLICY "Companies read own profile"
ON public.companies FOR SELECT
USING (
  COALESCE(user_id, id) = auth.uid()
  OR public.is_platform_admin()
  OR EXISTS (SELECT 1 FROM public.company_recruiters cr WHERE cr.company_id = companies.id AND cr.user_id = auth.uid())
);
CREATE POLICY "Companies create pending own profile"
ON public.companies FOR INSERT
WITH CHECK (auth.uid() = id AND COALESCE(user_id, id) = auth.uid() AND COALESCE(is_verified, false) = false);
CREATE POLICY "Companies update own non-verification profile"
ON public.companies FOR UPDATE
USING (COALESCE(user_id, id) = auth.uid() OR public.is_platform_admin())
WITH CHECK (COALESCE(user_id, id) = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admins can manage student registry" ON public.student_registry;
DROP POLICY IF EXISTS "Admins can modify student registry" ON public.student_registry;
DROP POLICY IF EXISTS "Admins can view student registry" ON public.student_registry;
DROP POLICY IF EXISTS "Authenticated students can read own registry row" ON public.student_registry;
DROP POLICY IF EXISTS "Students can read own registry row" ON public.student_registry;
CREATE POLICY "Admins can view student registry"
ON public.student_registry FOR SELECT
USING (public.is_platform_admin());
CREATE POLICY "Admins can modify student registry"
ON public.student_registry FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());
CREATE POLICY "Students can read own registry row"
ON public.student_registry FOR SELECT
USING (auth.role() = 'authenticated' AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "Company recruiters can view their team" ON public.company_recruiters;
DROP POLICY IF EXISTS "Company owners can manage recruiters" ON public.company_recruiters;
DROP POLICY IF EXISTS "Recruiters read their company team" ON public.company_recruiters;
DROP POLICY IF EXISTS "Company owners manage recruiters" ON public.company_recruiters;
CREATE POLICY "Recruiters read their company team"
ON public.company_recruiters FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_platform_admin()
  OR company_id IN (SELECT c.id FROM public.companies c WHERE COALESCE(c.user_id, c.id) = auth.uid())
);
CREATE POLICY "Company owners manage recruiters"
ON public.company_recruiters FOR ALL
USING (public.is_platform_admin() OR company_id IN (SELECT c.id FROM public.companies c WHERE COALESCE(c.user_id, c.id) = auth.uid()))
WITH CHECK (public.is_platform_admin() OR company_id IN (SELECT c.id FROM public.companies c WHERE COALESCE(c.user_id, c.id) = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Companies can create own jobs" ON public.opportunities;
DROP POLICY IF EXISTS "Companies can manage own jobs" ON public.opportunities;
DROP POLICY IF EXISTS "Admins full management" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can view active opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Verified recruiters create jobs" ON public.opportunities;
DROP POLICY IF EXISTS "Verified recruiters manage jobs" ON public.opportunities;
CREATE POLICY "Authenticated users can view active opportunities"
ON public.opportunities FOR SELECT
USING (auth.role() = 'authenticated' AND (COALESCE(status, 'active') = 'active' OR public.can_manage_opportunity(posted_by)));
CREATE POLICY "Verified recruiters create jobs"
ON public.opportunities FOR INSERT
WITH CHECK (public.can_post_for_company(posted_by));
CREATE POLICY "Verified recruiters manage jobs"
ON public.opportunities FOR UPDATE
USING (public.can_manage_opportunity(posted_by))
WITH CHECK (public.can_manage_opportunity(posted_by));

DROP POLICY IF EXISTS "Students see own applications" ON public.applications;
DROP POLICY IF EXISTS "Students create own applications" ON public.applications;
DROP POLICY IF EXISTS "Students update own applications" ON public.applications;
DROP POLICY IF EXISTS "Companies view applicants" ON public.applications;
DROP POLICY IF EXISTS "Companies update applicants" ON public.applications;
DROP POLICY IF EXISTS "Students read own applications" ON public.applications;
DROP POLICY IF EXISTS "Students create verified applications" ON public.applications;
DROP POLICY IF EXISTS "Students submit proof for own applications" ON public.applications;
DROP POLICY IF EXISTS "Recruiters read applicants" ON public.applications;
DROP POLICY IF EXISTS "Recruiters manage applicants" ON public.applications;
CREATE POLICY "Students read own applications"
ON public.applications FOR SELECT
USING (
  auth.uid() = student_id
  OR public.is_platform_admin()
  OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = applications.opportunity_id AND public.can_manage_opportunity(o.posted_by))
);
CREATE POLICY "Students create verified applications"
ON public.applications FOR INSERT
WITH CHECK (
  auth.uid() = student_id
  AND public.student_has_verified_registry(student_id, opportunity_id)
);
CREATE POLICY "Students submit proof for own applications"
ON public.applications FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id AND status IN ('applied', 'verifying', 'pending_verification'));
CREATE POLICY "Recruiters manage applicants"
ON public.applications FOR UPDATE
USING (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = applications.opportunity_id AND public.can_manage_opportunity(o.posted_by)))
WITH CHECK (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = applications.opportunity_id AND public.can_manage_opportunity(o.posted_by)));

DROP POLICY IF EXISTS "Trusted users can insert audit logs" ON public.platform_audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.platform_audit_logs;
DROP POLICY IF EXISTS "Trusted actors insert audit logs" ON public.platform_audit_logs;
DROP POLICY IF EXISTS "Authorized users read audit logs" ON public.platform_audit_logs;
CREATE POLICY "Trusted actors insert audit logs"
ON public.platform_audit_logs FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR actor_id = auth.uid()
  OR public.is_platform_admin()
  OR EXISTS (SELECT 1 FROM public.company_recruiters cr WHERE cr.user_id = auth.uid())
);
CREATE POLICY "Authorized users read audit logs"
ON public.platform_audit_logs FOR SELECT
USING (
  public.is_platform_admin()
  OR actor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.company_recruiters cr WHERE cr.user_id = auth.uid() AND cr.company_id::text = platform_audit_logs.details ->> 'company_id')
);

DROP POLICY IF EXISTS "Enable all access for demo" ON public.student_queries;
DROP POLICY IF EXISTS "Students create own queries" ON public.student_queries;
DROP POLICY IF EXISTS "Students read own queries" ON public.student_queries;
DROP POLICY IF EXISTS "Admins manage student queries" ON public.student_queries;
CREATE POLICY "Students create own queries"
ON public.student_queries FOR INSERT
WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students read own queries"
ON public.student_queries FOR SELECT
USING (auth.uid() = student_id OR public.is_platform_admin());
CREATE POLICY "Admins manage student queries"
ON public.student_queries FOR UPDATE
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Enable all access for demo" ON public.campus_resources;
DROP POLICY IF EXISTS "Students can use campus resources" ON public.campus_resources;
DROP POLICY IF EXISTS "Students read moderated campus resources" ON public.campus_resources;
DROP POLICY IF EXISTS "Students create own campus resources" ON public.campus_resources;
DROP POLICY IF EXISTS "Students manage own campus resources" ON public.campus_resources;
CREATE POLICY "Students read moderated campus resources"
ON public.campus_resources FOR SELECT
USING (auth.role() = 'authenticated' AND (COALESCE(is_moderated, true) = true OR lister_id = auth.uid() OR public.is_platform_admin()));
CREATE POLICY "Students create own campus resources"
ON public.campus_resources FOR INSERT
WITH CHECK (auth.uid() = lister_id);
CREATE POLICY "Students manage own campus resources"
ON public.campus_resources FOR UPDATE
USING (lister_id = auth.uid() OR public.is_platform_admin())
WITH CHECK (lister_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Enable all access for demo" ON public.service_requests;
DROP POLICY IF EXISTS "Students can use service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Students manage participant service requests" ON public.service_requests;
CREATE POLICY "Students manage participant service requests"
ON public.service_requests FOR ALL
USING (auth.uid() IN (requester_id, offerer_id) OR public.is_platform_admin())
WITH CHECK (auth.uid() IN (requester_id, offerer_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Students can use service feedback" ON public.service_feedback;
DROP POLICY IF EXISTS "Students manage participant service feedback" ON public.service_feedback;
CREATE POLICY "Students manage participant service feedback"
ON public.service_feedback FOR ALL
USING (
  public.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.id = service_feedback.service_request_id
      AND auth.uid() IN (sr.requester_id, sr.offerer_id)
  )
)
WITH CHECK (
  public.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.id = service_feedback.service_request_id
      AND auth.uid() IN (sr.requester_id, sr.offerer_id)
  )
);

DROP POLICY IF EXISTS "Students can use im here requests" ON public.im_here_requests;
DROP POLICY IF EXISTS "Students manage im-here participant requests" ON public.im_here_requests;
CREATE POLICY "Students manage im-here participant requests"
ON public.im_here_requests FOR ALL
USING (auth.uid() IN (requester_id, offerer_id) OR public.is_platform_admin())
WITH CHECK (auth.uid() IN (requester_id, offerer_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Students manage own certifications" ON public.student_certifications;
CREATE POLICY "Students manage own certifications"
ON public.student_certifications FOR ALL
USING (auth.uid() = student_id OR public.is_platform_admin())
WITH CHECK (auth.uid() = student_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Students manage own achievements" ON public.student_achievements;
CREATE POLICY "Students manage own achievements"
ON public.student_achievements FOR ALL
USING (auth.uid() = student_id OR public.is_platform_admin())
WITH CHECK (auth.uid() = student_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Students can view their own recommendations" ON public.student_recommendations;
DROP POLICY IF EXISTS "Service role can manage recommendations" ON public.student_recommendations;
DROP POLICY IF EXISTS "Students read own recommendations" ON public.student_recommendations;
DROP POLICY IF EXISTS "Service role manages recommendations" ON public.student_recommendations;
CREATE POLICY "Students read own recommendations"
ON public.student_recommendations FOR SELECT
USING (auth.uid() = student_id);
CREATE POLICY "Service role manages recommendations"
ON public.student_recommendations FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
