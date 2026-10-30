import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Edit3, Power, RefreshCw, X } from 'lucide-react';
import { WorkerDashboard } from './WorkerDashboard';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const WorkerWorkspace = ({ workerId, ownerId, workers, incomingJobData, language, showToast, onBack, onJobAcceptedByWorker, onBrowseJobs, onOpenChat }) => {
  const { session } = useAuth();
  const [worker, setWorker] = useState(() => workers.find((item) => item.id === workerId) || workers[0]);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const nextWorker = workers.find((item) => item.id === workerId) || workers[0];
    if (nextWorker) setWorker(nextWorker);
  }, [workerId, workers]);

  const loadJobs = async () => {
    if (!worker?.id) return;
    setIsLoading(true); setError('');
    try { setJobs(await api.getWorkerJobs(worker.id, ownerId, session?.access_token)); } catch (loadError) { setError(loadError.message); } finally { setIsLoading(false); }
  };
  useEffect(() => { loadJobs(); }, [worker?.id, ownerId, session?.access_token]);

  const updateAvailability = async () => {
    try {
      const result = await api.toggleWorkerDuty(worker.id, !worker.isAvailable, ownerId, session?.access_token);
      if (result?.data) setWorker(result.data);
      showToast('Availability updated', result?.data?.isAvailable ? 'You are available for new requests.' : 'You are now offline.', 'success');
    } catch (updateError) { showToast('Update failed', updateError.message, 'warning'); }
  };

  const updateJob = async (job, status) => {
    try {
      const updated = await api.updateWorkerJobStatus(job.id, worker.id, ownerId, status, session?.access_token);
      setJobs((current) => current.map((item) => item.id === updated.id ? updated : item));
      showToast('Job updated', `Job marked ${status}.`, 'success');
      onJobAcceptedByWorker?.(updated);
    } catch (updateError) { showToast('Job update failed', updateError.message, 'warning'); }
  };

  return (
    <div className="space-y-5 py-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-3.5 w-3.5" /> Customer discovery</button>
        <div className="flex gap-2">{onBrowseJobs && <button type="button" onClick={onBrowseJobs} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white">Available jobs</button>}{worker && <button type="button" onClick={updateAvailability} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${worker.isAvailable ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}><Power className="h-3.5 w-3.5" /> {worker.isAvailable ? 'Available' : 'Offline'}</button>}</div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-subtle">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><img src={worker?.avatar} alt={worker?.name} className="h-14 w-14 rounded-2xl object-cover" /><div><h1 className="text-xl font-extrabold text-slate-900">{worker?.name || 'Worker workspace'}</h1><p className="text-xs text-slate-500">{worker?.tradeTitle} · {worker?.locality}</p></div></div>
          <button type="button" onClick={() => setIsEditing((value) => !value)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><Edit3 className="h-3.5 w-3.5" /> {isEditing ? 'Close editor' : 'Edit profile'}</button>
        </div>
        {isEditing && <ProfileEditor worker={worker} ownerId={ownerId} onSaved={(saved) => { setWorker(saved); setIsEditing(false); showToast('Profile saved', 'Your worker profile was updated.', 'success'); }} />}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Assigned Jobs</h2><p className="text-xs text-slate-500">Only requests assigned to this worker are shown.</p></div><button type="button" onClick={loadJobs} className="rounded-xl border border-slate-200 p-2 text-slate-600"><RefreshCw className="h-4 w-4" /></button></div>
        {isLoading ? <p className="mt-5 text-sm text-slate-500">Loading assigned jobs…</p> : error ? <div className="mt-5 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{error}<button type="button" onClick={loadJobs} className="ml-3 font-bold underline">Retry</button></div> : jobs.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">No assigned jobs yet.</p> : <div className="mt-5 space-y-3">{jobs.map((job) => <JobRow key={job.id} job={job} onUpdate={updateJob} onOpenChat={onOpenChat} />)}</div>}
      </section>

      <WorkerDashboard language={language} showToast={showToast} workers={workers} incomingJobData={incomingJobData} onJobAcceptedByWorker={onJobAcceptedByWorker} />
    </div>
  );
};

const JobRow = ({ job, onUpdate }) => <div className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-slate-900">{job.serviceName} · {job.taskName}</p><p className="text-xs text-slate-500">{job.locality} · Customer: {job.customerName || 'Demo customer'}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{job.status}</span></div><div className="mt-3 flex flex-wrap gap-2">{job.status === 'pending' && <><button type="button" onClick={() => onUpdate(job, 'accepted')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"><Check className="h-3.5 w-3.5" /> Accept</button><button type="button" onClick={() => onUpdate(job, 'rejected')} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"><X className="h-3.5 w-3.5" /> Reject</button></>}{job.status === 'accepted' && <button type="button" onClick={() => onUpdate(job, 'en_route')} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Start route</button>}{job.status === 'en_route' && <button type="button" onClick={() => onUpdate(job, 'arrived')} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Mark arrived</button>}{job.status === 'arrived' && <button type="button" onClick={() => onUpdate(job, 'in_progress')} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Start work</button>}{job.status === 'in_progress' && <button type="button" onClick={() => onUpdate(job, 'completed')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Complete job</button>}</div></div>;

const ProfileEditor = ({ worker, ownerId, onSaved }) => {
  const { session } = useAuth();
  const [form, setForm] = useState({ name: worker.name || '', phone: worker.phone || '', locality: worker.locality || '', skills: (worker.skills || []).join(', '), experienceYears: worker.experienceYears || 0, halfDayRate: worker.halfDayRate || 0, dailyRate: worker.dailyRate || 0, workingHours: worker.workingHours || '', bio: worker.bio || '', availability: worker.isAvailable });
  const [error, setError] = useState('');
  const save = async (event) => { event.preventDefault(); setError(''); try { const saved = await api.updateWorkerProfile(worker.id, { ...form, ownerId, skills: form.skills.split(',').map((item) => item.trim()).filter(Boolean) }, session?.access_token); onSaved(saved); } catch (saveError) { setError(saveError.message); } };
  return <form onSubmit={save} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">{['name', 'phone', 'locality', 'skills', 'experienceYears', 'halfDayRate', 'dailyRate', 'workingHours'].map((field) => <label key={field} className="text-xs font-semibold capitalize text-slate-700">{field.replace(/([A-Z])/g, ' $1')}<input value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal" /></label>)}<label className="sm:col-span-2 text-xs font-semibold text-slate-700">Description<textarea rows={3} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal" /></label>{error && <p className="text-xs text-rose-700 sm:col-span-2">{error}</p>}<button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white sm:col-span-2">Save profile</button></form>;
};
