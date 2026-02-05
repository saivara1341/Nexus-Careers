-- Nexus Careers RLS Policies (Synchronized & Perfected)
-- This file implements the policies shown in the dashboard and completes missing ones.

-- 1. ADMISSIONS / PROFILES
CREATE POLICY "Enable all access for demo" ON public.students FOR ALL USING (true);
CREATE POLICY "Admins can list all students" ON public.students FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()));

CREATE POLICY "Enable all access for demo" ON public.admins FOR ALL USING (true);

-- 2. OPPORTUNITIES
CREATE POLICY "Anyone can view opportunities" ON public.opportunities FOR SELECT USING (true);
CREATE POLICY "Companies can manage own jobs" ON public.opportunities 
  FOR ALL USING (auth.uid() = posted_by);
CREATE POLICY "Admins full management" ON public.opportunities 
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()));

-- 3. APPLICATIONS
CREATE POLICY "Students see own applications" ON public.applications FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Companies view applicants" ON public.applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.opportunities WHERE opportunities.id = applications.opportunity_id AND opportunities.posted_by = auth.uid())
);
CREATE POLICY "Companies update applicants" ON public.applications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.opportunities WHERE opportunities.id = applications.opportunity_id AND opportunities.posted_by = auth.uid())
);

-- 4. IDEA CAFE (Queries/Submissions)
CREATE POLICY "Users can manage own ideas" ON public.idea_submissions FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Enable all access for demo" ON public.student_queries FOR ALL USING (true);

-- 5. CAMPUS RESOURCES & SERVICES
CREATE POLICY "Enable all access for demo" ON public.campus_resources FOR ALL USING (true);
CREATE POLICY "Enable all access for demo" ON public.service_requests FOR ALL USING (true);

-- 6. STUDENT REGISTRY
CREATE POLICY "Admins can view student registry" ON public.student_registry FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()));
CREATE POLICY "Admins can modify student registry" ON public.student_registry FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()));

-- 7. SYSTEM / MISC
CREATE POLICY "Admins full access" ON public.platform_issues FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()));
CREATE POLICY "Enable insert for authenticated users" ON public.platform_issues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can view own tickets" ON public.platform_issues FOR SELECT USING (auth.uid() = reporter_id);
