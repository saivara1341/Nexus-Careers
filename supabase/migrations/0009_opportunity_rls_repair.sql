-- Repair opportunity RLS so companies can create jobs they own.

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS posted_by uuid;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_corporate boolean DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS type text DEFAULT 'job';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS max_backlogs integer DEFAULT 0;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS passing_year integer DEFAULT extract(year from now())::integer;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS deadline timestamptz DEFAULT (now() + interval '30 days');
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS apply_link text DEFAULT '#';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS allowed_departments text[] DEFAULT '{All}';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Companies can create own jobs" ON public.opportunities;
CREATE POLICY "Companies can create own jobs"
ON public.opportunities
FOR INSERT
WITH CHECK (auth.uid() = posted_by);

DROP POLICY IF EXISTS "Companies can manage own jobs" ON public.opportunities;
CREATE POLICY "Companies can manage own jobs"
ON public.opportunities
FOR ALL
USING (auth.uid() = posted_by)
WITH CHECK (auth.uid() = posted_by);

DROP POLICY IF EXISTS "Anyone can view opportunities" ON public.opportunities;
CREATE POLICY "Anyone can view opportunities"
ON public.opportunities
FOR SELECT
USING (true);
