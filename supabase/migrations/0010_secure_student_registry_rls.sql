-- Remove unsafe student_registry policies that rely on editable auth.user_metadata.
-- Admin access is granted only through trusted rows in public.admins.

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.student_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage student registry" ON public.student_registry;
DROP POLICY IF EXISTS "Admins can modify student registry" ON public.student_registry;
DROP POLICY IF EXISTS "Admins can view student registry" ON public.student_registry;
DROP POLICY IF EXISTS "Authenticated students can read own registry row" ON public.student_registry;

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

CREATE POLICY "Students can read own registry row"
ON public.student_registry
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
