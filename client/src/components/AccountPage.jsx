import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, KeyRound, LoaderCircle, Mail, UserRound } from 'lucide-react';
import { api } from '../services/api';
import { browserSupabase, supabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const AccountPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, loading, refreshProfile, signOut } = useAuth();
  const params = new URLSearchParams(location.search);
  const requestedMode = params.get('mode');
  const [mode, setMode] = useState(requestedMode === 'signup' ? 'signup' : requestedMode === 'recovery' ? 'recovery' : 'signin');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(params.get('role') === 'worker' ? 'worker' : 'customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!session || profile) return;
    setFullName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '');
    setPhone(session.user.user_metadata?.phone || '');
    setRole(session.user.user_metadata?.role === 'worker' ? 'worker' : 'customer');
  }, [session?.user?.id, profile]);

  useEffect(() => {
    if (requestedMode === 'signup') setMode('signup');
    if (requestedMode === 'recovery') setMode('recovery');
    const requestedRole = params.get('role');
    if (requestedRole === 'customer' || requestedRole === 'worker') setRole(requestedRole);
  }, [location.search]);

  const redirectAfterAuth = (account) => {
    const requested = params.get('next');
    const destination = requested?.startsWith('/') ? requested : account?.role === 'worker'
      ? account.worker_profile_complete ? '/worker-dashboard' : '/register-worker'
      : '/bookings';
    navigate(destination, { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (!browserSupabase) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env to enable secure accounts.');
      if (mode === 'recovery') {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const { error: updateError } = await browserSupabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setNotice('Your password has been updated. You can continue to KaamConnect.');
        setMode('signin'); setPassword('');
        return;
      }
      if (mode === 'forgot') {
        const { error: resetError } = await browserSupabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/account?mode=recovery` });
        if (resetError) throw resetError;
        setNotice('If an account uses that email, Supabase will send a password reset link.');
        return;
      }
      if (mode === 'signup') {
        if (fullName.trim().length < 2) throw new Error('Enter your name.');
        const normalizedPhone = phone.replace(/\D/g, '');
        if (!/^[6-9]\d{9}$/.test(normalizedPhone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
        const { data, error: authError } = await browserSupabase.auth.signUp({
          email: email.trim().toLowerCase(), password,
          options: { data: { full_name: fullName.trim(), phone: normalizedPhone, role } },
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice('Check your email to confirm your account, then sign in. Your selected account type will be saved.');
          return;
        }
        const account = await api.saveAccountProfile(data.session.access_token, { fullName: fullName.trim(), phone: normalizedPhone, role });
        await refreshProfile().catch(() => {});
        redirectAfterAuth(account);
        return;
      }
      const { data, error: authError } = await browserSupabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (authError) throw authError;
      let account;
      try { account = await api.getAccountProfile(data.session.access_token); }
      catch (profileError) {
        if (profileError.status !== 404) throw profileError;
        account = await api.saveAccountProfile(data.session.access_token, {
          fullName: data.user.user_metadata?.full_name || email.split('@')[0],
          phone: data.user.user_metadata?.phone || '',
          role: data.user.user_metadata?.role === 'worker' ? 'worker' : 'customer',
        });
      }
      redirectAfterAuth(account);
    } catch (formError) { setError(formError.message || 'Unable to continue. Check your details and try again.'); }
    finally { setBusy(false); }
  };

  const completeMissingProfile = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (!session?.access_token) throw new Error('Your session expired. Please sign in again.');
      if (fullName.trim().length < 2) throw new Error('Enter your name.');
      const normalizedPhone = phone.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(normalizedPhone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
      const account = await api.saveAccountProfile(session.access_token, { fullName: fullName.trim(), phone: normalizedPhone, role });
      await refreshProfile();
      redirectAfterAuth(account);
    } catch (profileError) { setError(profileError.message || 'Unable to save your account profile.'); }
    finally { setBusy(false); }
  };

  if (mode === 'recovery' && session) return <AuthCard title="Choose a new password" subtitle="Use at least 8 characters for your KaamConnect account." onBack={() => navigate('/')}>
    <form onSubmit={submit} className="space-y-4"><PasswordField value={password} onChange={setPassword} autoComplete="new-password" label="New password" />{error && <Feedback error>{error}</Feedback>}{notice && <Feedback>{notice}</Feedback>}<SubmitButton busy={busy}>Update password</SubmitButton></form>
  </AuthCard>;

  if (session && profile) return <section className="mx-auto max-w-2xl py-8 sm:py-12">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-subtle sm:p-8">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><UserRound className="h-5 w-5" /></span><div><h1 className="text-xl font-extrabold text-slate-900">Your KaamConnect account</h1><p className="text-sm text-slate-600">Signed in as {profile.full_name} · {profile.role}</p></div></div>
      <dl className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Email</dt><dd className="break-all font-semibold text-slate-800">{session.user.email}</dd></div><div><dt className="text-xs text-slate-500">Phone</dt><dd className="font-semibold text-slate-800">{profile.phone || 'Add a phone number'}</dd></div><div><dt className="text-xs text-slate-500">Account type</dt><dd className="font-semibold capitalize text-slate-800">{profile.role}</dd></div>{profile.role === 'worker' && <div><dt className="text-xs text-slate-500">Worker profile</dt><dd className="font-semibold text-slate-800">{profile.worker_profile_complete ? 'Complete' : 'Needs setup'}</dd></div>}</dl>
      <div className="mt-5 flex flex-wrap gap-2">{profile.role === 'customer' && <button type="button" onClick={() => navigate('/bookings')} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">View booking history</button>}{profile.role === 'worker' && <button type="button" onClick={() => navigate(profile.worker_profile_complete ? '/worker-dashboard' : '/register-worker')} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Briefcase className="h-4 w-4" />{profile.worker_profile_complete ? 'Worker dashboard' : 'Complete worker profile'}</button>}<button type="button" onClick={async () => { try { await signOut(); navigate('/', { replace: true }); } catch (err) { setError(err.message); } }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Sign out</button></div>
      {error && <Feedback error>{error}</Feedback>}
    </div>
  </section>;

  if (loading) return <section className="mx-auto max-w-lg py-12"><div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Restoring your secure session…</div></section>;
  if (session && !profile) return <AuthCard title="Complete your KaamConnect account" subtitle="Your Supabase login is active. Add the profile details KaamConnect needs to continue." onBack={() => navigate('/')}>
    <form onSubmit={completeMissingProfile} className="space-y-4">
      <TextField label="Full name" value={fullName} onChange={setFullName} icon={<UserRound />} autoComplete="name" required />
      <TextField label="Mobile number" value={phone} onChange={setPhone} type="tel" autoComplete="tel" placeholder="10-digit mobile number" required />
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><RoleOption active={role === 'customer'} onClick={() => setRole('customer')}>Customer</RoleOption><RoleOption active={role === 'worker'} onClick={() => setRole('worker')}>Worker</RoleOption></div>
      {error && <Feedback error>{error}</Feedback>}
      <SubmitButton busy={busy}>{busy ? 'Saving profile…' : 'Continue'}</SubmitButton>
    </form>
  </AuthCard>;
  const title = mode === 'signup' ? role === 'worker' ? 'Join as a worker' : 'Join as a customer' : mode === 'forgot' ? 'Reset your password' : 'Sign in to KaamConnect';
  return <AuthCard title={title} subtitle={mode === 'signup' ? 'Create a secure KaamConnect account to get started.' : mode === 'forgot' ? 'We will email you a secure password reset link.' : 'Your account keeps bookings and conversations connected to your work.'} onBack={() => navigate('/')}>
    {!supabaseConfigured && <Feedback warning>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env to enable secure sign-in.</Feedback>}
    {mode === 'signup' && <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><RoleOption active={role === 'customer'} onClick={() => setRole('customer')}>Customer</RoleOption><RoleOption active={role === 'worker'} onClick={() => setRole('worker')}>Worker</RoleOption></div>}
    <form onSubmit={submit} className="space-y-4">
      {mode === 'signup' && <><TextField label="Full name" value={fullName} onChange={setFullName} icon={<UserRound />} autoComplete="name" required /><TextField label="Mobile number" value={phone} onChange={setPhone} type="tel" autoComplete="tel" placeholder="10-digit mobile number" required /></>}
      <TextField label="Email address" value={email} onChange={setEmail} icon={<Mail />} type="email" autoComplete="email" required />
      {mode !== 'forgot' && <PasswordField value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} label={mode === 'recovery' ? 'New password' : 'Password'} />}
      {mode === 'signin' && <div className="text-right"><button type="button" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }} className="text-xs font-bold text-blue-700 hover:underline">Forgot password?</button></div>}
      {error && <Feedback error>{error}</Feedback>}{notice && <Feedback>{notice}</Feedback>}
      <SubmitButton busy={busy}>{busy ? 'Please wait…' : mode === 'signup' ? `Create ${role} account` : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</SubmitButton>
    </form>
    <p className="mt-5 text-center text-sm text-slate-600">{mode === 'signup' ? 'Already registered?' : mode === 'signin' ? 'New to KaamConnect?' : 'Remember your password?'} <button type="button" onClick={() => { setMode(mode === 'signup' || mode === 'forgot' ? 'signin' : 'signup'); setError(''); setNotice(''); }} className="font-bold text-blue-700">{mode === 'signup' || mode === 'forgot' ? 'Sign in' : 'Join KaamConnect'}</button></p>
  </AuthCard>;
};

function AuthCard({ title, subtitle, onBack, children }) {
  return <section className="mx-auto max-w-lg py-8 sm:py-12"><button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to KaamConnect</button><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-subtle sm:p-8"><div className="mb-5"><h1 className="text-2xl font-extrabold text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-600">{subtitle}</p></div>{children}</div></section>;
}
function TextField({ label, value, onChange, icon, ...props }) { return <label className="grid gap-1 text-xs font-semibold text-slate-700">{label}<span className="relative">{icon && React.cloneElement(icon, { className: 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' })}<input value={value} onChange={(event) => onChange(event.target.value)} {...props} className={`w-full rounded-xl border border-slate-200 py-2.5 pr-3 text-sm font-normal outline-none focus:border-blue-500 ${icon ? 'pl-9' : 'px-3'}`} /></span></label>; }
function PasswordField({ value, onChange, autoComplete, label = 'Password' }) { return <label className="grid gap-1 text-xs font-semibold text-slate-700">{label}<span className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required minLength={8} type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-normal outline-none focus:border-blue-500" /></span><span className="font-normal text-slate-500">Use at least 8 characters.</span></label>; }
function SubmitButton({ busy, disabled, children }) { return <button disabled={busy || disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{children}</button>; }
function RoleOption({ active, onClick, children }) { return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-2 text-sm font-bold ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>{children}</button>; }
function Feedback({ children, error = false, warning = false }) { return <p role={error ? 'alert' : 'status'} className={`mb-4 rounded-xl p-3 text-sm ${error ? 'bg-rose-50 text-rose-800' : warning ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>{children}</p>; }
