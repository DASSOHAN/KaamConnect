import React, { useState } from 'react';
import { 
  Language, 
  UserRole, 
  ServiceCategory, 
  ServiceCategoryId, 
  Worker, 
  Booking, 
  BookingStatus,
  KalyaniLocation 
} from './types';
import { Header } from './components/Header';
import { ServiceGrid } from './components/ServiceGrid';
import { WorkerList } from './components/WorkerList';
import { BookingModal } from './components/BookingModal';
import { LiveTracking } from './components/LiveTracking';
import { WorkerDashboard } from './components/WorkerDashboard';
import { AdminView } from './components/AdminView';
import { FairWageExplainer } from './components/FairWageExplainer';
import { ToastContainer, ToastMessage } from './components/Toast';
import { 
  SERVICE_CATEGORIES, 
  MOCK_WORKERS, 
  KALYANI_LOCATIONS 
} from './data/mockData';
import { TRANSLATIONS } from './utils/i18n';
import { 
  MapPin, 
  Phone, 
  ShieldCheck, 
  Heart, 
  Sparkles, 
  ArrowRight,
  HelpCircle,
  Smartphone
} from 'lucide-react';

export function App() {
  // Global App States
  const [currentRole, setCurrentRole] = useState<UserRole>('customer');
  const [language, setLanguage] = useState<Language>('en');
  const [selectedLocation, setSelectedLocation] = useState<KalyaniLocation>(KALYANI_LOCATIONS[0]);
  const [selectedRadius, setSelectedRadius] = useState<number>(3); // 3 km default
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoryId | 'all'>('all');
  const [isMobileEmulation, setIsMobileEmulation] = useState<boolean>(false);

  // Booking Flow States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingPreselectedCat, setBookingPreselectedCat] = useState<ServiceCategory | undefined>(undefined);
  const [bookingPreselectedWorker, setBookingPreselectedWorker] = useState<Worker | undefined>(undefined);

  // Active Live Booking State
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState<boolean>(false);

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const t = TRANSLATIONS[language];

  const showToast = (title: string, message?: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Handlers for booking triggers
  const handleOpenBookingForCategory = (category: ServiceCategory) => {
    setBookingPreselectedCat(category);
    setBookingPreselectedWorker(undefined);
    setIsBookingModalOpen(true);
  };

  const handleOpenBookingForWorker = (worker: Worker) => {
    const cat = SERVICE_CATEGORIES.find((c) => c.id === worker.tradeId) || SERVICE_CATEGORIES[0];
    setBookingPreselectedCat(cat);
    setBookingPreselectedWorker(worker);
    setIsBookingModalOpen(true);
  };

  const handleBookingConfirmed = (newBooking: Booking) => {
    setActiveBooking(newBooking);
    setIsBookingModalOpen(false);
    setIsLiveTrackingOpen(true);
    showToast(
      'Worker Dispatched!',
      `${newBooking.worker?.name || 'Technician'} is en route to ${newBooking.locality}. Share OTP: ${newBooking.otp}`,
      'success'
    );
  };

  const handleUpdateBookingStatus = (newStatus: BookingStatus) => {
    if (!activeBooking) return;
    setActiveBooking((prev) => prev ? { ...prev, status: newStatus } : null);
    
    if (newStatus === 'arrived') {
      showToast('Worker Arrived', `${activeBooking.worker?.name} has arrived at your address`, 'info');
    } else if (newStatus === 'in_progress') {
      showToast('Work In Progress', 'OTP verified. Task execution started', 'info');
    } else if (newStatus === 'completed') {
      showToast('Job Completed!', 'Please verify work, provide tip, and leave a review', 'success');
    }
  };

  const handleCompleteBooking = (rating: number, tip: number, review: string) => {
    if (!activeBooking) return;
    const finalAmount = activeBooking.finalPrice + tip;
    showToast(
      'Thank you!',
      `₹${finalAmount} paid directly to ${activeBooking.worker?.name}. Review posted.`,
      'success'
    );
    // Keep reference in history or reset
  };

  const handleContactWorker = (type: 'call' | 'whatsapp', workerOrPhone: Worker | string, workerName?: string) => {
    const phone = typeof workerOrPhone === 'string' ? workerOrPhone : workerOrPhone.phone;
    const name = typeof workerOrPhone === 'string' ? workerName : workerOrPhone.name;

    if (type === 'call') {
      showToast(
        `Connecting Call to ${name}`,
        `Dialing ${phone} via local Nadia cellular network`,
        'info'
      );
      // Initiate phone protocol
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
                      Dispatched from <span className="text-blue-700">{selectedLocation.name}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Average arrival time: <strong className="text-slate-800">11 mins</strong> • Radius: {selectedRadius} km
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setBookingPreselectedCat(SERVICE_CATEGORIES[0]);
                      setBookingPreselectedWorker(undefined);
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
                categories={SERVICE_CATEGORIES}
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
                  setBookingPreselectedCat(SERVICE_CATEGORIES[0]);
                  setIsBookingModalOpen(true);
                }}
              />

              {/* Interactive Worker List with Filtering */}
              <WorkerList
                workers={MOCK_WORKERS}
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
              onJobAcceptedByWorker={(job) => {
                // If worker accepts, simulate active booking
                const matchingWorker = MOCK_WORKERS[0];
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
                  estimatedPriceMin: job.payoutAmount,
                  estimatedPriceMax: job.payoutAmount,
                  finalPrice: job.payoutAmount,
                  status: 'en_route',
                  workerId: matchingWorker.id,
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
            <AdminView language={language} showToast={showToast} />
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
                  Kalyani & Nadia District Informal Worker Empowerment Initiative
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
