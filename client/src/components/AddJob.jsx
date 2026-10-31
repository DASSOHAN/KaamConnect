import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, LoaderCircle, Mic, Square, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const AddJob = ({ services = [], locations = [], onBack, onPosted, workers = [] }) => {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [form, setForm] = useState({ title: '', serviceId: services[0]?.id || '', taskId: '', description: '', locality: locations[0]?.name || 'Kalyani', urgency: 'normal', preferredDate: '', preferredTime: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [posted, setPosted] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [voice, setVoice] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const recorder = useRef(null); const chunks = useRef([]); const streamRef = useRef(null); const timer = useRef(null); const recordingStartedAt = useRef(0); const elapsedRecordingMs = useRef(0);
  useEffect(() => () => { clearInterval(timer.current); streamRef.current?.getTracks().forEach((track) => track.stop()); photos.forEach((file) => file.preview && URL.revokeObjectURL(file.preview)); }, []);
  const service = services.find((item) => item.id === form.serviceId);
  const nearby = workers.filter((worker) => worker.tradeId === form.serviceId && worker.isAvailable).slice(0, 5);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      const result = await api.createJob({ ...form, photos: photos.map((item) => item.file), voice: voice?.file, voiceDuration: voice?.duration }, session.user, setUploadProgress);
      setPosted(result);
      onPosted?.(result);
    } catch (submitError) { setError(submitError.message || 'Unable to post your job. Please try again.'); }
    finally { setSaving(false); setUploadProgress(0); }
  };
  const addPhotos = (files) => { setMediaError(''); const incoming = Array.from(files || []); if (photos.length + incoming.length > 5) { setMediaError('Choose up to 5 photos.'); return; } for (const file of incoming) if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024) { setMediaError('Photos must be JPG, PNG or WebP files under 5 MB each.'); return; } setPhotos((current) => [...current, ...incoming.map((file) => ({ file, preview: URL.createObjectURL(file) }))]); };
  const stopRecording = (atLimit = false) => {
    clearInterval(timer.current);
    if (recordingStartedAt.current) elapsedRecordingMs.current = atLimit ? 30_000 : performance.now() - recordingStartedAt.current;
    setRecordSeconds(Math.round(elapsedRecordingMs.current / 100) / 10);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
  };
  const startRecording = async () => {
    setMediaError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') {
      setMediaError('Voice recording is not supported in this browser. You can still post with text or photos.'); return;
    }
    const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const selectedType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
    if (!selectedType) { setMediaError('This browser does not support a compatible voice recording format. You can still post with text or photos.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
      const instance = new MediaRecorder(stream, { mimeType: selectedType }); recorder.current = instance; chunks.current = [];
      instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      instance.onstop = () => {
        const actualType = instance.mimeType || selectedType;
        const baseType = actualType.split(';', 1)[0].trim().toLowerCase();
        const extension = baseType === 'audio/mp4' ? 'm4a' : baseType === 'audio/webm' ? 'webm' : '';
        if (!extension) { setMediaError('The browser produced an unsupported voice note format. Please try another browser or continue without audio.'); setRecording(false); stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; return; }
        const blob = new Blob(chunks.current, { type: actualType });
        const duration = Math.round(elapsedRecordingMs.current / 100) / 10;
        setVoice({ file: new File([blob], `voice-note.${extension}`, { type: actualType }), url: URL.createObjectURL(blob), duration, mimeType: actualType });
        stream.getTracks().forEach((track) => track.stop()); streamRef.current = null;
      };
      elapsedRecordingMs.current = 0; recordingStartedAt.current = performance.now(); instance.start(); setRecording(true); setRecordSeconds(0);
      timer.current = setInterval(() => {
        const elapsed = performance.now() - recordingStartedAt.current;
        elapsedRecordingMs.current = elapsed;
        if (elapsed >= 30_000) { stopRecording(true); return; }
        setRecordSeconds(Math.round(elapsed / 100) / 10);
      }, 100);
    } catch (recordError) {
      streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
      setMediaError(recordError?.name === 'NotSupportedError'
        ? 'This browser cannot record the selected audio format. You can still post with text or photos.'
        : recordError?.name === 'NotAllowedError'
          ? 'Microphone access was not granted. Allow microphone access in your browser settings, or continue without a voice note.'
          : 'Unable to start voice recording. Check microphone access or continue without a voice note.');
    }
  };

  return <section className="mx-auto max-w-3xl py-7">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to discovery</button>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle sm:p-7">
      <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><BriefcaseBusiness className="h-5 w-5" /></span><div><h1 className="text-xl font-extrabold text-slate-900">Post a job</h1><p className="text-sm text-slate-500">Tell nearby KaamConnect workers what you need.</p></div></div>
      {!session ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><h2 className="font-bold text-slate-900">Sign in to post a job</h2><p className="mt-1 text-sm text-slate-600">A KaamConnect account keeps job responses and messages private.</p><button type="button" onClick={() => navigate('/account?next=/post-job')} className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white">Sign in or create account</button></div> : !profile ? <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Setting up your account…</p> : profile.role !== 'customer' ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Switch to a customer account to post a job.</p> : posted ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h2 className="font-bold text-emerald-900">Job posted successfully.</h2><p className="mt-1 text-sm text-emerald-800">{posted.title} · {posted.locality}</p><p className="mt-2 text-xs text-emerald-800">Workers can respond as they become available.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => navigate(`/jobs/${posted.id}`)} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white">View job details</button><button type="button" onClick={onBack} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Find workers</button></div></div> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-2">What do you need?<input required minLength={3} maxLength={120} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Fan is not working" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Category<select value={form.serviceId} onChange={(e) => { update('serviceId', e.target.value); update('taskId', ''); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal">{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Task<select value={form.taskId} onChange={(e) => update('taskId', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"><option value="">Choose a task (optional)</option>{(service?.popularTasks || []).map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select></label>
        <div className="grid gap-3 sm:col-span-2"><div><h2 className="text-sm font-bold text-slate-900">Describe your problem</h2><p className="text-xs text-slate-500">Help workers understand your problem before they accept your request.</p></div><label className="grid gap-1 text-xs font-semibold text-slate-700">Description<textarea rows={3} maxLength={4000} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe the work and any useful details" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="grid gap-2 text-xs font-semibold text-slate-700">Photos (optional, up to 5)<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(e)=>{addPhotos(e.target.files);e.target.value='';}} className="block w-full rounded-xl border border-slate-200 p-2 text-sm font-normal"/><span className="text-[11px] font-normal text-slate-500">JPG, PNG or WebP, up to 5 MB each.</span></label>
        {photos.length>0&&<div className="flex flex-wrap gap-2">{photos.map((item,index)=><div key={item.preview} className="relative"><img src={item.preview} alt={`Problem photo ${index+1}`} className="h-20 w-20 rounded-lg object-cover"/><button type="button" aria-label="Remove photo" onClick={()=>{URL.revokeObjectURL(item.preview);setPhotos((current)=>current.filter((_,i)=>i!==index));}} className="absolute -right-1 -top-1 rounded-full bg-slate-900 p-1 text-white"><X className="h-3 w-3"/></button></div>)}</div>}
        <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-800">Voice note (optional, up to 30 seconds)</p><p className="mt-1 text-[11px] text-slate-500">Your browser will ask for microphone access after you start recording.</p><div className="mt-3 flex flex-wrap items-center gap-2">{!voice&&!recording&&<button type="button" onClick={startRecording} className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"><Mic className="h-4 w-4"/>Start recording</button>}{recording&&<><span role="status" className="text-xs font-semibold text-rose-700">● Recording · {recordSeconds.toFixed(1)}s / 30s</span><button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800"><Square className="h-4 w-4"/>Stop</button></>}{voice&&<><audio controls src={voice.url} className="h-9 max-w-full"/><span className="text-xs text-slate-600">{voice.duration.toFixed(1)}s</span><button type="button" onClick={()=>{URL.revokeObjectURL(voice.url);setVoice(null);setRecordSeconds(0);}} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-rose-700"><Trash2 className="h-4 w-4"/>Delete</button></>}</div></div>
        {mediaError&&<p role="alert" className="text-xs text-rose-700">{mediaError}</p>}{saving&&<div role="status" className="text-xs text-slate-600">Uploading job details… {uploadProgress}%<progress className="mt-1 block w-full" max="100" value={uploadProgress}/></div>}</div>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Location<select value={form.locality} onChange={(e) => update('locality', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal">{locations.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Urgency<select value={form.urgency} onChange={(e) => update('urgency', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"><option value="normal">Whenever convenient</option><option value="urgent">ASAP</option><option value="emergency">Emergency</option></select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Preferred date<input type="date" value={form.preferredDate} onChange={(e) => update('preferredDate', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Preferred time<input type="time" value={form.preferredTime} onChange={(e) => update('preferredTime', e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2">{error}</p>}
        <button disabled={saving || !services.length || recording} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{saving ? `Posting job… ${uploadProgress}%` : 'Post job'}</button>
      </form>}
    </div>
  </section>;
};
