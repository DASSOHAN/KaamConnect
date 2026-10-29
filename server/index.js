import express from 'express';
import cors from 'cors';
import { 
  INITIAL_LOCATIONS, 
  INITIAL_SERVICES, 
  INITIAL_WORKERS, 
  INITIAL_ANALYTICS 
} from './data.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// In-memory runtime state for live updates
let locations = [...INITIAL_LOCATIONS];
let services = [...INITIAL_SERVICES];
let workers = [...INITIAL_WORKERS];
let analytics = { ...INITIAL_ANALYTICS };
let bookings = [];
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

// 5. Worker single details
app.get('/api/workers/:id', (req, res) => {
  const worker = workers.find((w) => w.id === req.params.id);
  if (!worker) {
    return res.status(404).json({ success: false, message: 'Worker not found' });
  }
  res.json({ success: true, data: worker });
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
  const newDuty = req.body.isAvailable !== undefined ? req.body.isAvailable : !current.isAvailable;

  workers[workerIndex] = {
    ...current,
    isAvailable: newDuty
  };

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

  res.json({ success: true, data: workers[workerIndex] });
});

// 9. Bookings list
app.get('/api/bookings', (req, res) => {
  res.json({ success: true, count: bookings.length, data: bookings });
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
    workerId
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
  bookings[bookingIndex].status = status;

  res.json({ success: true, data: bookings[bookingIndex] });
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
