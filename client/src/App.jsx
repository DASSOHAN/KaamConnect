import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ServiceGrid } from './components/ServiceGrid';
import { WorkerList } from './components/WorkerList';
import { BookingModal } from './components/BookingModal';
import { LiveTracking } from './components/LiveTracking';
import { WorkerDashboard } from './components/WorkerDashboard';
import { AdminView } from './components/AdminView';
import { FairWageExplainer } from './components/FairWageExplainer';
import { ToastContainer } from './components/Toast';
import { api } from './services/api';
import { TRANSLATIONS } from './utils/i18n';
import { 
  MapPin, 
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export function App() {
  // Global States
  const [currentRole, setCurrentRole] = useState('customer');
  const [language, setLanguage] = useState('en');
  const [selectedRadius, setSelectedRadius] = useState(3);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isMobileEmulation, setIsMobileEmulation] = useState(false);

  // Dynamic Backend Data State
  const [locations, setLocations] = useState([
    { id: 'ghoshpara', name: 'Ghoshpara Station Rd', nameBn: 'ঘোষপাড়া স্টেশন রোড', nameHi: 'ঘোষপাड़ा স্টেশন রোড', wardOrBlock: 'Ward 8, Kalyani', isPopular: true },
    { id: 'central-park', name: 'Kalyani Central Park', nameBn: 'কল্যাণী সেন্ট্রাল পার্ক', nameHi: 'कल्याणी सेंट्रल पार्क', wardOrBlock: 'B-Block', isPopular: true },
    { id: 'b-block', name: 'B-Block Market & More', nameBn: 'বি-ব্লক মার্কেট মোড়', nameHi: 'बी-ब्लॉक मार्केट मोड़', wardOrBlock: 'Block B', isPopular: true },
    { id: 'station', name: 'Kalyani Main Railway Station', nameBn: 'কল্যাণী মেইন স্টেশন', nameHi: 'कल्याणी मुख्य रेलवे स्टेशन', wardOrBlock: 'Station Area', isPopular: true }
  ]);
  const [selectedLocation, setSelectedLocation] = useState(locations[0]);
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
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

  // Fetch initial data from Express backend on mount
  useEffect(() => {
    async function loadBackendData() {
      const [locs, srvs, wrks, anl, job] = await Promise.all([
        api.getLocations(),
        api.getServices(),
        api.getWorkers(),
        api.getAnalytics(),
        api.getIncomingJob()
      ]);

      if (locs && locs.length > 0) {
        setLocations(locs);
        setSelectedLocation(locs[0]);
      }
      if (srvs && srvs.length > 0) setServices(srvs);
      if (wrks && wrks.length > 0) setWorkers(wrks);
      if (anl) setAnalytics(anl);
      if (job) setIncomingJob(job);
    }

    loadBackendData();
  }, []);

  // Handlers for booking triggers
  const handleOpenBookingForCategory = (category) => {
    setBookingPreselectedCat(category);
    setBookingPreselectedWorker(null);
    setIsBookingModalOpen(true);
  };

  const handleOpenBookingForWorker = (worker) => {
    const cat = services.find((c) => c.id === worker.tradeId) || services[0];
    setBookingPreselectedCat(cat);
    setBookingPreselectedWorker(worker);
    setIsBookingModalOpen(true);
  };

  const handleBookingConfirmed = async (newBookingData) => {
    const createdBooking = await api.createBooking(newBookingData);
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
    await api.updateBookingStatus(activeBooking.id, newStatus);
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
    await api.reviewBooking(activeBooking.id, rating, tip, review);
    const finalAmount = activeBooking.finalPrice + tip;
    showToast(
      'Thank you!',
      `₹${finalAmount} paid directly to ${activeBooking.worker?.name}. Review posted.`,
      'success'
    );
  };

  const handleToggleWorkerKyc = async (workerId, newKyc) => {
    await api.toggleWorkerKyc(workerId, newKyc);
    setWorkers((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, kycVerified: newKyc, aadhaarVerified: newKyc } : w))
    );
    showToast(
      newKyc ? 'KYC Approved' : 'KYC Suspended',
      'Worker verification status updated on Express backend',
      newKyc ? 'success' : 'warning'
    );
  };

  const handleContactWorker = (type, workerOrPhone, workerName) => {
    const phone = typeof workerOrPhone === 'string' ? workerOrPhone : workerOrPhone.phone;
    const name = typeof workerOrPhone === 'string' ? workerName : workerOrPhone.name;

    if (type === 'call') {
      showToast(
        `Connecting Call to ${name}`,
        `Dialing ${phone} via local cellular network`,
        'info'
      );
      window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
    } else {
      showToast(
        `Opening WhatsApp for ${name}`,
        `Sending task address notes directly via WhatsApp`,
        'success'
      );
      const cleanPhone = phone.replace(/[^\d]/g, '');
      const text = encodeURIComponent(`Hello ${name}, I am contacting you from KaamConnect Kalyani regarding a home repair task.`);
      window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    }
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
          setRole={setCurrentRole}
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
          locations={locations}
        />

        {/* Main Content Area by Perspective Role */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 w-full">
          {/* CUSTOMER PERSPECTIVE */}
          {currentRole === 'customer' && (
            <div className="space-y-6">
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
                    onClick={() => {
                      if (services.length > 0) {
                        setBookingPreselectedCat(services[0]);
                      }
                      setBookingPreselectedWorker(null);
                      setIsBookingModalOpen(true);
                    }}
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
                onOpenBooking={() => {
                  if (services.length > 0) {
                    setBookingPreselectedCat(services[0]);
                  }
                  setIsBookingModalOpen(true);
                }}
              />

              {/* Interactive Worker List with Filtering */}
              <WorkerList
                workers={workers}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onBookWorker={handleOpenBookingForWorker}
                language={language}
                onContactWorker={(type, w) => handleContactWorker(type, w)}
                selectedRadius={selectedRadius}
              />
            </div>
          )}

          {/* WORKER COCKPIT PERSPECTIVE */}
          {currentRole === 'worker' && (
            <WorkerDashboard
              language={language}
              showToast={showToast}
              workers={workers}
              incomingJobData={incomingJob}
              onJobAcceptedByWorker={(job) => {
                const matchingWorker = workers[0];
                setActiveBooking({
                  id: `BK-KLY-${Math.floor(1000 + Math.random() * 9000)}`,
                  customerName: job.customerName,
                  customerPhone: '+91 98300 55410',
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
            />
          )}

          {/* REGIONAL ADMIN HUB */}
          {currentRole === 'admin' && (
            <AdminView 
              language={language} 
              showToast={showToast} 
              workers={workers}
              analytics={analytics}
              onToggleWorkerKyc={handleToggleWorkerKyc}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer className="mt-16 bg-white border-t border-slate-200 py-10 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                <span className="text-blue-400">K</span>
                <span className="text-emerald-400">C</span>
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
              © {new Date().getFullYear()} KaamConnect. All rights reserved.
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
          language={language}
          onContactWorker={(type, phone, name) => handleContactWorker(type, phone, name)}
        />
      )}

      {/* Interactive Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
