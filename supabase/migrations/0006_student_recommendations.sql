-- Create student_recommendations table for weekly AI picks
CREATE TABLE IF NOT EXISTS public.student_recommendations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    recommendations jsonb NOT NULL, -- Array of {jobId, matchScore, reasoning}
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Students can only see their own recommendations
CREATE POLICY "Students can view their own recommendations" 
ON public.student_recommendations FOR SELECT 
USING (auth.uid() = student_id);

-- Policy: Service role can manage all (for Edge Functions)
CREATE POLICY "Service role can manage recommendations"
ON public.student_recommendations FOR ALL
USING (true);
