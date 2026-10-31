import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, ShieldCheck, Star } from 'lucide-react';
import { api } from '../services/api';
import { DEFAULT_AVATAR } from '../utils/defaultAvatar';

export const WorkerProfileView = ({ worker, isLoading, loadError, onRetry, onBack, onBook }) => {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    if (!worker?.id) { setReviews([]); return undefined; }
    let active = true;
    api.getWorkerReviews(worker.id).then((items) => { if (active) setReviews(items); }).catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, [worker?.id]);
  if (isLoading && !worker) return <section className="mx-auto max-w-3xl py-16 text-center text-sm text-slate-600" role="status">Loading worker...</section>;
  if (loadError && !worker) return <section className="mx-auto max-w-3xl py-16 text-center"><p className="text-sm text-rose-700">Unable to load this worker. Please try again.</p><button type="button" onClick={onRetry} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Try again</button></section>;
  if (!worker) return <section className="mx-auto max-w-3xl py-16 text-center"><p className="font-bold text-slate-900">Worker not found</p><button type="button" onClick={onBack} className="mt-3 text-sm font-semibold text-blue-700">Back to workers</button></section>;

  return <section className="mx-auto max-w-3xl py-7">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> Workers</button>
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <img src={worker.avatar || DEFAULT_AVATAR} alt={worker.name || 'Worker'} className="h-24 w-24 rounded-2xl border border-slate-200 object-cover" />
        <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold text-slate-900">{worker.name || 'KaamConnect worker'}</h1>{worker.kycVerified && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"><ShieldCheck className="h-3.5 w-3.5" /> Verified</span>}</div>
          <p className="mt-1 text-sm text-slate-600">{worker.tradeTitle || worker.tradeId}</p>
          <p className="mt-2 flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4 text-rose-500" />{worker.locality || 'Kalyani'}</p>
          <div className="mt-2 flex items-center gap-1 text-sm font-bold text-amber-600"><Star className="h-4 w-4 fill-amber-400" />{worker.rating ?? 0}<span className="font-normal text-slate-500"> · {worker.completedJobs || 0} completed jobs</span></div>
        </div>
      </div>
      {worker.bio && <p className="mt-5 text-sm leading-6 text-slate-700">{worker.bio}</p>}
      {Array.isArray(worker.skills) && worker.skills.length > 0 && <div className="mt-5"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Skills</h2><div className="mt-2 flex flex-wrap gap-2">{worker.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{skill}</span>)}</div></div>}
      <section className="mt-6 border-t border-slate-100 pt-5"><h2 className="text-sm font-bold text-slate-900">Public reviews</h2>{reviews.length ? <div className="mt-3 space-y-3">{reviews.map((review) => <article key={review.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-1 text-sm font-bold text-amber-600"><Star className="h-4 w-4 fill-amber-400" />{review.rating}/5</div>{review.review_text && <p className="mt-1 text-sm text-slate-700">{review.review_text}</p>}<p className="mt-1 text-[11px] text-slate-400">{review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}</p></article>)}</div> : <p className="mt-2 text-sm text-slate-500">No public reviews yet.</p>}</section>
      <div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={() => onBook(worker)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white">Book this worker</button></div>
    </article>
  </section>;
};
