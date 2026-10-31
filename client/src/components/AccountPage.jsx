import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Eye, EyeOff, KeyRound, LoaderCircle, Mail, UserRound } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const categories = [
  ['electrician', 'Electrician'], ['plumber', 'Plumber'], ['carpenter', 'Carpenter'],
  ['painter', 'Painter'], ['ac-repair', 'AC repair'], ['cleaner', 'Cleaner'],
  ['maintenance', 'General maintenance'], ['mason', 'Mason'],
];
const redirectReasons = {
  booking: 'Create an account to book this worker and keep your appointment details in one place.',
  post_job: 'Sign in as a customer to post a job and receive worker offers.',
  quotation: 'Create a worker account to send a quotation for this job.',
  messaging: 'Sign in to keep your private conversations and contact details secure.',
  review: 'Sign in as a customer to review a completed booking.',
  dashboard: 'Sign in to open your personal KaamConnect dashboard.',
};

export const AccountPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, loading, profileError, refreshProfile, signOut, authenticate } = useAuth();
  const params = new URLSearchParams(location.search);
  const requestedMode = params.get('mode');
  const requestedRole = params.get('role');
  const [mode, setMode] = useState(['signup', 'forgot'].includes(requestedMode) ? requestedMode : 'signin');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(requestedRole === 'worker' ? 'worker' : 'customer');
  const [tradeId, setTradeId] = useState('electrician');
  const [locality, setLocality] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (['signup', 'forgot'].includes(requestedMode)) setMode(requestedMode);
    else if (!requestedMode) setMode('signin');
    if (requestedRole === 'customer' || requestedRole === 'worker') setRole(requestedRole);
  }, [location.search]);

  useEffect(() => {
    if (!session || profile) return;
    setFullName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '');
    setPhone(session.user.user_metadata?.phone || '');
    setRole(session.user.user_metadata?.role === 'worker' ? 'worker' : 'customer');
    setTradeId(session.user.user_metadata?.trade_id || 'electrician');
    setLocality(session.user.user_metadata?.locality || '');
    setEmail(session.user.email || '');
  }, [session?.user?.id, profile]);

  useEffect(() => {
    if (!resendCooldown) return undefined;
    const timer = window.setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const safeNext = () => {
    const next = params.get('next');
    return next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : null;
  };
  const redirectAfterAuth = (account) => {
    const requested = safeNext();
    const destination = requested || (account?.role === 'worker'
      ? account.worker_profile_complete ? '/worker-dashboard' : '/register-worker'
      : '/bookings');
    navigate(destination, { replace: true });
  };
  const emailRedirectUrl = () => {
    const url = new URL('/account', window.location.origin);
    url.searchParams.set('mode', 'verify');
    const next = safeNext();
    if (next) url.searchParams.set('next', next);
    if (params.get('reason')) url.searchParams.set('reason', params.get('reason'));
    return url.toString();
  };

  useEffect(() => {
    if (mode === 'verify' && session && profile) redirectAfterAuth(profile);
  }, [mode, session?.user?.id, profile?.id]);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'forgot' || mode === 'recovery' || mode === 'verify') { setNotice('Password reset email is not available in local SQLite mode. Contact the administrator to reset an account password.'); return; }
      if (mode === 'signup') {
        if(fullName.trim().length<2)throw new Error('Enter your full name.');
        if(password.length<8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))throw new Error('Use at least 8 characters, including a letter and a number.');
        if(password!==confirmPassword)throw new Error('Your passwords do not match.');
        if(role==='worker'&&!locality.trim())throw new Error('Enter your service location.');
        const data=await api.register({fullName:fullName.trim(),email:email.trim().toLowerCase(),phone:phone.replace(/\D/g,''),password,role,...(role==='worker'?{profession:tradeId,locality:locality.trim()}: {})});
        await authenticate(data);redirectAfterAuth(data.profile);return;
      }
      const data=await api.login({email:email.trim().toLowerCase(),password});
      await authenticate(data);redirectAfterAuth(data.profile);
    } catch(formError){setError(formError.message||'Unable to continue. Check your details and try again.');}
    finally{setBusy(false);}
  };
  const completeMissingProfile = async (event) => { event.preventDefault(); setError('Your local account is active. Return to sign in if it is not loading.'); };
  const resendVerification = async () => setNotice('Email verification is not required for local SQLite accounts.');  const switchMode = (nextMode) => {
    setMode(nextMode); setError(''); setNotice(''); setPassword(''); setConfirmPassword('');
  };
  const reason = redirectReasons[params.get('reason')];

  if (false && mode === 'recovery' && session) return <AuthCard title="Choose a new password" subtitle="Use at least 8 characters for your KaamConnect account." onBack={() => navigate('/')}>
    <form onSubmit={submit} className="space-y-4"><PasswordField value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" label="New password" /><PasswordField value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} autoComplete="new-password" label="Confirm new password" />{error && <Feedback error>{error}</Feedback>}{notice && <Feedback>{notice}</Feedback>}<SubmitButton busy={busy}>{busy ? 'Updating…' : 'Update password'}</SubmitButton></form>
  </AuthCard>;

  if (session && profile) return <section className="mx-auto max-w-2xl py-8 sm:py-12">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-subtle sm:p-8">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><UserRound className="h-5 w-5" /></span><div><h1 className="text-xl font-extrabold text-slate-900">Your KaamConnect account</h1><p className="text-sm text-slate-600">Signed in as {profile.full_name} · {profile.role}</p></div></div>
      <dl className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Email</dt><dd className="break-all font-semibold text-slate-800">{session.user.email}</dd></div><div><dt className="text-xs text-slate-500">Phone</dt><dd className="font-semibold text-slate-800">{profile.phone || 'Add a phone number'}</dd></div><div><dt className="text-xs text-slate-500">Account type</dt><dd className="font-semibold capitalize text-slate-800">{profile.role}</dd></div>{profile.role === 'worker' && <div><dt className="text-xs text-slate-500">Worker profile</dt><dd className="font-semibold text-slate-800">{profile.worker_profile_complete ? 'Complete' : 'Needs setup'}</dd></div>}</dl>
      <div className="mt-5 flex flex-wrap gap-2">{profile.role === 'customer' && <button type="button" onClick={() => navigate('/bookings')} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">View booking history</button>}{profile.role === 'worker' && <button type="button" onClick={() => navigate(profile.worker_profile_complete ? '/worker-dashboard' : '/register-worker')} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Briefcase className="h-4 w-4" />{profile.worker_profile_complete ? 'Worker dashboard' : 'Complete worker profile'}</button>}<button type="button" onClick={async () => { try { await signOut(); navigate('/', { replace: true }); } catch (err) { setError(err.message); }}} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Sign out</button></div>
      {error && <Feedback error>{error}</Feedback>}
    </div>
  </section>;

  if (loading) return <section className="mx-auto max-w-lg py-12"><div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status">Restoring your secure session…</div></section>;
  if (session && profileError) return <AuthCard title="Could not load your account" subtitle={profileError} onBack={() => navigate('/')}>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => refreshProfile().catch((loadError) => setError(loadError.message))} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Try again</button><button type="button" onClick={async () => { await signOut(); navigate('/', { replace: true }); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Sign out</button></div>{error && <Feedback error>{error}</Feedback>}
  </AuthCard>;

  const title = mode === 'signup' ? role === 'worker' ? 'Join as a worker' : 'Join as a customer'
    : mode === 'forgot' ? 'Reset your password' : mode === 'verify' ? 'Verify your email' : 'Sign in to KaamConnect';
  const subtitle = mode === 'signup' ? 'Create a secure KaamConnect account to get started.'
    : mode === 'forgot' ? 'We will email you a secure password reset link.'
      : mode === 'verify' ? 'Confirm your email address to activate your KaamConnect account.'
        : 'Your account keeps bookings and conversations connected to your work.';

  return <AuthCard title={title} subtitle={subtitle} onBack={() => navigate('/')}>
    {}
    {reason && mode !== 'verify' && <Feedback>{reason}</Feedback>}
    {mode === 'verify' ? <div className="space-y-4">
      <TextField label="Email address" value={email} onChange={setEmail} icon={<Mail />} type="email" autoComplete="email" required />
      {error && <Feedback error>{error}</Feedback>}{notice && <Feedback>{notice}</Feedback>}
      <button type="button" disabled={busy || resendCooldown > 0} onClick={resendVerification} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{resendCooldown ? `Resend email in ${resendCooldown}s` : 'Resend verification email'}</button>
      <p className="text-center text-sm text-slate-600">Already verified? <button type="button" onClick={() => switchMode('signin')} className="font-bold text-blue-700">Sign in</button></p>
    </div> : <>
      {mode === 'signup' && <RolePicker role={role} setRole={setRole} />}
      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && <><TextField label="Full name" value={fullName} onChange={setFullName} icon={<UserRound />} autoComplete="name" required /><TextField label="Mobile number" value={phone} onChange={setPhone} type="tel" autoComplete="tel" placeholder="10-digit mobile number" required />{role === 'worker' && <WorkerSignupFields tradeId={tradeId} setTradeId={setTradeId} locality={locality} setLocality={setLocality} />}</>}
        <TextField label="Email address" value={email} onChange={setEmail} icon={<Mail />} type="email" autoComplete="email" required />
        {mode !== 'forgot' && <PasswordField value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} label="Password" />}
        {mode === 'signup' && <PasswordField value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} autoComplete="new-password" label="Confirm password" />}
        {mode === 'signin' && <div className="text-right"><button type="button" onClick={() => switchMode('forgot')} className="text-xs font-bold text-blue-700 hover:underline">Forgot password?</button></div>}
        {error && <Feedback error>{error}</Feedback>}{notice && <Feedback>{notice}</Feedback>}
        <SubmitButton busy={busy}>{busy ? 'Please wait…' : mode === 'signup' ? `Create ${role} account` : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">{mode === 'signup' ? 'Already registered?' : mode === 'signin' ? 'New to KaamConnect?' : 'Remember your password?'} <button type="button" onClick={() => switchMode(mode === 'signup' || mode === 'forgot' ? 'signin' : 'signup')} className="font-bold text-blue-700">{mode === 'signup' || mode === 'forgot' ? 'Sign in' : 'Join KaamConnect'}</button></p>
    </>}
  </AuthCard>;
};

function AuthCard({ title, subtitle, onBack, children }) {
  return <section className="mx-auto max-w-lg py-8 sm:py-12"><button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to KaamConnect</button><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-subtle sm:p-8"><div className="mb-5"><h1 className="text-2xl font-extrabold text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-600">{subtitle}</p></div>{children}</div></section>;
}
function TextField({ label, value, onChange, icon, ...props }) { return <label className="grid gap-1 text-xs font-semibold text-slate-700">{label}<span className="relative">{icon && React.cloneElement(icon, { className: 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' })}<input value={value} onChange={(event) => onChange(event.target.value)} {...props} className={`w-full rounded-xl border border-slate-200 py-2.5 pr-3 text-sm font-normal outline-none focus:border-blue-500 ${icon ? 'pl-9' : 'px-3'}`} /></span></label>; }
function PasswordField({ value, onChange, visible, onToggle, autoComplete, label = 'Password' }) { return <label className="grid gap-1 text-xs font-semibold text-slate-700">{label}<span className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required minLength={8} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-11 text-sm font-normal outline-none focus:border-blue-500" /><button type="button" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>{label.toLowerCase().includes('password') && <span className="font-normal text-slate-500">Use at least 8 characters.</span>}</label>; }
function SubmitButton({ busy, children }) { return <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{children}</button>; }
function RolePicker({ role, setRole }) { return <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><RoleOption active={role === 'customer'} onClick={() => setRole('customer')}>Customer</RoleOption><RoleOption active={role === 'worker'} onClick={() => setRole('worker')}>Worker</RoleOption></div>; }
function WorkerSignupFields({ tradeId, setTradeId, locality, setLocality }) { return <><label className="grid gap-1 text-xs font-semibold text-slate-700">Profession / service category<select value={tradeId} onChange={(event) => setTradeId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal">{categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><TextField label="Service location" value={locality} onChange={setLocality} icon={<Briefcase />} autoComplete="address-level2" required placeholder="Town, ward or locality" /></>; }
function RoleOption({ active, onClick, children }) { return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-2 text-sm font-bold ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>{children}</button>; }
function Feedback({ children, error = false, warning = false }) { return <p role={error ? 'alert' : 'status'} className={`mb-4 rounded-xl p-3 text-sm ${error ? 'bg-rose-50 text-rose-800' : warning ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>{children}</p>; }
