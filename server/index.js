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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'KaamConnect Nadia API',
    region: 'Kalyani Subdivision, Nadia District, West Bengal',
    timestamp: new Date().toISOString()
  });
});

// 2. Locations
app.get('/api/locations', (req, res) => {
  res.json({ success: true, data: locations });
});

// 3. Services & fair wage rates
app.get('/api/services', (req, res) => {
  res.json({ success: true, data: services });
});

// 4. Workers list with filters
app.get('/api/workers', (req, res) => {
  const { trade, maxDistance, q } = req.query;
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
    const query = q.trim().toLowerCase();
    results = results.filter((w) =>
      String(w.name || '').toLowerCase().includes(query) ||
      String(w.nameBn || '').toLowerCase().includes(query) ||
      String(w.nameHi || '').toLowerCase().includes(query) ||
      String(w.tradeId || '').toLowerCase().includes(query) ||
      String(w.tradeTitle || '').toLowerCase().includes(query) ||
      String(w.bio || '').toLowerCase().includes(query) ||
      String(w.locality || '').toLowerCase().includes(query) ||
      (Array.isArray(w.skills) && w.skills.some((s) => String(s || '').toLowerCase().includes(query)))
    );
  }

  res.json({ success: true, count: results.length, data: results });
});

// 5. Register a new worker profile. Identity is demo-scoped because the app
// does not currently have authentication or account sessions.
app.post('/api/workers/register', (req, res) => {
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
app.get('/api/workers/:id', (req, res) => {
  const worker = workers.find((w) => w.id === req.params.id);
  if (!worker) {
    return res.status(404).json({ success: false, message: 'Worker not found' });
  }
  res.json({ success: true, data: worker });
});

app.patch('/api/workers/:id/profile', (req, res) => {
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

app.get('/api/workers/:id/jobs', (req, res) => {
  const worker = workers.find((item) => item.id === req.params.id);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
  if (worker.ownerId && req.query.ownerId && String(worker.ownerId) !== String(req.query.ownerId)) {
    return res.status(403).json({ success: false, message: 'You can only view your own worker jobs.' });
  }
  const assignedJobs = bookings.filter((booking) => booking.workerId === worker.id);
  res.json({ success: true, count: assignedJobs.length, data: assignedJobs });
});

// 6. Toggle Worker KYC (Admin Hub)
app.patch('/api/workers/:id/kyc', (req, res) => {
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
app.patch('/api/workers/:id/duty', (req, res) => {
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
app.patch('/api/workers/:id/rates', (req, res) => {
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
app.get('/api/bookings', (req, res) => {
  const customerId = String(req.query.customerId || '').trim();
  const results = customerId ? bookings.filter((booking) => booking.customerId === customerId) : bookings;
  res.json({ success: true, count: results.length, data: results });
});

// 10. Create new booking
app.post('/api/bookings', (req, res) => {
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
app.patch('/api/bookings/:id/status', (req, res) => {
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

app.patch('/api/bookings/:id/cancel', (req, res) => {
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

app.patch('/api/bookings/:id/worker-status', (req, res) => {
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
app.post('/api/bookings/:id/review', (req, res) => {
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
app.get('/api/analytics', (req, res) => {
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

app.listen(PORT, () => {
  console.log(`[KaamConnect Server] Backend API running at http://localhost:${PORT}`);
  console.log(`[KaamConnect Server] Serving Nadia District & Kalyani informal workforce network`);
});
