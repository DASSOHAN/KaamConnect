import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AirVent, ArrowLeft, ArrowRight, Blend, Check, CircuitBoard, ClipboardList, Coffee, CookingPot, Droplets, Fan, Flame, Heater, Microwave, Minus, Plus, Refrigerator, ShieldCheck, Tv, WashingMachine, Wind } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ICONS = {
  'air-conditioner': AirVent,
  refrigerator: Refrigerator,
  'washing-machine': WashingMachine,
  television: Tv,
  microwave: Microwave,
  'water-purifier': Droplets,
  geyser: Flame,
  'kitchen-chimney': Wind,
  'induction-cooktop': CookingPot,
  'electric-oven': Microwave,
  dishwasher: WashingMachine,
  'ceiling-fan': Fan,
  'exhaust-fan': Fan,
  'air-cooler': Wind,
  'water-pump': Droplets,
  'mixer-grinder': Blend,
  'electric-kettle': Coffee,
  'inverter-ups': CircuitBoard,
  'room-heater': Heater,
};
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const DRAFT_KEY = 'kaamconnect-electronics-care-draft';

export const HomeElectronicsCare = ({ selectedLocation }) => {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [workers, setWorkers] = useState([]);
  const [lines, setLines] = useState({});
  const [applianceSearch, setApplianceSearch] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [locality, setLocality] = useState(selectedLocation?.name || '');
  const [addressDetails, setAddressDetails] = useState('');
  const [step, setStep] = useState('configure');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);

  const loadCatalog = useCallback(async () => {
    setCatalogError('');
    setCatalogLoading(true);
    try {
      const data = await api.getElectronicsCareCatalog();
      setCatalog(data);
    } catch (requestError) {
      setCatalog(null);
      setCatalogError(requestError.message || 'Unable to load appliance services.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadCatalog();
    api.getWorkers().then((data) => { if (active) setWorkers(data); }).catch(() => {});
    try {
      const draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (draft) {
        setLines(draft.lines || {});
        setRequestedDate(draft.requestedDate || '');
        setRequestedTime(draft.requestedTime || '');
        setLocality(draft.locality || selectedLocation?.name || '');
        setAddressDetails(draft.addressDetails || '');
        window.sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY);
    }
    return () => { active = false; };
  }, [loadCatalog]);

  const selectedLines = useMemo(() => Object.entries(lines).map(([applianceId, value]) => {
    const appliance = catalog?.appliances.find((item) => item.id === applianceId);
    const service = appliance?.services.find((item) => item.id === value.serviceId);
    return appliance && service ? { ...value, appliance, service, lineSubtotal: service.unitPrice == null ? null : value.quantity * service.unitPrice } : null;
  }).filter(Boolean), [catalog, lines]);
  const subtotal = selectedLines.reduce((sum, item) => sum + (item.lineSubtotal ?? 0), 0);
  const hasQuotation = selectedLines.some((item) => item.lineSubtotal === null);
  const knownSubtotalLabel = subtotal > 0 ? currency.format(subtotal) : hasQuotation ? 'No fixed price configured' : currency.format(subtotal);
  const visibleAppliances = catalog?.appliances.filter((appliance) => `${appliance.name} ${appliance.teamCategory}`.toLowerCase().includes(applianceSearch.trim().toLowerCase())) || [];
  const teamCategories = [...new Set(selectedLines.map((item) => item.appliance.teamCategory))];

  const addAppliance = (appliance) => {
    setLines((current) => {
      if (current[appliance.id]) {
        const next = { ...current };
        delete next[appliance.id];
        return next;
      }
      return { ...current, [appliance.id]: { quantity: 1, serviceId: appliance.services[0].id, brand: '', problemDescription: '' } };
    });
  };
  const updateLine = (applianceId, changes) => setLines((current) => ({
    ...current,
    [applianceId]: { ...current[applianceId], ...changes },
  }));

  const eligibleProfiles = (teamCategory) => workers.filter((worker) => {
    const skills = [worker.tradeTitle, ...(worker.skills || [])].join(' ');
    if (teamCategory === 'AC service technician') return /\bac\b|air\s*condition|cooling/i.test(skills);
    if (teamCategory === 'Electrician') return /electrician|fan|inverter|electrical/i.test(skills);
    if (teamCategory === 'Plumber') return /plumb|pump|motor/i.test(skills);
    if (teamCategory === 'Chimney cleaning service') return /chimney|degrease|clean/i.test(skills);
    return /appliance repair|refrigerator|washing machine|television|microwave|purifier/i.test(skills);
  });

  const goToReview = (event) => {
    event.preventDefault();
    setError('');
    if (!selectedLines.length) { setError('Select at least one appliance and service.'); return; }
    if (!requestedDate || !requestedTime) { setError('Choose a preferred date and time for the visit request.'); return; }
    if (!locality.trim() || addressDetails.trim().length < 8) { setError('Enter your locality and complete home address.'); return; }
    setStep('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitBooking = async () => {
    if (submissionLock.current || submitting) return;
    if (!session?.access_token) {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ lines, requestedDate, requestedTime, locality, addressDetails }));
      navigate('/account?mode=signin&role=customer&next=%2Felectronics-care');
      return;
    }
    if (profile?.role !== 'customer') { setError('A customer account is required to request a home visit.'); return; }
    submissionLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const created = await api.createElectronicsCareBooking({
        customerId: profile.id,
        customerName: profile.full_name,
        locality,
        addressDetails,
        requestedDate,
        requestedTime,
        appliances: selectedLines.map(({ appliance, service, quantity, brand, problemDescription }) => ({
          applianceId: appliance.id,
          serviceId: service.id,
          quantity,
          brand,
          problemDescription,
        })),
      }, session.access_token);
      window.sessionStorage.removeItem(DRAFT_KEY);
      setBooking(created);
    } catch (requestError) {
      setError(requestError.message || 'Your request could not be saved. Please try again.');
      submissionLock.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  if (booking) return <section className="mx-auto max-w-2xl py-10 sm:py-14">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-subtle sm:p-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-slate-900"><Check className="h-7 w-7" /></span>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Request received</p>
      <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Your home visit is being coordinated</h1>
      <p className="mt-2 text-sm text-slate-600">Your preferred date and time are requests, not confirmed appointments. The team and any repair estimate will be confirmed before work begins.</p>
      <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm"><strong>Request ID:</strong> {booking.id}</p>
      <button type="button" onClick={() => navigate('/bookings')} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">View My Bookings</button>
    </div>
  </section>;

  return <section className="mx-auto max-w-6xl py-7 sm:py-10">
    <button type="button" onClick={() => navigate('/')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Back to home</button>
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">One coordinated home visit</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Home Electronics Care</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Request service for multiple appliances together. Select each unit and service, then review one transparent estimate and appointment request.</p></div>
      <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><ClipboardList className="h-4 w-4 text-amber-300" />One booking · one visit request</div>
    </div>

    {catalog?.pricesAreProvisional && <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-slate-800"><strong>Provisional development estimates.</strong> {catalog.pricingNotice}</p>}
    {catalogError && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-800">{catalogError} <button type="button" disabled={catalogLoading} onClick={loadCatalog} className="ml-2 font-bold underline disabled:opacity-50">{catalogLoading ? 'Retrying…' : 'Retry'}</button></div>}
    {catalogLoading && (!catalog || catalog.appliances.length === 0) && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Loading supported appliance services…</div>}
    {!catalogLoading && catalog && catalog.appliances.length === 0 && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h2 className="font-bold text-slate-900">No appliance services are available right now</h2><p className="mt-2 text-sm text-slate-600">Please check again later. No booking can be submitted until services are available.</p><button type="button" onClick={loadCatalog} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Retry</button></div>}

    {catalog && catalog.appliances.length > 0 && <form onSubmit={goToReview} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        {step === 'configure' ? <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-4"><h2 className="text-lg font-bold text-slate-900">1. Choose appliances</h2><p className="mt-1 text-xs text-slate-500">Tap a selected appliance again to remove it. Add every appliance for the same home visit.</p><input type="search" value={applianceSearch} onChange={(event) => setApplianceSearch(event.target.value)} placeholder="Search appliances" aria-label="Search appliances" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 sm:max-w-sm" /></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleAppliances.map((appliance) => {
                const Icon = ICONS[appliance.id] || Tv;
                const selected = Boolean(lines[appliance.id]);
                return <button key={appliance.id} type="button" onClick={() => addAppliance(appliance)} aria-pressed={selected} className={`min-h-28 rounded-xl border p-3 text-left transition ${selected ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : 'border-slate-200 bg-slate-50 hover:border-slate-400'}`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-amber-300"><Icon className="h-5 w-5" /></span>
                  <span className="mt-3 block text-sm font-bold text-slate-900">{appliance.name}</span>
                  <span className="mt-1 block text-xs leading-4 text-slate-500">{appliance.description}</span>
                  <span className="mt-2 flex items-center gap-1 text-xs text-slate-600">{selected ? <><Check className="h-3.5 w-3.5 text-emerald-700" /> Selected · tap to remove</> : 'Add appliance'}</span>
                </button>;
              })}
              {visibleAppliances.length === 0 && <p className="col-span-full rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No appliances match that search.</p>}
            </div>
          </section>

          {selectedLines.length > 0 && <section className="space-y-4">
            <div><h2 className="text-lg font-bold text-slate-900">2. Configure each appliance</h2><p className="mt-1 text-xs text-slate-500">Choose one service per appliance type. Use quantity for multiple units with the same service.</p></div>
            {selectedLines.map(({ appliance, service, quantity, brand, problemDescription }) => {
              const Icon = ICONS[appliance.id] || Tv;
              return <article key={appliance.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-subtle sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><h3 className="font-bold text-slate-900">{appliance.name}</h3><p className="text-xs text-slate-500">{appliance.teamCategory}</p></div>
                  <button type="button" onClick={() => setLines((current) => { const next = { ...current }; delete next[appliance.id]; return next; })} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Remove</button>
                </div>
                <fieldset className="mt-4 grid gap-2">
                  <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Service</legend>
                  {appliance.services.map((option) => <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${service.id === option.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}>
                    <input type="radio" name={`service-${appliance.id}`} value={option.id} checked={service.id === option.id} onChange={() => updateLine(appliance.id, { serviceId: option.id })} className="mt-0.5 accent-amber-400" />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{option.name}</span>{option.unitPrice == null ? <span className="mt-0.5 block text-xs text-slate-600">{catalog.quotationMessage}</span> : option.quoteRequired && <span className="mt-0.5 block text-xs text-slate-500">Repair work and parts require your approval of a separate quote.</span>}</span>
                    <strong className="whitespace-nowrap text-sm text-slate-900">{option.unitPrice == null ? 'Quote after diagnosis' : currency.format(option.unitPrice)}<span className="block text-right text-[10px] font-normal text-slate-500">{option.unitPrice == null ? 'per unit' : `${option.pricingType === 'configured' ? 'configured price' : 'per unit · provisional'}`}</span></strong>
                  </label>)}
                </fieldset>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">Brand (optional)<input maxLength={60} value={brand} onChange={(event) => updateLine(appliance.id, { brand: event.target.value })} placeholder="e.g. Samsung" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
                  <label className="text-xs font-semibold text-slate-700">Problem or notes (optional)<input maxLength={500} value={problemDescription} onChange={(event) => updateLine(appliance.id, { problemDescription: event.target.value })} placeholder="Briefly describe the issue" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs font-semibold text-slate-600">Quantity</span>
                  <div className="flex items-center gap-3"><button type="button" aria-label={`Remove one ${appliance.name}`} disabled={quantity <= 1} onClick={() => updateLine(appliance.id, { quantity: Math.max(1, quantity - 1) })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"><Minus className="h-4 w-4" /></button><span className="min-w-5 text-center text-sm font-bold">{quantity}</span><button type="button" aria-label={`Add one ${appliance.name}`} disabled={quantity >= 8} onClick={() => updateLine(appliance.id, { quantity: Math.min(8, quantity + 1) })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"><Plus className="h-4 w-4" /></button></div>
                  <span className="text-right text-sm font-bold text-slate-900">Line: {service.unitPrice == null ? 'Quote after diagnosis' : currency.format(quantity * service.unitPrice)}</span>
                </div>
              </article>;
            })}
          </section>}

          {selectedLines.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">3. Request a home visit</h2>
            <p className="mt-1 text-xs text-slate-500">Time availability is not connected, so this is a preferred date and time request, not a confirmed slot.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">Preferred date<input required type="date" min={todayLocal()} value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900" /></label>
              <label className="text-xs font-semibold text-slate-700">Preferred time<input required type="time" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900" /></label>
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Locality<input required maxLength={100} value={locality} onChange={(event) => setLocality(event.target.value)} placeholder="Neighbourhood or locality" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Home address<textarea required minLength={8} maxLength={300} rows={3} value={addressDetails} onChange={(event) => setAddressDetails(event.target.value)} placeholder="House or apartment, street, and nearby landmark" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            </div>
          </section>}
        </> : <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <button type="button" onClick={() => setStep('configure')} className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-slate-600"><ArrowLeft className="h-4 w-4" /> Edit selections</button>
          <h2 className="text-xl font-bold text-slate-900">Review your request</h2>
          <p className="mt-1 text-sm text-slate-600">One parent booking will include these appliance services.</p>
          <div className="mt-5 divide-y divide-slate-100">{selectedLines.map((item) => <div key={item.appliance.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="min-w-0"><strong>{item.quantity} × {item.appliance.name}</strong><span className="block text-xs text-slate-500">{item.service.name}{item.brand ? ` · ${item.brand}` : ''}</span>{item.problemDescription && <span className="block text-xs text-slate-500">{item.problemDescription}</span>}</span><span className="text-right font-bold">{item.lineSubtotal == null ? 'Quote after diagnosis' : currency.format(item.lineSubtotal)}<small className="block text-right font-normal text-slate-500">{item.service.unitPrice == null ? catalog.quotationMessage : `${currency.format(item.service.unitPrice)} / unit`}</small></span></div>)}</div>
          <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm"><div className="flex justify-between"><span>{hasQuotation ? 'Known service subtotal' : 'Estimated service total'}</span><strong>{knownSubtotalLabel}</strong></div>{hasQuotation && <p className="mt-2 text-xs font-semibold text-slate-700">Final total after diagnosis</p>}<p className="mt-2 text-xs leading-5 text-slate-600">No extra charge is added here. Repair labor and parts beyond diagnosis are quoted separately and need your approval.</p></div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Preferred visit</dt><dd className="font-semibold">{requestedDate} · {requestedTime} (requested)</dd></div><div><dt className="text-xs text-slate-500">Service area</dt><dd className="font-semibold">{locality}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-slate-500">Home address</dt><dd className="font-semibold">{addressDetails}</dd></div></dl>
        </section>}

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {selectedLines.length > 0 && <div className="flex flex-wrap justify-end gap-3">
          {step === 'review' && <button type="button" onClick={() => setStep('configure')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Back to edit</button>}
          {step === 'configure' ? <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300">Review combined request <ArrowRight className="h-4 w-4" /></button> : <button type="button" disabled={submitting} onClick={submitBooking} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{submitting ? 'Submitting…' : session ? 'Submit one booking request' : 'Sign in to submit request'}</button>}
        </div>}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-36">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle">
          <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Combined estimate</h2><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-800">Provisional</span></div>
          {selectedLines.length ? <div className="mt-4 space-y-3">{selectedLines.map((item) => <div key={item.appliance.id} className="flex justify-between gap-3 text-xs"><span className="min-w-0 text-slate-600">{item.quantity} × {item.appliance.name}<span className="block truncate text-[10px] text-slate-400">{item.service.name}</span></span><strong className="shrink-0 text-right text-slate-900">{item.lineSubtotal == null ? 'Quote after diagnosis' : currency.format(item.lineSubtotal)}</strong></div>)}<div className="flex justify-between border-t border-slate-200 pt-3 text-sm"><strong>{hasQuotation ? 'Known subtotal' : 'Total estimate'}</strong><strong className="text-lg">{knownSubtotalLabel}</strong></div>{hasQuotation && <p className="text-xs font-semibold text-slate-700">Final total after diagnosis</p>}<p className="text-[11px] leading-4 text-slate-500">Repair and parts charges are not included; they require a separate quote.</p></div> : <p className="mt-3 text-xs text-slate-500">Add appliances to build your combined request.</p>}
        </div>
        {teamCategories.length > 0 && <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-amber-300" /><h2 className="font-bold">Service coordination</h2></div>
          <p className="mt-2 text-xs leading-5 text-slate-300">The booking will request these service categories. A coordinated team is not assigned by the current platform, so availability and team assignment will be confirmed after review.</p>
          <ul className="mt-3 space-y-2">{teamCategories.map((category) => <li key={category} className="rounded-lg bg-white/10 px-3 py-2 text-xs">{category}
            {eligibleProfiles(category).length > 0 && <span className="mt-1 block text-[10px] text-slate-300">Relevant profiles on file: {eligibleProfiles(category).map((worker) => `${worker.name}${Number(worker.rating) > 0 ? ` (${Number(worker.rating).toFixed(1)}★)` : ''}${worker.kycVerified ? ' · verified' : ''}`).join(', ')}. Not assigned.</span>}
          </li>)}</ul>
        </div>}
      </aside>
    </form>}
  </section>;
};
