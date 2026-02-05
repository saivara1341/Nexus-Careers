
import React, { useState, useEffect } from 'react';
import AdminDashboard from './pages/admin/AdminDashboard.tsx';
import StudentDashboard from './pages/student/StudentDashboard.tsx';
import CompanyDashboard from './pages/company/CompanyDashboard.tsx';
import DeveloperDashboard from './pages/developer/DeveloperDashboard.tsx';
import AuthPage from './pages/AuthPage.tsx';
import { createSupabaseClient } from './services/supabase.ts';
import { SupabaseProvider, useSupabase } from './contexts/SupabaseContext.tsx';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AdminProfile, StudentProfile, CompanyProfile, DeveloperProfile } from './types.ts';
import { normalizeDepartmentName } from './types.ts'; // Import normalizeDepartmentName
import ChatBot from './components/ai/ChatBot.tsx';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SplashScreen from './components/layout/SplashScreen.tsx';
import { Spinner } from './components/ui/Spinner.tsx';
import { PasswordUpdateModal } from './components/auth/PasswordUpdateModal.tsx';
import { ChatProvider } from './contexts/ChatContext.tsx';
import { Card } from './components/ui/Card.tsx';
import { Button } from './components/ui/Button.tsx';

const DEVELOPER_EMAIL = 'ssaivaraprasad51@gmail.com';

const fetchUserProfile = async (supabase: SupabaseClient): Promise<{ session: Session | null; profile: AdminProfile | StudentProfile | CompanyProfile | DeveloperProfile | null }> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return { session: null, profile: null };
    }

    // 0. Check Developer
    if (session.user.email === DEVELOPER_EMAIL) {
      const devProfile: DeveloperProfile = {
        id: session.user.id,
        name: 'Lead Developer',
        email: session.user.email,
        created_at: new Date().toISOString(),
        role: 'developer'
      };
      return { session, profile: devProfile };
    }

    // 1. Check Admin
    let { data: adminData } = await supabase.from('admins').select('*').eq('id', session.user.id).single();
    if (adminData) return { session, profile: { ...adminData, role: adminData.role || 'admin' } };

    // 2. Check Student
    let { data: studentData } = await supabase.from('students').select('*').eq('id', session.user.id).single();
    if (studentData) return { session, profile: { ...studentData, role: 'student' } };

    // 3. Check Company
    let { data: companyData } = await supabase.from('companies').select('*').eq('id', session.user.id).single();
    if (companyData) return { session, profile: { ...companyData, role: 'company' } };

    return { session, profile: null };
  } catch (e) {
    console.error("Profile Fetch Error:", e);
    return { session: null, profile: null };
  }
};

const AppContent: React.FC = () => {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setShowPasswordResetModal(true);
      if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(['userProfile'], { session: null, profile: null });
        setSyncError(null);
      } else {
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      }
    });

    const timer = setTimeout(() => setIsAppLoading(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [queryClient, supabase]);

  const { data, isLoading: isProfileLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => fetchUserProfile(supabase),
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  const session = data?.session;
  const userProfile = data?.profile;

  useEffect(() => {
    const autoCreateProfile = async () => {
      // Logic: If we have a session but NO profile in the database, 
      // we need to perform the initial "Sync" to create the DB record.
      if (session && !userProfile && !isProfileLoading && !isCreatingProfile && !syncError) {
        if (session.user.email === DEVELOPER_EMAIL) return;

        setIsCreatingProfile(true);
        try {
          const { user } = session;
          const metadata = user.user_metadata || {};
          const role = metadata.role || 'student';
          const name = metadata.full_name || user.email?.split('@')[0] || 'User';

          if (role === 'student') {
            const college = metadata.college || 'Anurag University';
            // Fetch student registry data using the authenticated user's email
            const { data: registryData, error: registryError } = await supabase.from('student_registry').select('*').ilike('email', user.email).single();

            if (registryError && registryError.code !== 'PGRST116') { // PGRST116 means "No rows found"
              throw registryError;
            }

            // IMPORTANT FIX: If registryData's email is different, update it to match auth.users.email
            if (registryData && registryData.email !== user.email!) {
              await supabase.from('student_registry').update({ email: user.email! }).eq('id', registryData.id);
            }

            // Use UPSERT to prevent "Duplicate Key" errors if sync is triggered twice
            const { error: insError } = await supabase.from('students').upsert({
              id: user.id,
              name,
              email: user.email!, // Always use the authenticated user's email for the active profile
              college,
              // Normalize department name to prevent case-sensitive mismatches
              department: normalizeDepartmentName(registryData?.department || metadata.department || 'General') || 'General',
              roll_number: registryData?.roll_number || metadata.roll_number || 'STU-' + Math.random().toString(36).substring(7).toUpperCase(),
              ug_cgpa: registryData?.ug_cgpa || 0,
              backlogs: registryData?.backlogs || 0,
              level: 1,
              xp: 0,
              xp_to_next_level: 100
            }, { onConflict: 'id' }); // Conflict on 'id' is standard for primary key

            if (insError) throw insError;
          } else if (role === 'company') {
            const { error: insError } = await supabase.from('companies').upsert({
              id: user.id, name, email: user.email!,
              company_name: metadata.company_name || name,
              industry: metadata.industry || 'Technology',
              is_verified: metadata.is_verified || false
            }, { onConflict: 'id' });

            if (insError) throw insError;
          } else { // Admin
            const { error: insError } = await supabase.from('admins').upsert({
              id: user.id, name, email: user.email!,
              college: metadata.college || 'Anurag University',
              role: role, department: metadata.department || null,
              is_verified: metadata.is_verified || false,
              employee_id: metadata.employee_id || null
            }, { onConflict: 'id' });

            if (insError) throw insError;
          }
          await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
          toast.success("Identity synchronization complete.");
        } catch (error: any) {
          // Fix: Extracting the actual error message instead of letting it default to [object Object]
          const errorMessage = error?.message || error?.details || "Database connection timed out.";
          console.error("Auto-creation failed:", errorMessage, error);
          setSyncError(errorMessage);
        } finally {
          setIsCreatingProfile(false);
        }
      }
    };
    autoCreateProfile();
  }, [session, userProfile, isProfileLoading, isCreatingProfile, queryClient, supabase, syncError]);

  const handleLogout = async () => {
    setSyncError(null);
    await supabase.auth.signOut();
  };

  const handleRetrySync = () => {
    setSyncError(null);
    queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

  if (isAppLoading) return <SplashScreen />;

  if (!session && !isProfileLoading) return <AuthPage />;

  if (session && !userProfile && (isProfileLoading || isCreatingProfile)) {
    return <SplashScreen />;
  }

  if (session && !userProfile && syncError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-center">
        <Card glow="none" className="max-w-md p-8 border-red-500/50 shadow-2xl bg-red-500/5">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-red-500 text-4xl">sync_problem</span>
          </div>
          <h1 className="text-2xl text-red-400 mb-4 font-display font-bold uppercase tracking-tighter">Synchronization Blocked</h1>
          <p className="text-text-muted text-sm mb-8 leading-relaxed">
            Nexus failed to link your security token with our database records.
            <br /><br />
            <span className="text-xs opacity-60">System Message:</span>
            <br />
            <code className="text-[10px] text-red-300 bg-red-900/20 p-2 block mt-1 rounded break-all whitespace-pre-wrap">{syncError}</code>
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={handleRetrySync} variant="primary" className="w-full text-lg">Force Re-Sync</Button>
            <Button onClick={handleLogout} variant="ghost" className="w-full !border-white/10 !text-text-muted text-lg">Return to Security Hub</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (userProfile && 'is_verified' in userProfile && userProfile.is_verified === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4 bg-background">
        <Card glow="secondary" className="max-w-md p-8">
          <h1 className="text-3xl font-display text-secondary mb-4">Verification Pending</h1>
          <p className="text-text-muted mb-6">Your registration is received. Nexus Command is reviewing your credentials. Access will be granted shortly.</p>
          <Button onClick={handleLogout} variant="ghost" className="text-lg">Logout</Button>
        </Card>
      </div>
    );
  }

  if (!userProfile?.role) {
    if (isProfileLoading) return <SplashScreen />;
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background text-text-base relative">
      <Toaster position="top-center" toastOptions={{ className: 'bg-card-bg text-text-base border border-primary/50' }} />
      <ChatProvider>
        {userProfile.role === 'developer' && <DeveloperDashboard onLogout={handleLogout} user={userProfile as DeveloperProfile} />}
        {userProfile.role === 'student' && <StudentDashboard onLogout={handleLogout} user={userProfile as StudentProfile} />}
        {userProfile.role === 'company' && <CompanyDashboard onLogout={handleLogout} user={userProfile as CompanyProfile} />}
        {userProfile.role !== 'student' && userProfile.role !== 'company' && userProfile.role !== 'developer' && <AdminDashboard onLogout={handleLogout} user={userProfile as AdminProfile} />}
        <ChatBot session={session} />
      </ChatProvider>
      {showPasswordResetModal && <PasswordUpdateModal onClose={() => setShowPasswordResetModal(false)} />}
    </div>
  );
};

const App: React.FC = () => {
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const supabaseUrl = (window as any).NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = (window as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Nexus Infrastructure values missing.");
      setSupabaseClient(createSupabaseClient(supabaseUrl, supabaseAnonKey));
    } catch (error: any) {
      setSupabaseError(error.message);
    }
  }, []);

  if (supabaseError) return <div className="min-h-screen flex flex-col items-center justify-center bg-background text-red-400 p-8 text-center"><h1 className="text-4xl mb-4 font-display">Nexus Core Error</h1><p>{supabaseError}</p></div>;
  if (!supabaseClient) return <div className="min-h-screen items-center justify-center bg-background flex"><Spinner /></div>;

  return (
    <SupabaseProvider supabaseClient={supabaseClient}>
      <AppContent />
    </SupabaseProvider>
  );
};

export default App;
