import 'dotenv/config';
import { INITIAL_LOCATIONS, INITIAL_SERVICES, INITIAL_WORKERS } from '../data.js';
import { supabase, supabaseConfigured } from './client.js';

if (!supabaseConfigured) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env before seeding.');
const check = (result) => { if (result.error) throw result.error; return result.data; };

for (const service of INITIAL_SERVICES) {
  check(await supabase.from('services').upsert({
    id: service.id, name: service.name, name_bn: service.nameBn, name_hi: service.nameHi,
    description: service.tagline, icon: service.iconName, active: true,
    metadata: { fairWageRange: service.fairWageRange, typicalResponseTime: service.typicalResponseTime, activeWorkersCount: service.activeWorkersCount },
  }));
  for (const task of service.popularTasks || []) check(await supabase.from('service_tasks').upsert({
    id: task.id, service_id: service.id, name: task.name, name_bn: task.nameBn, name_hi: task.nameHi,
    description: task.description, base_price: task.basePrice, active: true, metadata: { estMinutes: task.estMinutes },
  }));
}

for (const location of INITIAL_LOCATIONS) check(await supabase.from('locations').upsert({
  id: location.id, name: location.name, district: 'Nadia', state: 'West Bengal', active: true, metadata: location,
}));

const seededWorkers = [];
for (let i = 0; i < INITIAL_WORKERS.length; i += 1) {
  const worker = INITIAL_WORKERS[i];
  const phone = `demo-worker-${String(i + 1).padStart(3, '0')}@kaamconnect.invalid`;
  const user = check(await supabase.from('users').upsert({
    full_name: worker.name, phone, email: null, role: 'worker', language: 'bn', locality: worker.locality,
  }, { onConflict: 'phone' }).select('id').single());
  const saved = check(await supabase.from('workers').upsert({
    user_id: user.id, legacy_id: worker.id, trade_id: worker.tradeId, bio: worker.bio,
    profile_photo_url: worker.avatar, locality: worker.locality, is_available: Boolean(worker.isAvailable),
    kyc_status: worker.kycVerified ? 'verified' : 'pending', identity_verified: Boolean(worker.kycVerified),
    background_verified: Boolean(worker.policeVerification), aadhaar_verified: Boolean(worker.aadhaarVerified),
    experience_years: worker.experienceYears || 0, jobs_completed: worker.completedJobs || 0,
    rating_average: worker.rating || 0, rating_count: (worker.recentReviews || []).length,
    half_day_rate: worker.halfDayRate || 0, daily_rate: worker.dailyRate || 0,
    metadata: Object.fromEntries(['name', 'nameBn', 'nameHi', 'tradeTitle', 'distanceKm', 'languages', 'workingHours', 'categoryId', 'todayEarnings', 'todayJobsCount'].filter((key) => worker[key] !== undefined).map((key) => [key, worker[key]])),
  }, { onConflict: 'legacy_id' }).select('id').single());
  seededWorkers.push({ ...worker, dbId: saved.id });
  const skills = (worker.skills || []).map((skill) => ({ worker_id: saved.id, skill_name: skill }));
  if (skills.length) check(await supabase.from('worker_skills').upsert(skills, { onConflict: 'worker_id,skill_name', ignoreDuplicates: true }));
}

const seededCustomers = [];
for (let i = 1; i <= 5; i += 1) {
  seededCustomers.push(check(await supabase.from('users').upsert({
    full_name: `Demo Customer ${i}`, phone: `demo-customer-${i}@kaamconnect.invalid`, role: 'customer',
    language: 'bn', locality: 'Kalyani',
  }, { onConflict: 'phone' }).select('id').single()));
}

const demoJobs = [
  { id: '10000000-0000-4000-8000-000000000001', customer_id: seededCustomers[0].id, service_id: 'electrician', task_id: 'el-fan', title: 'Fan is not working', description: 'Ceiling fan suddenly stopped working.', locality: 'Kalyani Central Park', urgency: 'urgent', status: 'completed' },
  { id: '10000000-0000-4000-8000-000000000002', customer_id: seededCustomers[1].id, service_id: 'plumber', task_id: 'pl-tap', title: 'Kitchen tap leakage', description: 'Water drips continuously from the tap.', locality: 'Ghoshpara Station Rd', urgency: 'normal', status: 'completed' },
  { id: '10000000-0000-4000-8000-000000000003', customer_id: seededCustomers[2].id, service_id: 'carpenter', task_id: 'cp-door', title: 'Bedroom door latch repair', description: 'The latch is loose and the door will not close properly.', locality: 'B-Block Market & More', urgency: 'normal', status: 'assigned' },
  { id: '10000000-0000-4000-8000-000000000004', customer_id: seededCustomers[3].id, service_id: 'cleaner', task_id: 'cl-floor', title: 'One room deep clean', description: 'Please clean the bedroom and attached balcony.', locality: 'Kalyani University Gate 1', urgency: 'normal', status: 'completed' },
  { id: '10000000-0000-4000-8000-000000000005', customer_id: seededCustomers[4].id, service_id: 'mason', task_id: 'ms-tile', title: 'Replace two cracked tiles', description: 'Bathroom floor tiles need replacing.', locality: 'Saguna Silpanchal', urgency: 'urgent', status: 'open' },
];
for (const job of demoJobs) check(await supabase.from('jobs').upsert(job));

const demoBookingSpecs = [
  { legacy_id: 'DEMO-BOOKING-1', job_id: demoJobs[0].id, customer: 0, worker: 'electrician', task_id: 'el-fan', service_id: 'electrician', status: 'completed', price: 350 },
  { legacy_id: 'DEMO-BOOKING-2', job_id: demoJobs[1].id, customer: 1, worker: 'plumber', task_id: 'pl-tap', service_id: 'plumber', status: 'completed', price: 250 },
  { legacy_id: 'DEMO-BOOKING-3', job_id: demoJobs[2].id, customer: 2, worker: 'carpenter', task_id: 'cp-door', service_id: 'carpenter', status: 'confirmed', price: 300 },
  { legacy_id: 'DEMO-BOOKING-4', job_id: demoJobs[3].id, customer: 3, worker: 'cleaner', task_id: 'cl-floor', service_id: 'cleaner', status: 'completed', price: 650 },
  { legacy_id: 'DEMO-BOOKING-5', job_id: demoJobs[4].id, customer: 4, worker: 'mason', task_id: 'ms-tile', service_id: 'mason', status: 'pending', price: 500 },
];
for (let i = 0; i < demoBookingSpecs.length; i += 1) {
  const spec = demoBookingSpecs[i];
  const worker = seededWorkers.find((item) => item.tradeId === spec.worker);
  const booking = check(await supabase.from('bookings').upsert({
    legacy_id: spec.legacy_id, job_id: spec.job_id, customer_id: seededCustomers[spec.customer].id,
    worker_id: worker.dbId, service_id: spec.service_id, task_id: spec.task_id,
    booking_type: i === 2 ? 'scheduled' : 'immediate', scheduled_date: i === 2 ? '2026-11-02' : null,
    scheduled_slot: i === 2 ? '10:00 AM - 12:00 PM' : null, locality: demoJobs[i].locality,
    estimated_price_min: spec.price, estimated_price_max: Math.round(spec.price * 1.3), final_price: spec.price,
    payment_method: 'upi', payment_status: spec.status === 'completed' ? 'paid' : 'pending', status: spec.status,
    completed_at: spec.status === 'completed' ? new Date().toISOString() : null,
    metadata: { customerId: `demo-customer-${spec.customer + 1}`, customerName: `Demo Customer ${spec.customer + 1}` },
  }, { onConflict: 'legacy_id' }).select('id').single());
  if (spec.status === 'completed') check(await supabase.from('reviews').upsert({
    booking_id: booking.id, customer_id: seededCustomers[spec.customer].id, worker_id: worker.dbId,
    rating: [5, 4, 5, 5, 0][i], review_text: 'Reliable service and clear communication.',
  }, { onConflict: 'booking_id' }));
}

console.log(`Seeded ${INITIAL_SERVICES.length} services, ${INITIAL_LOCATIONS.length} locations, ${INITIAL_WORKERS.length} workers, 5 customers, ${demoJobs.length} jobs, ${demoBookingSpecs.length} bookings and 3 reviews.`);
