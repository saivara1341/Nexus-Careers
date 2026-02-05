
-- Enable Row Level Security for tables flagged by Supabase lint.
-- RLS policies only take effect when RLS is enabled on the table.

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.im_here_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;

-- Note: Ensure you have corresponding RLS policies defined for each table
-- to properly restrict data access as intended by your application logic.
-- If no policies exist, enabling RLS will default to denying all access.
