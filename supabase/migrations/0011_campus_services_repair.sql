CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.campus_resources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lister_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  college text NOT NULL,
  item_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  listing_type text NOT NULL DEFAULT 'service',
  service_rate double precision,
  service_rate_unit text,
  image_url text,
  is_moderated boolean NOT NULL DEFAULT true,
  moderation_reason text,
  availability jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id uuid NOT NULL REFERENCES public.campus_resources(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  offerer_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested',
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.service_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.im_here_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  requester_role text NOT NULL DEFAULT 'student',
  college text NOT NULL,
  item_description text NOT NULL,
  location_description text NOT NULL,
  urgency timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open',
  offerer_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  offerer_name text,
  accepted_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.campus_resources ADD COLUMN IF NOT EXISTS availability jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.campus_resources ADD COLUMN IF NOT EXISTS is_moderated boolean DEFAULT true;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());
ALTER TABLE public.im_here_requests ADD COLUMN IF NOT EXISTS urgency timestamptz DEFAULT (now() + interval '1 hour');
ALTER TABLE public.im_here_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

ALTER TABLE public.campus_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.im_here_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can use campus resources" ON public.campus_resources;
CREATE POLICY "Students can use campus resources"
ON public.campus_resources
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Students can use service requests" ON public.service_requests;
CREATE POLICY "Students can use service requests"
ON public.service_requests
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Students can use service feedback" ON public.service_feedback;
CREATE POLICY "Students can use service feedback"
ON public.service_feedback
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Students can use im here requests" ON public.im_here_requests;
CREATE POLICY "Students can use im here requests"
ON public.im_here_requests
FOR ALL
USING (true)
WITH CHECK (true);
