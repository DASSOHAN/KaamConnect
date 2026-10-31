import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, LoaderCircle, MapPin, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export const WorkerJobBoard = () => {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingId, setSendingId] = useState('');
  const [prices, setPrices] = useState({});
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true); setError('');
    try { setJobs(await api.getWorkerJobsBoard(session.user)); }
    catch (requestError) { setError(requestError.message || 'Unable to load available jobs.'); }
    finally { setLoading(false); }
  }, [session?.user]);
  useEffect(() => { load(); }, [load]);

  const submitOffer = async (job) => {
    setSendingId(job.id); setError('');
    try {
      const offer = await api.sendJobOffer(session.user, job.id, Number(prices[job.id]), notes[job.id] || '');
      if (offer.conversationId) navigate(`/messages/${offer.conversationId}`);
      else setError('Offer sent. The customer can start a private conversation from the offer.');
    } catch (requestError) { setError(requestError.message || 'Unable to send your offer.'); }
    finally { setSendingId(''); await load(); }
  };

  if (profile?.role !== 'worker') return <section className="mx-auto max-w-3xl py-12"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Sign in with a worker account and complete your worker profile to respond to jobs.</div></section>;

  return <section className="mx-auto max-w-5xl py-6 sm:py-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><button type="button" onClick={() => navigate('/worker-dashboard')} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> Worker dashboard</button><h1 className="text-2xl font-extrabold text-slate-900">Available jobs</h1><p className="mt-1 text-sm text-slate-600">Respond with a clear price, then coordinate privately in KaamConnect.</p></div><button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
    {error && <p role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{error}</p>}
    {loading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">Loading available jobs…</p>
      : jobs.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold text-slate-800">No matching open jobs</p><p className="mt-1 text-sm text-slate-500">Check again soon for nearby requests in your trade.</p></div>
        : <div className="grid gap-4">{jobs.map((job) => <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{job.services?.name || job.service_id}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{job.title}</h2><p className="mt-1 text-sm text-slate-600">{job.description}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold capitalize text-amber-900">{job.urgency}</span></div><p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 text-rose-500" />{job.locality} · {job.service_tasks?.name || job.task_id || 'General request'}</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><label className="grid gap-1 text-xs font-semibold text-slate-700">Your price (₹)<input type="number" min="1" max="1000000" value={prices[job.id] || ''} onChange={(event) => setPrices((current) => ({ ...current, [job.id]: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label><label className="grid gap-1 text-xs font-semibold text-slate-700">Short note<input maxLength={500} value={notes[job.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [job.id]: event.target.value }))} placeholder="What is included in your quote?" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" /></label><button disabled={sendingId === job.id || !Number(prices[job.id])} type="button" onClick={() => submitOffer(job)} className="self-end inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{sendingId === job.id && <LoaderCircle className="h-4 w-4 animate-spin" />}{sendingId === job.id ? 'Sending…' : 'Send offer'}</button></div></article>)}</div>}
  </section>;
};
