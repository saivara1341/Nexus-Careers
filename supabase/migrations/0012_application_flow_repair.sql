CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  status text DEFAULT 'applied',
  rejection_reason text,
  current_stage text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS opportunity_id uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'applied';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS current_stage text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc'::text, now());
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_student_id_fkey'
      AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_opportunity_id_fkey'
      AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_opportunity_id_fkey
      FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS applications_student_opportunity_unique
ON public.applications(student_id, opportunity_id);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students see own applications" ON public.applications;
CREATE POLICY "Students see own applications"
ON public.applications
FOR SELECT
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students create own applications" ON public.applications;
CREATE POLICY "Students create own applications"
ON public.applications
FOR INSERT
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students update own applications" ON public.applications;
CREATE POLICY "Students update own applications"
ON public.applications
FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Companies view applicants" ON public.applications;
CREATE POLICY "Companies view applicants"
ON public.applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.opportunities
    WHERE opportunities.id = applications.opportunity_id
      AND opportunities.posted_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Companies update applicants" ON public.applications;
CREATE POLICY "Companies update applicants"
ON public.applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.opportunities
    WHERE opportunities.id = applications.opportunity_id
      AND opportunities.posted_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.opportunities
    WHERE opportunities.id = applications.opportunity_id
      AND opportunities.posted_by = auth.uid()
  )
);
