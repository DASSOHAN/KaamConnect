import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export const JobDetails = ({ onBack }) => {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.getJob(id).then((result) => { if (active) setJob(result); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load this job.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]);

  return <section className="mx-auto max-w-3xl py-7">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to Add Job</button>
    {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">Loading job...</div>
      : error ? <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center"><p className="text-sm text-rose-700">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-slate-700"><RefreshCw className="h-3.5 w-3.5" /> Try again</button></div>
        : job ? <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-subtle"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{job.status}</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">{job.title}</h1></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">{job.urgency}</span></div><p className="mt-3 text-sm text-slate-700">{job.description || 'No additional details provided.'}</p><p className="mt-4 flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4 text-rose-500" />{job.locality}</p><p className="mt-3 text-xs text-slate-500">Posted {job.created_at ? new Date(job.created_at).toLocaleString() : ''}</p></article>
          : null}
  </section>;
};
