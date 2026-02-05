
-- This migration ensures that when a user is deleted from `auth.users`,
-- all their associated data in public tables is also automatically deleted,
-- preventing foreign key constraint errors.

-- Step 1: Cascade from `auth.users` to primary profile tables.
-- This is the main fix for the user deletion error.

-- For Admins
ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_id_fkey;
ALTER TABLE public.admins
ADD CONSTRAINT admins_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- For Students
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_id_fkey;
ALTER TABLE public.students
ADD CONSTRAINT students_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- For Companies
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_id_fkey;
ALTER TABLE public.companies
ADD CONSTRAINT companies_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;


-- Step 2: Cascade from profile tables to their dependent data.
-- This prevents future errors if a student/admin record is deleted directly.

-- Data related to students
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_student_id_fkey;
ALTER TABLE public.applications
ADD CONSTRAINT applications_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.students(id)
ON DELETE CASCADE;

ALTER TABLE public.idea_submissions DROP CONSTRAINT IF EXISTS idea_submissions_student_id_fkey;
ALTER TABLE public.idea_submissions
ADD CONSTRAINT idea_submissions_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.students(id)
ON DELETE CASCADE;

ALTER TABLE public.student_queries DROP CONSTRAINT IF EXISTS student_queries_student_id_fkey;
ALTER TABLE public.student_queries
ADD CONSTRAINT student_queries_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.students(id)
ON DELETE CASCADE;

ALTER TABLE public.student_certifications DROP CONSTRAINT IF EXISTS student_certifications_student_id_fkey;
ALTER TABLE public.student_certifications
ADD CONSTRAINT student_certifications_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.students(id)
ON DELETE CASCADE;

ALTER TABLE public.student_achievements DROP CONSTRAINT IF EXISTS student_achievements_student_id_fkey;
ALTER TABLE public.student_achievements
ADD CONSTRAINT student_achievements_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.students(id)
ON DELETE CASCADE;

-- Data related to any user (student, admin, etc.)
-- Assuming 'lister_id' and 'requester_id' reference the student's public profile ID.
ALTER TABLE public.campus_resources DROP CONSTRAINT IF EXISTS campus_resources_lister_id_fkey;
ALTER TABLE public.campus_resources
ADD CONSTRAINT campus_resources_lister_id_fkey
FOREIGN KEY (lister_id)
REFERENCES public.students(id)
ON DELETE CASCADE;

ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_requester_id_fkey;
ALTER TABLE public.service_requests
ADD CONSTRAINT service_requests_requester_id_fkey
FOREIGN KEY (requester_id)
REFERENCES public.students(id)
ON DELETE CASCADE;

-- Note: We assume platform_issues reporter_id, opportunity posted_by etc.
-- reference the auth.users ID directly for simplicity. If they reference
-- public profile tables, similar cascades should be added.
ALTER TABLE public.platform_issues DROP CONSTRAINT IF EXISTS platform_issues_reporter_id_fkey;
ALTER TABLE public.platform_issues
ADD CONSTRAINT platform_issues_reporter_id_fkey
FOREIGN KEY (reporter_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
