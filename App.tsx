
import React, { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage.tsx';
import { createSupabaseClient } from './services/supabase.ts';
import { SupabaseProvider, useSupabase } from './contexts/SupabaseContext.tsx';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AdminProfile, StudentProfile, CompanyProfile, DeveloperProfile } from './types.ts';
import type { AdminRole, Department } from './types.ts';
import { normalizeDepartmentName, UNIVERSITY_LEVEL_ROLES } from './types.ts'; // Import normalizeDepartmentName
import toast, { Toaster } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SplashScreen from './components/layout/SplashScreen.tsx';
import { Spinner } from './components/ui/Spinner.tsx';
import { PasswordUpdateModal } from './components/auth/PasswordUpdateModal.tsx';
import { ChatProvider } from './contexts/ChatContext.tsx';
import { Card } from './components/ui/Card.tsx';
import { Button } from './components/ui/Button.tsx';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { getAuthCodeFromUrl, isNativeApp, isNativeAuthCallback } from './utils/authRedirect.ts';

const DEVELOPER_EMAIL = 'ssaivaraprasad51@gmail.com';

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.tsx'));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard.tsx'));
const CompanyDashboard = lazy(() => import('./pages/company/CompanyDashboard.tsx'));
const DeveloperDashboard = lazy(() => import('./pages/developer/DeveloperDashboard.tsx'));
const ChatBot = lazy(() => import('./components/ai/ChatBot.tsx'));

const GOOGLE_PROFILE_INTENT_KEY = 'nexus_google_profile_intent';
const AVAILABLE_COLLEGES = ['Anurag University', 'CVR College of Engineering', 'VNR VJIET', 'GRIET'];
const UNIVERSITY_ADMIN_DEPT = 'University Administration';
const COMMON_DEPARTMENTS = [
  'AI & Machine Learning', 'Artificial Intelligence', 'B. Pharmacy', 'Bachelor of Arts',
  'Bachelor of Business Administration', 'Civil Engineering', 'Computer Science',
  'Computer Science and Engineering', 'Data Science', 'Electrical and Electronics Engineering',
  'Electronics and Communication Engineering', 'Information Technology',
  'Master of Business Administration', 'Master of Computer Applications', 'Mechanical Engineering',
].sort();
const departmentScopedRoles: AdminRole[] = ['Dean', 'HOD', 'Faculty', 'Placement Officer'];

const readGoogleProfileIntent = () => {
  try {
    const rawIntent = window.sessionStorage.getItem(GOOGLE_PROFILE_INTENT_KEY);
    return rawIntent ? JSON.parse(rawIntent) as Record<string, any> : {};
  } catch {
    window.sessionStorage.removeItem(GOOGLE_PROFILE_INTENT_KEY);
    return {};
  }
};

const upsertWithSchemaRetry = async (supabase: SupabaseClient, table: string, payload: Record<string, any>, options: { onConflict: string }) => {
  const { error } = await supabase.from(table).upsert(payload, options);
  if (!error) return;

  const missingColumn = error.message?.match(/Could not find the '([^']+)' column/)?.[1];
  if (missingColumn) {
    throw new Error(`Database schema mismatch: ${table}.${missingColumn} is missing. Apply the latest Supabase migrations before syncing this profile.`);
  }

  throw error;
};

const fetchDepartments = async (supabase: SupabaseClient, college: string): Promise<Department[]> => {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, college_name')
    .eq('college_name', college)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

const uploadVerificationFile = async (supabase: SupabaseClient, userId: string, file: File, category: 'admin' | 'company') => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `verification/${category}/${userId}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage.from('student-credentials').upload(filePath, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('student-credentials').getPublicUrl(filePath);
  return data.publicUrl;
};

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

    const metadataRole = session.user.user_metadata?.role;
    const profileFromKnownRole = async () => {
      if (metadataRole === 'student') {
        const { data } = await supabase.from('students').select('*').eq('id', session.user.id).maybeSingle();
        return data ? { ...data, role: 'student' as const } : null;
      }

      if (metadataRole === 'company') {
        const { data } = await supabase.from('companies').select('*').eq('id', session.user.id).maybeSingle();
        return data ? { ...data, role: 'company' as const } : null;
      }

      if (metadataRole) {
        const { data: adminData } = await supabase.from('admins').select('*').eq('id', session.user.id).maybeSingle();
        if (adminData) {
          return {
            ...adminData,
            name: adminData.name || adminData.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Admin',
            email: adminData.email || session.user.email || '',
            college: adminData.college || session.user.user_metadata?.college || 'Anurag University',
            role: adminData.role || adminData.admin_role || 'admin'
          };
        }
      }

      return null;
    };

    const knownProfile = await profileFromKnownRole();
    if (knownProfile) return { session, profile: knownProfile };

    const [adminResult, studentResult, companyResult] = await Promise.all([
      supabase.from('admins').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('students').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('companies').select('*').eq('id', session.user.id).maybeSingle(),
    ]);

    // 1. Check Admin
    const adminData = adminResult.data;
    if (adminData) return {
      session,
      profile: {
        ...adminData,
        name: adminData.name || adminData.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Admin',
        email: adminData.email || session.user.email || '',
        college: adminData.college || session.user.user_metadata?.college || 'Anurag University',
        role: adminData.role || adminData.admin_role || 'admin'
      }
    };

    // 2. Check Student
    const studentData = studentResult.data;
    if (studentData) return { session, profile: { ...studentData, role: 'student' } };

    // 3. Check Company
    const companyData = companyResult.data;
    if (companyData) return { session, profile: { ...companyData, role: 'company' } };

    return { session, profile: null };
  } catch (e) {
    console.error("Profile Fetch Error:", e);
    return { session: null, profile: null };
  }
};

interface GoogleProfileCompletionProps {
  session: Session;
  onComplete: () => void;
  onLogout: () => Promise<void>;
}

const GoogleProfileCompletion: React.FC<GoogleProfileCompletionProps> = ({ session, onComplete, onLogout }) => {
  const supabase = useSupabase();
  const [userType, setUserType] = useState<'student' | 'admin' | 'company'>('student');
  const [fullName, setFullName] = useState(session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || '');
  const [college, setCollege] = useState(AVAILABLE_COLLEGES[0]);
  const [department, setDepartment] = useState(UNIVERSITY_ADMIN_DEPT);
  const [adminRole, setAdminRole] = useState<AdminRole>('Faculty');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companyRole, setCompanyRole] = useState<'Founder' | 'Hiring Manager' | 'Recruiter' | 'HR Admin'>('Founder');
  const [employeeId, setEmployeeId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: dbDepartments = [] } = useQuery<Department[]>({
    queryKey: ['departments', college, 'google-completion'],
    queryFn: () => fetchDepartments(supabase, college),
    enabled: userType === 'admin' && !!college,
  });

  const availableDepartments = useMemo(() => [
    UNIVERSITY_ADMIN_DEPT,
    ...(dbDepartments.length > 0 ? dbDepartments.map(d => d.name).sort() : COMMON_DEPARTMENTS)
  ], [dbDepartments]);

  useEffect(() => {
    if (userType !== 'admin') return;
    const isUnivScope = department === UNIVERSITY_ADMIN_DEPT;
    if (isUnivScope && !UNIVERSITY_LEVEL_ROLES.includes(adminRole)) setAdminRole(UNIVERSITY_LEVEL_ROLES[0]);
    else if (!isUnivScope && !departmentScopedRoles.includes(adminRole)) setAdminRole(departmentScopedRoles[0]);
  }, [adminRole, department, userType]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!fullName.trim()) throw new Error('Full name is required.');

      let verificationFileUrl: string | null = null;
      if ((userType === 'admin' || userType === 'company') && proofFile) {
        verificationFileUrl = await uploadVerificationFile(supabase, session.user.id, proofFile, userType);
      }

      const intent: Record<string, any> = {
        auth_provider: 'google',
        full_name: fullName.trim(),
        role: userType,
        college,
        is_verified: userType === 'student'
      };

      if (userType === 'student') {
        intent.roll_number = session.user.email?.split('@')[0];
      }

      if (userType === 'admin') {
        intent.account_type = 'admin';
        intent.role = adminRole;
        intent.department = department === UNIVERSITY_ADMIN_DEPT ? null : department;
        intent.verification_file_url = verificationFileUrl;
      }

      if (userType === 'company') {
        if (!companyName.trim()) throw new Error('Corporate identity is required.');
        if (!industry.trim()) throw new Error('Industry sector is required.');
        if (companyRole !== 'Founder' && !employeeId.trim()) throw new Error('Employee ID is required.');
        if (companyRole === 'Founder' && !proofFile) throw new Error('Proof of incorporation is required.');

        intent.role = 'company';
        intent.company_name = companyName.trim();
        intent.industry = industry.trim();
        intent.company_role = companyRole;
        intent.employee_id = employeeId.trim();
        intent.verification_file_url = verificationFileUrl;
        intent.is_verified = false;
      }

      window.sessionStorage.setItem(GOOGLE_PROFILE_INTENT_KEY, JSON.stringify(intent));
      await supabase.auth.updateUser({ data: { ...session.user.user_metadata, ...intent } });
      onComplete();
    } catch (error: any) {
      setError(error?.message || 'Unable to complete Google profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md !p-8" glow="primary">
        <h1 className="font-display text-3xl text-primary text-center mb-2 uppercase tracking-tighter">Complete Profile</h1>
        <p className="text-xs text-text-muted text-center mb-6 break-all">{session.user.email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex bg-input-bg p-1 rounded-md border border-primary/30 gap-1">
            {(['student', 'admin', 'company'] as const).map((type) => (
              <button key={type} type="button" onClick={() => setUserType(type)} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${userType === type ? 'bg-primary text-black' : 'text-text-muted hover:text-text-base'}`}>
                {type === 'company' ? 'Corp' : type}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Full Name</span>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary" />
          </label>

          {(userType === 'student' || userType === 'admin') && (
            <label className="block">
              <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Institution</span>
              <select value={college} onChange={e => setCollege(e.target.value)} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary">
                {AVAILABLE_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

          {userType === 'admin' && (
            <>
              <label className="block">
                <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Departmental Scope</span>
                <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary">
                  {availableDepartments.map(deptName => <option key={deptName} value={deptName}>{deptName}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Official Role</span>
                <select value={adminRole} onChange={e => setAdminRole(e.target.value as AdminRole)} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary">
                  {department === UNIVERSITY_ADMIN_DEPT ? UNIVERSITY_LEVEL_ROLES.map(role => <option key={role} value={role}>{role}</option>) : departmentScopedRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label className="block bg-black/40 p-4 rounded-lg border border-primary/30">
                <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Verification Proof</span>
                <input type="file" accept="image/*,.pdf" onChange={e => setProofFile(e.target.files?.[0] || null)} className="w-full text-xs text-text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:bg-primary/20 file:text-primary file:font-bold" />
              </label>
            </>
          )}

          {userType === 'company' && (
            <>
              <label className="block">
                <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Corporate Identity</span>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} required className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Industry Sector</span>
                <input value={industry} onChange={e => setIndustry(e.target.value)} required className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Your Role</span>
                <select value={companyRole} onChange={e => setCompanyRole(e.target.value as any)} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="Founder">Founder</option>
                  <option value="Hiring Manager">Hiring Manager</option>
                  <option value="Recruiter">Recruiter</option>
                  <option value="HR Admin">HR Admin</option>
                </select>
              </label>
              {companyRole !== 'Founder' && (
                <label className="block">
                  <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Employee ID</span>
                  <input value={employeeId} onChange={e => setEmployeeId(e.target.value)} required className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                </label>
              )}
              <label className="block bg-black/40 p-4 rounded-lg border border-primary/30">
                <span className="block text-primary font-display text-sm font-bold uppercase mb-2">{companyRole === 'Founder' ? 'Proof of Incorporation' : 'Employee ID Proof'}</span>
                <input type="file" accept="image/*,.pdf" required={companyRole === 'Founder'} onChange={e => setProofFile(e.target.files?.[0] || null)} className="w-full text-xs text-text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:bg-primary/20 file:text-primary file:font-bold" />
              </label>
            </>
          )}

          <Button type="submit" className="w-full text-lg" disabled={loading}>
            {loading ? <Spinner className="w-5 h-5" /> : 'Continue'}
          </Button>
          {error && <p className="text-red-400 text-center text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
        </form>
        <button onClick={onLogout} className="mt-6 w-full text-xs text-text-muted hover:text-white uppercase tracking-widest font-bold">Use another account</button>
      </Card>
    </div>
  );
};

const AppContent: React.FC = () => {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [isAssistantReady, setIsAssistantReady] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [profileCompletionTick, setProfileCompletionTick] = useState(0);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setShowPasswordResetModal(true);
      if (event === 'SIGNED_IN' && session?.user) {
        const profileIntent = readGoogleProfileIntent();
        if (Object.keys(profileIntent).length > 0) {
          supabase.auth.updateUser({ data: { ...session.user.user_metadata, ...profileIntent } }).catch((error) => {
            console.error('Google profile metadata sync failed:', error);
          });
        }
      }
      if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(['userProfile'], { session: null, profile: null });
        setSyncError(null);
        window.sessionStorage.removeItem(GOOGLE_PROFILE_INTENT_KEY);
      } else if (event !== 'INITIAL_SESSION') {
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, supabase]);

  useEffect(() => {
    if (!isNativeApp()) return;

    let isMounted = true;
    let removeListener: (() => Promise<void>) | undefined;

    const handleNativeAuthUrl = async (url: string) => {
      if (!isNativeAuthCallback(url)) return;

      try {
        const code = getAuthCodeFromUrl(url);
        if (!code) throw new Error('Google sign-in callback did not include an authorization code.');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        await Browser.close();
      } catch (error: any) {
        console.error('Native Google sign-in callback failed:', error);
        toast.error(error?.message || 'Google sign-in callback failed.');
      }
    };

    CapacitorApp.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) handleNativeAuthUrl(launchUrl.url);
    }).catch((error) => {
      console.error('Unable to inspect native launch URL:', error);
    });

    CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      handleNativeAuthUrl(url);
    }).then((handle) => {
      if (!isMounted) {
        handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    }).catch((error) => {
      console.error('Unable to register native auth callback:', error);
    });

    return () => {
      isMounted = false;
      removeListener?.().catch((error) => {
        console.error('Unable to remove native auth callback listener:', error);
      });
    };
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsAssistantReady(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

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
          const profileIntent = readGoogleProfileIntent();
          const role = profileIntent.account_type || profileIntent.role || metadata.account_type || metadata.role;
          if (!role) return;

          const name = profileIntent.full_name || metadata.full_name || metadata.name || user.email?.split('@')[0] || 'User';

          if (role === 'student') {
            const college = profileIntent.college || metadata.college || 'Anurag University';
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
            await upsertWithSchemaRetry(supabase, 'students', {
              id: user.id,
              user_id: user.id,
              name,
              email: user.email!, // Always use the authenticated user's email for the active profile
              college,
              // Normalize department name to prevent case-sensitive mismatches
              department: normalizeDepartmentName(registryData?.department || profileIntent.department || metadata.department || 'General') || 'General',
              roll_number: registryData?.roll_number || profileIntent.roll_number || metadata.roll_number || user.email?.split('@')[0] || 'STU-' + Math.random().toString(36).substring(7).toUpperCase(),
              ug_cgpa: registryData?.ug_cgpa || 0,
              cgpa: registryData?.cgpa || registryData?.ug_cgpa || 0,
              backlogs: registryData?.backlogs || 0,
              passing_year: registryData?.passing_year || registryData?.ug_passout_year || new Date().getFullYear() + 1,
              verification_status: registryData ? 'verified' : 'pending_registry',
              level: 1,
              xp: 0,
              xp_to_next_level: 100
            }, { onConflict: 'id' }); // Conflict on 'id' is standard for primary key
          } else if (role === 'company') {
            await upsertWithSchemaRetry(supabase, 'companies', {
              id: user.id, user_id: user.id, name, email: user.email!,
              company_name: profileIntent.company_name || metadata.company_name || name,
              industry: profileIntent.industry || metadata.industry || 'Technology',
              verification_file_url: profileIntent.verification_file_url || metadata.verification_file_url || null,
              is_verified: false
            }, { onConflict: 'id' });
          } else {
            throw new Error('Admin and staff accounts must be provisioned by an existing verified administrator before first login.');
          }
          window.sessionStorage.removeItem(GOOGLE_PROFILE_INTENT_KEY);
          await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
          toast.success("Identity synchronization complete.");
        } catch (error: any) {
          // Fix: Extracting the actual error message instead of letting it default to [object Object]
          const errorMessage = error?.message || error?.details || "Database connection timed out.";
          console.error("Auto-creation failed:", errorMessage, error);
          const publicMessage = /schema|column|relation|policy|permission|RLS|row-level/i.test(errorMessage)
            ? 'Identity synchronization is blocked by a server configuration issue. Please contact the platform administrator.'
            : errorMessage;
          setSyncError(publicMessage);
        } finally {
          setIsCreatingProfile(false);
        }
      }
    };
    autoCreateProfile();
  }, [session, userProfile, isProfileLoading, isCreatingProfile, queryClient, supabase, syncError, profileCompletionTick]);

  const handleLogout = async () => {
    setSyncError(null);
    await supabase.auth.signOut();
  };

  const handleRetrySync = () => {
    setSyncError(null);
    queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

  const handleProfileCompletion = () => {
    setSyncError(null);
    setProfileCompletionTick(value => value + 1);
    queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

  if (!session && !isProfileLoading) return <AuthPage />;

  if (session && !userProfile && !isProfileLoading && !isCreatingProfile && !syncError) {
    const metadata = session.user.user_metadata || {};
    const profileIntent = readGoogleProfileIntent();
    const hasRoleIntent = !!(profileIntent.account_type || profileIntent.role || metadata.account_type || metadata.role);

    if (!hasRoleIntent) {
      return <GoogleProfileCompletion session={session} onComplete={handleProfileCompletion} onLogout={handleLogout} />;
    }
  }

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
            <span className="text-xs opacity-60">Status:</span>
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
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner /></div>}>
          {userProfile.role === 'developer' && <DeveloperDashboard onLogout={handleLogout} user={userProfile as DeveloperProfile} />}
          {userProfile.role === 'student' && <StudentDashboard onLogout={handleLogout} user={userProfile as StudentProfile} />}
          {userProfile.role === 'company' && <CompanyDashboard onLogout={handleLogout} user={userProfile as CompanyProfile} />}
          {userProfile.role !== 'student' && userProfile.role !== 'company' && userProfile.role !== 'developer' && <AdminDashboard onLogout={handleLogout} user={userProfile as AdminProfile} />}
        </Suspense>
        {isAssistantReady && (
          <Suspense fallback={null}>
            <ChatBot session={session} userRole={userProfile.role} />
          </Suspense>
        )}
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
      const env = import.meta.env;
      const supabaseUrl = env.VITE_SUPABASE_URL || (window as any).NEXT_PUBLIC_SUPABASE_URL;
      const supabasePublishableKey =
        env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        env.VITE_SUPABASE_ANON_KEY ||
        (window as any).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        (window as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabasePublishableKey) throw new Error("Nexus Infrastructure values missing.");
      setSupabaseClient(createSupabaseClient(supabaseUrl, supabasePublishableKey));
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
