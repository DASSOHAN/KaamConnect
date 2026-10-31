import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import multer from 'multer';
import {
  INITIAL_LOCATIONS,
  INITIAL_SERVICES,
  INITIAL_WORKERS,
  INITIAL_ANALYTICS
} from './data.js';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { dbResult, db, databaseReady, sqlite } from './database/sqlite.js';
import { SQLiteSessionStore } from './database/session-store.js';
import { buildElectronicsCareCatalog, validateElectronicsCareRequest } from './electronicsCare.js';
import { processAICareMessage, SUPPORTED_APPLIANCES, evaluateDeterministicSafety } from './aiCareService.js';

const app = express();
app.set('trust proxy', 1);
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });
const PORT = process.env.PORT || 5000;
const PERSISTENCE_FILE = path.join(process.cwd(), 'server', 'runtime-data.json');
const uploadRoot=path.join(path.dirname(fileURLToPath(import.meta.url)),'uploads');
const imageUpload=multer({storage:multer.diskStorage({destination:(req,file,cb)=>{const folder=path.join(uploadRoot,req.path.startsWith('/api/workers/photo')?'worker-avatars':'chat-attachments');fs.mkdirSync(folder,{recursive:true});cb(null,folder);},filename:(req,file,cb)=>cb(null,`${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)}),limits:{fileSize:8*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
const chatImageUpload=multer({storage:multer.diskStorage({destination:(req,file,cb)=>{const userId=req.session?.userId||req.appProfile?.id||'anonymous';const folder=path.join(uploadRoot,'chat-attachments',String(req.params.id),String(userId));fs.mkdirSync(folder,{recursive:true});cb(null,folder);},filename:(req,file,cb)=>cb(null,`${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)}),limits:{fileSize:8*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
const workerPhotoRoot=path.join(uploadRoot,'worker-avatars');
app.use('/api/worker-avatars',express.static(workerPhotoRoot,{fallthrough:false,maxAge:'1d'}));

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('Set SESSION_SECRET to a random value of at least 32 characters in server/.env.');
}
app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  name: 'kaamconnect.sid', secret: process.env.SESSION_SECRET,
  store: new SQLiteSessionStore(), resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(express.json({ limit: '1mb' }));
app.use((req,res,next)=>{
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const isLocalHost = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);
    const origin = req.get('origin');
    if (origin) {
      try {
        const originHost = new URL(origin).hostname;
        const matches = originHost === req.hostname || (isLocalHost(originHost) && isLocalHost(req.hostname));
        if (!matches) return res.status(403).json({ success: false, message: 'Request origin was rejected.' });
      } catch {
        return res.status(403).json({ success: false, message: 'Request origin was rejected.' });
      }
    }
    const referer = req.get('referer');
    if (referer) {
      try {
        const refererHost = new URL(referer).hostname;
        const matches = refererHost === req.hostname || (isLocalHost(refererHost) && isLocalHost(req.hostname));
        if (!matches) return res.status(403).json({ success: false, message: 'Request origin was rejected.' });
      } catch {
        return res.status(403).json({ success: false, message: 'Request origin was rejected.' });
      }
    }
    const csrf = req.get('x-csrf-token');
    const isExempt = ['/api/auth/login', '/api/auth/register', '/api/ai-care/session'].includes(req.path);
    if (!isExempt && (!req.session?.csrfToken || !csrf || csrf !== req.session.csrfToken)) {
      return res.status(403).json({ success: false, message: 'Your security token expired. Refresh the page and try again.' });
    }
  }
  next();
});

const normalizeMobile = (value) => String(value || '').replace(/\D/g, '');
const isValidMobile = (value) => /^[6-9]\d{9}$/.test(normalizeMobile(value));
const currentUser = (id) => { const user=sqlite.prepare('SELECT id,full_name,email,phone,role,is_suspended,language,locality,created_at,updated_at FROM users WHERE id=?').get(id);if(user&&user.role==='worker'){const worker=sqlite.prepare('SELECT metadata FROM workers WHERE user_id=?').get(id);let metadata={};try{metadata=JSON.parse(worker?.metadata||'{}')}catch{}user.worker_profile_complete=metadata.workerRegistrationComplete===true;}return user;};
const authError = (res,status,message) => res.status(status).json({success:false,message});
const authAttemptAllowed = (req,key) => {
  const ip=String(req.ip||'local').slice(0,100), bucket=`${ip}:${key}`; const now=Date.now();
  const old=sqlite.prepare('SELECT window_started_at,attempts FROM auth_rate_limits WHERE key=?').get(bucket);
  if(!old || now-old.window_started_at>15*60*1000){sqlite.prepare('INSERT INTO auth_rate_limits(key,window_started_at,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_started_at=excluded.window_started_at,attempts=1').run(bucket,now);return true;}
  sqlite.prepare('UPDATE auth_rate_limits SET attempts=attempts+1 WHERE key=?').run(bucket); return old.attempts<10;
};
const createAuthenticatedSession = (req,user,res) => new Promise((resolve,reject)=>req.session.regenerate(error=>{
  if(error){reject(error);return;} req.session.userId=user.id;req.session.csrfToken=randomBytes(32).toString('hex');req.session.save(saveError=>saveError?reject(saveError):(res.json({success:true,data:{user:currentUser(user.id),profile:currentUser(user.id),csrfToken:req.session.csrfToken}}),resolve()));
}));
app.get('/api/auth/csrf',(req,res)=>{
  req.session.csrfToken ||= randomBytes(32).toString('hex');
  req.session.save((err) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to initialize session.' });
    res.json({ success: true, data: { token: req.session.csrfToken } });
  });
});
app.get('/api/auth/me',(req,res)=>{const user=req.session.userId?currentUser(req.session.userId):null;if(!user)return res.json({success:true,data:null});if(user.is_suspended)return authError(res,403,'This account is suspended. Contact KaamConnect support.');res.json({success:true,data:{user,profile:user}});});
app.post('/api/auth/register',async(req,res)=>{
  const fullName=String(req.body?.fullName||'').trim(),email=String(req.body?.email||'').trim().toLowerCase(),phone=normalizeMobile(req.body?.phone),password=String(req.body?.password||''),role=String(req.body?.role||'customer');
  if(fullName.length<2||fullName.length>100)return authError(res,400,'Enter a name between 2 and 100 characters.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return authError(res,400,'Enter a valid email address.');
  if(!isValidMobile(phone))return authError(res,400,'Enter a valid 10-digit Indian mobile number.');
  if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))return authError(res,400,'Use a password with at least 8 characters, including a letter and a number.');
  if(!['customer','worker'].includes(role))return authError(res,400,'Choose customer or worker account type.');
  let serviceId=String(req.body?.profession||req.body?.tradeId||'');if(serviceId==='ac-repair')serviceId='electrician';if(serviceId==='maintenance')serviceId='mason';
  if(role==='worker'&&!sqlite.prepare('SELECT id FROM services WHERE id=? AND active=1').get(serviceId))return authError(res,400,'Choose a valid profession from the list.');
  if(!authAttemptAllowed(req,email))return authError(res,429,'Too many account attempts. Try again in 15 minutes.');
  const now=new Date().toISOString(),id=randomUUID();
  try {
    const hash=await bcrypt.hash(password,12);
    const register=sqlite.transaction(()=>{
      sqlite.prepare('INSERT INTO users(id,full_name,email,phone,password_hash,role,locality,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,fullName,email,phone,hash,role,String(req.body?.locality||'').trim()||null,now,now);
      if(role==='worker')sqlite.prepare('INSERT INTO workers(id,user_id,trade_id,locality,is_available,kyc_status,experience_years,half_day_rate,daily_rate,metadata,created_at,updated_at) VALUES(?,?,?,?,0,\'pending\',0,0,0,?,?,?)').run(randomUUID(),id,serviceId,String(req.body?.locality||'').trim()||null,JSON.stringify({tradeTitle:sqlite.prepare('SELECT name FROM services WHERE id=?').get(serviceId)?.name,isDemo:false}),now,now);
    }); register();
    await createAuthenticatedSession(req,currentUser(id),res);
  } catch(error){if(error.code==='SQLITE_CONSTRAINT_UNIQUE')return authError(res,409,'An account with this email or phone number already exists. Sign in or use different contact details.');console.error('[auth register]',error.message);return authError(res,500,'Account registration failed. Please try again.');}
});
app.post('/api/auth/login',async(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||'');
  if(!email||!password)return authError(res,400,'Enter your email and password.');
  if(!authAttemptAllowed(req,email))return authError(res,429,'Too many sign-in attempts. Try again in 15 minutes.');
  const row=sqlite.prepare('SELECT id,password_hash FROM users WHERE email=? COLLATE NOCASE').get(email);
  if(!row||!await bcrypt.compare(password,row.password_hash))return authError(res,401,'Email or password is incorrect.');
  const user=currentUser(row.id);if(user.is_suspended)return authError(res,403,'This account is suspended. Contact KaamConnect support.');
  try{await createAuthenticatedSession(req,user,res);}catch(error){console.error('[auth login]',error.message);return authError(res,500,'Unable to create your session. Please retry.');}
});
app.post('/api/auth/logout',(req,res)=>{req.session.destroy(error=>{if(error)return authError(res,500,'Unable to end your session.');res.clearCookie('kaamconnect.sid',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'});res.json({success:true,data:{loggedOut:true}});});});

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

const profileDatabaseFailure = (error, action) => {
  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.code === '23505') {
    return { status: 409, body: { success: false, code: error.code, message: 'This account or mobile number is already linked to an existing KaamConnect profile. Sign in to the linked account or use another number.' } };
  }
  if (error?.code === 'SQLITE_CONSTRAINT_CHECK' || error?.code === '23514') {
    return { status: 400, body: { success: false, code: error.code, message: 'The selected account role is not allowed.' } };
  }
  console.error(`[KaamConnect API] ${action} failed`, { code: error?.code || null, message: error?.message || 'Unknown database error' });
  return { status: 503, body: { success: false, code: error?.code || 'PROFILE_DATABASE_ERROR', message: `Unable to ${action}. Database error: ${error?.message || 'unknown error'}` } };
};
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

// SQLite health probes report the real local database state.
app.get('/api/health', (req,res)=>{
  try { const integrity=sqlite.pragma('quick_check').at(0)?.quick_check;if(integrity!=='ok')throw new Error('SQLite integrity check failed.');res.json({success:true,status:'ok',database:'sqlite',app:'KaamConnect Nadia API',timestamp:new Date().toISOString()}); }
  catch(error){res.status(503).json({success:false,status:'degraded',database:'sqlite',message:error.message});}
});
app.get('/api/health/database',(req,res)=>{try{sqlite.prepare('SELECT 1').get();res.json({success:true,connected:true,database:'sqlite',message:'SQLite database is ready.',timestamp:new Date().toISOString()});}catch(error){res.status(503).json({success:false,connected:false,database:'sqlite',message:error.message,timestamp:new Date().toISOString()});}});
// 2. Locations
app.get('/api/locations', async (req, res) => {
  if (databaseReady) {
    const { data, error } = await dbResult(db.from('locations').select('*').eq('active', true).order('name'));
    if (error) return res.status(503).json({ success: false, message: 'Unable to load locations from the database.' });
    return res.json({ success: true, data: data.map((item) => ({ ...item.metadata, id: item.id, name: item.name })) });
  }
  res.json({ success: true, data: locations });
});

// 3. Services & fair wage rates
app.get('/api/services', async (req, res) => {
  if (databaseReady) {
    const { data, error } = await dbResult(db.from('services').select('*, service_tasks(*)').eq('active', true).order('name'));
    if (error) return res.status(503).json({ success: false, message: 'Unable to load services from the database.' });
    return res.json({ success: true, data: data.map((item) => ({
      ...item.metadata, id: item.id, name: item.name, nameBn: item.name_bn, nameHi: item.name_hi,
      iconName: item.icon, tagline: item.description,
      popularTasks: (item.service_tasks || []).filter((task) => task.active).map((task) => ({ ...task.metadata, id: task.id, name: task.name, nameBn: task.name_bn, nameHi: task.name_hi, description: task.description, basePrice: Number(task.base_price) })),
    })) });
  }
  res.json({ success: true, data: services });
});

app.get('/api/electronics-care/catalog', async (_req, res) => {
  const { data, error } = await dbResult(db.from('services').select('*, service_tasks(*)').eq('active', true));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load configured appliance service prices.' });
  return res.json({ success: true, data: buildElectronicsCareCatalog(data) });
});

const workerFromDb = (row) => ({
  ...(row.metadata || {}), id: row.id, legacyId: row.legacy_id, ownerId: row.metadata?.ownerId,
  name: row.users?.full_name || row.metadata?.name || 'KaamConnect worker',
  nameBn: row.metadata?.nameBn || row.users?.full_name, nameHi: row.metadata?.nameHi || row.users?.full_name,
  phone: '', email: '', tradeId: row.trade_id,
  bio: row.bio || '', avatar: row.profile_photo_url || '', locality: row.locality || '',
  isAvailable: row.is_available, availability: row.is_available, kycStatus: row.kyc_status,
  kycVerified: row.kyc_status === 'verified', aadhaarVerified: row.aadhaar_verified,
  policeVerification: row.background_verified, experienceYears: row.experience_years,
  completedJobs: row.jobs_completed, rating: Number(row.rating_average), ratingCount: row.rating_count,
  halfDayRate: Number(row.half_day_rate), dailyRate: Number(row.daily_rate),
  skills: (row.worker_skills || []).map((skill) => skill.skill_name),
});
// Public discovery endpoints expose marketplace fields only. Ownership, contact,
// KYC review details and internal earnings stay on authenticated/admin APIs.
const redactContactText = (value) => String(value || '')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[contact hidden]')
  .replace(/(?<!\d)(?:\+\s*91[\s().-]*)?[6-9](?:[\s().-]*\d){9}(?!\d)/g, '[contact hidden]');
const publicWorker = (worker) => {
  const allowed = ['id', 'legacyId', 'name', 'nameBn', 'nameHi', 'tradeId', 'tradeTitle', 'bio', 'avatar', 'locality', 'isAvailable', 'availability', 'kycVerified', 'experienceYears', 'completedJobs', 'rating', 'ratingCount', 'halfDayRate', 'dailyRate', 'skills', 'distanceKm', 'languages', 'workingHours', 'categoryId'];
  const safe = Object.fromEntries(allowed.filter((key) => worker?.[key] !== undefined).map((key) => [key, worker[key]]));
  if (safe.bio) safe.bio = redactContactText(safe.bio);
  return safe;
};
const findWorkerDb = async (id) => {
  const column = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? 'id' : 'legacy_id';
  return dbResult(db.from('workers').select('*, users(*), worker_skills(*)').eq(column, id).maybeSingle());
};
const bookingFromDb = (row) => {
  const { customerPhone: _privatePhone, ...safeMetadata } = row.metadata || {};
  return ({
  ...safeMetadata, id: row.id, customerId: row.metadata?.customerId || row.customer_id,
  serviceId: row.service_id, serviceName: row.metadata?.serviceName || row.services?.name || row.service_id,
  taskId: row.task_id, taskName: row.service_tasks?.name || row.metadata?.taskName || '',
  workerId: row.worker_id, worker: row.workers ? workerFromDb(row.workers) : null,
  bookingType: row.booking_type, scheduledDate: row.scheduled_date, scheduledSlot: row.scheduled_slot,
  locality: row.locality, addressDetails: row.address_details, estimatedPriceMin: Number(row.estimated_price_min || 0),
  estimatedPriceMax: Number(row.estimated_price_max || 0), finalPrice: Number(row.final_price || 0),
  paymentMethod: row.payment_method, status: row.status, otp: row.otp, createdAt: row.created_at,
  });
};

const optionalAuth = async (req, res, next) => {
  const user=req.session?.userId?currentUser(req.session.userId):null;
  if(!user)return next();
  if(user.is_suspended)return res.status(403).json({success:false,message:'This account is suspended. Contact KaamConnect support.'});
  req.authUser={id:user.id,email:user.email,user_metadata:{full_name:user.full_name,phone:user.phone,role:user.role}};
  req.appProfile=user;
  next();
};

const requireAuth = (req, res, next) => optionalAuth(req, res, () => {
  if (!req.authUser) return res.status(401).json({ success: false, message: 'Sign in to your account to continue.' });
  if (!req.appProfile) return res.status(403).json({ success: false, message: 'Finish setting up your KaamConnect account first.' });
  next();
});

const requireAdmin = (req, res, next) => requireAuth(req, res, () => {
  if (req.appProfile.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access is required.' });
  next();
});

app.post('/api/workers/photo',requireAuth,(req,res,next)=>req.appProfile.role!=='worker'?res.status(403).json({success:false,message:'Worker account required.'}):next(),imageUpload.single('photo'),(req,res)=>{
  if(!req.file)return res.status(400).json({success:false,message:'Choose a JPG, PNG or WebP image under 5 MB.'});
  if(req.file.size>5*1024*1024){fs.unlinkSync(req.file.path);return res.status(413).json({success:false,message:'Profile photos must be under 5 MB.'});}
  res.json({success:true,data:{url:`/api/worker-avatars/${req.file.filename}`}});
});
app.post('/api/conversations/:id/attachments',requireAuth,(req,res,next)=>{
  const access=sqlite.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?').get(req.params.id,req.appProfile.id);
  if(!access)return res.status(404).json({success:false,message:'Conversation not found.'});
  chatImageUpload.single('photo')(req,res,(error)=>{if(error)return next(error);if(!req.file)return res.status(400).json({success:false,message:'Choose a JPG, PNG or WebP image under 8 MB.'});res.json({success:true,data:{attachmentPath:`${req.params.id}/${req.appProfile.id}/${req.file.filename}`}});});
});
app.get('/api/conversations/:id/attachments/:filename',requireAuth,(req,res)=>{
  const access=sqlite.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?').get(req.params.id,req.appProfile.id);
  if(!access)return res.sendStatus(404);
  const filename=path.basename(req.params.filename);
  const message=sqlite.prepare('SELECT attachment_url FROM messages WHERE conversation_id=? AND attachment_url LIKE ?').get(req.params.id,`%/${filename}`);
  if(!message)return res.sendStatus(404);
  const [conversationId,senderId,storedName]=message.attachment_url.split('/');if(conversationId!==req.params.id||storedName!==filename)return res.sendStatus(404);
  const file=path.join(uploadRoot,'chat-attachments',conversationId,senderId,filename);
  if(!fs.existsSync(file))return res.sendStatus(404);res.sendFile(file);
});

const contactSharingType = (text) => {
  const value = String(text || '');
  if (/\bwa\.me\/|whatsapp\.com\/(?:send|channel|invite)|\b(?:whats\s*app|whatsapp)\b.{0,60}\b(?:me|call|message|number|contact|reach|text|ping|invite|join|group)\b|\b(?:message|call|contact|text)\s+(?:me|us)\s+(?:on|at)\s+(?:whats\s*app|whatsapp)\b/i.test(value)) return 'whatsapp';
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) return 'email';
  if (/(?<!\d)(?:\+\s*91[\s().-]*)?[6-9](?:[\s().-]*\d){9}(?!\d)/.test(value)) return 'phone';
  return null;
};

const getConversationAccess = async (conversationId, userId) => {
  const membership = await dbResult(db.from('conversation_participants').select('id,last_read_at').eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle());
  if (membership.error || !membership.data) return { error: membership.error, membership: null, conversation: null };
  const conversation = await dbResult(db.from('conversations').select('*').eq('id', conversationId).maybeSingle());
  return { error: conversation.error, membership: membership.data, conversation: conversation.data };
};

const createConversationForBooking = async (booking) => {
  if (!booking?.customer_id || !booking?.worker_id) return null;
  const [worker, customer] = await Promise.all([
    dbResult(db.from('workers').select('user_id, users!workers_user_id_fkey(id)').eq('id', booking.worker_id).maybeSingle()),
    dbResult(db.from('users').select('id').eq('id', booking.customer_id).maybeSingle()),
  ]);
  if (worker.error || customer.error || !worker.data?.user_id || !worker.data.users?.id || !customer.data?.id) return null;
  return ensureConversation({ customerId: booking.customer_id, workerId: booking.worker_id, workerUserId: worker.data.user_id, jobId: booking.job_id, bookingId: booking.id });
};

const ensureConversation = async ({ customerId, workerId, workerUserId, jobId = null, bookingId = null }) => {
  let found = bookingId
    ? await dbResult(db.from('conversations').select('*').eq('booking_id', bookingId).maybeSingle())
    : { data: null, error: null };
  if (!found.data && jobId) found = await dbResult(db.from('conversations').select('*').eq('job_id', jobId).eq('worker_id', workerId).maybeSingle());
  let conversation = found.data;
  if (!conversation) {
    const inserted = await dbResult(db.from('conversations').insert({ customer_id: customerId, worker_id: workerId, job_id: jobId, booking_id: bookingId }).select('*').single());
    if (inserted.error) {
      const retry = bookingId
        ? await dbResult(db.from('conversations').select('*').eq('booking_id', bookingId).maybeSingle())
        : await dbResult(db.from('conversations').select('*').eq('job_id', jobId).eq('worker_id', workerId).maybeSingle());
      if (retry.error || !retry.data) return null;
      conversation = retry.data;
    } else conversation = inserted.data;
  } else if (bookingId && !conversation.booking_id) {
    const updated = await dbResult(db.from('conversations').update({ booking_id: bookingId, updated_at: new Date().toISOString() }).eq('id', conversation.id).select('*').single());
    if (!updated.error) conversation = updated.data;
  }
  if (conversation.customer_id !== customerId || conversation.worker_id !== workerId) return null;
  const members = [customerId, workerUserId].filter(Boolean);
  if (members.length !== 2) return null;
  const participantRows = await dbResult(db.from('users').select('id').in('id', members));
  if (participantRows.error || participantRows.data?.length !== 2) return null;
  const savedMembers = await dbResult(db.from('conversation_participants').upsert(members.map((user_id) => ({ conversation_id: conversation.id, user_id, joined_at: new Date().toISOString() })), { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }));
  if (savedMembers.error) return null;
  return conversation;
};

app.get('/api/account/profile', optionalAuth, async (req, res) => {
  if (!req.authUser) return res.status(401).json({ success: false, message: 'Sign in to view your KaamConnect account.' });
  if (!req.appProfile) return res.status(404).json({ success: false, message: 'KaamConnect account profile is not set up yet.' });
  let workerProfileComplete = false;
  if (req.appProfile.role === 'worker') {
    const worker = await dbResult(db.from('workers').select('id').eq('user_id', req.appProfile.id).maybeSingle());
    if (worker.error) return res.status(503).json({ success: false, message: 'Unable to check your worker profile.' });
    workerProfileComplete = Boolean(worker.data);
  }
  const { id, full_name, role, locality, phone, is_suspended } = req.appProfile;
  res.json({ success: true, data: { id, full_name, role, locality, phone, is_suspended, worker_profile_complete: workerProfileComplete } });
});

app.post('/api/account/profile', optionalAuth, async (req, res) => {
  if (!req.authUser) return res.status(401).json({ success: false, message: 'Sign in to set up your KaamConnect account.' });
  const fullName = String(req.body?.fullName || req.authUser.user_metadata?.full_name || '').trim();
  const role = String(req.body?.role || req.appProfile?.role || req.authUser.user_metadata?.role || 'customer');
  const phone = normalizeMobile(req.body?.phone || req.authUser.user_metadata?.phone || req.appProfile?.phone || '');
  if (fullName.length < 2 || fullName.length > 100) return res.status(400).json({ success: false, message: 'Enter a name between 2 and 100 characters.' });
  if (!isValidMobile(phone)) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
  if (!['customer', 'worker'].includes(role)) return res.status(400).json({ success: false, message: 'Choose customer or worker account type.' });
  let existing = req.appProfile;
  if (!existing) {
    const byAuthId = await dbResult(db.from('users').select('*').eq('id', req.authUser.id).maybeSingle());
    if (byAuthId.error) {
      const failure = profileDatabaseFailure(byAuthId.error, 'look up your KaamConnect account');
      return res.status(failure.status).json(failure.body);
    }
    existing = byAuthId.data;
  }
  if (existing && existing.role !== role) return res.status(409).json({ success: false, message: 'Account roles cannot be changed after registration.' });
  const values = {
    id: req.authUser.id,
    full_name: fullName, phone, email: req.authUser.email || null,
    role: existing?.role || role,
    updated_at: new Date().toISOString(),
  };
  const profileSave = db.from('users').upsert(values, { onConflict: 'id' });
  const { data, error } = await dbResult(profileSave.select('id,full_name,role,locality,phone,is_suspended').single());
  if (error) {
    const failure = profileDatabaseFailure(error, 'save your KaamConnect profile');
    return res.status(failure.status).json(failure.body);
  }
  res.json({ success: true, data });
});

// 4. Workers list with filters
app.get('/api/workers', async (req, res) => {
  const { trade, maxDistance, q } = req.query;
  if (databaseReady) {
    let query = db.from('workers').select('*, users(*), worker_skills(*)');
    if (trade && trade !== 'all') query = query.eq('trade_id', trade);
    const { data, error } = await dbResult(query.order('created_at'));
    if (error) {
      console.error('[GET /api/workers] SQLite query failed:', error.code || 'no-code', error.message || error);
      return res.status(503).json({ success: false, message: 'Unable to load workers from the database.' });
    }
    let rows = (data || []).map(workerFromDb).map(publicWorker);
    if (maxDistance && Number.isFinite(Number(maxDistance))) rows = rows.filter((worker) => Number(worker.distanceKm || 0) <= Number(maxDistance));
    if (q && q.trim()) {
      const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const catalog = await dbResult(db.from('services').select('id,name,service_tasks(name)').eq('active', true));
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

  res.json({ success: true, count: results.length, data: results.map(publicWorker) });
});

// 5. Register a worker profile linked to the authenticated account.
app.post('/api/workers/register', optionalAuth, async (req, res) => {
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

  if (databaseReady) {
    if (!req.authUser) return res.status(401).json({ success: false, message: 'Sign in to create a worker profile.' });
    if (!req.appProfile) return res.status(403).json({ success: false, message: 'Set up your KaamConnect worker account before creating a profile.' });
    if (req.appProfile && req.appProfile.role !== 'worker') return res.status(403).json({ success: false, message: 'Choose a worker account to register a worker profile.' });
    const tradeId = cleanTradeId === 'ac-repair' ? 'electrician' : cleanTradeId === 'maintenance' ? 'mason' : cleanTradeId;
    const service = await dbResult(db.from('services').select('id').eq('id', tradeId).eq('active', true).maybeSingle());
    if (service.error || !service.data) return res.status(400).json({ success: false, message: 'Choose an available profession.' });
    const userResult = req.appProfile
      ? await dbResult(db.from('users').update({ full_name: req.appProfile.full_name, phone: req.appProfile.phone, email: req.authUser.email || null, locality: cleanLocality, updated_at: new Date().toISOString() }).eq('id', req.appProfile.id).select('*').single())
      : { data: null, error: new Error('Worker accounts must be created through KaamConnect registration.') };
    const { data: user, error: userError } = userResult;
    if (userError) return res.status(userError.code === '23505' ? 409 : 503).json({ success: false, message: userError.code === '23505' ? 'A worker profile already uses this mobile number.' : 'Unable to create worker account.' });
    const profilePhoto = String(avatar || '').trim();
    const allowedPhotoPrefix = '/api/worker-avatars/';
    if (profilePhoto && !profilePhoto.startsWith(allowedPhotoPrefix)) return res.status(400).json({ success: false, message: 'Upload your profile photo using the KaamConnect photo control.' });
    const { data: row, error } = await dbResult(db.from('workers').upsert({ user_id: user.id, trade_id: tradeId, bio: String(bio || '').trim().slice(0, 500), profile_photo_url: profilePhoto, locality: cleanLocality, is_available: availability !== false, experience_years: years, half_day_rate: halfRate, daily_rate: fullRate, metadata: { ownerId: String(req.appProfile.id), tradeTitle: cleanTradeTitle, workingHours: String(workingHours || '09:00 AM - 07:00 PM'), isDemo: false, workerRegistrationComplete: true } }, { onConflict: 'user_id' }).select('*, users(*)').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to save worker profile.' });
    await dbResult(db.from('worker_skills').delete().eq('worker_id', row.id));
    const skillRows = cleanSkills.map((skill) => ({ worker_id: row.id, skill_name: skill }));
    const skillsResult = skillRows.length ? await dbResult(db.from('worker_skills').insert(skillRows)) : { error: null };
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

app.get('/api/workers/me', requireAuth, async (req, res) => {
  if (req.appProfile.role !== 'worker') return res.status(403).json({ success: false, message: 'A worker account is required.' });
  const result = await dbResult(db.from('workers').select('*, users(*), worker_skills(*)').eq('user_id', req.appProfile.id).maybeSingle());
  if (result.error) return res.status(503).json({ success: false, message: 'Unable to load your worker profile.' });
  if (!result.data) return res.status(404).json({ success: false, message: 'Complete your worker profile first.' });
  res.json({ success: true, data: workerFromDb(result.data) });
});

// 6. Worker single details
app.get('/api/workers/:id', async (req, res) => {
  if (databaseReady) {
    const { data, error } = await dbResult(db.from('workers').select('*, users(*), worker_skills(*)').or(`id.eq.${req.params.id},legacy_id.eq.${req.params.id}`).maybeSingle());
    if (error) return res.status(503).json({ success: false, message: 'Unable to load worker.' });
    if (!data) return res.status(404).json({ success: false, message: 'Worker not found' });
    return res.json({ success: true, data: publicWorker(workerFromDb(data)) });
  }
  const worker = workers.find((w) => w.id === req.params.id);
  if (!worker) {
    return res.status(404).json({ success: false, message: 'Worker not found' });
  }
  res.json({ success: true, data: publicWorker(worker) });
});

app.patch('/api/workers/:id/profile', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'worker') return res.status(403).json({ success: false, message: 'A signed-in worker account is required.' });
    const found = await findWorkerDb(req.params.id);
    if (found.error || !found.data) return res.status(found.error ? 503 : 404).json({ success: false, message: found.error ? 'Unable to load worker.' : 'Worker not found' });
    if (found.data.user_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'You can only edit your own worker profile.' });
    const body = req.body || {};
    if (body.phone !== undefined && !isValidMobile(body.phone)) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
    const skills = body.skills === undefined ? null : (Array.isArray(body.skills) ? body.skills : String(body.skills).split(',')).map((item) => String(item).trim()).filter(Boolean);
    const userUpdate = {};
    if (body.name !== undefined) userUpdate.full_name = String(body.name).trim();
    if (body.locality !== undefined) userUpdate.locality = String(body.locality).trim();
    if (Object.keys(userUpdate).length) {
      const userResult = await dbResult(db.from('users').update({ ...userUpdate, updated_at: new Date().toISOString() }).eq('id', found.data.user_id));
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
    const { error } = await dbResult(db.from('workers').update(update).eq('id', found.data.id));
    if (error) return res.status(503).json({ success: false, message: 'Unable to save worker profile.' });
    if (skills) {
      const removed = await dbResult(db.from('worker_skills').delete().eq('worker_id', found.data.id));
      if (removed.error) return res.status(503).json({ success: false, message: 'Profile saved, but skills could not be updated.' });
      if (skills.length) {
        const saved = await dbResult(db.from('worker_skills').insert(skills.map((skill_name) => ({ worker_id: found.data.id, skill_name }))));
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

app.get('/api/workers/:id/jobs', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'worker') return res.status(403).json({ success: false, message: 'A signed-in worker account is required.' });
    const worker = await findWorkerDb(req.params.id);
    if (worker.error || !worker.data) return res.status(worker.error ? 503 : 404).json({ success: false, message: 'Worker not found.' });
    if (worker.data.user_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'You can only view your own worker jobs.' });
    const { data, error } = await dbResult(db.from('bookings').select('*, services(name), service_tasks(name)').eq('worker_id', worker.data.id).order('created_at', { ascending: false }));
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
app.patch('/api/workers/:id/kyc', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access is required.' });
    const found = await findWorkerDb(req.params.id);
    if (found.error || !found.data) return res.status(found.error ? 503 : 404).json({ success: false, message: found.error ? 'Unable to load worker.' : 'Worker not found' });
    const verified = Boolean(req.body.kycVerified ?? (found.data.kyc_status !== 'verified'));
    const { data, error } = await dbResult(db.from('workers').update({ kyc_status: verified ? 'verified' : 'suspended', identity_verified: verified, aadhaar_verified: verified, updated_at: new Date().toISOString() }).eq('id', found.data.id).select('*, users(*), worker_skills(*)').single());
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
app.patch('/api/workers/:id/duty', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'worker') return res.status(403).json({ success: false, message: 'A signed-in worker account is required.' });
    const found = await findWorkerDb(req.params.id);
    if (found.error || !found.data) return res.status(found.error ? 503 : 404).json({ success: false, message: found.error ? 'Unable to load worker.' : 'Worker not found' });
    if (found.data.user_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'You can only change your own availability.' });
    const available = req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : !found.data.is_available;
    const { data, error } = await dbResult(db.from('workers').update({ is_available: available, last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', found.data.id).select('*, users(*), worker_skills(*)').single());
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
app.patch('/api/workers/:id/rates', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'worker') return res.status(403).json({ success: false, message: 'A signed-in worker account is required.' });
    const found = await findWorkerDb(req.params.id);
    if (found.error || !found.data) return res.status(found.error ? 503 : 404).json({ success: false, message: found.error ? 'Unable to load worker.' : 'Worker not found' });
    if (found.data.user_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'You can only edit your own service rates.' });
    const half = req.body.halfDayRate === undefined ? Number(found.data.half_day_rate) : Number(req.body.halfDayRate);
    const daily = req.body.dailyRate === undefined ? Number(found.data.daily_rate) : Number(req.body.dailyRate);
    if (![half, daily].every((value) => Number.isFinite(value) && value >= 0 && value <= 200000)) return res.status(400).json({ success: false, message: 'Enter valid non-negative rates.' });
    const { data, error } = await dbResult(db.from('workers').update({ half_day_rate: half, daily_rate: daily, updated_at: new Date().toISOString() }).eq('id', found.data.id).select('*, users(*), worker_skills(*)').single());
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

// Home Electronics Care is stored as one parent booking; its priced appliance lines live in metadata.
app.post('/api/electronics-care/bookings', optionalAuth, async (req, res) => {
  if (!req.authUser || !req.appProfile) return res.status(401).json({ success: false, message: 'Sign in with a KaamConnect customer account to request a visit.' });
  if (req.appProfile.role !== 'customer') return res.status(403).json({ success: false, message: 'Only customer accounts can request Home Electronics Care.' });
  const { data: serviceRows, error: catalogError } = await dbResult(db.from('services').select('*, service_tasks(*)').eq('active', true));
  if (catalogError) return res.status(503).json({ success: false, message: 'Unable to validate configured appliance service prices.' });
  const catalog = buildElectronicsCareCatalog(serviceRows);
  const checked = validateElectronicsCareRequest(req.body, catalog);
  if (checked.error) return res.status(400).json({ success: false, message: checked.error });
  const request = checked.value;
  const summary = request.lineItems.map((line) => `${line.quantity} × ${line.applianceName}`).join(', ');
  const electronicsCare = {
    lineItems: request.lineItems,
    subtotal: request.subtotal,
    knownSubtotal: request.knownSubtotal,
    estimatedTotal: request.estimatedTotal,
    hasQuotation: request.hasQuotation,
    currency: 'INR',
    pricesAreProvisional: true,
    appointmentStatus: 'requested',
    assignmentStatus: 'awaiting_team_assignment',
    teamCategories: request.teamCategories,
    pricingNotice: request.pricingNotice,
    quotationMessage: request.quotationMessage,
  };

  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    customer_id: req.appProfile.id,
    worker_id: null,
    service_id: 'electrician',
    task_id: null,
    booking_type: 'scheduled',
    scheduled_date: request.requestedDate,
    scheduled_slot: `${request.requestedTime} (requested, not confirmed)`,
    locality: request.locality,
    address_details: request.addressDetails,
    estimated_price_min: request.estimatedTotal,
    estimated_price_max: request.estimatedTotal,
    final_price: null,
    payment_method: 'quote-after-assessment',
    status: 'pending',
    metadata: {
      customerId: req.appProfile.id,
      customerName: req.appProfile.full_name,
      serviceName: 'Home Electronics Care',
      taskName: summary,
      electronicsCare,
    },
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await dbResult(db.from('bookings').insert(row)
    .select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
  if (error) return res.status(503).json({ success: false, message: 'Unable to save this Home Electronics Care request.' });
  return res.status(201).json({ success: true, data: bookingFromDb(data) });
});

// 9. Bookings list
app.get('/api/bookings', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.appProfile) return res.status(401).json({ success: false, message: 'Sign in to view bookings.' });
    let query = db.from('bookings').select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').order('created_at', { ascending: false });
    if (req.appProfile.role === 'customer') query = query.eq('customer_id', req.appProfile.id);
    else if (req.appProfile.role === 'worker') {
      const worker = await dbResult(db.from('workers').select('id').eq('user_id', req.appProfile.id).maybeSingle());
      if (worker.error || !worker.data) return res.status(403).json({ success: false, message: 'A registered worker profile is required.' });
      query = query.eq('worker_id', worker.data.id);
    } else if (req.appProfile.role !== 'admin') return res.status(403).json({ success: false, message: 'You cannot view these bookings.' });
    const { data, error } = await dbResult(query);
    if (error) return res.status(503).json({ success: false, message: 'Unable to load bookings.' });
    return res.json({ success: true, count: data.length, data: data.map(bookingFromDb) });
  }
  const customerId = String(req.query.customerId || '').trim();
  const results = customerId ? bookings.filter((booking) => booking.customerId === customerId) : bookings;
  res.json({ success: true, count: results.length, data: results });
});

// 10. Create new booking
app.post('/api/bookings', optionalAuth, async (req, res) => {
  if (databaseReady) {
    const body = req.body || {};
    if (!req.authUser || !req.appProfile) return res.status(401).json({ success: false, message: 'Sign in with a customer account to book a service.' });
    if (req.appProfile.role !== 'customer') return res.status(403).json({ success: false, message: 'Only customer accounts can book a service.' });
    const { data: service, error: serviceError } = await dbResult(db.from('services').select('id,name').eq('id', body.serviceId).eq('active', true).maybeSingle());
    if (serviceError || !service) return res.status(400).json({ success: false, message: 'Choose a valid service.' });
    const { data: task, error: taskError } = await dbResult(db.from('service_tasks').select('id,name,base_price').eq('id', body.taskId).eq('service_id', service.id).maybeSingle());
    if (taskError || !task) return res.status(400).json({ success: false, message: 'Choose a valid service task.' });
    const customer = { data: req.appProfile, error: null };
    if (customer.error) return res.status(503).json({ success: false, message: 'Unable to save customer account.' });
    let worker = null;
    if (body.workerId) {
      const found = await findWorkerDb(String(body.workerId));
      if (!found.error) worker = found.data;
    }
    if (!worker) {
      const found = await dbResult(db.from('workers').select('*').eq('trade_id', service.id).eq('is_available', true).limit(1).maybeSingle());
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
      metadata: { customerId: req.appProfile?.id || body.customerId || 'demo-customer-1', customerName: req.appProfile?.full_name || body.customerName || customer.data.full_name },
    };
    const { data, error } = await dbResult(db.from('bookings').insert(row).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
    if (error) return res.status(503).json({ success: false, message: 'Unable to create booking.' });
    const conversation = await createConversationForBooking(data);
    return res.status(201).json({ success: true, message: 'Booking placed & worker dispatched', data: { ...bookingFromDb(data), conversationId: conversation?.id || null } });
  }
  const {
    customerName,
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
app.patch('/api/bookings/:id/status', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'worker') return res.status(403).json({ success: false, message: 'Only the assigned worker can update booking status.' });
    if (!isValidStatus(req.body?.status)) return res.status(400).json({ success: false, message: 'Unsupported booking status.' });
    const worker = await dbResult(db.from('workers').select('id').eq('user_id', req.appProfile.id).maybeSingle());
    if (worker.error || !worker.data) return res.status(403).json({ success: false, message: 'A worker profile is required.' });
    const current = await dbResult(db.from('bookings').select('status').eq('id', req.params.id).eq('worker_id', worker.data.id).maybeSingle());
    if (current.error || !current.data) return res.status(current.error ? 503 : 404).json({ success: false, message: current.error ? 'Unable to load booking.' : 'Booking not found.' });
    if (current.data.status !== req.body.status && !statusTransitions[current.data.status]?.includes(req.body.status)) return res.status(409).json({ success: false, message: `Cannot move booking from ${current.data.status} to ${req.body.status}.` });
    const { data, error } = await dbResult(db.from('bookings').update({ status: req.body.status, updated_at: new Date().toISOString(), completed_at: req.body.status === 'completed' ? new Date().toISOString() : null }).eq('id', req.params.id).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
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

app.patch('/api/bookings/:id/cancel', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'customer') return res.status(403).json({ success: false, message: 'Only the booking customer can cancel this job.' });
    const current = await dbResult(db.from('bookings').select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').eq('id', req.params.id).maybeSingle());
    if (current.error || !current.data) return res.status(current.error ? 503 : 404).json({ success: false, message: current.error ? 'Unable to load booking.' : 'Booking not found.' });
    if (req.appProfile.id !== current.data.customer_id) return res.status(403).json({ success: false, message: 'Only the booking customer can cancel this job.' });
    if (!['pending', 'confirmed', 'en_route'].includes(current.data.status)) return res.status(409).json({ success: false, message: 'This job can no longer be cancelled.' });
    const { data, error } = await dbResult(db.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
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

app.patch('/api/bookings/:id/worker-status', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'worker') return res.status(403).json({ success: false, message: 'Only the assigned worker can update this job.' });
    const current = await dbResult(db.from('bookings').select('*, workers(*)').eq('id', req.params.id).maybeSingle());
    if (current.error || !current.data) return res.status(current.error ? 503 : 404).json({ success: false, message: current.error ? 'Unable to load booking.' : 'Booking not found.' });
    if (current.data.workers?.user_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'Only the assigned worker can update this job.' });
    const status = req.body?.status;
    if (!isValidStatus(status) || !statusTransitions[current.data.status]?.includes(status)) return res.status(409).json({ success: false, message: `Cannot move booking from ${current.data.status} to ${status}.` });
    const { data, error } = await dbResult(db.from('bookings').update({ status, updated_at: new Date().toISOString(), completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', req.params.id).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
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
app.post('/api/bookings/:id/review', optionalAuth, async (req, res) => {
  if (databaseReady) {
    if (!req.authUser || req.appProfile?.role !== 'customer') return res.status(403).json({ success: false, message: 'Only a signed-in customer can leave a review.' });
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    const booking = await dbResult(db.from('bookings').select('*').eq('id', req.params.id).maybeSingle());
    if (booking.error || !booking.data) return res.status(booking.error ? 503 : 404).json({ success: false, message: 'Booking not found.' });
    if (req.appProfile.id !== booking.data.customer_id) return res.status(403).json({ success: false, message: 'Only the booking customer can leave a review.' });
    if (!booking.data.worker_id) return res.status(409).json({ success: false, message: 'This booking has no assigned worker.' });
    const { data: review, error } = await dbResult(db.from('reviews').insert({ booking_id: booking.data.id, customer_id: booking.data.customer_id, worker_id: booking.data.worker_id, rating, review_text: String(req.body?.reviewComment || '').slice(0, 2000) }).select('*').single());
    if (error) return res.status(error.code === '23505' ? 409 : 503).json({ success: false, message: error.code === '23505' ? 'This booking already has a review.' : 'Unable to save review.' });
    const updated = await dbResult(db.from('bookings').update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: { ...booking.data.metadata, rating, tipAmount: Number(req.body?.tipAmount) || 0, reviewComment: req.body?.reviewComment || '' } }).eq('id', booking.data.id).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
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
  if (databaseReady) {
    const [workerRows, bookingRows, jobRows] = await Promise.all([
      dbResult(db.from('workers').select('id,is_available,locality')),
      dbResult(db.from('bookings').select('id,status,created_at')),
      dbResult(db.from('jobs').select('id,status,created_at')),
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

// Customer-posted jobs and worker offers (SQLite-backed when configured).
app.post('/api/jobs', requireAuth, async (req, res) => {

  if (req.appProfile.role !== 'customer') return res.status(403).json({ success: false, message: 'Only customer accounts can post jobs.' });
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const serviceId = String(body.serviceId || '').trim();
  const locality = String(body.locality || '').trim();
  if (title.length < 3 || !serviceId || locality.length < 2) return res.status(400).json({ success: false, message: 'Enter a job title, service and location.' });
  if (contactSharingType(`${title}\n${body.description || ''}\n${body.addressDetails || ''}`)) return res.status(422).json({ success: false, code: 'CONTACT_DETAILS_BLOCKED', message: 'To protect your privacy and keep your booking secure, please communicate through KaamConnect.' });
  const service = await dbResult(db.from('services').select('id').eq('id', serviceId).eq('active', true).maybeSingle());
  if (service.error || !service.data) return res.status(400).json({ success: false, message: 'Choose a valid service.' });
  const record = {
    customer_id: req.appProfile.id, service_id: serviceId, task_id: body.taskId || null,
    title, description: String(body.description || '').slice(0, 4000), photo_url: body.photoUrl || null,
    locality, address_details: String(body.addressDetails || ''), urgency: ['normal', 'urgent', 'emergency'].includes(body.urgency) ? body.urgency : 'normal',
    preferred_date: body.preferredDate || null, preferred_time: body.preferredTime || null,
    estimated_price_min: Number(body.estimatedPriceMin) || null, estimated_price_max: Number(body.estimatedPriceMax) || null,
  };
  const { data, error } = await dbResult(db.from('jobs').insert(record).select('*').single());
  if (error) return res.status(503).json({ success: false, message: 'Unable to post this job.' });
  res.status(201).json({ success: true, message: 'Job posted successfully.', data });
});

app.get('/api/jobs', optionalAuth, async (req, res) => {

  let query = db.from('jobs').select('*, services(name), service_tasks(name)').order('created_at', { ascending: false });
  if (req.appProfile?.role === 'customer') query = query.eq('customer_id', req.appProfile.id);
  else if (req.appProfile?.role === 'worker') {
    const worker = await dbResult(db.from('workers').select('trade_id,user_id').eq('user_id', req.appProfile.id).maybeSingle());
    if (worker.error || !worker.data) return res.status(403).json({ success: false, message: 'A registered worker profile is required to browse jobs.' });
    query = query.eq('service_id', worker.data.trade_id).eq('status', 'open');
  } else query = query.eq('status', 'open');
  const { data, error } = await dbResult(query);
  if (error) {
    console.error('[GET /api/jobs] SQLite query failed:', error.code || 'no-code', error.message || error);
    return res.status(503).json({ success: false, message: 'Unable to load jobs.' });
  }
  const safeData = (data || []).map(({ customer_id, address_details, latitude, longitude, photo_url, ...job }) => ({ ...job, description: redactContactText(job.description) }));
  res.json({ success: true, count: safeData.length, data: safeData });
});

app.get('/api/jobs/:id/offers', requireAuth, async (req, res, next) => {
  if (req.params.id === 'incoming') return next();

  const { data, error } = await dbResult(db.from('job_offers').select('*, workers(*, users(*))').eq('job_id', req.params.id).order('created_at'));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load job offers.' });
  const job = await dbResult(db.from('jobs').select('customer_id').eq('id', req.params.id).maybeSingle());
  const ownWorker = req.appProfile.role === 'worker' ? await dbResult(db.from('workers').select('id').eq('user_id', req.appProfile.id).maybeSingle()) : null;
  if (job.error || !job.data) return res.status(job.error ? 503 : 404).json({ success: false, message: 'Job not found.' });
  if (req.appProfile.id !== job.data.customer_id && (!ownWorker?.data || !data.some((offer) => offer.worker_id === ownWorker.data.id))) return res.status(403).json({ success: false, message: 'You cannot view these job offers.' });
  const visibleOffers = req.appProfile.role === 'customer' ? data : data.filter((offer) => offer.worker_id === ownWorker?.data?.id);
  res.json({ success: true, data: visibleOffers.map((offer) => ({ id: offer.id, offeredPrice: offer.offered_price, message: offer.message, status: offer.status, worker: offer.workers ? workerFromDb(offer.workers) : null })) });
});

app.get('/api/jobs/:id', optionalAuth, async (req, res, next) => {
  if (req.params.id === 'incoming') return next();

  const { data, error } = await dbResult(db.from('jobs').select('*, services(name), service_tasks(name)').eq('id', req.params.id).maybeSingle());
  if (error) return res.status(503).json({ success: false, message: 'Unable to load job.' });
  if (!data) return res.status(404).json({ success: false, message: 'Job not found.' });
  const isOwner = req.appProfile?.id === data.customer_id;
  if (!isOwner) {
    if (data.status !== 'open') return res.status(404).json({ success: false, message: 'Open job not found.' });
    const { customer_id, address_details, latitude, longitude, photo_url, ...safe } = data;
    safe.description = redactContactText(safe.description);
    return res.json({ success: true, data: safe });
  }
  res.json({ success: true, data });
});

app.patch('/api/jobs/:id', requireAuth, async (req, res, next) => {
  if (req.params.id === 'incoming') return next();

  if (req.appProfile.role !== 'customer') return res.status(403).json({ success: false, message: 'Only customer accounts can manage posted jobs.' });
  const existing = await dbResult(db.from('jobs').select('*').eq('id', req.params.id).maybeSingle());
  if (existing.error || !existing.data) return res.status(existing.error ? 503 : 404).json({ success: false, message: existing.error ? 'Unable to load job.' : 'Job not found.' });
  if (existing.data.customer_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'You can only manage jobs you posted.' });
  const allowed = ['title', 'description', 'photo_url', 'locality', 'address_details', 'urgency', 'preferred_date', 'preferred_time', 'status'];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (updates.status && !['open', 'assigned', 'in_progress', 'completed', 'cancelled'].includes(updates.status)) return res.status(400).json({ success: false, message: 'Unsupported job status.' });
  if (updates.status && updates.status !== existing.data.status) {
    const transitions = { open: ['cancelled'], assigned: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [] };
    if (!transitions[existing.data.status]?.includes(updates.status)) return res.status(409).json({ success: false, message: `Cannot move job from ${existing.data.status} to ${updates.status}.` });
  }
  if (updates.title !== undefined && String(updates.title).trim().length < 3) return res.status(400).json({ success: false, message: 'Enter a job title with at least 3 characters.' });
  if (updates.urgency !== undefined && !['normal', 'urgent', 'emergency'].includes(updates.urgency)) return res.status(400).json({ success: false, message: 'Choose a valid urgency.' });
  if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'Provide at least one job update.' });
  updates.updated_at = new Date().toISOString();
  const { data, error } = await dbResult(db.from('jobs').update(updates).eq('id', req.params.id).eq('customer_id', req.appProfile.id).select('*').maybeSingle());
  if (error) return res.status(503).json({ success: false, message: 'Unable to update job.' });
  if (!data) return res.status(404).json({ success: false, message: 'Job not found.' });
  res.json({ success: true, data });
});

app.post('/api/jobs/:id/offers', requireAuth, async (req, res) => {

  if (req.appProfile.role !== 'worker') return res.status(403).json({ success: false, message: 'Only worker accounts can respond to jobs.' });
  const amount = Number(req.body?.offeredPrice);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, message: 'Enter a valid offer price.' });
  const job = await dbResult(db.from('jobs').select('id,status,customer_id,service_id,locality').eq('id', req.params.id).maybeSingle());
  if (job.error || !job.data) return res.status(job.error ? 503 : 404).json({ success: false, message: job.error ? 'Unable to load job.' : 'Job not found.' });
  if (job.data.status !== 'open') return res.status(409).json({ success: false, message: 'This job is no longer accepting offers.' });
  const worker = await dbResult(db.from('workers').select('*, users(*)').eq('user_id', req.appProfile.id).maybeSingle());
  if (worker.error || !worker.data) return res.status(400).json({ success: false, message: 'Choose a valid worker.' });
  if (worker.data.trade_id !== job.data.service_id) return res.status(403).json({ success: false, message: 'This job does not match your registered trade.' });
  const note = String(req.body?.message || '').trim().slice(0, 1000);
  const detection = contactSharingType(note);
  if (detection) {
    const conversation = await ensureConversation({ customerId: job.data.customer_id, workerId: worker.data.id, workerUserId: req.appProfile.id, jobId: job.data.id });
    if (conversation) await dbResult(db.from('contact_sharing_attempts').insert({ conversation_id: conversation.id, sender_id: req.appProfile.id, detection_type: detection }));
    return res.status(422).json({ success: false, code: 'CONTACT_DETAILS_BLOCKED', message: 'To protect your privacy and keep your booking secure, please communicate through KaamConnect.' });
  }
  const { data, error } = await dbResult(db.from('job_offers').upsert({ job_id: job.data.id, worker_id: worker.data.id, offered_price: amount, message: note, status: 'pending' }, { onConflict: 'job_id,worker_id' }).select('*').single());
  if (error) return res.status(503).json({ success: false, message: 'Unable to submit offer.' });
  const conversation = await ensureConversation({ customerId: job.data.customer_id, workerId: worker.data.id, workerUserId: req.appProfile.id, jobId: job.data.id });
  res.status(201).json({ success: true, data: { ...data, conversationId: conversation?.id || null } });
});

app.post('/api/jobs/:id/accept-offer', requireAuth, async (req, res) => {

  const offer = await dbResult(db.from('job_offers').select('*, jobs(*)').eq('id', req.body?.offerId).eq('job_id', req.params.id).maybeSingle());
  if (offer.error || !offer.data) return res.status(404).json({ success: false, message: 'Offer not found.' });
  if (offer.data.jobs.status !== 'open') return res.status(409).json({ success: false, message: 'This job has already been assigned.' });
  if (req.appProfile.role !== 'customer' || req.appProfile.id !== offer.data.jobs.customer_id) return res.status(403).json({ success: false, message: 'Only the customer who posted this job can accept an offer.' });
  const jobUpdate = await dbResult(db.from('jobs').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('status', 'open').select('*').maybeSingle());
  if (jobUpdate.error || !jobUpdate.data) return res.status(409).json({ success: false, message: 'This job has already been assigned.' });
  await dbResult(db.from('job_offers').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', offer.data.id));
  await dbResult(db.from('job_offers').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('job_id', req.params.id).neq('id', offer.data.id).eq('status', 'pending'));
  const job = offer.data.jobs;
  const { data: booking, error: bookingError } = await dbResult(db.from('bookings').insert({
    job_id: job.id, customer_id: job.customer_id, worker_id: offer.data.worker_id, service_id: job.service_id,
    task_id: job.task_id, booking_type: job.preferred_date ? 'scheduled' : 'immediate', scheduled_date: job.preferred_date,
    scheduled_slot: job.preferred_time, locality: job.locality, address_details: job.address_details,
    estimated_price_min: job.estimated_price_min, estimated_price_max: job.estimated_price_max,
    final_price: offer.data.offered_price, payment_method: 'upi', status: 'confirmed',
    otp: String(Math.floor(1000 + Math.random() * 9000)), metadata: { customerId: req.appProfile.id, customerName: req.appProfile.full_name },
  }).select('*, services(name), service_tasks(name), workers(*, users(*), worker_skills(*))').single());
  if (bookingError) return res.status(503).json({ success: false, message: 'Offer was accepted, but its booking could not be created. Contact support before retrying.' });
  const conversation = await createConversationForBooking(booking);
  res.json({ success: true, data: { job: jobUpdate.data, offer: { ...offer.data, status: 'accepted' }, booking: { ...bookingFromDb(booking), conversationId: conversation?.id || null } } });
});

app.post('/api/reviews', requireAuth, async (req, res) => {

  if (req.appProfile.role !== 'customer') return res.status(403).json({ success: false, message: 'Only customer accounts can leave a review.' });
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
  const booking = await dbResult(db.from('bookings').select('*').eq('id', req.body?.bookingId).maybeSingle());
  if (booking.error || !booking.data) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.data.customer_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'Only the booking customer can leave a review.' });
  if (booking.data.status !== 'completed') return res.status(409).json({ success: false, message: 'Complete the booking before leaving a review.' });
  const { data, error } = await dbResult(db.from('reviews').insert({ booking_id: booking.data.id, customer_id: booking.data.customer_id, worker_id: booking.data.worker_id, rating, review_text: String(req.body?.reviewText || '').slice(0, 2000) }).select('*').single());
  if (error) return res.status(error.code === '23505' ? 409 : 503).json({ success: false, message: error.code === '23505' ? 'This booking already has a review.' : 'Unable to save review.' });
  res.status(201).json({ success: true, data });
});

app.get('/api/workers/:id/reviews', async (req, res) => {

  const worker = await findWorkerDb(req.params.id);
  if (worker.error || !worker.data) return res.status(worker.error ? 503 : 404).json({ success: false, message: 'Worker not found.' });
  const { data, error } = await dbResult(db.from('reviews').select('id,rating,review_text,created_at').eq('worker_id', worker.data.id).order('created_at', { ascending: false }));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load reviews.' });
  res.json({ success: true, data: (data || []).map((review) => ({ ...review, review_text: redactContactText(review.review_text) })) });
});

app.get('/api/workers/:id/history', requireAuth, async (req, res) => {

  const worker = await findWorkerDb(req.params.id);
  if (worker.error || !worker.data) return res.status(worker.error ? 503 : 404).json({ success: false, message: 'Worker not found.' });
  if (req.appProfile.role !== 'admin' && (req.appProfile.role !== 'worker' || worker.data.user_id !== req.appProfile.id)) return res.status(403).json({ success: false, message: 'You can only view your own worker history.' });
  const { data, error } = await dbResult(db.from('bookings').select('*, services(name), service_tasks(name)').eq('worker_id', worker.data.id).order('created_at', { ascending: false }));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load worker history.' });
  res.json({ success: true, data });
});

app.get('/api/workers/:id/stats', requireAuth, async (req, res) => {

  const worker = await findWorkerDb(req.params.id);
  if (worker.error || !worker.data) return res.status(worker.error ? 503 : 404).json({ success: false, message: 'Worker not found.' });
  if (req.appProfile.role !== 'admin' && (req.appProfile.role !== 'worker' || worker.data.user_id !== req.appProfile.id)) return res.status(403).json({ success: false, message: 'You can only view your own worker statistics.' });
  const { data, error } = await dbResult(db.from('bookings').select('status, final_price').eq('worker_id', worker.data.id));
  if (error) return res.status(503).json({ success: false, message: 'Unable to load worker statistics.' });
  res.json({ success: true, data: { completedJobs: data.filter((item) => item.status === 'completed').length, totalJobs: data.length, ratingAverage: Number(worker.data.rating_average), ratingCount: worker.data.rating_count, earnings: data.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.final_price || 0), 0) } });
});

const chatWindowLimit = async (userId) => {
  const now=Date.now(),row=sqlite.prepare('SELECT window_started_at,message_count FROM chat_rate_limits WHERE user_id=?').get(userId);
  if(!row || now-new Date(row.window_started_at).getTime()>60000){sqlite.prepare('INSERT INTO chat_rate_limits(user_id,window_started_at,message_count) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET window_started_at=excluded.window_started_at,message_count=1').run(userId,new Date(now).toISOString());return true;}
  if(row.message_count>=30)return false;sqlite.prepare('UPDATE chat_rate_limits SET message_count=message_count+1 WHERE user_id=?').run(userId);return true;
};

const conversationSummary = async (conversation, appUserId) => {
  const isCustomer = conversation.customer_id === appUserId;
  const [jobResult, bookingResult, workerResult, customerResult, lastResult, unreadResult] = await Promise.all([
    conversation.job_id ? dbResult(db.from('jobs').select('id,title,locality,status').eq('id', conversation.job_id).maybeSingle()) : { data: null, error: null },
    conversation.booking_id ? dbResult(db.from('bookings').select('id,status,final_price,locality,service_id,task_id').eq('id', conversation.booking_id).maybeSingle()) : { data: null, error: null },
    dbResult(db.from('workers').select('id,user_id,profile_photo_url,kyc_status,trade_id,metadata').eq('id', conversation.worker_id).maybeSingle()),
    dbResult(db.from('users').select('id,full_name').eq('id', conversation.customer_id).maybeSingle()),
    dbResult(db.from('messages').select('id,message_type,message_text,created_at,sender_id').eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(1).maybeSingle()),
    dbResult(db.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversation.id).eq('is_read', false).neq('sender_id', appUserId)),
  ]);
  if ([jobResult, bookingResult, workerResult, customerResult, lastResult, unreadResult].some((result) => result.error)) throw new Error('Unable to load conversation details.');
  const worker = workerResult.data;
  const workerUser = worker?.user_id ? await dbResult(db.from('users').select('id,full_name').eq('id', worker.user_id).maybeSingle()) : { data: null, error: null };
  if (workerUser.error) throw new Error('Unable to load worker account.');
  const peer = isCustomer
    ? { name: workerUser.data?.full_name || 'KaamConnect worker', avatar: worker?.profile_photo_url || '', verified: worker?.kyc_status === 'verified', tradeId: worker?.trade_id }
    : { name: customerResult.data?.full_name || 'KaamConnect customer', avatar: '', verified: false };
  const last = lastResult.data;
  return {
    id: conversation.id, status: conversation.status, jobId: conversation.job_id, bookingId: conversation.booking_id,
    createdAt: conversation.created_at, lastMessageAt: conversation.last_message_at,
    peer, job: jobResult.data, booking: bookingResult.data,
    lastMessage: last ? { type: last.message_type, text: last.message_type === 'text' ? last.message_text : last.message_type === 'image' ? 'Photo' : last.message_type === 'quote' ? 'Quotation' : 'Update', createdAt: last.created_at, sentByMe: last.sender_id === appUserId } : null,
    unreadCount: unreadResult.count || 0,
  };
};

const messageOutput = async (message, quotation = null) => {
  let attachmentUrl = null;
  if (message.attachment_url) {
    const filename=message.attachment_url.split('/').at(-1);
    attachmentUrl=`/api/conversations/${encodeURIComponent(message.conversation_id)}/attachments/${encodeURIComponent(filename)}`;
  }
  return {
    id: message.id, conversationId: message.conversation_id, senderId: message.sender_id,
    type: message.message_type, text: message.message_text, attachmentUrl,
    isRead: message.is_read, createdAt: message.created_at, quotation,
  };
};

app.get('/api/messages/unread-count', requireAuth, async (req, res) => {
  const result = await dbResult(db.from('messages').select('id', { count: 'exact', head: true }).neq('sender_id', req.appProfile.id).eq('is_read', false)
    .in('conversation_id', (await dbResult(db.from('conversation_participants').select('conversation_id').eq('user_id', req.appProfile.id))).data?.map((row) => row.conversation_id) || []));
  if (result.error) return res.status(503).json({ success: false, message: 'Unable to load unread messages.' });
  res.json({ success: true, data: { count: result.count || 0 } });
});

app.get('/api/conversations', requireAuth, async (req, res) => {
  const members = await dbResult(db.from('conversation_participants').select('conversation_id').eq('user_id', req.appProfile.id));
  if (members.error) return res.status(503).json({ success: false, message: 'Unable to load conversations.' });
  const ids = [...new Set((members.data || []).map((row) => row.conversation_id))];
  if (!ids.length) return res.json({ success: true, data: [] });
  const conversations = await dbResult(db.from('conversations').select('*').in('id', ids).order('updated_at', { ascending: false }));
  if (conversations.error) return res.status(503).json({ success: false, message: 'Unable to load conversations.' });
  try {
    const data = await Promise.all(conversations.data.map((conversation) => conversationSummary(conversation, req.appProfile.id)));
    return res.json({ success: true, data });
  } catch (error) { return res.status(503).json({ success: false, message: error.message }); }
});

app.post('/api/conversations', requireAuth, async (req, res) => {
  const { jobId, bookingId } = req.body || {};
  if ((!jobId && !bookingId) || (jobId && !/^[0-9a-f-]{36}$/i.test(jobId)) || (bookingId && !/^[0-9a-f-]{36}$/i.test(bookingId))) return res.status(400).json({ success: false, message: 'Choose a valid job or booking.' });
  let customerId; let workerId; let workerUserId; let relatedJobId = jobId || null; let relatedBookingId = bookingId || null;
  if (bookingId) {
    const booking = await dbResult(db.from('bookings').select('*').eq('id', bookingId).maybeSingle());
    if (booking.error || !booking.data) return res.status(booking.error ? 503 : 404).json({ success: false, message: booking.error ? 'Unable to load booking.' : 'Booking not found.' });
    const worker = await dbResult(db.from('workers').select('id,user_id').eq('id', booking.data.worker_id).maybeSingle());
    if (worker.error || !worker.data) return res.status(503).json({ success: false, message: 'Unable to load assigned worker.' });
    if (req.appProfile.id !== booking.data.customer_id && req.appProfile.id !== worker.data.user_id) return res.status(403).json({ success: false, message: 'Only the booking participants can open this conversation.' });
    customerId = booking.data.customer_id; workerId = worker.data.id; workerUserId = worker.data.user_id;
    relatedJobId = booking.data.job_id || null;
  } else {
    const job = await dbResult(db.from('jobs').select('*').eq('id', jobId).maybeSingle());
    if (job.error || !job.data) return res.status(job.error ? 503 : 404).json({ success: false, message: job.error ? 'Unable to load job.' : 'Job not found.' });
    const worker = req.appProfile.role === 'worker'
      ? await dbResult(db.from('workers').select('id,user_id').eq('user_id', req.appProfile.id).maybeSingle())
      : await findWorkerDb(String(req.body?.workerId || ''));
    if (worker.error || !worker.data) return res.status(worker.error ? 503 : 403).json({ success: false, message: 'This account does not have a worker profile.' });
    const actualWorkerId = worker.data.id;
    const actualWorkerUserId = worker.data.user_id;
    if (!actualWorkerUserId) return res.status(409).json({ success: false, message: 'This worker has not activated secure messaging yet.' });
    if (req.appProfile.role === 'worker') {
      const offer = await dbResult(db.from('job_offers').select('id').eq('job_id', jobId).eq('worker_id', actualWorkerId).maybeSingle());
      if (offer.error || !offer.data) return res.status(403).json({ success: false, message: 'Respond to this job before opening a conversation.' });
      customerId = job.data.customer_id;
    } else {
      if (job.data.customer_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'Only the job customer can open this conversation.' });
      const offer = await dbResult(db.from('job_offers').select('id').eq('job_id', jobId).eq('worker_id', actualWorkerId).maybeSingle());
      if (offer.error || !offer.data) return res.status(403).json({ success: false, message: 'A worker must respond to this job before you can message them.' });
      customerId = req.appProfile.id;
    }
    workerId = actualWorkerId; workerUserId = actualWorkerUserId;
  }
  const conversation = await ensureConversation({ customerId, workerId, workerUserId, jobId: relatedJobId, bookingId: relatedBookingId });
  if (!conversation) return res.status(503).json({ success: false, message: 'Unable to create this conversation. Apply the messaging database migration and try again.' });
  const summary = await conversationSummary(conversation, req.appProfile.id);
  res.status(201).json({ success: true, data: summary });
});

app.get('/api/conversations/:id/messages', requireAuth, async (req, res) => {
  const access = await getConversationAccess(req.params.id, req.appProfile.id);
  if (access.error) return res.status(503).json({ success: false, message: 'Unable to check conversation access.' });
  if (!access.membership || !access.conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
  if (access.conversation.status === 'blocked') return res.status(403).json({ success: false, message: 'This conversation is unavailable.' });
  const result = await dbResult(db.from('messages').select('*').eq('conversation_id', req.params.id).order('created_at', { ascending: true }).limit(100));
  if (result.error) return res.status(503).json({ success: false, message: 'Unable to load messages.' });
  const quoteIds = result.data.filter((message) => message.quotation_id).map((message) => message.quotation_id);
  const quoteResult = quoteIds.length ? await dbResult(db.from('quotations').select('*').in('id', quoteIds)) : { data: [], error: null };
  if (quoteResult.error) return res.status(503).json({ success: false, message: 'Unable to load quotations.' });
  const quotes = new Map((quoteResult.data || []).map((quote) => [quote.id, quote]));
  const otherUserIds = [...new Set(result.data.filter((message) => message.sender_id !== req.appProfile.id).map((message) => message.id))];
  const output = await Promise.all(result.data.map((message) => messageOutput(message, quotes.get(message.quotation_id) || null)));
  const updatedAt = new Date().toISOString();
  const marked = await dbResult(db.from('messages').update({ is_read: true }).eq('conversation_id', req.params.id).neq('sender_id', req.appProfile.id).eq('is_read', false));
  await dbResult(db.from('conversation_participants').update({ last_read_at: updatedAt }).eq('conversation_id', req.params.id).eq('user_id', req.appProfile.id));
  if (marked.error) return res.status(503).json({ success: false, message: 'Messages loaded but read receipts could not be updated.' });
  res.json({ success: true, data: output });
});

app.post('/api/conversations/:id/messages', requireAuth, async (req, res) => {
  const access = await getConversationAccess(req.params.id, req.appProfile.id);
  if (access.error) return res.status(503).json({ success: false, message: 'Unable to check conversation access.' });
  if (!access.membership || !access.conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
  if (access.conversation.status !== 'active') return res.status(409).json({ success: false, message: 'This conversation is closed.' });
  if (!await chatWindowLimit(req.appProfile.id)) return res.status(429).json({ success: false, message: 'You have sent messages too quickly. Please wait a moment.' });
  const type = req.body?.type || 'text';
  let values;
  if (type === 'text') {
    const messageText = String(req.body?.text || '').trim();
    if (!messageText || messageText.length > 2000) return res.status(400).json({ success: false, message: 'Message must be between 1 and 2,000 characters.' });
    const detection = contactSharingType(messageText);
    if (detection) {
      await dbResult(db.from('contact_sharing_attempts').insert({ conversation_id: req.params.id, sender_id: req.appProfile.id, detection_type: detection }));
      return res.status(422).json({ success: false, code: 'CONTACT_DETAILS_BLOCKED', message: 'To protect your privacy and keep your booking secure, please communicate through KaamConnect.' });
    }
    values = { conversation_id: req.params.id, sender_id: req.appProfile.id, message_type: 'text', message_text: messageText };
  } else if (type === 'image') {
    const objectPath = String(req.body?.attachmentPath || '');
    const expectedPrefix = `${req.params.id}/${req.appProfile.id}/`;
    if (!objectPath.startsWith(expectedPrefix) || !/\.(?:jpe?g|png|webp)$/i.test(objectPath)) return res.status(400).json({ success: false, message: 'Choose a valid chat image.' });
    const folder = objectPath.slice(0, objectPath.lastIndexOf('/'));
    const filename = objectPath.slice(objectPath.lastIndexOf('/') + 1);
    const diskPath=path.join(uploadRoot,'chat-attachments',req.params.id,req.appProfile.id,filename);
    if (!fs.existsSync(diskPath) || !['jpg','jpeg','png','webp'].includes(path.extname(filename).slice(1).toLowerCase())) return res.status(400).json({ success: false, message: 'The uploaded image is missing or is not an allowed image type under 8 MB.' });
    values = { conversation_id: req.params.id, sender_id: req.appProfile.id, message_type: 'image', attachment_url: objectPath };
  } else return res.status(400).json({ success: false, message: 'Unsupported message type.' });
  const { data, error } = await dbResult(db.from('messages').insert(values).select('*').single());
  if (error) return res.status(503).json({ success: false, message: 'Unable to send message.' });
  const update = await dbResult(db.from('conversations').update({ last_message_at: data.created_at, updated_at: data.created_at }).eq('id', req.params.id));
  if (update.error) return res.status(503).json({ success: false, message: 'Message sent, but conversation preview did not update.' });
  res.status(201).json({ success: true, data: await messageOutput(data) });
});

app.post('/api/conversations/:id/quotations', requireAuth, async (req, res) => {
  const access = await getConversationAccess(req.params.id, req.appProfile.id);
  if (access.error) return res.status(503).json({ success: false, message: 'Unable to check conversation access.' });
  if (!access.membership || !access.conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
  if (access.conversation.status !== 'active' || req.appProfile.role !== 'worker') return res.status(403).json({ success: false, message: 'Only the assigned worker can send a quotation in an active conversation.' });
  const worker = await dbResult(db.from('workers').select('id').eq('id', access.conversation.worker_id).eq('user_id', req.appProfile.id).maybeSingle());
  if (worker.error || !worker.data) return res.status(403).json({ success: false, message: 'This worker account is not assigned to the conversation.' });
  const labour = Number(req.body?.labourCost); const materials = Number(req.body?.materialCost || 0); const travel = Number(req.body?.travelCost || 0);
  if (![labour, materials, travel].every((amount) => Number.isFinite(amount) && amount >= 0 && amount <= 1000000) || labour + materials + travel <= 0) return res.status(400).json({ success: false, message: 'Enter valid labour, material and travel costs.' });
  const notes = String(req.body?.notes || '').trim().slice(0, 1000);
  const detection = contactSharingType(notes);
  if (detection) {
    await dbResult(db.from('contact_sharing_attempts').insert({ conversation_id: req.params.id, sender_id: req.appProfile.id, detection_type: detection }));
    return res.status(422).json({ success: false, code: 'CONTACT_DETAILS_BLOCKED', message: 'To protect your privacy and keep your booking secure, please communicate through KaamConnect.' });
  }
  if (!await chatWindowLimit(req.appProfile.id)) return res.status(429).json({ success: false, message: 'You have sent messages too quickly. Please wait a moment.' });
  const quoteResult = await dbResult(db.from('quotations').insert({ conversation_id: req.params.id, booking_id: access.conversation.booking_id, sender_id: req.appProfile.id, labour_cost: labour, material_cost: materials, travel_cost: travel, notes }).select('*').single());
  if (quoteResult.error) return res.status(503).json({ success: false, message: 'Unable to save quotation.' });
  const message = await dbResult(db.from('messages').insert({ conversation_id: req.params.id, sender_id: req.appProfile.id, message_type: 'quote', quotation_id: quoteResult.data.id }).select('*').single());
  if (message.error) return res.status(503).json({ success: false, message: 'Quotation saved, but its chat card could not be created.' });
  await dbResult(db.from('conversations').update({ last_message_at: message.data.created_at, updated_at: message.data.created_at }).eq('id', req.params.id));
  res.status(201).json({ success: true, data: await messageOutput(message.data, quoteResult.data) });
});

app.post('/api/quotations/:id/respond', requireAuth, async (req, res) => {
  const action = String(req.body?.action || '');
  if (!['accept', 'change', 'reject'].includes(action)) return res.status(400).json({ success: false, message: 'Choose accept, request changes or reject.' });
  const quote = await dbResult(db.from('quotations').select('*').eq('id', req.params.id).maybeSingle());
  if (quote.error || !quote.data) return res.status(404).json({ success: false, message: 'Quotation not found.' });
  const access = await getConversationAccess(quote.data.conversation_id, req.appProfile.id);
  if (access.error) return res.status(503).json({ success: false, message: 'Unable to check conversation access.' });
  if (!access.membership || !access.conversation || access.conversation.customer_id !== req.appProfile.id) return res.status(403).json({ success: false, message: 'Only this booking customer can respond to the quotation.' });
  if (!['proposed', 'change_requested'].includes(quote.data.status)) return res.status(409).json({ success: false, message: 'This quotation has already been answered.' });
  const responseNote = String(req.body?.notes || '').trim().slice(0, 500);
  const detection = contactSharingType(responseNote);
  if (detection) {
    await dbResult(db.from('contact_sharing_attempts').insert({ conversation_id: quote.data.conversation_id, sender_id: req.appProfile.id, detection_type: detection }));
    return res.status(422).json({ success: false, code: 'CONTACT_DETAILS_BLOCKED', message: 'To protect your privacy and keep your booking secure, please communicate through KaamConnect.' });
  }
  if (action === 'accept') {
    const bookingId = quote.data.booking_id || access.conversation.booking_id;
    let booking = bookingId
      ? await dbResult(db.from('bookings').update({ final_price: Number(quote.data.total_estimate), updated_at: new Date().toISOString() }).eq('id', bookingId).eq('customer_id', req.appProfile.id).select('*').maybeSingle())
      : { data: null, error: null };
    if (booking.error) return res.status(503).json({ success: false, message: 'Unable to apply the accepted quotation to this booking.' });
    if (!booking.data && !bookingId && access.conversation.job_id) {
      const job = await dbResult(db.from('jobs').select('*').eq('id', access.conversation.job_id).eq('customer_id', req.appProfile.id).maybeSingle());
      if (job.error || !job.data) return res.status(403).json({ success: false, message: 'The conversation job is unavailable.' });
      const existing = await dbResult(db.from('bookings').select('*').eq('job_id', job.data.id).maybeSingle());
      if (existing.error) return res.status(503).json({ success: false, message: 'Unable to check the job booking.' });
      if (existing.data) {
        if (existing.data.worker_id !== access.conversation.worker_id) return res.status(409).json({ success: false, message: 'This job has been assigned to another worker.' });
        booking = await dbResult(db.from('bookings').update({ final_price: Number(quote.data.total_estimate), updated_at: new Date().toISOString() }).eq('id', existing.data.id).select('*').single());
      } else {
        const assigned = job.data.status === 'assigned' ? { data: job.data, error: null } : await dbResult(db.from('jobs').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', job.data.id).eq('status', 'open').select('*').maybeSingle());
        if (assigned.error || !assigned.data) return res.status(409).json({ success: false, message: 'This job has already been assigned or closed.' });
        booking = await dbResult(db.from('bookings').insert({
          job_id: job.data.id, customer_id: job.data.customer_id, worker_id: access.conversation.worker_id,
          service_id: job.data.service_id, task_id: job.data.task_id, booking_type: job.data.preferred_date ? 'scheduled' : 'immediate',
          scheduled_date: job.data.preferred_date, scheduled_slot: job.data.preferred_time, locality: job.data.locality,
          address_details: job.data.address_details, estimated_price_min: job.data.estimated_price_min,
          estimated_price_max: job.data.estimated_price_max, final_price: Number(quote.data.total_estimate),
          payment_method: 'upi', status: 'confirmed', otp: String(Math.floor(1000 + Math.random() * 9000)),
          metadata: { customerId: req.appProfile.id, customerName: req.appProfile.full_name },
        }).select('*').single());
      }
      if (booking.error || !booking.data) return res.status(503).json({ success: false, message: 'Quotation could not be connected to a booking.' });
      await dbResult(db.from('conversations').update({ booking_id: booking.data.id, updated_at: new Date().toISOString() }).eq('id', access.conversation.id));
    }
    if (!booking.data) return res.status(409).json({ success: false, message: 'A valid booking could not be found for this quotation.' });
    const saved = await dbResult(db.from('quotations').update({ status: 'accepted', booking_id: booking.data.id, response_note: responseNote, updated_at: new Date().toISOString() }).eq('id', quote.data.id).select('*').single());
    if (saved.error) return res.status(503).json({ success: false, message: 'Unable to accept quotation.' });
    return res.json({ success: true, data: { quotation: saved.data, booking: booking.data } });
  }
  const nextStatus = action === 'change' ? 'change_requested' : 'rejected';
  const { data, error } = await dbResult(db.from('quotations').update({ status: nextStatus, response_note: responseNote, updated_at: new Date().toISOString() }).eq('id', quote.data.id).select('*').single());
  if (error) return res.status(503).json({ success: false, message: 'Unable to save your quotation response.' });
  res.json({ success: true, data });
});

app.post('/api/messages/:id/report', requireAuth, async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ success: false, message: 'Explain the issue in 3 to 500 characters.' });
  const message = await dbResult(db.from('messages').select('id,conversation_id,sender_id').eq('id', req.params.id).maybeSingle());
  if (message.error || !message.data) return res.status(404).json({ success: false, message: 'Message not found.' });
  const access = await getConversationAccess(message.data.conversation_id, req.appProfile.id);
  if (access.error) return res.status(503).json({ success: false, message: 'Unable to check conversation access.' });
  if (!access.membership || message.data.sender_id === req.appProfile.id) return res.status(403).json({ success: false, message: 'You can report only messages from another conversation participant.' });
  const { data, error } = await dbResult(db.from('message_reports').insert({ message_id: message.data.id, reporter_id: req.appProfile.id, reason }).select('id,status,created_at').single());
  if (error) return res.status(error.code === '23505' ? 409 : 503).json({ success: false, message: error.code === '23505' ? 'You already reported this message.' : 'Unable to submit report.' });
  res.status(201).json({ success: true, data });
});

app.get('/api/admin/message-reports', requireAdmin, async (req, res) => {
  const [reports, attempts] = await Promise.all([
    dbResult(db.from('message_reports').select('*').order('created_at', { ascending: false }).limit(100)),
    dbResult(db.from('contact_sharing_attempts').select('*').order('created_at', { ascending: false }).limit(100)),
  ]);
  if (reports.error || attempts.error) return res.status(503).json({ success: false, message: 'Unable to load message moderation queue.' });
  const reportRows = await Promise.all((reports.data || []).map(async (report) => {
    const message = await dbResult(db.from('messages').select('*').eq('id', report.message_id).maybeSingle());
    const sender = message.data ? await dbResult(db.from('users').select('id,full_name,role,is_suspended').eq('id', message.data.sender_id).maybeSingle()) : { data: null, error: null };
    return { ...report, conversation_id: message.data?.conversation_id || null, message: message.data ? { id: message.data.id, text: message.data.message_text, type: message.data.message_type, sender: sender.data } : null };
  }));
  const attemptRows = await Promise.all((attempts.data || []).map(async (attempt) => {
    const sender = await dbResult(db.from('users').select('id,full_name,role').eq('id', attempt.sender_id).maybeSingle());
    return { ...attempt, sender: sender.data };
  }));
  res.json({ success: true, data: { reports: reportRows, contactAttempts: attemptRows } });
});

app.patch('/api/admin/message-reports/:id', requireAdmin, async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['reviewing', 'actioned', 'dismissed'].includes(status)) return res.status(400).json({ success: false, message: 'Choose a valid moderation status.' });
  const { data, error } = await dbResult(db.from('message_reports').update({ status }).eq('id', req.params.id).select('*').maybeSingle());
  if (error) return res.status(503).json({ success: false, message: 'Unable to update report.' });
  if (!data) return res.status(404).json({ success: false, message: 'Report not found.' });
  await dbResult(db.from('admin_action_logs').insert({ actor_id: req.appProfile.id, report_id: data.id, action: `message_report_${status}`, notes: String(req.body?.notes || '').slice(0, 500) }));
  res.json({ success: true, data });
});

app.patch('/api/admin/users/:id/suspension', requireAdmin, async (req, res) => {
  const isSuspended = req.body?.isSuspended;
  if (typeof isSuspended !== 'boolean') return res.status(400).json({ success: false, message: 'Choose whether to suspend this account.' });
  const { data, error } = await dbResult(db.from('users').update({ is_suspended: isSuspended, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('id,full_name,role,is_suspended').maybeSingle());
  if (error) return res.status(503).json({ success: false, message: 'Unable to update account status.' });
  if (!data) return res.status(404).json({ success: false, message: 'Account not found.' });
  await dbResult(db.from('admin_action_logs').insert({ actor_id: req.appProfile.id, target_user_id: data.id, action: isSuspended ? 'account_suspended' : 'account_reinstated' }));
  res.json({ success: true, data });
});

app.get('/api/admin/conversations/:id', requireAdmin, async (req, res) => {
  const conversation = await dbResult(db.from('conversations').select('*').eq('id', req.params.id).maybeSingle());
  if (conversation.error) return res.status(503).json({ success: false, message: 'Unable to load conversation.' });
  if (!conversation.data) return res.status(404).json({ success: false, message: 'Conversation not found.' });
  const messages = await dbResult(db.from('messages').select('*').eq('conversation_id', req.params.id).order('created_at', { ascending: true }).limit(200));
  if (messages.error) return res.status(503).json({ success: false, message: 'Unable to load conversation messages.' });
  const quoteIds = messages.data.filter((message) => message.quotation_id).map((message) => message.quotation_id);
  const quotations = quoteIds.length ? await dbResult(db.from('quotations').select('*').in('id', quoteIds)) : { data: [], error: null };
  if (quotations.error) return res.status(503).json({ success: false, message: 'Unable to load quotations.' });
  const quotes = new Map((quotations.data || []).map((quote) => [quote.id, quote]));
  const data = await Promise.all(messages.data.map((message) => messageOutput(message, quotes.get(message.quotation_id) || null)));
  res.json({ success: true, data: { conversation: conversation.data, messages: data } });
});

app.patch('/api/admin/conversations/:id', requireAdmin, async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['active', 'closed', 'blocked'].includes(status)) return res.status(400).json({ success: false, message: 'Choose a valid conversation status.' });
  const { data, error } = await dbResult(db.from('conversations').update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').maybeSingle());
  if (error) return res.status(503).json({ success: false, message: 'Unable to update conversation status.' });
  if (!data) return res.status(404).json({ success: false, message: 'Conversation not found.' });
  await dbResult(db.from('admin_action_logs').insert({ actor_id: req.appProfile.id, conversation_id: data.id, action: `conversation_${status}`, notes: String(req.body?.notes || '').slice(0, 500) }));
  res.json({ success: true, data });
});

// -------------------------------------------------------------
// =============================================================
// KaamConnect AI Care Routes: "Understand. Resolve. Connect."
// =============================================================

const verifyAICareAccess = (req, sessionRow) => {
  if (!sessionRow) return false;
  if (sessionRow.customer_id) {
    return req.session?.userId === sessionRow.customer_id;
  }
  const token = req.get('x-ai-session-token') || req.session?.csrfToken || req.session?.id;
  return sessionRow.session_token === token || (req.session?.userId && !sessionRow.customer_id);
};

// 1. Create or get AI Care session
app.post('/api/ai-care/session', async (req, res) => {
  const customerId = req.session?.userId || null;
  req.session.csrfToken ||= randomBytes(32).toString('hex');
  const sessionToken = req.get('x-ai-session-token') || req.session.csrfToken;
  const applianceCategory = String(req.body?.applianceCategory || 'other');
  const initialMessage = req.body?.initialMessage ? String(req.body.initialMessage).trim() : null;

  const sessionId = randomUUID();
  const now = new Date().toISOString();

  let assessment = null;
  if (initialMessage) {
    assessment = await processAICareMessage({
      message: initialMessage,
      applianceCategory,
      conversationHistory: [],
      simulateInvalidModel: req.body?.simulateInvalidModel === true,
      simulateTimeout: req.body?.simulateTimeout === true,
    });
  }

  const status = assessment?.status || 'NEED_MORE_INFORMATION';
  const action = assessment?.recommended_action || 'ASK_FOLLOW_UP';
  const summary = JSON.stringify(assessment?.problem_summary || {});
  const flags = JSON.stringify(assessment?.safety_flags || []);
  const multiData = JSON.stringify(assessment?.multi_appliance_data || []);
  const suggestedCategory = assessment?.suggested_service_category || (SUPPORTED_APPLIANCES[applianceCategory]?.serviceId || 'electrician');

  sqlite.prepare(`
    INSERT INTO ai_care_sessions(id, customer_id, session_token, appliance_category, status, recommended_action, problem_summary, suggested_service_category, safety_flags, multi_appliance_data, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, customerId, sessionToken, applianceCategory, status, action, summary, suggestedCategory, flags, multiData, now, now);

  if (initialMessage) {
    sqlite.prepare(`
      INSERT INTO ai_care_messages(id, session_id, sender, content, structured_payload, created_at)
      VALUES(?, ?, 'customer', ?, '{}', ?)
    `).run(randomUUID(), sessionId, initialMessage, now);

    if (assessment) {
      sqlite.prepare(`
        INSERT INTO ai_care_messages(id, session_id, sender, content, structured_payload, created_at)
        VALUES(?, ?, 'assistant', ?, ?, ?)
      `).run(randomUUID(), sessionId, assessment.message, JSON.stringify(assessment), new Date(Date.now() + 50).toISOString());
    }
  }

  const session = sqlite.prepare('SELECT * FROM ai_care_sessions WHERE id=?').get(sessionId);
  const messages = sqlite.prepare('SELECT * FROM ai_care_messages WHERE session_id=? ORDER BY created_at ASC').all(sessionId);

  res.json({
    success: true,
    data: {
      session: {
        ...session,
        problem_summary: JSON.parse(session.problem_summary || '{}'),
        safety_flags: JSON.parse(session.safety_flags || '[]'),
        multi_appliance_data: JSON.parse(session.multi_appliance_data || '[]')
      },
      assessment,
      messages: messages.map(m => ({ ...m, structured_payload: JSON.parse(m.structured_payload || '{}') })),
      sessionToken,
      csrfToken: req.session.csrfToken
    }
  });
});

// 2. Chat with AI Care session
app.post('/api/ai-care/chat', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '');
  const message = String(req.body?.message || '').trim();
  const applianceCategory = req.body?.applianceCategory;

  if (!sessionId || !message) {
    return res.status(400).json({ success: false, message: 'Session ID and message are required.' });
  }

  const session = sqlite.prepare('SELECT * FROM ai_care_sessions WHERE id=?').get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'AI Care session not found.' });
  }

  // Authorization check (Test I: Reject unauthorized data access)
  if (!verifyAICareAccess(req, session)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to access this AI Care session.' });
  }

  const category = applianceCategory || session.appliance_category || 'other';
  const now = new Date().toISOString();

  // Save customer message
  sqlite.prepare(`
    INSERT INTO ai_care_messages(id, session_id, sender, content, structured_payload, created_at)
    VALUES(?, ?, 'customer', ?, '{}', ?)
  `).run(randomUUID(), sessionId, message, now);

  // Retrieve prior messages for context
  const history = sqlite.prepare('SELECT sender, content FROM ai_care_messages WHERE session_id=? ORDER BY created_at ASC').all(sessionId);

  // Process assessment through AI Care Service
  const assessment = await processAICareMessage({
    message,
    applianceCategory: category,
    conversationHistory: history,
    simulateInvalidModel: req.body?.simulateInvalidModel === true,
    simulateTimeout: req.body?.simulateTimeout === true
  });

  // Save assistant message
  const assistantMsgId = randomUUID();
  const assistantTime = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO ai_care_messages(id, session_id, sender, content, structured_payload, created_at)
    VALUES(?, ?, 'assistant', ?, ?, ?)
  `).run(assistantMsgId, sessionId, assessment.message, JSON.stringify(assessment), assistantTime);

  // Update session
  const summaryJson = JSON.stringify(assessment.problem_summary || JSON.parse(session.problem_summary || '{}'));
  const flagsJson = JSON.stringify(assessment.safety_flags || []);
  const multiJson = JSON.stringify(assessment.multi_appliance_data || []);
  const suggestedCategory = assessment.suggested_service_category || session.suggested_service_category;

  sqlite.prepare(`
    UPDATE ai_care_sessions
    SET status = ?, recommended_action = ?, problem_summary = ?, suggested_service_category = ?, safety_flags = ?, multi_appliance_data = ?, updated_at = ?
    WHERE id = ?
  `).run(assessment.status, assessment.recommended_action, summaryJson, suggestedCategory, flagsJson, multiJson, assistantTime, sessionId);

  const updatedSession = sqlite.prepare('SELECT * FROM ai_care_sessions WHERE id=?').get(sessionId);
  const updatedMessages = sqlite.prepare('SELECT * FROM ai_care_messages WHERE session_id=? ORDER BY created_at ASC').all(sessionId);

  res.json({
    success: true,
    data: {
      assessment,
      session: {
        ...updatedSession,
        problem_summary: JSON.parse(updatedSession.problem_summary || '{}'),
        safety_flags: JSON.parse(updatedSession.safety_flags || '[]'),
        multi_appliance_data: JSON.parse(updatedSession.multi_appliance_data || '[]')
      },
      messages: updatedMessages.map(m => ({ ...m, structured_payload: JSON.parse(m.structured_payload || '{}') }))
    }
  });
});

// 3. Get session history
app.get('/api/ai-care/session/:id', async (req, res) => {
  const session = sqlite.prepare('SELECT * FROM ai_care_sessions WHERE id=?').get(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'AI Care session not found.' });
  }

  // Authorization check (Test I)
  if (!verifyAICareAccess(req, session)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to view this session.' });
  }

  const messages = sqlite.prepare('SELECT * FROM ai_care_messages WHERE session_id=? ORDER BY created_at ASC').all(req.params.id);
  res.json({
    success: true,
    data: {
      session: {
        ...session,
        problem_summary: JSON.parse(session.problem_summary || '{}'),
        safety_flags: JSON.parse(session.safety_flags || '[]'),
        multi_appliance_data: JSON.parse(session.multi_appliance_data || '[]')
      },
      messages: messages.map(m => ({ ...m, structured_payload: JSON.parse(m.structured_payload || '{}') }))
    }
  });
});

// 4. Get matched workers for an AI Care session
app.get('/api/ai-care/matched-workers/:sessionId', async (req, res) => {
  const session = sqlite.prepare('SELECT * FROM ai_care_sessions WHERE id=?').get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'AI Care session not found.' });
  }

  const tradeId = session.suggested_service_category || 'electrician';
  const workers = sqlite.prepare(`
    SELECT w.*, u.full_name, u.phone, u.locality as user_locality
    FROM workers w
    JOIN users u ON w.user_id = u.id
    WHERE w.trade_id = ? AND w.is_available = 1 AND u.is_suspended = 0
    ORDER BY w.rating_average DESC, w.jobs_completed DESC
    LIMIT 10
  `).all(tradeId);

  res.json({
    success: true,
    data: {
      tradeId,
      workers: workers.map(w => ({
        id: w.id,
        name: w.full_name,
        tradeId: w.trade_id,
        rating: w.rating_average,
        reviewCount: w.rating_count,
        locality: w.locality || w.user_locality,
        halfDayRate: w.half_day_rate,
        dailyRate: w.daily_rate,
        experienceYears: w.experience_years,
        profilePhotoUrl: w.profile_photo_url,
        isVerified: w.kyc_status === 'verified'
      }))
    }
  });
});

// 5. Explicit Booking Confirmation from AI Care (Test J: Booking confirmation)
app.post('/api/ai-care/confirm-booking', async (req, res) => {
  // Test J: If confirmed is not explicitly true, reject!
  if (req.body?.confirmed !== true) {
    return res.status(400).json({
      success: false,
      message: 'Booking creation requires explicit customer confirmation. Review the problem summary and confirm to proceed.'
    });
  }

  // Enforce customer authentication
  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: 'Please sign in or create a customer account to confirm your technician booking.'
    });
  }

  const user = currentUser(req.session.userId);
  if (!user || user.role !== 'customer') {
    return res.status(403).json({ success: false, message: 'Only customer accounts can confirm bookings.' });
  }

  const { sessionId, workerId, serviceId, scheduledDate, scheduledSlot, locality, addressDetails } = req.body;
  const session = sessionId ? sqlite.prepare('SELECT * FROM ai_care_sessions WHERE id=?').get(sessionId) : null;

  const targetServiceId = serviceId || session?.suggested_service_category || 'electrician';
  const targetLocality = locality || user.locality || 'Kalyani Ghoshpara';
  const targetAddress = addressDetails || 'Kalyani, Nadia District';
  const bookingId = randomUUID();
  const now = new Date().toISOString();

  let problemSummary = {};
  try {
    problemSummary = session?.problem_summary ? JSON.parse(session.problem_summary) : (req.body.problemSummary || {});
  } catch {}

  const metadata = JSON.stringify({
    source: 'KaamConnect AI Care',
    aiCareSessionId: sessionId || null,
    problemSummary,
    confirmedByCustomer: true,
    confirmedAt: now
  });

  const worker = workerId ? sqlite.prepare('SELECT id FROM workers WHERE id=?').get(workerId) : null;

  sqlite.prepare(`
    INSERT INTO bookings(id, customer_id, worker_id, service_id, booking_type, scheduled_date, scheduled_slot, locality, address_details, status, metadata, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(
    bookingId,
    user.id,
    worker?.id || null,
    targetServiceId,
    scheduledDate ? 'scheduled' : 'immediate',
    scheduledDate || now.slice(0, 10),
    scheduledSlot || 'Immediate Dispatch',
    targetLocality,
    targetAddress,
    metadata,
    now,
    now
  );

  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);

  res.json({
    success: true,
    message: 'Technician booking confirmed successfully with AI problem summary attached.',
    data: {
      booking: {
        ...booking,
        metadata: JSON.parse(booking.metadata || '{}')
      }
    }
  });
});

// Unified Full-Stack Hosting: Serve Frontend from Express
// -------------------------------------------------------------
const clientDistPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');
const rootPublicPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

if (fs.existsSync(rootPublicPath)) {
  app.use(express.static(rootPublicPath));
}

if (!fs.existsSync(clientDistPath) && process.env.NODE_ENV !== 'test') {
  try {
    console.log('[KaamConnect Server] Building frontend assets for full-stack delivery...');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execSync(`${npmCmd} --prefix client run build`, {
      stdio: 'inherit',
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    });
  } catch (err) {
    console.warn('[KaamConnect Server] Could not build client automatically:', err.message);
  }
}

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // Catch-all route to support client-side routing (React Router)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, message: 'API route not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[KaamConnect Server] Backend API running at http://localhost:${PORT}`);
    console.log(`[KaamConnect Server] Serving Nadia District & Kalyani informal workforce network`);
  });
}

export { app, PORT };
export default app;
