
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Input } from '../components/ui/Input.tsx';
import { useSupabase } from '../contexts/SupabaseContext.tsx';
import type { AdminRole, Department } from '../types.ts';
import { GENDERS, UNIVERSITY_LEVEL_ROLES, normalizeDepartmentName } from '../types.ts'; // Import normalizeDepartmentName
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '../components/ui/Spinner.tsx';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme.tsx';
import { Browser } from '@capacitor/browser';
import { getAuthRedirectUrl, isNativeApp } from '../utils/authRedirect.ts';

const fetchDepartments = async (supabase, college: string): Promise<Department[]> => {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, college_name')
    .eq('college_name', college)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const COMMON_DEPARTMENTS = [
  'AI & Machine Learning', 'Artificial Intelligence', 'B. Pharmacy', 'Bachelor of Arts',
  'Bachelor of Business Administration', 'Civil Engineering', 'Computer Science',
  'Computer Science and Engineering', 'Data Science', 'Electrical and Electronics Engineering',
  'Electronics and Communication Engineering', 'Information Technology',
  'Master of Business Administration', 'Master of Computer Applications', 'Mechanical Engineering',
].sort();

const departmentScopedRoles: AdminRole[] = ['Dean', 'HOD', 'Faculty', 'Placement Officer'];
const AVAILABLE_COLLEGES = ['Anurag University', 'CVR College of Engineering', 'VNR VJIET', 'GRIET'];
const UNIVERSITY_ADMIN_DEPT = "University Administration";

const PUBLIC_EMAIL_PROVIDERS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'live.com'];

const AuthPage: React.FC = () => {
  const supabase = useSupabase();
  const { theme, toggleTheme } = useTheme();
  const isLightMode = theme === 'professional';
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [userType, setUserType] = useState<'student' | 'admin' | 'company'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState(AVAILABLE_COLLEGES[0]);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');

  // New states for company role and employee ID
  const [companyRole, setCompanyRole] = useState<'Founder' | 'Hiring Manager' | 'Recruiter' | 'HR Admin'>('Founder');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeIdProofFile, setEmployeeIdProofFile] = useState<File | null>(null);

  const [idFile, setIdFile] = useState<File | null>(null); // For founder incorporation proof

  const { data: dbDepartments = [] } = useQuery<Department[]>({
    queryKey: ['departments', college],
    queryFn: () => fetchDepartments(supabase, college),
    enabled: !!college && userType === 'admin',
  });

  const availableDepartments = useMemo(() => [
    UNIVERSITY_ADMIN_DEPT,
    ...(dbDepartments.length > 0 ? dbDepartments.map(d => d.name).sort() : COMMON_DEPARTMENTS)
  ], [dbDepartments]);

  const [department, setDepartment] = useState(UNIVERSITY_ADMIN_DEPT);
  const [adminRole, setAdminRole] = useState<AdminRole>('Faculty');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const uploadVerificationFile = async (userId: string, file: File, category: 'admin' | 'company') => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `verification/${category}/${userId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('student-credentials').upload(filePath, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('student-credentials').getPublicUrl(filePath);
    return data.publicUrl;
  };

  useEffect(() => {
    if (userType !== 'admin') return;
    const isUnivScope = department === UNIVERSITY_ADMIN_DEPT;
    if (isUnivScope && !UNIVERSITY_LEVEL_ROLES.includes(adminRole)) setAdminRole(UNIVERSITY_LEVEL_ROLES[0]);
    else if (!isUnivScope && !departmentScopedRoles.includes(adminRole)) setAdminRole(departmentScopedRoles[0]);
  }, [department, userType]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      let isVerified = false;

      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage("Identity recovery protocol initiated. Check your inbox.");
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (password !== confirmPassword) throw new Error("Credential mismatch: Passwords do not match.");
        const options: any = { data: { full_name: fullName } };

        if (userType === 'admin') {
          options.data.college = college;
          options.data.role = adminRole;
          options.data.department = department === UNIVERSITY_ADMIN_DEPT ? null : department;
          isVerified = false;
        } else if (userType === 'company') {
          const domain = email.split('@')[1];
          if (domain && PUBLIC_EMAIL_PROVIDERS.includes(domain.toLowerCase())) throw new Error("Corporate security: Use your official work email.");

          // Proof validation based on company role
          if (companyRole === 'Founder' && !idFile) {
            throw new Error("Identity verification: Proof of Incorporation document required.");
          } else if (companyRole !== 'Founder' && !employeeId.trim()) {
            throw new Error("Identity verification: Employee ID required.");
          }

          options.data = { role: 'company', company_name: companyName, industry, company_role: companyRole, employee_id: employeeId };
          isVerified = false;
        } else { // Student
          const rollNumber = email.split('@')[0];
          options.data = {
            role: 'student',
            college,
            roll_number: rollNumber
          };
          isVerified = true;
        }

        options.data.is_verified = isVerified;
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password, options });
        if (signUpError) throw signUpError;

        const proofFile = userType === 'company'
          ? (companyRole === 'Founder' ? idFile : employeeIdProofFile)
          : userType === 'admin'
            ? idFile
            : null;

        if (proofFile && signUpData.user) {
          const verificationFileUrl = await uploadVerificationFile(signUpData.user.id, proofFile, userType === 'company' ? 'company' : 'admin');
          const profileTable = userType === 'company' ? 'companies' : 'admins';
          await supabase.auth.updateUser({ data: { verification_file_url: verificationFileUrl } });
          const { error: profileUpdateError } = await supabase
            .from(profileTable)
            .update({ verification_file_url: verificationFileUrl })
            .eq('id', signUpData.user.id);
          if (profileUpdateError && profileUpdateError.code !== 'PGRST116') throw profileUpdateError;
        }

        if (isVerified) {
          setMessage("Access Cleared. Booting Nexus Interface...");
        } else {
          setMessage("Registry Update: Awaiting manual clearance from administration.");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getGoogleMetadata = () => {
    if (isLogin || isForgotPassword) return { auth_provider: 'google' };

    const baseData: Record<string, any> = {
      auth_provider: 'google',
      full_name: fullName,
      role: userType,
      college,
      is_verified: userType === 'student'
    };

    if (userType === 'student') {
      baseData.roll_number = email ? email.split('@')[0] : undefined;
    }

    if (userType === 'admin') {
      baseData.role = adminRole;
      baseData.account_type = 'admin';
      baseData.department = department === UNIVERSITY_ADMIN_DEPT ? null : department;
    }

    if (userType === 'company') {
      baseData.role = 'company';
      baseData.company_name = companyName || fullName;
      baseData.industry = industry || 'Technology';
      baseData.company_role = companyRole;
      baseData.employee_id = employeeId;
      baseData.is_verified = false;
    }

    return baseData;
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!isLogin && !isForgotPassword && userType === 'company') {
        const hasFounderProof = companyRole === 'Founder' && !!idFile;
        const hasEmployeeInfo = companyRole !== 'Founder' && !!employeeId.trim();
        if (!companyName.trim()) throw new Error('Corporate Identity is required before Google registration.');
        if (!industry.trim()) throw new Error('Industry Sector is required before Google registration.');
        if (!hasFounderProof && !hasEmployeeInfo) {
          throw new Error(companyRole === 'Founder'
            ? 'Proof of Incorporation is required before Google registration.'
            : 'Employee ID is required before Google registration.');
        }
      }

      if (!isLogin && !isForgotPassword && userType === 'admin' && !fullName.trim()) {
        throw new Error('Full Name is required before Google registration.');
      }

      const metadata = getGoogleMetadata();
      window.sessionStorage.setItem('nexus_google_profile_intent', JSON.stringify(metadata));

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl(),
          skipBrowserRedirect: isNativeApp(),
          scopes: 'openid email profile',
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });

      if (error) throw error;

      if (isNativeApp()) {
        if (!data.url) throw new Error('Google sign-in URL was not returned by Supabase.');
        await Browser.open({ url: data.url, windowName: '_self' });
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
      window.sessionStorage.removeItem('nexus_google_profile_intent');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-20 h-11 px-3 rounded-lg border border-primary/30 bg-card-bg/90 backdrop-blur-xl text-primary hover:bg-primary/10 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
        aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        <span className="material-symbols-outlined text-xl">{isLightMode ? 'dark_mode' : 'light_mode'}</span>
        <span className="hidden sm:inline">{isLightMode ? 'Dark' : 'Light'}</span>
      </button>
      <div className="text-center mb-8 w-full max-w-4xl px-4">
        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl mb-2 font-black leading-none whitespace-nowrap uppercase tracking-tighter animated-gradient-text">
          NEXUS CAREERS
        </h1>
        <p className="font-display text-xs md:text-sm text-text-muted max-w-lg mx-auto uppercase tracking-[0.3em] font-bold opacity-70">Careers Portal</p>
      </div>

      <Card className="w-full max-w-md !p-8" glow="primary">
        <h2 className="font-display text-3xl text-center text-primary mb-6 flex items-center justify-center gap-3">
          <span className="material-symbols-outlined text-4xl">{isForgotPassword ? 'lock_reset' : isLogin ? 'fingerprint' : 'shield_person'}</span>
          {isForgotPassword ? 'Recover ID' : isLogin ? 'Access' : 'Register'}
        </h2>
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && !isForgotPassword && (
            <>
              <div className="flex bg-input-bg p-1 rounded-md mb-6 border border-primary/30 gap-1">
                {['student', 'admin', 'company'].map((type) => (
                  <button key={type} type="button" onClick={() => setUserType(type as any)} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${userType === type ? 'bg-primary text-black' : 'text-text-muted hover:text-text-base'}`}>{type === 'company' ? 'Corp' : type}</button>
                ))}
              </div>
              <Input label="Full Name" placeholder="Official Record Name" required value={fullName} onChange={e => setFullName(e.target.value)} />
              {userType === 'admin' && (
                <>
                  <Input label="Email ID" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                  <div>
                    <label className="block text-primary font-display text-sm font-bold uppercase mb-2">Institution</label>
                    <select value={college} onChange={(e) => setCollege(e.target.value)} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary" required>
                      {AVAILABLE_COLLEGES.map(c => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-primary font-display text-sm font-bold uppercase mb-2">Departmental Scope</label>
                    <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary">
                      {availableDepartments.map(deptName => <option key={deptName} value={deptName}>{deptName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-primary font-display text-sm font-bold uppercase mb-2">Official Role</label>
                    <select value={adminRole} onChange={(e) => setAdminRole(e.target.value as AdminRole)} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary">
                      {department === UNIVERSITY_ADMIN_DEPT ? UNIVERSITY_LEVEL_ROLES.map(role => <option key={role} value={role}>{role}</option>) : departmentScopedRoles.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </div>
                </>
              )}
              {userType === 'company' && (
                <>
                  <Input label="Email ID" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                  <Input label="Corporate Identity" placeholder="Legal Entity Name" required value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  <Input label="Industry Sector" placeholder="e.g. Technology" required value={industry} onChange={e => setIndustry(e.target.value)} />

                  {/* New: Company Role Selection */}
                  <div>
                    <label className="block text-primary font-display text-sm font-bold uppercase mb-2">Your Role</label>
                    <select value={companyRole} onChange={(e) => setCompanyRole(e.target.value as any)} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="Founder">Founder</option>
                      <option value="Hiring Manager">Hiring Manager</option>
                      <option value="Recruiter">Recruiter</option>
                      <option value="HR Admin">HR Admin</option>
                    </select>
                  </div>

                  {/* Conditional Proof based on Role */}
                  {companyRole === 'Founder' ? (
                    <div className="bg-black/40 p-4 rounded-lg border border-primary/30 mt-4 group">
                      <label className="block text-primary font-display text-sm font-bold uppercase mb-2">Proof of Incorporation</label>
                      <input type="file" accept="image/*,.pdf" required onChange={e => setIdFile(e.target.files?.[0] || null)} className="w-full text-xs text-text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:bg-primary/20 file:text-primary file:font-bold" />
                    </div>
                  ) : (
                    <div className="space-y-4 mt-4">
                      <Input label="Employee ID" placeholder="Your Official Employee ID" required value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
                      <div className="bg-black/40 p-4 rounded-lg border border-primary/30 group">
                        <label className="block text-primary font-display text-sm font-bold uppercase mb-2">Employee ID Proof (Optional)</label>
                        <input type="file" accept="image/*,.pdf" onChange={e => setEmployeeIdProofFile(e.target.files?.[0] || null)} className="w-full text-xs text-text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:bg-primary/20 file:text-primary file:font-bold" />
                      </div>
                    </div>
                  )}
                </>
              )}
              {userType === 'student' && (
                <Input label="Email ID" type="email" placeholder="rollnumber@anurag.edu.in" required value={email} onChange={e => setEmail(e.target.value)} />
              )}
            </>
          )}

          {(isLogin || isForgotPassword) && <Input label="Email ID" type="email" required value={email} onChange={e => setEmail(e.target.value)} />}

          {!isForgotPassword && (
            <Input
              label="Password"
              type={passwordVisible ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              endAdornment={<button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="text-text-muted flex items-center"><span className="material-symbols-outlined">{passwordVisible ? 'visibility_off' : 'visibility'}</span></button>}
            />
          )}
          {!isLogin && !isForgotPassword && password && (
            <Input
              label="Verify Password"
              type={confirmPasswordVisible ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              endAdornment={<button type="button" onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)} className="text-text-muted flex items-center"><span className="material-symbols-outlined">{confirmPasswordVisible ? 'visibility_off' : 'visibility'}</span></button>}
            />
          )}

          <Button type="submit" className="w-full mt-6 text-lg" variant="primary" disabled={loading}>
            {loading ? <Spinner className="w-5 h-5" /> : isForgotPassword ? 'Transmit Signal' : 'Submit'}
          </Button>
          {!isForgotPassword && (
            <>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-primary/20" />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-muted">or</span>
                <div className="h-px flex-1 bg-primary/20" />
              </div>
              <Button
                type="button"
                className="w-full text-base !bg-white !text-neutral-900 hover:!bg-neutral-100 border border-neutral-200 gap-3"
                variant="ghost"
                disabled={loading || googleLoading}
                onClick={handleGoogleSignIn}
              >
                {googleLoading ? (
                  <Spinner className="w-5 h-5" />
                ) : (
                  <>
                    <span className="text-lg font-bold leading-none text-[#4285F4]">G</span>
                    <span>Continue with Google</span>
                  </>
                )}
              </Button>
              {!isLogin && userType === 'admin' && (
                <p className="text-[10px] text-text-muted text-center leading-relaxed">
                  Google admin access still requires administrator provisioning after sign-in.
                </p>
              )}
            </>
          )}
          {error && <p className="text-red-400 text-center text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
          {message && <p className="text-green-400 text-center text-xs bg-green-500/10 p-2 rounded border border-green-500/20">{message}</p>}
        </form>
        <div className="mt-8 flex flex-col items-center gap-4">
          <button onClick={() => setIsForgotPassword(!isForgotPassword)} className="text-xs text-text-muted hover:text-white uppercase tracking-widest font-bold">{isForgotPassword ? 'Abort Recovery' : 'Forgot Password?'}</button>
          <p className="text-sm text-text-muted">
            {isLogin ? "Need entry?" : "Already cleared?"}
            <button onClick={() => setIsLogin(!isLogin)} className="font-bold text-secondary ml-2 hover:underline uppercase tracking-tighter">{isLogin ? 'Register' : 'Login'}</button>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AuthPage;
