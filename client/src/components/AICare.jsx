import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function AICare({ services = [], onBack }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState(services[0]?.name || 'Home repair');
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);
  useEffect(() => { if (services.length && !services.some((item) => item.name === category)) setCategory(services[0].name); }, [services, category]);

  const addPhotos = (files) => {
    setPhotoError('');
    const selected = Array.from(files || []);
    if (photos.length + selected.length > 5) { setPhotoError('Choose up to 5 photos.'); return; }
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setPhotoError('Photos must be JPG, PNG or WebP files under 5 MB each.'); return;
    }
    setPhotos((current) => [...current, ...selected.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const assess = async (text, turns = history) => {
    if (!profile || profile.role !== 'customer') { navigate('/account?next=/care'); return; }
    setBusy(true); setError('');
    try {
      const assessment = await api.assessCare({ category, description: text, history: turns });
      setResult(assessment);
      setHistory([...turns, { customer: text, assessment }].slice(-6));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const ask = (event) => { event.preventDefault(); if (!answer.trim()) return; const updated = [...history, { customer: answer.trim(), assessment: result }].slice(-6); setDescription((value) => `${value}\n${answer.trim()}`.slice(0, 2000)); setAnswer(''); assess(answer.trim(), updated); };
  const handoff = () => {
    const cleanDescription = description.trim();
    navigate('/post-job', { state: { careDraft: { title: cleanDescription.split(/[.!?\n]/)[0].slice(0, 100) || 'Home repair request', description: cleanDescription, serviceId: services.find((item) => item.name === category)?.id || '' }, carePhotos: photos.map((photo) => photo.file) } });
  };

  return <section className="mx-auto max-w-2xl py-7"><button onClick={onBack || (() => navigate('/'))} className="mb-4 text-sm font-semibold text-blue-700">← Back</button><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-subtle"><h1 className="text-xl font-extrabold">AI Care</h1><p className="mt-1 text-sm text-slate-600">Describe a home issue to get cautious next steps. This is not a diagnosis. Photos are not analyzed by AI.</p>
    <label className="mt-5 grid gap-1 text-sm font-semibold">Category<select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border p-2">{services.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
    <div className="mt-4 rounded-xl border border-slate-200 p-4"><label className="grid cursor-pointer gap-1 text-sm font-bold text-slate-800">Add photos for a professional <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = ''; }} className="mt-2 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal"/><span className="text-xs font-normal text-slate-500">Up to 5 JPG, PNG or WebP photos; 5 MB each. Photos are not analyzed by AI. If you hire, they’ll be attached to the job for the professional.</span></label>
      {photoError && <p role="alert" className="mt-2 text-xs text-rose-700">{photoError}</p>}
      {photos.length > 0 && <div className="mt-3 flex flex-wrap gap-3">{photos.map((photo, index) => <div key={photo.preview} className="relative"><img src={photo.preview} alt={`Selected job photo ${index + 1}`} className="h-20 w-20 rounded-lg object-cover"/><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => { URL.revokeObjectURL(photo.preview); setPhotos((items) => items.filter((item) => item !== photo)); }} className="absolute -right-2 -top-2 rounded-full bg-slate-900 px-2 py-1 text-xs font-bold text-white">×</button></div>)}</div>}
    </div>
    <form onSubmit={(e) => { e.preventDefault(); if (description.trim()) assess(description.trim()); }} className="mt-3 grid gap-2"><label className="grid gap-1 text-sm font-semibold">What is happening?<textarea required minLength={4} maxLength={2000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="For example: The ceiling fan stopped working this morning." className="rounded-lg border p-3 text-sm font-normal" /></label><button disabled={busy || !description.trim()} className="justify-self-start rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Checking safely…' : 'Assess issue'}</button></form>
    {error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {result && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><h2 className="font-bold">{result.status.replaceAll('_', ' ')}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{result.summary}</p>{result.safetyNotice && <p className="mt-2 text-sm font-semibold text-amber-800">{result.safetyNotice}</p>}{result.questions?.length > 0 && <><p className="mt-3 text-sm font-semibold">A few questions</p><ul className="list-disc pl-5 text-sm">{result.questions.map((q, i) => <li key={i}>{q}</li>)}</ul><form onSubmit={ask} className="mt-3 flex gap-2"><input value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={500} placeholder="Your answer" className="min-w-0 flex-1 rounded-lg border p-2 text-sm"/><button disabled={busy || !answer.trim()} className="rounded-lg bg-slate-800 px-3 text-sm font-bold text-white">Continue</button></form></>}
    <p className="mt-3 text-xs text-slate-500">If unsure, stop and use a qualified professional. Assessment is based on what you reported; no inspection has verified the cause.</p><button onClick={handoff} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Hire a Professional Instead</button></div>}
    {!result && <button onClick={handoff} className="mt-4 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800">Hire a Professional Instead</button>}
  </div></section>;
}
