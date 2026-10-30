import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ImagePlus } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { browserSupabase } from '../services/supabase';

const categoryOptions = [
  ['electrician', 'Electrician'], ['plumber', 'Plumber'], ['carpenter', 'Carpenter'],
  ['painter', 'Painter'], ['ac-repair', 'AC Repair Technician'], ['cleaner', 'Cleaner'],
  ['maintenance', 'General Maintenance'], ['mason', 'Other / Mason'],
];

const initialForm = { name: '', phone: '', email: '', tradeId: 'electrician', tradeTitle: 'Electrician', locality: '', skills: '', experienceYears: '0', halfDayRate: '350', dailyRate: '650', availability: true, workingHours: '09:00 AM - 07:00 PM', bio: '' };

export const WorkerRegistration = ({ ownerId, onBack, onSuccess }) => {
  const { session, profile } = useAuth();
  const [form, setForm] = useState(() => ({ ...initialForm, name: profile?.full_name || '', phone: profile?.phone || '', email: session?.user?.email || '' }));
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setErrors({}); setError(''); setIsSaving(true);
    try {
      let avatar = '';
      if (photoFile) {
        const ext = photoFile.type === 'image/jpeg' ? 'jpg' : photoFile.type.split('/')[1];
        const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await browserSupabase.storage.from('worker-avatars').upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (uploadError) throw new Error(`Profile photo upload failed: ${uploadError.message}`);
        avatar = browserSupabase.storage.from('worker-avatars').getPublicUrl(path).data.publicUrl;
      }
      const saved = await api.registerWorker({ ...form, name: profile.full_name, phone: profile.phone, email: session.user.email, avatar, ownerId, skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean), experienceYears: Number(form.experienceYears), halfDayRate: Number(form.halfDayRate), dailyRate: Number(form.dailyRate) }, session?.access_token);
      onSuccess(saved);
    } catch (saveError) {
      setError(saveError.message);
      setErrors(saveError.fieldErrors || {});
    } finally { setIsSaving(false); }
  };

  return (
    <section className="mx-auto max-w-3xl py-6 sm:py-8">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-3.5 w-3.5" /> Back to discovery</button>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle sm:p-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Become a Worker</h1>
        <p className="mt-1 text-sm text-slate-600">Complete your profile so customers can find and book your services.</p>
        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={profile?.full_name || form.name} onChange={() => {}} readOnly />
            <Field label="Mobile number" type="tel" value={profile?.phone || form.phone} onChange={() => {}} readOnly />
            <Field label="Email" type="email" value={session?.user?.email || form.email} onChange={() => {}} readOnly />
            <label className="text-xs font-semibold text-slate-700">Primary profession *<select value={form.tradeId} onChange={(event) => { const option = categoryOptions.find(([id]) => id === event.target.value); update('tradeId', event.target.value); update('tradeTitle', option?.[1] || 'Professional'); }} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal">{categoryOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>{errors.tradeId && <span className="mt-1 block text-[11px] text-rose-600">{errors.tradeId}</span>}</label>
            <Field label="Service area *" value={form.locality} error={errors.locality} onChange={(value) => update('locality', value)} />
            <Field label="Skills / services *" value={form.skills} error={errors.skills} placeholder="Wiring, fan installation, MCB repair" onChange={(value) => update('skills', value)} />
            <Field label="Years of experience" type="number" min="0" max="60" value={form.experienceYears} error={errors.experienceYears} onChange={(value) => update('experienceYears', value)} />
            <Field label="Starting half-day rate (₹)" type="number" min="0" value={form.halfDayRate} error={errors.halfDayRate} onChange={(value) => update('halfDayRate', value)} />
            <Field label="Daily rate (₹)" type="number" min="0" value={form.dailyRate} error={errors.dailyRate} onChange={(value) => update('dailyRate', value)} />
            <Field label="Working hours" value={form.workingHours} onChange={(value) => update('workingHours', value)} />
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-700 hover:border-blue-400"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><ImagePlus className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block">Profile photo</strong><span className="text-xs text-slate-500">JPG, PNG or WebP, up to 5 MB</span></span>{photoPreview && <img src={photoPreview} alt="Profile preview" className="h-12 w-12 rounded-lg object-cover" />}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPG, PNG or WebP profile photo under 5 MB.'); return; } setError(''); setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }} /></label>
          <label className="block text-xs font-semibold text-slate-700">Professional description<textarea rows={3} value={form.bio} onChange={(event) => update('bio', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Describe your experience and typical services" /></label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={form.availability} onChange={(event) => update('availability', event.target.checked)} /> Available for new customer requests</label>
          <button disabled={isSaving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? 'Saving profile…' : 'Register worker profile'}</button>
        </form>
      </div>
    </section>
  );
};

const Field = ({ label, value, onChange, error, type = 'text', ...props }) => <label className="block text-xs font-semibold text-slate-700">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} {...props} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal" />{error && <span className="mt-1 block text-[11px] text-rose-600">{error}</span>}</label>;

