import React, { useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, LoaderCircle } from 'lucide-react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

export const AddJob = ({ services = [], locations = [], customerId, onBack, onPosted, workers = [] }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', serviceId: services[0]?.id || '', taskId: '', description: '', locality: locations[0]?.name || 'Kalyani', urgency: 'normal', preferredDate: '', preferredTime: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [posted, setPosted] = useState(null);
  const service = services.find((item) => item.id === form.serviceId);
  const nearby = workers.filter((worker) => worker.tradeId === form.serviceId && worker.isAvailable).slice(0, 5);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      const result = await api.createJob({ ...form, customerId });
      setPosted(result);
      onPosted?.(result);
    } catch (submitError) { setError(submitError.message || 'Unable to post your job. Please try again.'); }
    finally { setSaving(false); }
  };

  return <section className="mx-auto max-w-3xl py-7">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to discovery</button>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle sm:p-7">
      <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><BriefcaseBusiness className="h-5 w-5" /></span><div><h1 className="text-xl font-extrabold text-slate-900">Post a job</h1><p className="text-sm text-slate-500">Tell nearby KaamConnect workers what you need.</p></div></div>
      {posted ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h2 className="font-bold text-emerald-900">Job posted successfully.</h2><p className="mt-1 text-sm text-emerald-800">{posted.title} · {posted.locality}</p><p className="mt-2 text-xs text-emerald-800">{nearby.length ? `${nearby.length} available ${service?.name || 'service'} workers nearby can respond.` : 'Workers can respond as they become available.'}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => navigate(`/jobs/${posted.id}`)} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white">View job details</button><button type="button" onClick={onBack} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Find workers</button></div></div> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-2">What do you need?<input required minLength={3} maxLength={120} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Fan is not working" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Category<select value={form.serviceId} onChange={(e) => { update('serviceId', e.target.value); update('taskId', ''); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal">{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Task<select value={form.taskId} onChange={(e) => update('taskId', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"><option value="">Choose a task (optional)</option>{(service?.popularTasks || []).map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-2">Description<textarea rows={3} maxLength={4000} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe the work and any useful details" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Location<select value={form.locality} onChange={(e) => update('locality', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal">{locations.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Urgency<select value={form.urgency} onChange={(e) => update('urgency', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"><option value="normal">Whenever convenient</option><option value="urgent">ASAP</option><option value="emergency">Emergency</option></select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Preferred date<input type="date" value={form.preferredDate} onChange={(e) => update('preferredDate', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Preferred time<input type="time" value={form.preferredTime} onChange={(e) => update('preferredTime', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2">{error}</p>}
        <button disabled={saving || !services.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{saving ? 'Posting job...' : 'Post job'}</button>
      </form>}
    </div>
  </section>;
};
