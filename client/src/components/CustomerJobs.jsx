import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, RefreshCw, Star, XCircle } from 'lucide-react';
import { api } from '../services/api';

const tabs = [
  { id: 'all', label: 'All Bookings' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const statusLabel = (status) => ({
  en_route: 'En route',
  in_progress: 'In Progress',
  pending: 'Pending',
  accepted: 'Accepted',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  arrived: 'Arrived',
}[status] || status);

export const CustomerJobs = ({ customerId, onBack, onOpenLiveBooking, onRetry }) => {
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [expandedJobId, setExpandedJobId] = useState(null);

  const loadJobs = async () => {
    setIsLoading(true);
    setError('');
    try {
      setJobs(await api.getBookings(customerId));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your bookings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadJobs(); }, [customerId, onRetry]);

  const visibleJobs = useMemo(() => (
    activeTab === 'all' ? jobs : jobs.filter((job) => job.status === activeTab)
  ), [activeTab, jobs]);

  const cancelJob = async (job) => {
    setActionError('');
    try {
      const updated = await api.cancelBooking(job.id, customerId);
      setJobs((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cancelError) {
      setActionError(cancelError.message);
    }
  };

  return (
    <section className="py-6 sm:py-8 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to discovery
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Bookings</h1>
          <p className="mt-1 text-sm text-slate-600">Track your service bookings and completed work.</p>
        </div>
        <button type="button" onClick={loadJobs} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{actionError}</div>}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center" role="status">Loading your bookings…</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-800">We could not load your bookings.</p>
          <p className="mt-1 text-xs text-slate-500">{error}</p>
          <button type="button" onClick={loadJobs} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Try again</button>
        </div>
      ) : visibleJobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-800">No bookings in this view</p>
          <p className="mt-1 text-xs text-slate-500">Your service bookings will appear here after you book a worker.</p>
          <button type="button" onClick={onBack} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">Find Workers</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleJobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {job.worker?.avatar && <img src={job.worker.avatar} alt={job.worker.name || 'Assigned worker'} className="h-12 w-12 rounded-xl border border-slate-200 object-cover" />}
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{job.serviceName || job.serviceId}</h2>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{statusLabel(job.status)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{job.taskName}</p>
                  <p className="mt-1 text-xs text-slate-500">{job.worker?.name || 'Assigned technician'}{job.worker?.tradeTitle ? ` · ${job.worker.tradeTitle}` : ''}</p>
                  </div>
                </div>
                <span className="font-mono text-base font-bold text-slate-900">₹{job.finalPrice || job.estimatedPriceMin || 0}</span>
              </div>
              <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600 sm:grid-cols-3">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-rose-500" />{job.locality}</span>
                <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-blue-500" />{job.scheduledDate || job.createdAt || 'Just now'} {job.scheduledSlot || ''}</span>
                <span>Worker: <strong className="text-slate-800">{job.worker?.name || 'Assigned technician'}</strong></span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setExpandedJobId((current) => current === job.id ? null : job.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{expandedJobId === job.id ? 'Hide details' : 'View details'}</button>
                {['pending', 'accepted', 'en_route'].includes(job.status) && (
                  <button type="button" onClick={() => cancelJob(job)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><XCircle className="h-3.5 w-3.5" /> Cancel job</button>
                )}
                {job.status === 'completed' && <button type="button" onClick={() => onOpenLiveBooking?.(job)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><Star className="h-3.5 w-3.5" /> Review job</button>}
                {['en_route', 'arrived', 'in_progress'].includes(job.status) && <button type="button" onClick={() => onOpenLiveBooking?.(job)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">View live job</button>}
              </div>
              {expandedJobId === job.id && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p><strong>Booking ID:</strong> {job.id}</p><p className="mt-1"><strong>Address:</strong> {job.addressDetails || job.locality}</p><p className="mt-1"><strong>Payment:</strong> {job.paymentMethod ? job.paymentMethod.toUpperCase() : 'Not specified'}</p></div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
