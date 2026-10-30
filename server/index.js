import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { 
  INITIAL_LOCATIONS, 
  INITIAL_SERVICES, 
  INITIAL_WORKERS, 
  INITIAL_ANALYTICS 
} from './data.js';
import { dbResult, supabase, supabaseConfigured } from './database/client.js';

const app = express();
const PORT = process.env.PORT || 5000;
const PERSISTENCE_FILE = path.join(process.cwd(), 'server', 'runtime-data.json');

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

const readPersistentState = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(PERSISTENCE_FILE, 'utf8'));
    return {
      workers: Array.isArray(saved.workers) && saved.workers.length > 0 ? saved.workers : [...INITIAL_WORKERS],
      bookings: Array.isArray(saved.bookings) ? saved.bookings : [],
    };
  } catch (error) {
    return { workers: [...INITIAL_WORKERS], bookings: [] };
  }
};

const savePersistentState = () => {
  fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify({ workers, bookings }, null, 2), 'utf8');
};

// Locations and services remain static; profiles and bookings persist locally.
let locations = [...INITIAL_LOCATIONS];
let services = [...INITIAL_SERVICES];
const persistedState = readPersistentState();
let workers = persistedState.workers;
let analytics = { ...INITIAL_ANALYTICS };
let bookings = persistedState.bookings;

const normalizeMobile = (value) => String(value || '').replace(/\D/g, '');
const isValidMobile = (value) => /^[6-9]\d{9}$/.test(normalizeMobile(value));
const isValidStatus = (status) => ['pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'rejected'].includes(status);
const statusTransitions = {
  pending: ['accepted', 'cancelled', 'rejected'],
  accepted: ['en_route', 'cancelled', 'rejected'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: [],
};
let incomingJob = {
  id: 'req-kly-892',
  serviceId: 'electrician',
  serviceTitle: 'Electrician (বৈদ্যুতিক কর্মী)',
  taskTitle: 'Switchboard Sparks & MCB Repair',
  locality: 'Kalyani B-Block (near Buddha Park)',
  distanceKm: 1.2,
  payoutAmount: 450,
  customerName: 'Suman Chatterjee',
  timeRequested: 'Just now',
  expiresInSeconds: 58,
  addressNote: 'Flat 2B, Greenview Enclave, Opp. B-9 Market gate'
};

// 1. Health check
app.get('/api/health', async (req, res) => {
  let database = 'mock-fallback';
  if (supabaseConfigured) {
    const { error } = await dbResult(supabase.from('services').select('id', { head: true, count: 'exact' }).limit(1));
    database = error ? 'unavailable' : 'supabase';
    if (error) return res.status(503).json({ success: false, status: 'degraded', database, message: 'Supabase is configured but unavailable.' });
  }
  res.json({
    success: true,
    status: 'ok',
    database,
    app: 'KaamConnect Nadia API',
    region: 'Kalyani Subdivision, Nadia District, West Bengal',
    timestamp: new Date().toISOString()
  });
});

// 2. Locations
app.get('/api/locations', async (req, res) => {
  if (supabaseConfigured) {
    const { data, error } = await dbResult(supabase.from('locations').select('*').eq('active', true).order('name'));
    if (error) return res.status(503).json({ success: false, message: 'Unable to load locations from the database.' });
    return res.json({ success: true, data: data.map((item) => ({ ...item.metadata, id: item.id, name: item.name })) });
  }
  res.json({ success: true, data: locations });
});

// 3. Services & fair wage rates
app.get('/api/services', async (req, res) => {
  if (supabaseConfigured) {
    const { data, error } = await dbResult(supabase.from('services').select('*, service_tasks(*)').eq('active', true).order('name'));
    if (error) return res.status(503).json({ success: false, message: 'Unable to load services from the database.' });
    return res.json({ success: true, data: data.map((item) => ({
      ...item.metadata, id: item.id, name: item.name, nameBn: item.name_bn, nameHi: item.name_hi,
      iconName: item.icon, tagline: item.description,
      popularTasks: (item.service_tasks || []).filter((task) => task.active).map((task) => ({ ...task.metadata, id: task.id, name: task.name, nameBn: task.name_bn, nameHi: task.name_hi, description: task.description, basePrice: Number(task.base_price) })),
    })) });
  }
  res.json({ success: true, data: services });
});

const workerFromDb = (row) => ({
  ...(row.metadata || {}), id: row.id, legacyId: row.legacy_id, ownerId: row.metadata?.ownerId,
  name: row.users?.full_name || row.metadata?.name || 'KaamConnect worker',
  nameBn: row.metadata?.nameBn || row.users?.full_name, nameHi: row.metadata?.nameHi || row.users?.full_name,
  phone: row.users?.phone || '', email: row.users?.email || '', tradeId: row.trade_id,
  bio: row.bio || '', avatar: row.profile_photo_url || '', locality: row.locality || '',
  isAvailable: row.is_available, availability: row.is_available, kycStatus: row.kyc_status,
  kycVerified: row.kyc_status === 'verified', aadhaarVerified: row.aadhaar_verified,
  policeVerification: row.background_verified, experienceYears: row.experience_years,
  completedJobs: row.jobs_completed, rating: Number(row.rating_average), ratingCount: row.rating_count,
  halfDayRate: Number(row.half_day_rate), dailyRate: Number(row.daily_rate),
  skills: (row.worker_skills || []).map((skill) => skill.skill_name),
});
const findWorkerDb = async (id) => {
  const column = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? 'id' : 'legacy_id';
  return dbResult(supabase.from('workers').select('*, users(*), worker_skills(*)').eq(column, id).maybeSingle());
};
const resolveCustomer = async (id = 'demo-customer-1', name = 'Demo Customer') => {
  const phone = `${String(id).replace(/[^a-z0-9-]/gi, '-') }@kaamconnect.invalid`;
  return dbResult(supabase.from('users').upsert({ full_name: name, phone, role: 'customer', locality: 'Kalyani' }, { onConflict: 'phone' }).select('*').single());
};
const bookingFromDb = (row) => ({
  ...(row.metadata || {}), id: row.id, customerId: row.metadata?.customerId || row.customer_id,
  serviceId: row.service_id, serviceName: row.services?.name || row.metadata?.serviceName || row.service_id,
  taskId: row.task_id, taskName: row.service_tasks?.name || row.metadata?.taskName || '',
  workerId: row.worker_id, worker: row.workers ? workerFromDb(row.workers) : null,
  bookingType: row.booking_type, scheduledDate: row.scheduled_date, scheduledSlot: row.scheduled_slot,
  locality: row.locality, addressDetails: row.address_details, estimatedPriceMin: Number(row.estimated_price_min || 0),
  estimatedPriceMax: Number(row.estimated_price_max || 0), finalPrice: Number(row.final_price || 0),
  paymentMethod: row.payment_method, status: row.status, otp: row.otp, createdAt: row.created_at,
});

// 4. Workers list with filters
app.get('/api/workers', async (req, res) => {
  const { trade, maxDistance, q } = req.query;
  if (supabaseConfigured) {
    let query = supabase.from('workers').select('*, users(*), worker_skills(*)');
    if (trade && trade !== 'all') query = query.eq('trade_id', trade);
    const { data, error } = await dbResult(query.order('created_at'));
    if (error) return res.status(503).json({ success: false, message: 'Unable to load workers from the database.' });
    let rows = (data || []).map(workerFromDb);
    if (maxDistance && Number.isFinite(Number(maxDistance))) rows = rows.filter((worker) => Number(worker.distanceKm || 0) <= Number(maxDistance));
    if (q && q.trim()) {
      const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const catalog = await dbResult(supabase.from('services').select('id,name,service_tasks(name)').eq('active', true));
      if (catalog.error) return res.status(503).json({ success: false, message: 'Unable to search services and tasks.' });
      const matchedTrades = new Set(catalog.data.filter((service) => terms.every((term) => `${service.name} ${(service.service_tasks || []).map((task) => task.name).join(' ')}`.toLowerCase().includes(term))).map((service) => service.id));
      rows = rows.filter((worker) => {
        const haystack = [worker.name, worker.nameBn, worker.nameHi, worker.tradeId, worker.tradeTitle, worker.bio, worker.locality, ...(worker.skills || [])].join(' ').toLowerCase();
        return matchedTrades.has(worker.tradeId) || terms.every((term) => haystack.includes(term));
      });
    }
    return res.json({ success: true, count: rows.length, data: rows });
  }
  let results = [...workers];

  if (trade && trade !== 'all') {
    results = results.filter((w) => w.tradeId === trade);
  }

  if (maxDistance) {
    const dist = parseFloat(maxDistance);
    if (!isNaN(dist)) {
      results = results.filter((w) => w.distanceKm <= dist);
    }
  }

  if (q && q.trim()) {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    results = results.filter((w) => {
      const service = services.find((item) => item.id === w.tradeId);
      const searchable = [w.name, w.nameBn, w.nameHi, w.tradeId, w.tradeTitle, w.bio, w.locality, ...(w.skills || []), service?.name, ...(service?.popularTasks || []).map((task) => task.name)].join(' ').toLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
  }

  res.json({ success: true, count: results.length, data: results });
});

// 5. Register a new worker profile. Identity is demo-scoped because the app
// does not currently have authentication or account sessions.
app.post('/api/workers/register', async (req, res) => {
  const {
    ownerId,
    name,
    phone,
    email,
    tradeId,
    tradeTitle,
    locality,
    skills,
    experienceYears,
    halfDayRate,
    dailyRate,
    availability,
    workingHours,
    bio,
    avatar,
  } = req.body || {};

  const cleanName = String(name || '').trim();
  const cleanTradeId = String(tradeId || '').trim().toLowerCase();
  const cleanTradeTitle = String(tradeTitle || '').trim();
  const cleanLocality = String(locality || '').trim();
  const cleanSkills = Array.isArray(skills)
    ? skills.map((skill) => String(skill).trim()).filter(Boolean)
    : String(skills || '').split(',').map((skill) => skill.trim()).filter(Boolean);
  const years = Number(experienceYears || 0);
  const halfRate = Number(halfDayRate || 0);
  const fullRate = Number(dailyRate || 0);

  const errors = {};
  if (cleanName.length < 2 || cleanName.length > 80) errors.name = 'Enter a name between 2 and 80 characters.';
  if (!isValidMobile(phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.';
  if (!cleanTradeId || !cleanTradeTitle) errors.tradeId = 'Choose a primary profession.';
  if (cleanLocality.length < 2 || cleanLocality.length > 120) errors.locality = 'Enter a service area between 2 and 120 characters.';
  if (cleanSkills.length === 0 || cleanSkills.some((skill) => skill.length > 60)) errors.skills = 'Add at least one skill, each under 60 characters.';
  if (!Number.isInteger(years) || years < 0 || years > 60) errors.experienceYears = 'Experience must be between 0 and 60 years.';
  if (!Number.isFinite(halfRate) || halfRate < 0 || halfRate > 100000) errors.halfDayRate = 'Enter a valid starting rate.';
  if (!Number.isFinite(fullRate) || fullRate < 0 || fullRate > 200000) errors.dailyRate = 'Enter a valid daily rate.';
  if (email && !/^\S+@\S+\.\S+$/.test(String(email).trim())) errors.email = 'Enter a valid email address.';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, message: 'Please correct the highlighted fields.', errors });
  }

  if (supabaseConfigured) {
    const tradeId = cleanTradeId === 'ac-repair' ? 'electrician' : cleanTradeId === 'maintenance' ? 'mason' : cleanTradeId;
    const service = await dbResult(supabase.from('services').select('id').eq('id', tradeId).eq('active', true).maybeSingle());
    if (service.error || !service.data) return res.status(400).json({ success: false, message: 'Choose an available profession.' });
    const { data: user, error: userError } = await dbResult(supabase.from('users').insert({ full_name: cleanName, phone: normalizeMobile(phone), email: String(email || '').trim() || null, role: 'worker', language: 'bn', locality: cleanLocality }).select('*').single());
    if (userError) return res.status(userError.code === '23505' ? 409 : 503).json({ success: false, message: userError.code === '23505' ? 'A worker profile already uses this mobile number.' : 'Unable to create worker account.' });
    const { data: row, error } = await dbResult(supabase.from('workers').insert({ user_id: user.id, trade_id: tradeId, bio: String(bio || '').trim().slice(0, 500), profile_photo_url: String(avatar || ''), locality: cleanLocality, is_available: availability !== false, experience_years: years, half_day_rate: halfRate, daily_rate: fullRate, metadata: { ownerId: String(ownerId || `demo-owner-${user.id}`), tradeTitle: cleanTradeTitle, workingHours: String(workingHours || '09:00 AM - 07:00 PM'), isDemo: true } }).select('*, users(*)').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to save worker profile.' });
    const skillRows = cleanSkills.map((skill) => ({ worker_id: row.id, skill_name: skill }));
    const skillsResult = skillRows.length ? await dbResult(supabase.from('worker_skills').insert(skillRows)) : { error: null };
    if (skillsResult.error) return res.status(503).json({ success: false, message: 'Worker profile saved, but skills could not be saved.' });
    const full = await findWorkerDb(row.id);
    return res.status(201).json({ success: true, message: 'Worker profile registered for discovery.', data: workerFromDb(full.data) });
  }

  const duplicatePhone = workers.some((worker) => normalizeMobile(worker.phone) === normalizeMobile(phone));
  if (duplicatePhone) {
    return res.status(409).json({ success: false, message: 'A worker profile already uses this mobile number.' });
  }

  const id = `w-reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const profile = {
    id,
    ownerId: String(ownerId || `demo-owner-${id}`),
    isDemo: true,
    name: cleanName,
    nameBn: cleanName,
    nameHi: cleanName,
    phone: String(phone).trim(),
    email: String(email || '').trim(),
    avatar: String(avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80'),
    tradeId: cleanTradeId === 'ac-repair' ? 'electrician' : cleanTradeId === 'maintenance' ? 'mason' : cleanTradeId,
    categoryId: cleanTradeId,
    tradeTitle: cleanTradeTitle,
    experienceYears: years,
    rating: 0,
    completedJobs: 0,
    languages: ['Bengali', 'Hindi'],
    kycVerified: false,
    aadhaarVerified: false,
    policeVerification: false,
    locality: cleanLocality,
    distanceKm: 0,
    dailyRate: fullRate,
    halfDayRate: halfRate,
    isAvailable: availability !== false,
    availability: availability !== false,
    workingHours: String(workingHours || '09:00 AM - 07:00 PM'),
    bio: String(bio || '').trim().slice(0, 500),
    skills: cleanSkills,
    todayEarnings: 0,
    todayJobsCount: 0,
    recentReviews: [],
  };

  workers.push(profile);
  savePersistentState();
  res.status(201).json({ success: true, message: 'Worker profile registered for discovery.', data: profile });
});

// 6. Worker single details
app.get('/api/workers/:id', async (req, res) => {
  if (supabaseConfigured) {
    const { data, error } = await dbResult(supabase.from('workers').select('*, users(*), worker_skills(*)').or(`id.eq.${req.params.id},legacy_id.eq.${req.params.id}`).maybeSingle());
    if (error) return res.status(503).json({ success: false, message: 'Unable to load worker.' });
    if (!data) return res.status(404).json({ success: false, message: 'Worker not found' });
    return res.json({ success: true, data: workerFromDb(data) });
  }
  const worker = workers.find((w) => w.id === req.params.id);
  if (!worker) {
    return res.status(404).json({ success: false, message: 'Worker not found' });
  }
  res.json({ success: true, data: worker });
});

app.patch('/api/workers/:id/profile', async (req, res) => {
  if (supabaseConfigured) {
    const found = await findWorkerDb(req.params.id);
    if (found.error || !found.data) return res.status(found.error ? 503 : 404).json({ success: false, message: found.error ? 'Unable to load worker.' : 'Worker not found' });
    if (found.data.metadata?.ownerId && String(req.body?.ownerId || '') !== String(found.data.metadata.ownerId)) return res.status(403).json({ success: false, message: 'You can only edit your own worker profile.' });
    const body = req.body || {};
    if (body.phone !== undefined && !isValidMobile(body.phone)) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
    const skills = body.skills === undefined ? null : (Array.isArray(body.skills) ? body.skills : String(body.skills).split(',')).map((item) => String(item).trim()).filter(Boolean);
    const userUpdate = {};
    if (body.name !== undefined) userUpdate.full_name = String(body.name).trim();
    if (body.phone !== undefined) userUpdate.phone = normalizeMobile(body.phone);
    if (body.email !== undefined) userUpdate.email = String(body.email).trim() || null;
    if (body.locality !== undefined) userUpdate.locality = String(body.locality).trim();
    if (Object.keys(userUpdate).length) {
      const userResult = await dbResult(supabase.from('users').update({ ...userUpdate, updated_at: new Date().toISOString() }).eq('id', found.data.user_id));
      if (userResult.error) return res.status(503).json({ success: false, message: 'Unable to update worker contact details.' });
    }
    const update = {};
    if (body.locality !== undefined) update.locality = String(body.locality).trim();
    if (body.experienceYears !== undefined) update.experience_years = Number(body.experienceYears);
    if (body.halfDayRate !== undefined) update.half_day_rate = Number(body.halfDayRate);
    if (body.dailyRate !== undefined) update.daily_rate = Number(body.dailyRate);
    if (body.availability !== undefined) update.is_available = Boolean(body.availability);
    if (body.bio !== undefined) update.bio = String(body.bio).slice(0, 500);
    if (body.avatar !== undefined) update.profile_photo_url = String(body.avatar);
    update.updated_at = new Date().toISOString();
    update.metadata = { ...found.data.metadata, ...(body.workingHours !== undefined ? { workingHours: body.workingHours } : {}), ...(body.tradeTitle !== undefined ? { tradeTitle: body.tradeTitle } : {}) };
    const { error } = await dbResult(supabase.from('workers').update(update).eq('id', found.data.id));
    if (error) return res.status(503).json({ success: false, message: 'Unable to save worker profile.' });
    if (skills) {
      const removed = await dbResult(supabase.from('worker_skills').delete().eq('worker_id', found.data.id));
      if (removed.error) return res.status(503).json({ success: false, message: 'Profile saved, but skills could not be updated.' });
      if (skills.length) {
        const saved = await dbResult(supabase.from('worker_skills').insert(skills.map((skill_name) => ({ worker_id: found.data.id, skill_name }))));
        if (saved.error) return res.status(503).json({ success: false, message: 'Profile saved, but skills could not be updated.' });
      }
    }
    const updated = await findWorkerDb(found.data.id);
    return res.json({ success: true, data: workerFromDb(updated.data) });
  }
  const workerIndex = workers.findIndex((worker) => worker.id === req.params.id);
  if (workerIndex === -1) return res.status(404).json({ success: false, message: 'Worker not found' });

  const worker = workers[workerIndex];
  if (!worker.ownerId || String(req.body?.ownerId || '') !== String(worker.ownerId)) {
    return res.status(403).json({ success: false, message: 'You can only edit your own worker profile.' });
  }

  const allowed = ['name', 'phone', 'email', 'locality', 'skills', 'experienceYears', 'halfDayRate', 'dailyRate', 'availability', 'workingHours', 'bio', 'avatar', 'tradeTitle'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  if (updates.phone !== undefined && !isValidMobile(updates.phone)) {
    return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
  }
  if (updates.name !== undefined && String(updates.name).trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Name must contain at least 2 characters.' });
  }
  if (updates.skills !== undefined) {
    updates.skills = Array.isArray(updates.skills)
      ? updates.skills.map((skill) => String(skill).trim()).filter(Boolean)
      : String(updates.skills).split(',').map((skill) => skill.trim()).filter(Boolean);
  }
  if (updates.experienceYears !== undefined) updates.experienceYears = Number(updates.experienceYears);
  if (updates.halfDayRate !== undefined) updates.halfDayRate = Number(updates.halfDayRate);
  if (updates.dailyRate !== undefined) updates.dailyRate = Number(updates.dailyRate);
  if (updates.availability !== undefined) updates.isAvailable = Boolean(updates.availability);

  workers[workerIndex] = { ...worker, ...updates };
  savePersistentState();
  res.json({ success: true, data: workers[workerIndex] });
});

app.get('/api/workers/:id/jobs', async (req, res) => {
  if (supabaseConfigured) {
    const worker = await findWorkerDb(req.params.id);
    if (worker.error || !worker.data) return res.status(worker.error ? 503 : 404).json({ success: false, message: 'Worker not found.' });
    if (worker.data.metadata?.ownerId && req.query.ownerId && String(worker.data.metadata.ownerId) !== String(req.query.ownerId)) return res.status(403).json({ success: false, message: 'You can only view your own worker jobs.' });
    const { data, error } = await dbResult(supabase.from('bookings').select('*, services(name), service_tasks(name)').eq('worker_id', worker.data.id).order('created_at', { ascending: false }));
    if (error) return res.status(503).json({ success: false, message: 'Unable to load worker jobs.' });
    return res.json({ success: true, count: data.length, data: data.map(bookingFromDb) });
  }
  const worker = workers.find((item) => item.id === req.params.id);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
  if (worker.ownerId && req.query.ownerId && String(worker.ownerId) !== String(req.query.ownerId)) {
    return res.status(403).json({ success: false, message: 'You can only view your own worker jobs.' });
  }
  const assignedJobs = bookings.filter((booking) => booking.workerId === worker.id);
  res.json({ success: true, count: assignedJobs.length, data: assignedJobs });
});

// 6. Toggle Worker KYC (Admin Hub)
app.patch('/api/workers/:id/kyc', async (req, res) => {
  if (supabaseConfigured) {
    const found = await findWorkerDb(req.params.id);
    if (found.error || !found.data) return res.status(found.error ? 503 : 404).json({ success: false, message: found.error ? 'Unable to load worker.' : 'Worker not found' });
    const verified = Boolean(req.body.kycVerified ?? (found.data.kyc_status !== 'verified'));
    const { data, error } = await dbResult(supabase.from('workers').update({ kyc_status: verified ? 'verified' : 'suspended', identity_verified: verified, aadhaar_verified: verified, updated_at: new Date().toISOString() }).eq('id', found.data.id).select('*, users(*), worker_skills(*)').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to update worker verification.' });
    return res.json({ success: true, message: `Worker KYC status updated to ${verified ? 'VERIFIED' : 'SUSPENDED'}`, data: workerFromDb(data) });
  }
  const workerIndex = workers.findIndex((w) => w.id === req.params.id);
  if (workerIndex === -1) {
    return res.status(404).json({ success: false, message: 'Worker not found' });
  }

  const current = workers[workerIndex];
  const newStatus = req.body.kycVerified !== undefined ? req.body.kycVerified : !current.kycVerified;
  
  workers[workerIndex] = {
    ...current,
    kycVerified: newStatus,
    aadhaarVerified: newStatus
  };

  res.json({ 
    success: true, 
    message: `Worker KYC status updated to ${newStatus ? 'VERIFIED' : 'SUSPENDED'}`,
    data: workers[workerIndex] 
  });
});

// 7. Toggle Worker Duty (Worker Cockpit)
app.patch('/api/workers/:id/duty', async (req, res) => {
  if (supabaseConfigured) {
    const found = await findWorkerDb(req.params.id);
    if (found.error || !found.data) return res.status(found.error ? 503 : 404).json({ success: false, message: found.error ? 'Unable to load worker.' : 'Worker not found' });
    if (found.data.metadata?.ownerId && String(req.body?.ownerId || '') !== String(found.data.metadata.ownerId)) return res.status(403).json({ success: false, message: 'You can only change your own availability.' });
    const available = req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : !found.data.is_available;
    const { data, error } = await dbResult(supabase.from('workers').update({ is_available: available, last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', found.data.id).select('*, users(*), worker_skills(*)').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to save worker availability.' });
    return res.json({ success: true, message: `Duty mode changed to ${available ? 'ON' : 'OFF'}`, data: workerFromDb(data) });
  }
  const workerIndex = workers.findIndex((w) => w.id === req.params.id);
  if (workerIndex === -1) {
    return res.status(404).json({ success: false, message: 'Worker not found' });
  }

  const current = workers[workerIndex];
  if (current.ownerId && String(req.body?.ownerId || '') !== String(current.ownerId)) {
    return res.status(403).json({ success: false, message: 'You can only change your own availability.' });
  }
  const newDuty = req.body.isAvailable !== undefined ? req.body.isAvailable : !current.isAvailable;

  workers[workerIndex] = {
    ...current,
    isAvailable: newDuty
  };
  savePersistentState();

  res.json({ 
    success: true, 
    message: `Duty mode changed to ${newDuty ? 'ON' : 'OFF'}`,
    data: workers[workerIndex] 
  });
});

// 8. Update Worker Rate Card
app.patch('/api/workers/:id/rates', async (req, res) => {
  if (supabaseConfigured) {
    const found = await findWorkerDb(req.params.id);
    if (found.error || !found.data) return res.status(found.error ? 503 : 404).json({ success: false, message: found.error ? 'Unable to load worker.' : 'Worker not found' });
    const half = req.body.halfDayRate === undefined ? Number(found.data.half_day_rate) : Number(req.body.halfDayRate);
    const daily = req.body.dailyRate === undefined ? Number(found.data.daily_rate) : Number(req.body.dailyRate);
    if (![half, daily].every((value) => Number.isFinite(value) && value >= 0 && value <= 200000)) return res.status(400).json({ success: false, message: 'Enter valid non-negative rates.' });
    const { data, error } = await dbResult(supabase.from('workers').update({ half_day_rate: half, daily_rate: daily, updated_at: new Date().toISOString() }).eq('id', found.data.id).select('*, users(*), worker_skills(*)').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to save worker rates.' });
    return res.json({ success: true, data: workerFromDb(data) });
  }
  const workerIndex = workers.findIndex((w) => w.id === req.params.id);
  if (workerIndex === -1) {
    return res.status(404).json({ success: false, message: 'Worker not found' });
  }

  const { halfDayRate, dailyRate } = req.body;
  workers[workerIndex] = {
    ...workers[workerIndex],
    ...(halfDayRate !== undefined && { halfDayRate: Number(halfDayRate) }),
    ...(dailyRate !== undefined && { dailyRate: Number(dailyRate) })
  };
  savePersistentState();

  res.json({ success: true, data: workers[workerIndex] });
});

// 9. Bookings list
app.get('/api/bookings', async (req, res) => {
  if (supabaseConfigured) {
    let query = supabase.from('bookings').select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').order('created_at', { ascending: false });
    if (req.query.customerId) {
      const customer = await resolveCustomer(req.query.customerId);
      if (customer.error) return res.status(503).json({ success: false, message: 'Unable to load customer bookings.' });
      query = query.eq('customer_id', customer.data.id);
    }
    const { data, error } = await dbResult(query);
    if (error) return res.status(503).json({ success: false, message: 'Unable to load bookings.' });
    return res.json({ success: true, count: data.length, data: data.map(bookingFromDb) });
  }
  const customerId = String(req.query.customerId || '').trim();
  const results = customerId ? bookings.filter((booking) => booking.customerId === customerId) : bookings;
  res.json({ success: true, count: results.length, data: results });
});

// 10. Create new booking
app.post('/api/bookings', async (req, res) => {
  if (supabaseConfigured) {
    const body = req.body || {};
    const { data: service, error: serviceError } = await dbResult(supabase.from('services').select('id,name').eq('id', body.serviceId).eq('active', true).maybeSingle());
    if (serviceError || !service) return res.status(400).json({ success: false, message: 'Choose a valid service.' });
    const { data: task, error: taskError } = await dbResult(supabase.from('service_tasks').select('id,name,base_price').eq('id', body.taskId).eq('service_id', service.id).maybeSingle());
    if (taskError || !task) return res.status(400).json({ success: false, message: 'Choose a valid service task.' });
    const customer = await resolveCustomer(body.customerId, body.customerName);
    if (customer.error) return res.status(503).json({ success: false, message: 'Unable to save customer account.' });
    let worker = null;
    if (body.workerId) {
      const found = await findWorkerDb(String(body.workerId));
      if (!found.error) worker = found.data;
    }
    if (!worker) {
      const found = await dbResult(supabase.from('workers').select('*').eq('trade_id', service.id).eq('is_available', true).limit(1).maybeSingle());
      if (found.error) return res.status(503).json({ success: false, message: 'Unable to find an available worker.' });
      worker = found.data;
    }
    if (!worker) return res.status(409).json({ success: false, message: 'No workers are currently available for this service.' });
    const bookingType = body.bookingType === 'scheduled' ? 'scheduled' : 'immediate';
    const row = {
      customer_id: customer.data.id, worker_id: worker.id, service_id: service.id, task_id: task.id,
      booking_type: bookingType, scheduled_date: bookingType === 'scheduled' ? body.scheduledDate || null : null,
      scheduled_slot: bookingType === 'scheduled' ? body.scheduledSlot || null : null, locality: body.locality || 'Kalyani',
      address_details: body.addressDetails || '', estimated_price_min: Number(task.base_price),
      estimated_price_max: Math.round(Number(task.base_price) * 1.3), final_price: Number(task.base_price),
      payment_method: body.paymentMethod || 'upi', status: 'en_route', otp: String(Math.floor(1000 + Math.random() * 9000)),
      metadata: { customerId: body.customerId || 'demo-customer-1', customerName: body.customerName || customer.data.full_name, customerPhone: body.customerPhone || '' },
    };
    const { data, error } = await dbResult(supabase.from('bookings').insert(row).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to create booking.' });
    return res.status(201).json({ success: true, message: 'Booking placed & worker dispatched', data: bookingFromDb(data) });
  }
  const { 
    customerName, 
    customerPhone, 
    serviceId, 
    taskId, 
    locality, 
    addressDetails, 
    bookingType, 
    scheduledDate, 
    scheduledSlot,
    paymentMethod,
    workerId,
    customerId
  } = req.body;

  // Find matching service and task
  const service = services.find((s) => s.id === serviceId) || services[0];
  const task = service.popularTasks.find((t) => t.id === taskId) || service.popularTasks[0];

  // Match worker (requested worker or nearest available)
  let assignedWorker = null;
  if (workerId) {
    assignedWorker = workers.find((w) => w.id === workerId);
  }
  if (!assignedWorker) {
    assignedWorker = workers.find((w) => w.tradeId === service.id && w.isAvailable) || workers[0];
  }

  const newBooking = {
    id: `BK-KLY-${Math.floor(1000 + Math.random() * 9000)}`,
    customerId: customerId || 'demo-customer-1',
    customerName: customerName || 'Valued Kalyani Resident',
    customerPhone: customerPhone || '+91 98300 00000',
    serviceId: service.id,
    serviceName: service.name,
    taskId: task.id,
    taskName: task.name,
    locality: locality || 'Kalyani Central Park',
    addressDetails: addressDetails || 'Flat 3A, Nibedita Apartment, near Ghoshpara Station Road',
    bookingType: bookingType || 'immediate',
    scheduledDate: bookingType === 'scheduled' ? scheduledDate : undefined,
    scheduledSlot: bookingType === 'scheduled' ? scheduledSlot : undefined,
    estimatedPriceMin: task.basePrice,
    estimatedPriceMax: Math.round(task.basePrice * 1.3),
    finalPrice: task.basePrice,
    status: 'en_route',
    workerId: assignedWorker.id,
    worker: assignedWorker,
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    otp: String(Math.floor(1000 + Math.random() * 9000)),
    paymentMethod: paymentMethod || 'upi'
  };

  bookings.unshift(newBooking);
  savePersistentState();

  // Update district analytics
  analytics.completedJobsToday += 1;

  res.status(201).json({
    success: true,
    message: 'Booking placed & worker dispatched',
    data: newBooking
  });
});

// 11. Update booking status
app.patch('/api/bookings/:id/status', async (req, res) => {
  if (supabaseConfigured) {
    if (!isValidStatus(req.body?.status)) return res.status(400).json({ success: false, message: 'Unsupported booking status.' });
    const current = await dbResult(supabase.from('bookings').select('status').eq('id', req.params.id).maybeSingle());
    if (current.error || !current.data) return res.status(current.error ? 503 : 404).json({ success: false, message: current.error ? 'Unable to load booking.' : 'Booking not found.' });
    if (current.data.status !== req.body.status && !statusTransitions[current.data.status]?.includes(req.body.status)) return res.status(409).json({ success: false, message: `Cannot move booking from ${current.data.status} to ${req.body.status}.` });
    const { data, error } = await dbResult(supabase.from('bookings').update({ status: req.body.status, updated_at: new Date().toISOString(), completed_at: req.body.status === 'completed' ? new Date().toISOString() : null }).eq('id', req.params.id).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to update booking status.' });
    return res.json({ success: true, data: bookingFromDb(data) });
  }
  const bookingIndex = bookings.findIndex((b) => b.id === req.params.id);
  if (bookingIndex === -1) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  const { status } = req.body;
  if (!isValidStatus(status)) {
    return res.status(400).json({ success: false, message: 'Unsupported booking status.' });
  }
  const currentStatus = bookings[bookingIndex].status;
  if (currentStatus !== status && !statusTransitions[currentStatus]?.includes(status)) {
    return res.status(409).json({ success: false, message: `Cannot move booking from ${currentStatus} to ${status}.` });
  }
  bookings[bookingIndex].status = status;
  savePersistentState();

  res.json({ success: true, data: bookings[bookingIndex] });
});

app.patch('/api/bookings/:id/cancel', async (req, res) => {
  if (supabaseConfigured) {
    const current = await dbResult(supabase.from('bookings').select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').eq('id', req.params.id).maybeSingle());
    if (current.error || !current.data) return res.status(current.error ? 503 : 404).json({ success: false, message: current.error ? 'Unable to load booking.' : 'Booking not found.' });
    const customer = await resolveCustomer(req.body?.customerId);
    if (customer.error || customer.data.id !== current.data.customer_id) return res.status(403).json({ success: false, message: 'Only the booking customer can cancel this job.' });
    if (!['pending', 'confirmed', 'en_route'].includes(current.data.status)) return res.status(409).json({ success: false, message: 'This job can no longer be cancelled.' });
    const { data, error } = await dbResult(supabase.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to cancel booking.' });
    return res.json({ success: true, data: bookingFromDb(data) });
  }
  const bookingIndex = bookings.findIndex((booking) => booking.id === req.params.id);
  if (bookingIndex === -1) return res.status(404).json({ success: false, message: 'Booking not found' });
  const booking = bookings[bookingIndex];
  if (String(req.body?.customerId || '') !== String(booking.customerId)) {
    return res.status(403).json({ success: false, message: 'Only the booking customer can cancel this job.' });
  }
  if (!['pending', 'accepted', 'en_route'].includes(booking.status)) {
    return res.status(409).json({ success: false, message: 'This job can no longer be cancelled.' });
  }
  booking.status = 'cancelled';
  savePersistentState();
  res.json({ success: true, data: booking });
});

app.patch('/api/bookings/:id/worker-status', async (req, res) => {
  if (supabaseConfigured) {
    const current = await dbResult(supabase.from('bookings').select('*, workers(*)').eq('id', req.params.id).maybeSingle());
    if (current.error || !current.data) return res.status(current.error ? 503 : 404).json({ success: false, message: current.error ? 'Unable to load booking.' : 'Booking not found.' });
    if (String(req.body?.workerId || '') !== String(current.data.worker_id) || (current.data.workers?.metadata?.ownerId && String(req.body?.ownerId || '') !== String(current.data.workers.metadata.ownerId))) return res.status(403).json({ success: false, message: 'Only the assigned worker can update this job.' });
    const status = req.body?.status;
    if (!isValidStatus(status) || !statusTransitions[current.data.status]?.includes(status)) return res.status(409).json({ success: false, message: `Cannot move booking from ${current.data.status} to ${status}.` });
    const { data, error } = await dbResult(supabase.from('bookings').update({ status, updated_at: new Date().toISOString(), completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', req.params.id).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to update booking status.' });
    return res.json({ success: true, data: bookingFromDb(data) });
  }
  const bookingIndex = bookings.findIndex((booking) => booking.id === req.params.id);
  if (bookingIndex === -1) return res.status(404).json({ success: false, message: 'Booking not found' });
  const booking = bookings[bookingIndex];
  const worker = workers.find((item) => item.id === booking.workerId);
  if (!worker || String(req.body?.workerId || '') !== String(worker.id) || (worker.ownerId && String(req.body?.ownerId || '') !== String(worker.ownerId))) {
    return res.status(403).json({ success: false, message: 'Only the assigned worker can update this job.' });
  }
  const { status } = req.body;
  if (!isValidStatus(status) || !statusTransitions[booking.status]?.includes(status)) {
    return res.status(409).json({ success: false, message: `Cannot move booking from ${booking.status} to ${status}.` });
  }
  booking.status = status;
  savePersistentState();
  res.json({ success: true, data: booking });
});

// 12. Review and tip booking
app.post('/api/bookings/:id/review', async (req, res) => {
  if (supabaseConfigured) {
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    const booking = await dbResult(supabase.from('bookings').select('*').eq('id', req.params.id).maybeSingle());
    if (booking.error || !booking.data) return res.status(booking.error ? 503 : 404).json({ success: false, message: 'Booking not found.' });
    const customer = await resolveCustomer(req.body?.customerId || booking.data.metadata?.customerId);
    if (customer.error || customer.data.id !== booking.data.customer_id) return res.status(403).json({ success: false, message: 'Only the booking customer can leave a review.' });
    if (!booking.data.worker_id) return res.status(409).json({ success: false, message: 'This booking has no assigned worker.' });
    const { data: review, error } = await dbResult(supabase.from('reviews').insert({ booking_id: booking.data.id, customer_id: booking.data.customer_id, worker_id: booking.data.worker_id, rating, review_text: String(req.body?.reviewComment || '').slice(0, 2000) }).select('*').single());
    if (error) return res.status(error.code === '23505' ? 409 : 503).json({ success: false, message: error.code === '23505' ? 'This booking already has a review.' : 'Unable to save review.' });
    const updated = await dbResult(supabase.from('bookings').update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: { ...booking.data.metadata, rating, tipAmount: Number(req.body?.tipAmount) || 0, reviewComment: req.body?.reviewComment || '' } }).eq('id', booking.data.id).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
    if (updated.error) return res.status(503).json({ success: false, message: 'Review saved but booking summary could not be refreshed.', data: review });
    return res.json({ success: true, data: bookingFromDb(updated.data) });
  }
  const bookingIndex = bookings.findIndex((b) => b.id === req.params.id);
  if (bookingIndex === -1) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  const { rating, tipAmount, reviewComment } = req.body;
  bookings[bookingIndex] = {
    ...bookings[bookingIndex],
    rating: Number(rating) || 5,
    tipAmount: Number(tipAmount) || 0,
    reviewComment: reviewComment || '',
    status: 'completed'
  };
  savePersistentState();

  res.json({ success: true, data: bookings[bookingIndex] });
});

// 13. District Analytics
app.get('/api/analytics', async (req, res) => {
  if (supabaseConfigured) {
    const [workerRows, bookingRows, jobRows] = await Promise.all([
      dbResult(supabase.from('workers').select('id,is_available,locality')),
      dbResult(supabase.from('bookings').select('id,status,created_at')),
      dbResult(supabase.from('jobs').select('id,status,created_at')),
    ]);
    if (workerRows.error || bookingRows.error || jobRows.error) return res.status(503).json({ success: false, message: 'Unable to load district statistics.' });
    const workersNow = workerRows.data || [];
    const bookingsNow = bookingRows.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const completedToday = bookingsNow.filter((item) => item.status === 'completed' && String(item.created_at).slice(0, 10) === today).length;
    const areas = new Map();
    workersNow.filter((worker) => worker.is_available).forEach((worker) => {
      const area = worker.locality || 'Kalyani'; areas.set(area, (areas.get(area) || 0) + 1);
    });
    return res.json({ success: true, data: {
      ...INITIAL_ANALYTICS, totalActiveWorkers: workersNow.filter((worker) => worker.is_available).length,
      completedJobsToday: completedToday,
      activeAreas: [...areas.entries()].map(([name, activeWorkers]) => ({ name, activeWorkers, demand: 'Steady' })),
      totalWorkers: workersNow.length, totalBookings: bookingsNow.length, totalJobs: (jobRows.data || []).length,
    } });
  }
  res.json({ success: true, data: analytics });
});

// 14. Incoming Job for Worker
app.get('/api/jobs/incoming', (req, res) => {
  res.json({ success: true, data: incomingJob });
});

// 15. Accept Job by Worker
app.post('/api/jobs/incoming/accept', (req, res) => {
  const job = incomingJob;
  // Clear incoming or generate next
  incomingJob = null;
  res.json({ 
    success: true, 
    message: 'Job accepted by worker',
    data: job 
  });
});

// Customer-posted jobs and worker offers (Supabase-backed when configured).
app.post('/api/jobs', async (req, res) => {
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Job posting requires Supabase. Configure the server environment first.' });
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const serviceId = String(body.serviceId || '').trim();
  const locality = String(body.locality || '').trim();
  if (title.length < 3 || !serviceId || locality.length < 2) return res.status(400).json({ success: false, message: 'Enter a job title, service and location.' });
  const service = await dbResult(supabase.from('services').select('id').eq('id', serviceId).eq('active', true).maybeSingle());
  if (service.error || !service.data) return res.status(400).json({ success: false, message: 'Choose a valid service.' });
  const customer = await resolveCustomer(body.customerId, body.customerName || 'Demo Customer');
  if (customer.error) return res.status(503).json({ success: false, message: 'Unable to save customer account.' });
  const record = {
    customer_id: customer.data.id, service_id: serviceId, task_id: body.taskId || null,
    title, description: String(body.description || '').slice(0, 4000), photo_url: body.photoUrl || null,
    locality, address_details: String(body.addressDetails || ''), urgency: ['normal', 'urgent', 'emergency'].includes(body.urgency) ? body.urgency : 'normal',
    preferred_date: body.preferredDate || null, preferred_time: body.preferredTime || null,
    estimated_price_min: Number(body.estimatedPriceMin) || null, estimated_price_max: Number(body.estimatedPriceMax) || null,
  };
  const { data, error } = await dbResult(supabase.from('jobs').insert(record).select('*').single());
  if (error) return res.status(503).json({ success: false, message: 'Unable to post this job.' });
  res.status(201).json({ success: true, message: 'Job posted successfully.', data });
});

app.get('/api/jobs', async (req, res) => {
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Jobs require Supabase configuration.' });
  let query = supabase.from('jobs').select('*, services(name), service_tasks(name)').order('created_at', { ascending: false });
  if (req.query.customerId) {
    const customer = await resolveCustomer(req.query.customerId);
    if (customer.error) return res.status(503).json({ success: false, message: 'Unable to load customer jobs.' });
    query = query.eq('customer_id', customer.data.id);
  }
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error } = await dbResult(query);
  if (error) return res.status(503).json({ success: false, message: 'Unable to load jobs.' });
  res.json({ success: true, count: data.length, data });
});

app.get('/api/jobs/:id/offers', async (req, res, next) => {
  if (req.params.id === 'incoming') return next();
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Job offers require Supabase configuration.' });
  const { data, error } = await dbResult(supabase.from('job_offers').select('*, workers(*, users(*))').eq('job_id', req.params.id).order('created_at'));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load job offers.' });
  res.json({ success: true, data: data.map((offer) => ({ ...offer, worker: offer.workers ? workerFromDb(offer.workers) : null })) });
});

app.get('/api/jobs/:id', async (req, res, next) => {
  if (req.params.id === 'incoming') return next();
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Jobs require Supabase configuration.' });
  const { data, error } = await dbResult(supabase.from('jobs').select('*, services(name), service_tasks(name)').eq('id', req.params.id).maybeSingle());
  if (error) return res.status(503).json({ success: false, message: 'Unable to load job.' });
  if (!data) return res.status(404).json({ success: false, message: 'Job not found.' });
  res.json({ success: true, data });
});

app.patch('/api/jobs/:id', async (req, res, next) => {
  if (req.params.id === 'incoming') return next();
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Jobs require Supabase configuration.' });
  const allowed = ['title', 'description', 'photo_url', 'locality', 'address_details', 'urgency', 'preferred_date', 'preferred_time', 'status'];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (updates.status && !['open', 'assigned', 'in_progress', 'completed', 'cancelled'].includes(updates.status)) return res.status(400).json({ success: false, message: 'Unsupported job status.' });
  updates.updated_at = new Date().toISOString();
  const { data, error } = await dbResult(supabase.from('jobs').update(updates).eq('id', req.params.id).select('*').maybeSingle());
  if (error) return res.status(503).json({ success: false, message: 'Unable to update job.' });
  if (!data) return res.status(404).json({ success: false, message: 'Job not found.' });
  res.json({ success: true, data });
});

app.post('/api/jobs/:id/offers', async (req, res) => {
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Job offers require Supabase configuration.' });
  const amount = Number(req.body?.offeredPrice);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, message: 'Enter a valid offer price.' });
  const job = await dbResult(supabase.from('jobs').select('id,status').eq('id', req.params.id).maybeSingle());
  if (job.error || !job.data) return res.status(job.error ? 503 : 404).json({ success: false, message: job.error ? 'Unable to load job.' : 'Job not found.' });
  if (job.data.status !== 'open') return res.status(409).json({ success: false, message: 'This job is no longer accepting offers.' });
  const worker = await findWorkerDb(String(req.body?.workerId || ''));
  if (worker.error || !worker.data) return res.status(400).json({ success: false, message: 'Choose a valid worker.' });
  const { data, error } = await dbResult(supabase.from('job_offers').upsert({ job_id: job.data.id, worker_id: worker.data.id, offered_price: amount, message: String(req.body?.message || '').slice(0, 1000), status: 'pending' }, { onConflict: 'job_id,worker_id' }).select('*').single());
  if (error) return res.status(503).json({ success: false, message: 'Unable to submit offer.' });
  res.status(201).json({ success: true, data });
});

app.post('/api/jobs/:id/accept-offer', async (req, res) => {
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Job offers require Supabase configuration.' });
  const offer = await dbResult(supabase.from('job_offers').select('*, jobs(*)').eq('id', req.body?.offerId).eq('job_id', req.params.id).maybeSingle());
  if (offer.error || !offer.data) return res.status(404).json({ success: false, message: 'Offer not found.' });
  if (offer.data.jobs.status !== 'open') return res.status(409).json({ success: false, message: 'This job has already been assigned.' });
  const customer = await resolveCustomer(req.body?.customerId);
  if (customer.error || customer.data.id !== offer.data.jobs.customer_id) return res.status(403).json({ success: false, message: 'Only the customer who posted this job can accept an offer.' });
  const jobUpdate = await dbResult(supabase.from('jobs').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('status', 'open').select('*').maybeSingle());
  if (jobUpdate.error || !jobUpdate.data) return res.status(409).json({ success: false, message: 'This job has already been assigned.' });
  await dbResult(supabase.from('job_offers').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', offer.data.id));
  await dbResult(supabase.from('job_offers').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('job_id', req.params.id).neq('id', offer.data.id).eq('status', 'pending'));
  const job = offer.data.jobs;
  const { data: booking, error: bookingError } = await dbResult(supabase.from('bookings').insert({
    job_id: job.id, customer_id: job.customer_id, worker_id: offer.data.worker_id, service_id: job.service_id,
    task_id: job.task_id, booking_type: job.preferred_date ? 'scheduled' : 'immediate', scheduled_date: job.preferred_date,
    scheduled_slot: job.preferred_time, locality: job.locality, address_details: job.address_details,
    estimated_price_min: job.estimated_price_min, estimated_price_max: job.estimated_price_max,
    final_price: offer.data.offered_price, payment_method: 'upi', status: 'confirmed',
    otp: String(Math.floor(1000 + Math.random() * 9000)), metadata: { customerId: req.body?.customerId || 'demo-customer-1', customerName: customer.data.full_name },
  }).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
  if (bookingError) return res.status(503).json({ success: false, message: 'Offer was accepted, but its booking could not be created. Contact support before retrying.' });
  res.json({ success: true, data: { job: jobUpdate.data, offer: { ...offer.data, status: 'accepted' }, booking: bookingFromDb(booking) } });
});

app.post('/api/reviews', async (req, res) => {
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Reviews require Supabase configuration.' });
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
  const booking = await dbResult(supabase.from('bookings').select('*').eq('id', req.body?.bookingId).maybeSingle());
  if (booking.error || !booking.data) return res.status(404).json({ success: false, message: 'Booking not found.' });
  const customer = await resolveCustomer(req.body?.customerId);
  if (customer.error || booking.data.customer_id !== customer.data.id) return res.status(403).json({ success: false, message: 'Only the customer can review this booking.' });
  if (booking.data.status !== 'completed') return res.status(409).json({ success: false, message: 'Complete the booking before leaving a review.' });
  const { data, error } = await dbResult(supabase.from('reviews').insert({ booking_id: booking.data.id, customer_id: booking.data.customer_id, worker_id: booking.data.worker_id, rating, review_text: String(req.body?.reviewText || '').slice(0, 2000) }).select('*').single());
  if (error) return res.status(error.code === '23505' ? 409 : 503).json({ success: false, message: error.code === '23505' ? 'This booking already has a review.' : 'Unable to save review.' });
  res.status(201).json({ success: true, data });
});

app.get('/api/workers/:id/reviews', async (req, res) => {
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Reviews require Supabase configuration.' });
  const worker = await findWorkerDb(req.params.id);
  if (worker.error || !worker.data) return res.status(worker.error ? 503 : 404).json({ success: false, message: 'Worker not found.' });
  const { data, error } = await dbResult(supabase.from('reviews').select('*').eq('worker_id', worker.data.id).order('created_at', { ascending: false }));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load reviews.' });
  res.json({ success: true, data });
});

app.get('/api/workers/:id/history', async (req, res) => {
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Worker history requires Supabase configuration.' });
  const worker = await findWorkerDb(req.params.id);
  if (worker.error || !worker.data) return res.status(worker.error ? 503 : 404).json({ success: false, message: 'Worker not found.' });
  const { data, error } = await dbResult(supabase.from('bookings').select('*, services(name), service_tasks(name)').eq('worker_id', worker.data.id).order('created_at', { ascending: false }));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load worker history.' });
  res.json({ success: true, data });
});

app.get('/api/workers/:id/stats', async (req, res) => {
  if (!supabaseConfigured) return res.status(503).json({ success: false, message: 'Worker statistics require Supabase configuration.' });
  const worker = await findWorkerDb(req.params.id);
  if (worker.error || !worker.data) return res.status(worker.error ? 503 : 404).json({ success: false, message: 'Worker not found.' });
  const { data, error } = await dbResult(supabase.from('bookings').select('status, final_price').eq('worker_id', worker.data.id));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load worker statistics.' });
  res.json({ success: true, data: { completedJobs: data.filter((item) => item.status === 'completed').length, totalJobs: data.length, ratingAverage: Number(worker.data.rating_average), ratingCount: worker.data.rating_count, earnings: data.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.final_price || 0), 0) } });
});

app.listen(PORT, () => {
  console.log(`[KaamConnect Server] Backend API running at http://localhost:${PORT}`);
  console.log(`[KaamConnect Server] Serving Nadia District & Kalyani informal workforce network`);
});
