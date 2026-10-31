import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from './components/Header';
import { ServiceGrid } from './components/ServiceGrid';
import { WorkerList } from './components/WorkerList';
import { CategoryResultsPage } from './components/CategoryResultsPage';
import { BookingModal } from './components/BookingModal';
import { LiveTracking } from './components/LiveTracking';
// WorkerDashboard removed
import { WorkerWorkspace } from './components/WorkerWorkspace';
import { CustomerJobs } from './components/CustomerJobs';
import { AddJob } from './components/AddJob';
import { WorkerProfileView } from './components/WorkerProfileView';
import { JobDetails } from './components/JobDetails';
import { WorkerRegistration } from './components/WorkerRegistration';
import { AdminView } from './components/AdminView';
import { FairWageExplainer } from './components/FairWageExplainer';
import { ToastContainer } from './components/Toast';
import { api } from './services/api';
import { useAuth } from './hooks/useAuth';
import { AccountPage } from './components/AccountPage';
import { WorkerJobBoard } from './components/WorkerJobBoard';
import { MessagesPage } from './components/MessagesPage';
import { PublicJobBoard } from './components/PublicJobBoard';
import { AdminMessageModeration } from './components/AdminMessageModeration';
import { HomeElectronicsCare } from './components/HomeElectronicsCare';
// TRANSLATIONS removed
import { getCategoryCatalog } from './utils/workerCategories';
import { 
  MapPin, 
  ShieldCheck, 
  ArrowRight,

  Search,
  X
} from 'lucide-react';

export function App() {
  const { session, profile, loading: authLoading, signOut, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pathname = location.pathname;
  const rawWorkerPathId = pathname.match(/^\/workers\/([^/]+)\/?$/)?.[1] || '';
  let workerPathId = rawWorkerPathId;
  try { workerPathId = decodeURIComponent(rawWorkerPathId); } catch { /* Invalid encoded paths fall through to the not-found state. */ }
  const updateSearchParam = (key, value) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    if (value && value !== 'all') next.set(key, String(value));
    else next.delete(key);
    return next;
  }, { replace: true });
  // Global States
  const currentRole = profile?.role || 'customer';
  const [language, setLanguage] = useState('en');
  const selectedRadius = Number(searchParams.get('radius')) || 3;
  const setSelectedRadius = (value) => updateSearchParam('radius', value === 3 ? '' : value);
  const selectedCategory = searchParams.get('service') || 'all';
  const setSelectedCategory = (value) => updateSearchParam('service', value);
  const searchQuery = searchParams.get('q') || '';
  const [isMobileEmulation, setIsMobileEmulation] = useState(false);
  const [customerId] = useState('demo-customer-1');
  const [workerOwnerId, setWorkerOwnerId] = useState('');
  const [currentWorkerId, setCurrentWorkerId] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const searchContainerRef = useRef(null);
  const setSearchQuery = (value) => updateSearchParam('q', value);

  // Dynamic Backend Data State
  const [locations, setLocations] = useState([
    { id: 'ghoshpara', name: 'Ghoshpara Station Rd', nameBn: 'ঘোষপাড়া স্টেশন রোড', nameHi: 'ঘোষপাड़ा স্টেশন রোড', wardOrBlock: 'Ward 8, Kalyani', isPopular: true },
    { id: 'central-park', name: 'Kalyani Central Park', nameBn: 'কল্যাণী সেন্ট্রাল পার্ক', nameHi: 'कल्याणी सेंट्रल पार्क', wardOrBlock: 'B-Block', isPopular: true },
    { id: 'b-block', name: 'B-Block Market & More', nameBn: 'বি-ব্লক মার্কেট মোড়', nameHi: 'बी-ब्लॉक मार्केट मोड़', wardOrBlock: 'Block B', isPopular: true },
    { id: 'station', name: 'Kalyani Main Railway Station', nameBn: 'কল্যাণী মেইন স্টেশন', nameHi: 'कल्याणी मुख्य रेलवे स्टेशन', wardOrBlock: 'Station Area', isPopular: true }
  ]);
  const selectedLocation = locations.find((item) => item.id === searchParams.get('location') || item.name === searchParams.get('location')) || locations[0];
  const setSelectedLocation = (value) => updateSearchParam('location', value?.id || '');
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [isWorkersLoading, setIsWorkersLoading] = useState(true);
  const [workerLoadError, setWorkerLoadError] = useState('');
  const [workerLoadAttempt, setWorkerLoadAttempt] = useState(0);
  const [analytics, setAnalytics] = useState(null);
  const [incomingJob, setIncomingJob] = useState(null);

  // Booking Flow States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingPreselectedCat, setBookingPreselectedCat] = useState(null);
  const [bookingPreselectedWorker, setBookingPreselectedWorker] = useState(null);

  // Active Live Booking State
  const [activeBooking, setActiveBooking] = useState(null);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);

  // Toast System
  const [toasts, setToasts] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    if (!session?.user) { setUnreadMessageCount(0); return undefined; }
    let active = true;
    const refresh = () => api.getUnreadMessageCount(session.user).then((data) => { if (active) setUnreadMessageCount(Number(data?.count || 0)); }).catch(() => {});
    refresh(); const timer = window.setInterval(refresh, 20000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.user, pathname]);

  const openBookingChat = async (booking) => {
    if (!session?.user) { navigate('/account?next=/messages'); return; }
    try {
      const conversation = await api.createConversation(session.user, { bookingId: booking.id });
      navigate(`/messages/${conversation.id}`);
    } catch (error) { showToast('Unable to open chat', error.message, 'warning'); }
  };
  const _unusedOpenJobChat = async (jobId, workerId) => {
    if (!session?.user) { navigate('/account?next=/messages'); return; }
    try {
      const conversation = await api.createConversation(session.user, { jobId, workerId });
      navigate(`/messages/${conversation.id}`);
    } catch (error) { showToast('Unable to open chat', error.message, 'warning'); }
  };

  const categoryCatalog = useMemo(() => getCategoryCatalog(services, workers), [services, workers]);
  const categorySlug = pathname.match(/^\/workers\/([^/]+)\/?$/)?.[1]?.toLowerCase();
  const activeCategory = categoryCatalog.find((category) =>
    category.id === categorySlug || category.slug === categorySlug
  );
  const activeWorkerId = currentWorkerId;
  const categorySuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return categoryCatalog.filter((category) =>
      category.label.toLowerCase().includes(query) || category.id.includes(query)
    );
  }, [categoryCatalog, searchQuery]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!searchContainerRef.current?.contains(event.target)) setIsSearchOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const navigateTo = (path) => {
    navigate(path);
  };

  useEffect(() => {
    if (authLoading) return;
    const workerOnly = ['/worker-dashboard', '/dashboard', '/worker-jobs', '/register-worker'].includes(pathname);
    const adminOnly = pathname.startsWith('/admin');
    const customerOnly = ['/bookings', '/post-job'].includes(pathname);
    if (workerOnly && !session) {
      const reason = pathname === '/worker-jobs' ? 'quotation' : 'dashboard';
      navigate(`/account?mode=signup&role=worker&reason=${reason}&next=${encodeURIComponent(pathname)}`, { replace: true });
    }
    else if (workerOnly && profile?.role !== 'worker') navigate('/', { replace: true });
    else if (profile?.role === 'worker' && !profile.worker_profile_complete && ['/worker-dashboard', '/dashboard', '/worker-jobs'].includes(pathname)) navigate('/register-worker', { replace: true });
    else if (adminOnly && profile?.role !== 'admin') navigate('/', { replace: true });
    else if (customerOnly && !session) {
      const query = new URLSearchParams({ mode: 'signup', role: 'customer', reason: 'booking', next: `${pathname}${location.search}` });
      navigate(`/account?${query.toString()}`, { replace: true });
    }
    else if (customerOnly && profile?.role === 'worker') navigate('/worker-dashboard', { replace: true });
  }, [authLoading, pathname, location.search, session, profile?.role, profile?.worker_profile_complete, navigate]);

  useEffect(() => {
    if (!session?.user || profile?.role !== 'worker' || !profile.worker_profile_complete) return undefined;
    let active = true;
    api.getMyWorkerProfile(session.user).then((worker) => {
      if (!active || !worker?.id) return;
      setCurrentWorkerId(worker.id);
      setWorkerOwnerId(profile.id);
      window.sessionStorage.setItem('kaamconnect-worker-id', worker.id);
      window.sessionStorage.setItem('kaamconnect-worker-owner', profile.id);
      setWorkers((current) => current.some((item) => item.id === worker.id) ? current.map((item) => item.id === worker.id ? worker : item) : [...current, worker]);
    }).catch((error) => console.error('Unable to load your worker profile:', error));
    return () => { active = false; };
  }, [session?.user, profile?.id, profile?.role, profile?.worker_profile_complete]);

  const selectCategorySuggestion = (category) => {
    setSearchQuery('');
    setIsSearchOpen(false);
    setActiveSuggestion(0);
    setSelectedCategory(category.id);
    navigateTo(`/workers/${category.slug}`);
  };

  const handleWorkerRegistered = async (workerProfile) => {
    setWorkers((current) => [...current.filter((item) => item.id !== workerProfile.id), workerProfile]);
    setCurrentWorkerId(workerProfile.id);
    setWorkerOwnerId(profile.id);
    window.sessionStorage.setItem('kaamconnect-worker-id', workerProfile.id);
    window.sessionStorage.setItem('kaamconnect-worker-owner', profile.id);
    await refreshProfile().catch((error) => console.error('Unable to refresh your account profile:', error));
    navigateTo('/worker-dashboard');
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown' && categorySuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % categorySuggestions.length);
    } else if (event.key === 'ArrowUp' && categorySuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((index) => (index - 1 + categorySuggestions.length) % categorySuggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const exactCategory = categorySuggestions.find((category) =>
        category.label.toLowerCase() === searchQuery.trim().toLowerCase() ||
        category.id === searchQuery.trim().toLowerCase()
      );
      const categoryToSelect = exactCategory || (categorySuggestions.length === 1 ? categorySuggestions[0] : null);
      if (categoryToSelect) selectCategorySuggestion(categoryToSelect);
      else setIsSearchOpen(false);
    } else if (event.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  const showToast = (title, message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch supporting data from Express backend on mount.
  useEffect(() => {
    async function loadBackendData() {
      const [locs, srvs, anl, job] = await Promise.all([
        api.getLocations(),
        api.getServices(),
        api.getAnalytics(),
        api.getIncomingJob()
      ]);

      if (locs && locs.length > 0) {
        setLocations(locs);
      }
      if (srvs && srvs.length > 0) setServices(srvs);
      if (anl) setAnalytics(anl);
      if (job) setIncomingJob(job);
    }

    loadBackendData();
  }, []);

  // Keep worker loading separate so a failure here is visible and retryable.
  useEffect(() => {
    let isCurrentRequest = true;
    setIsWorkersLoading(true);
    setWorkerLoadError('');

    api.getWorkers()
      .then((loadedWorkers) => {
        if (!isCurrentRequest) return;
        setWorkers(loadedWorkers);
      })
      .catch((error) => {
        if (!isCurrentRequest) return;
        console.error('Unable to load worker profiles:', error);
        setWorkers([]);
        setWorkerLoadError('Worker profiles could not be loaded. Please start the backend and try again.');
      })
      .finally(() => {
        if (isCurrentRequest) setIsWorkersLoading(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [workerLoadAttempt]);

  // Handlers for booking triggers
  const requireAccount = (reason, next, role = 'customer') => {
    const query = new URLSearchParams({ mode: 'signup', role, reason, next });
    navigate(`/account?${query.toString()}`);
  };

  const handleOpenBookingForCategory = (category) => {
    if (!session) { requireAccount('booking', `${pathname}${location.search}`, 'customer'); showToast('Account needed', 'Sign in or create a customer account to book this service.', 'info'); return; }
    if (profile?.role !== 'customer') { showToast('Customer account required', 'Sign in with a customer account to book a service.', 'warning'); return; }
    setBookingPreselectedCat(category);
    setBookingPreselectedWorker(null);
    setIsBookingModalOpen(true);
  };

  const handleOpenBookingForWorker = (worker) => {
    if (!session) { requireAccount('booking', `${pathname}${location.search}`, 'customer'); showToast('Account needed', 'Sign in or create a customer account to book this worker.', 'info'); return; }
    if (profile?.role !== 'customer') { showToast('Customer account required', 'Sign in with a customer account to book a service.', 'warning'); return; }
    const cat = services.find((c) => c.id === worker.tradeId) || services[0];
    setBookingPreselectedCat(cat);
    setBookingPreselectedWorker(worker);
    setIsBookingModalOpen(true);
  };

  const handleBookingConfirmed = async (newBookingData) => {
    if (!session || profile?.role !== 'customer') { setIsBookingModalOpen(false); navigate('/account?mode=signup&role=customer&next=%2Fbookings'); return; }
    let createdBooking;
    try { createdBooking = await api.createBooking({ ...newBookingData, customerId }, session?.user); }
    catch (error) { showToast('Booking could not be created', error.message, 'warning'); return; }
    const finalBooking = createdBooking || {
      id: `BK-KLY-${Math.floor(1000 + Math.random() * 9000)}`,
      ...newBookingData,
      status: 'en_route',
      worker: bookingPreselectedWorker || workers[0],
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      otp: String(Math.floor(1000 + Math.random() * 9000)),
      finalPrice: 249 + 79
    };

    setActiveBooking(finalBooking);
    setIsBookingModalOpen(false);
    setIsLiveTrackingOpen(true);

    showToast(
      'Worker Dispatched!',
      `${finalBooking.worker?.name || 'Technician'} is en route to ${finalBooking.locality}. Share OTP: ${finalBooking.otp}`,
      'success'
    );
  };

  const handleUpdateBookingStatus = async (newStatus) => {
    if (!activeBooking) return;
    if (profile?.role !== 'worker') { showToast('Worker update required', 'Only the assigned worker can change booking progress.', 'info'); return; }
    await api.updateBookingStatus(activeBooking.id, newStatus, session?.user);
    setActiveBooking((prev) => prev ? { ...prev, status: newStatus } : null);
    
    if (newStatus === 'arrived') {
      showToast('Worker Arrived', `${activeBooking.worker?.name} has arrived at your address`, 'info');
    } else if (newStatus === 'in_progress') {
      showToast('Work In Progress', 'OTP verified. Task execution started', 'info');
    } else if (newStatus === 'completed') {
      showToast('Job Completed!', 'Please verify work, provide tip, and leave a review', 'success');
    }
  };

  const handleCompleteBooking = async (rating, tip, review) => {
    if (!activeBooking) return;
    await api.reviewBooking(activeBooking.id, rating, tip, review, session?.user);
    const finalAmount = activeBooking.finalPrice + tip;
    showToast(
      'Thank you!',
      `₹${finalAmount} paid directly to ${activeBooking.worker?.name}. Review posted.`,
      'success'
    );
  };

  const handleToggleWorkerKyc = async (workerId, newKyc) => {
    await api.toggleWorkerKyc(workerId, newKyc, session?.user);
    setWorkers((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, kycVerified: newKyc, aadhaarVerified: newKyc } : w))
    );
    showToast(
      newKyc ? 'KYC Approved' : 'KYC Suspended',
      'Worker verification status updated on Express backend',
      newKyc ? 'success' : 'warning'
    );
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col font-sans transition-all ${
      isMobileEmulation ? 'py-6 px-3 bg-slate-200' : ''
    }`}>
      {/* Mobile Emulation Container Wrapper */}
      <div className={`mx-auto w-full flex-1 flex flex-col transition-all duration-300 ${
        isMobileEmulation 
          ? 'max-w-[420px] bg-white rounded-[40px] shadow-2xl border-[8px] border-slate-900 overflow-hidden min-h-[844px]' 
          : 'max-w-full'
      }`}>
        
        {/* Persistent Navigation Header */}
        <Header
          currentRole={currentRole}
          onHome={() => navigateTo('/')}
          language={language}
          setLanguage={setLanguage}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          selectedRadius={selectedRadius}
          setSelectedRadius={setSelectedRadius}
          isMobileEmulation={isMobileEmulation}
          setIsMobileEmulation={setIsMobileEmulation}
          hasActiveBooking={!!activeBooking}
          onOpenActiveBooking={() => setIsLiveTrackingOpen(true)}
          onOpenMyJobs={() => navigateTo('/bookings')}
          onOpenWorkerDashboard={() => navigateTo('/worker-dashboard')}
          onOpenWorkerJobs={() => navigateTo('/worker-jobs')}
          onOpenAdmin={() => navigateTo('/admin')}
          onOpenMessages={() => session ? navigateTo('/messages') : requireAccount('messaging', `${pathname}${location.search}`, 'customer')}
          onOpenElectronicsCare={() => navigateTo('/electronics-care')}
          unreadMessageCount={unreadMessageCount}
          onOpenAccount={() => navigateTo('/account')}
          onSignOut={async () => { try { await signOut(); navigate('/', { replace: true }); } catch (error) { showToast('Unable to sign out', error.message, 'warning'); } }}
          onJoinCustomer={() => navigateTo('/account?mode=signup&role=customer')}
          onJoinWorker={() => navigateTo('/account?mode=signup&role=worker')}
          onBrowseJobs={() => navigateTo('/jobs')}
          isAuthenticated={!!session}
          locations={locations}
        />

        {/* Main Content Area by Perspective Role */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 w-full">
          {/* CUSTOMER PERSPECTIVE */}
          {pathname === '/account' ? (
            <AccountPage />
          ) : pathname === '/electronics-care' && currentRole === 'customer' ? (
            <HomeElectronicsCare selectedLocation={selectedLocation} />
          ) : pathname === '/messages' || pathname.match(/^\/messages\/[^/]+\/?$/) ? (
            <MessagesPage />
          ) : pathname === '/worker-jobs' ? (
            <WorkerJobBoard />
          ) : pathname === '/admin/messages' && currentRole === 'admin' ? (
            <AdminMessageModeration />
          ) : pathname === '/register-worker' ? (
            session && profile?.role === 'worker' && !profile.worker_profile_complete ? <WorkerRegistration
              ownerId={workerOwnerId}
              onBack={() => navigateTo('/')}
              onSuccess={handleWorkerRegistered}
            /> : <section className="mx-auto max-w-xl py-12"><div className="rounded-2xl border border-slate-200 bg-white p-6"><h1 className="text-xl font-bold">Worker profile is ready</h1><p className="mt-2 text-sm text-slate-600">Your registered profile is available from the worker dashboard.</p><button type="button" onClick={() => navigate('/worker-dashboard')} className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Open worker dashboard</button></div></section>
          ) : pathname === '/jobs' && (!session || profile?.role === 'worker') ? (
            <PublicJobBoard onOpenJob={(job) => navigateTo(`/jobs/${encodeURIComponent(job.id)}`)} onSignIn={() => profile?.role === 'worker' ? navigateTo('/worker-jobs') : requireAccount('quotation', '/jobs', 'worker')} />
          ) : currentRole === 'customer' && (pathname === '/bookings' || pathname === '/jobs') ? (
            <CustomerJobs
              customerId={customerId}
              onBack={() => navigateTo('/')}
              onOpenLiveBooking={(job) => { setActiveBooking(job); setIsLiveTrackingOpen(true); }}
              onOpenChat={openBookingChat}
            />
          ) : currentRole === 'customer' && pathname === '/post-job' ? (
            <AddJob services={services} locations={locations} customerId={customerId} workers={workers} onBack={() => navigateTo('/')} />
          ) : pathname.match(/^\/jobs\/[^/]+\/?$/) ? (
            <JobDetails onBack={() => navigateTo('/post-job')} />
          ) : currentRole === 'customer' && activeCategory ? (
            <CategoryResultsPage
              category={activeCategory}
              workers={workers}
              selectedRadius={selectedRadius}
              onBookWorker={handleOpenBookingForWorker}
              onOpenProfile={(worker) => navigateTo(`/workers/${encodeURIComponent(worker.id)}`)}
              language={language}
              isLoading={isWorkersLoading}
              loadError={workerLoadError}
              onRetry={() => setWorkerLoadAttempt((attempt) => attempt + 1)}
              onBack={() => {
                setSelectedCategory('all');
                navigateTo('/');
              }}
            />
          ) : currentRole === 'customer' && pathname.match(/^\/workers\/[^/]+\/?$/) ? (
            <WorkerProfileView
              worker={workers.find((item) => item.id === workerPathId || item.legacyId === workerPathId)}
              isLoading={isWorkersLoading}
              loadError={workerLoadError}
              onRetry={() => setWorkerLoadAttempt((attempt) => attempt + 1)}
              language={language}
              onBack={() => navigateTo('/workers')}
              onBook={handleOpenBookingForWorker}
            />
          ) : currentRole === 'customer' && (pathname === '/' || pathname === '/workers') ? (
            <div className="space-y-6">
              {/* Primary worker search */}
              <section className="home-discovery mt-5 overflow-visible rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-subtle sm:p-8">
                <div className="home-discovery__intro mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                  <div className="max-w-2xl">
                    <span className="home-discovery__eyebrow inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]"><span className="h-2 w-2 rounded-full bg-amber-400" />Local help, fairly priced</span>
                    <h1 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight tracking-[-0.045em] text-slate-900 sm:text-5xl">Good work starts <span className="home-discovery__accent">right here.</span></h1>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Find trusted local workers for the jobs that keep your home and day moving. Clear rates, nearby skills, and no middleman cuts.</p>
                  </div>
                  <div className="home-discovery__note flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 sm:max-w-[230px]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-900"><ShieldCheck className="h-5 w-5" /></span>
                    <span><strong className="block text-sm">Fair wage promise</strong><span className="mt-0.5 block text-xs opacity-75">Workers keep what they earn.</span></span>
                  </div>
                </div>
                <label htmlFor="worker-search" className="mb-2 block text-sm font-bold text-slate-900">
                  Find the right worker for your job
                </label>
                <div className="relative" ref={searchContainerRef}>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600" aria-hidden="true" />
                  <input
                    id="worker-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setActiveSuggestion(0);
                      setIsSearchOpen(Boolean(e.target.value.trim()));
                    }}
                    onFocus={() => searchQuery.trim() && setIsSearchOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search electricians, plumbers, workers or skills..."
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/15 sm:py-3.5 sm:text-base"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear worker search"
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  {isSearchOpen && categorySuggestions.length > 0 && (
                    <div
                      className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
                      role="listbox"
                      aria-label="Category suggestions"
                    >
                      {categorySuggestions.map((category, index) => (
                        <button
                          type="button"
                          key={category.id}
                          role="option"
                          aria-selected={index === activeSuggestion}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCategorySuggestion(category)}
                          className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                            index === activeSuggestion ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-semibold">{category.label}</span>
                          <span className="text-xs text-slate-400">View workers</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">Search by name, service, skill, or locality.</p>
              </section>

              {/* Quick Hero Notification Banner */}
              <div className="mt-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold">
                    <MapPin className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Dispatched from <span className="text-blue-700">{selectedLocation?.name}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Average arrival time: <strong className="text-slate-800">11 mins</strong> • Radius: {selectedRadius} km
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateTo('/post-job')}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>Post a Job</span>
                  </button>
                  <button
                    onClick={() => handleOpenBookingForCategory(services[0])}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>Instant Booking</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Service Categories Grid */}
              <ServiceGrid
                categories={services}
                selectedCategory={selectedCategory}
                onSelectCategory={(catId) => {
                  setSelectedCategory(catId);
                }}
                onBookCategory={handleOpenBookingForCategory}
                language={language}
              />

              {/* Fair Wage Guarantee Explainer Banner */}
              <FairWageExplainer
                language={language}
                onOpenBooking={() => handleOpenBookingForCategory(services[0])}
              />

              {/* Interactive Worker List with Filtering */}
              <WorkerList
                workers={workers}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onBookWorker={handleOpenBookingForWorker}
                onOpenProfile={(worker) => navigateTo(`/workers/${encodeURIComponent(worker.id)}`)}
                language={language}
                selectedRadius={selectedRadius}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
                isLoading={isWorkersLoading}
                loadError={workerLoadError}
                onRetry={() => setWorkerLoadAttempt((attempt) => attempt + 1)}
              />
            </div>
          ) : null}

          {/* WORKER COCKPIT PERSPECTIVE */}
          {currentRole === 'worker' && (
            activeWorkerId ? <WorkerWorkspace
              language={language}
              showToast={showToast}
              workers={workers}
              incomingJobData={incomingJob}
              workerId={activeWorkerId}
              ownerId={workerOwnerId}
              onBack={() => navigateTo('/')}
              onBrowseJobs={() => navigateTo('/worker-jobs')}
              onOpenChat={openBookingChat}
              onJobAcceptedByWorker={(job) => {
                const matchingWorker = workers[0];
                setActiveBooking({
                  id: `BK-KLY-${Math.floor(1000 + Math.random() * 9000)}`,
                  customerName: job.customerName,
                  serviceId: job.serviceId,
                  serviceName: job.serviceTitle,
                  taskId: 'task-1',
                  taskName: job.taskTitle,
                  locality: job.locality,
                  addressDetails: job.addressNote,
                  bookingType: 'immediate',
                  finalPrice: job.payoutAmount,
                  status: 'en_route',
                  workerId: matchingWorker?.id,
                  worker: matchingWorker,
                  createdAt: 'Just now',
                  otp: '8492',
                  paymentMethod: 'upi',
                });
              }}
            /> : <div role="status" className="mx-auto my-10 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading your worker profile…</div>
          )}

          {/* REGIONAL ADMIN HUB */}
          {currentRole === 'admin' && (
            <AdminView 
              language={language} 
              showToast={showToast} 
              workers={workers}
              analytics={analytics}
              onToggleWorkerKyc={handleToggleWorkerKyc}
              onOpenMessageModeration={() => navigateTo('/admin/messages')}
            />
          )}

          {!['/', '/workers', '/post-job', '/register-worker', '/bookings', '/jobs', '/worker-dashboard', '/dashboard', '/admin', '/account', '/electronics-care', '/messages', '/worker-jobs', '/admin/messages'].includes(pathname) && !pathname.match(/^\/messages\/[^/]+\/?$/) && !activeCategory && !pathname.match(/^\/workers\/[^/]+\/?$/) && !pathname.match(/^\/jobs\/[^/]+\/?$/) && (
            <section className="mx-auto max-w-xl py-20 text-center">
              <h1 className="text-2xl font-extrabold text-slate-900">Page not found</h1>
              <p className="mt-2 text-sm text-slate-600">The page you’re looking for doesn’t exist.</p>
              <button type="button" onClick={() => navigateTo('/')} className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">← Back to KaamConnect</button>
            </section>
          )}
        </main>

        {/* Global Footer */}
        <footer className="mt-16 bg-white border-t border-slate-200 py-10 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center gap-0.5 rounded-xl font-bold text-sm" style={{ backgroundColor: '#F2F0E9' }}>
                <span className="inline-block" style={{ backgroundImage: 'linear-gradient(to bottom, #FFD43B 0%, #FFD43B 50%, #242629 50%, #242629 75%, #C5CAD0 75%, #C5CAD0 100%)', color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', WebkitTextStroke: '0.35px #242629', transform: 'scale(1.12)' }}>K</span>
                <span className="inline-block" style={{ backgroundImage: 'linear-gradient(to bottom, #FFD43B 0%, #FFD43B 50%, #242629 50%, #242629 75%, #C5CAD0 75%, #C5CAD0 100%)', color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', WebkitTextStroke: '0.35px #242629', transform: 'scale(1.12)' }}>C</span>
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm">KaamConnect</span>
                <p className="text-[11px] text-slate-500">
                  Kalyani & Nadia District Informal Worker Empowerment Initiative • Express.js + React Full-Stack
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5 text-slate-600 font-medium">
              <span>Kalyani Municipality Helpline: 1800-345-3232</span>
              <span>•</span>
              <span>Nadia District Labor Office, Krishnanagar</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                100% Zero Middleman Commission
              </span>
            </div>

            <div className="text-slate-400 text-[11px]">
              © {2026} KaamConnect. All rights reserved.
            </div>
          </div>
        </footer>
      </div>

      {/* Booking Wizard Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        preselectedCategory={bookingPreselectedCat}
        preselectedWorker={bookingPreselectedWorker}
        selectedLocation={selectedLocation}
        onBookingConfirmed={handleBookingConfirmed}
        language={language}
        categories={services}
        workers={workers}
      />

      {/* Live Tracking Modal */}
      {activeBooking && (
        <LiveTracking
          booking={activeBooking}
          isOpen={isLiveTrackingOpen}
          onClose={() => setIsLiveTrackingOpen(false)}
          onUpdateStatus={handleUpdateBookingStatus}
          onCompleteBooking={handleCompleteBooking}
          canUpdateStatus={profile?.role === 'worker'}
          language={language}
          onOpenChat={() => openBookingChat(activeBooking)}
        />
      )}

      {/* Interactive Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
