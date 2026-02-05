-- Migration 0004: Create Admin forensic logs table
-- Track administrative actions for accountability

CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'opportunity', 'student_registry', 'department', etc.
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins can read all logs
CREATE POLICY "Admins can view all logs" 
ON public.admin_logs FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.id = auth.uid()
    )
);

-- Active profiles (Admins) can insert logs
CREATE POLICY "Admins can insert logs" 
ON public.admin_logs FOR INSERT 
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.id = auth.uid()
    )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
