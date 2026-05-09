-- Repair student registry RLS for deployments where admins are keyed by user_id.

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.student_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view student registry" ON public.student_registry;
CREATE POLICY "Admins can view student registry"
ON public.student_registry
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.id = auth.uid()
       OR admins.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can modify student registry" ON public.student_registry;
CREATE POLICY "Admins can modify student registry"
ON public.student_registry
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.id = auth.uid()
       OR admins.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.id = auth.uid()
       OR admins.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated students can read own registry row" ON public.student_registry;
CREATE POLICY "Authenticated students can read own registry row"
ON public.student_registry
FOR SELECT
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
