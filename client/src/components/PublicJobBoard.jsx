import React, { useEffect, useState } from 'react';
import { Briefcase, MapPin, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export function PublicJobBoard({ onOpenJob, onSignIn }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.getPublicJobs().then((rows) => { if (active) setJobs(rows); })
      .catch((err) => { if (active) setError(err.message || 'Unable to load public jobs.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return <section className="mx-auto max-w-5xl py-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">KaamConnect opportunities</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Browse open jobs</h1><p className="mt-1 text-sm text-slate-600">Explore public job details. Sign in as a worker to submit a quotation.</p></div><button onClick={onSignIn} className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950">Join as a worker</button></div>
    {loading ? <p className="py-12 text-center text-sm text-slate-600" role="status">Loading open jobs…</p> : error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-white p-6 text-center"><p className="text-sm text-rose-700">{error}</p><button onClick={() => setAttempt((v) => v + 1)} className="mt-3 inline-flex items-center gap-2 text-xs font-bold"><RefreshCw className="h-4 w-4" /> Retry</button></div> : jobs.length === 0 ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center"><Briefcase className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-2 font-bold text-slate-800">No open jobs are available right now.</p></div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{jobs.map((job) => <button key={job.id} onClick={() => onOpenJob(job)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-subtle transition hover:border-blue-300 hover:shadow-card"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">{job.title || job.serviceName || 'Open service job'}</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700">{job.status || 'open'}</span></div><p className="mt-2 line-clamp-3 text-sm text-slate-600">{job.description || 'View job details and requirements.'}</p><div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.locality || 'Area shared after contact'}</span>{job.urgency && <span className="capitalize">{job.urgency} urgency</span>}</div><span className="mt-4 inline-block text-xs font-bold text-blue-700">View job details →</span></button>)}</div>}
  </section>;
}
