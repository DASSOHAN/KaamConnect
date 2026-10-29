import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Clock, 
  MapPin, 
  Calendar, 
  Calculator, 
  Radar, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { 
  ServiceCategory, 
  ServiceTask, 
  Worker, 
  Booking, 
  Language, 
  KalyaniLocation 
} from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { SERVICE_CATEGORIES, MOCK_WORKERS, KALYANI_LOCATIONS } from '../data/mockData';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCategory?: ServiceCategory;
  preselectedWorker?: Worker;
  selectedLocation: KalyaniLocation;
  onBookingConfirmed: (booking: Booking) => void;
  language: Language;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  preselectedCategory,
  preselectedWorker,
  selectedLocation,
  onBookingConfirmed,
  language,
}) => {
  const t = TRANSLATIONS[language];

  // Steps: 1: Task Selection, 2: Slot/Type, 3: Address, 4: Fair Price Calculator, 5: Matching Radar
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form State
  const [selectedCat, setSelectedCat] = useState<ServiceCategory>(
    preselectedCategory || SERVICE_CATEGORIES[0]
  );
  const [selectedTask, setSelectedTask] = useState<ServiceTask>(
    (preselectedCategory || SERVICE_CATEGORIES[0]).popularTasks[0]
  );
  const [bookingType, setBookingType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDay, setScheduledDay] = useState<'today' | 'tomorrow'>('today');
  const [scheduledTime, setScheduledTime] = useState<string>('02:00 PM - 04:00 PM');
  const [addressDetails, setAddressDetails] = useState('Flat 3A, Nibedita Apartment, near Ghoshpara Station Road');
  const [customerPhone, setCustomerPhone] = useState('+91 98300 12345');
  const [customerName, setCustomerName] = useState('Anirban Roy');
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'upi'>('upi');

  // Radar Simulation State
  const [radarProgress, setRadarProgress] = useState(0);
  const [matchedWorker, setMatchedWorker] = useState<Worker | null>(null);

  // Sync props when modal opens
  useEffect(() => {
    if (preselectedCategory) {
      setSelectedCat(preselectedCategory);
      setSelectedTask(preselectedCategory.popularTasks[0]);
    } else if (preselectedWorker) {
      const cat = SERVICE_CATEGORIES.find((c) => c.id === preselectedWorker.tradeId) || SERVICE_CATEGORIES[0];
      setSelectedCat(cat);
      setSelectedTask(cat.popularTasks[0]);
    }
  }, [preselectedCategory, preselectedWorker]);

  // Handle Radar Simulation in Step 5
  useEffect(() => {
    if (currentStep === 5) {
      setRadarProgress(15);
      const t1 = setTimeout(() => setRadarProgress(45), 1000);
      const t2 = setTimeout(() => setRadarProgress(80), 2200);
      const t3 = setTimeout(() => {
        setRadarProgress(100);
        // Find best worker (preselected worker or closest matching worker)
        const worker = preselectedWorker || 
          MOCK_WORKERS.find(w => w.tradeId === selectedCat.id && w.isAvailable) || 
          MOCK_WORKERS[0];
        setMatchedWorker(worker);

        // Auto trigger confirmation after brief celebration
        setTimeout(() => {
          const newBooking: Booking = {
            id: `BK-KLY-${Math.floor(1000 + Math.random() * 9000)}`,
            customerName: customerName.trim() || 'Valued Kalyani Resident',
            customerPhone: customerPhone.trim() || '+91 98300 00000',
            serviceId: selectedCat.id,
            serviceName: selectedCat.name,
            taskId: selectedTask.id,
            taskName: selectedTask.name,
            locality: selectedLocation.name,
            addressDetails,
            bookingType,
            scheduledDate: bookingType === 'scheduled' ? scheduledDay : undefined,
            scheduledSlot: bookingType === 'scheduled' ? scheduledTime : undefined,
            estimatedPriceMin: selectedTask.basePrice,
            estimatedPriceMax: Math.round(selectedTask.basePrice * 1.3),
            finalPrice: selectedTask.basePrice,
            status: 'en_route',
            workerId: worker.id,
            worker: worker,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            otp: String(Math.floor(1000 + Math.random() * 9000)),
            paymentMethod: selectedPayment,
          };
          onBookingConfirmed(newBooking);
        }, 1400);
      }, 3400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [currentStep]);

  if (!isOpen) return null;

  // Calculation figures
  const baseVisitFee = 79;
  const taskPrice = selectedTask.basePrice;
  const laborPactDeduction = 0; // Fair transparent wage
  const commissionCut = 0; // 0% platform extraction
  const totalPrice = baseVisitFee + taskPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-elevated border border-slate-200 overflow-hidden flex flex-col my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Kalyani Fast Dispatch
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">{selectedLocation.name}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              Book {selectedCat.name}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
            aria-label="Close booking modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Progress Indicator */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-semibold ${currentStep === 1 ? 'text-blue-600' : 'text-slate-400'}`}>
              1. Task
            </span>
            <div className={`h-0.5 flex-1 mx-2 ${currentStep > 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`font-semibold ${currentStep === 2 ? 'text-blue-600' : 'text-slate-400'}`}>
              2. Slot
            </span>
            <div className={`h-0.5 flex-1 mx-2 ${currentStep > 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`font-semibold ${currentStep === 3 ? 'text-blue-600' : 'text-slate-400'}`}>
              3. Address
            </span>
            <div className={`h-0.5 flex-1 mx-2 ${currentStep > 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`font-semibold ${currentStep === 4 ? 'text-blue-600' : 'text-slate-400'}`}>
              4. Fair Price
            </span>
            <div className={`h-0.5 flex-1 mx-2 ${currentStep > 4 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`font-semibold ${currentStep === 5 ? 'text-emerald-600' : 'text-slate-400'}`}>
              5. Radar
            </span>
          </div>
        </div>

        {/* Modal Body: Dynamic Step Content */}
        <div className="p-6 overflow-y-auto max-h-[68vh]">
          {/* STEP 1: Select Trade & Specific Task */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Select Trade Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SERVICE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCat(cat);
                        setSelectedTask(cat.popularTasks[0]);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition text-xs font-semibold ${
                        selectedCat.id === cat.id
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Choose Specific Task Needed
                </label>
                <div className="space-y-2">
                  {selectedCat.popularTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                        selectedTask.id === task.id
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{task.name}</span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            ~{task.estMinutes} mins
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{task.description}</p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-slate-400 uppercase font-medium block">Starting</span>
                        <span className="text-base font-extrabold text-slate-900 font-mono">
                          ₹{task.basePrice}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Date & Time Slot Picker */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Dispatch Preference
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setBookingType('immediate')}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      bookingType === 'immediate'
                        ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        ⚡ Instant Dispatch
                      </span>
                      {bookingType === 'immediate' && (
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900">Rapido / Zepto Style</div>
                    <p className="text-xs text-slate-600 mt-1">
                      Nearest verified worker dispatched immediately. Expected arrival in 12–15 mins.
                    </p>
                  </div>

                  <div
                    onClick={() => setBookingType('scheduled')}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      bookingType === 'scheduled'
                        ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                        📅 Schedule Later
                      </span>
                      {bookingType === 'scheduled' && (
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900">Pick Slot</div>
                    <p className="text-xs text-slate-600 mt-1">
                      Lock in a certified technician for today afternoon or tomorrow morning.
                    </p>
                  </div>
                </div>
              </div>

              {bookingType === 'scheduled' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">Select Day</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setScheduledDay('today')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                          scheduledDay === 'today'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setScheduledDay('tomorrow')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                          scheduledDay === 'tomorrow'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Tomorrow
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">Select Time Window</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        '09:00 AM - 11:00 AM',
                        '11:30 AM - 01:30 PM',
                        '02:00 PM - 04:00 PM',
                        '05:00 PM - 07:00 PM',
                      ].map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setScheduledTime(slot)}
                          className={`p-2.5 rounded-xl text-xs font-semibold border transition text-left ${
                            scheduledTime === slot
                              ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Address & Contact Details */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Kalyani Locality
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>{selectedLocation.name} ({selectedLocation.wardOrBlock})</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Complete Address & Landmark Note
                </label>
                <textarea
                  rows={3}
                  value={addressDetails}
                  onChange={(e) => setAddressDetails(e.target.value)}
                  placeholder="House / Flat no, apartment name, nearby gate or landmark..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedPayment('upi')}
                    className={`p-3 rounded-xl border font-semibold flex items-center justify-between ${
                      selectedPayment === 'upi'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>UPI (GPay / PhonePe / Paytm)</span>
                    {selectedPayment === 'upi' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPayment('cash')}
                    className={`p-3 rounded-xl border font-semibold flex items-center justify-between ${
                      selectedPayment === 'cash'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Cash on Completion</span>
                    {selectedPayment === 'cash' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: AI Fair-Price Transparency Calculator */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Nadia Fair-Wage Transparency Engine</span>
                  </div>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    No Hidden Surcharges
                  </span>
                </div>

                <div className="text-2xl font-extrabold tracking-tight font-mono text-white">
                  ₹{totalPrice}
                  <span className="text-xs text-slate-400 font-normal ml-2">
                    (Fair rate range: ₹{totalPrice} - ₹{Math.round(totalPrice * 1.2)})
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  100% of this fee goes directly to your technician. KaamConnect does NOT take commission from informal workers.
                </p>
              </div>

              {/* Itemized Price Breakdown */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2.5 text-xs">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-100">
                  Rate Breakdown (Nadia District Standard)
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>{t.baseFare} (inspection & tools)</span>
                  <span className="font-mono font-semibold text-slate-800">₹{baseVisitFee}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>{selectedTask.name} ({selectedTask.estMinutes} mins standard labor)</span>
                  <span className="font-mono font-semibold text-slate-800">₹{taskPrice}</span>
                </div>

                <div className="flex items-center justify-between text-emerald-700 font-medium">
                  <span>KaamConnect Platform Commission Cut</span>
                  <span className="font-mono font-bold">₹0 (Free)</span>
                </div>

                <div className="flex items-center justify-between text-emerald-700 font-medium">
                  <span>Surge Pricing Markup</span>
                  <span className="font-mono font-bold">₹0 (Zero Surge)</span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
                  <span>Total Estimated Fair Price</span>
                  <span className="font-mono text-base text-blue-700">₹{totalPrice}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  If spare materials or wires are needed, the technician will show you the original GST retail bill from Kalyani hardware stores with zero markup.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Matching Radar Screen */}
          {currentStep === 5 && (
            <div className="py-6 text-center space-y-6">
              {/* Radar Pulse Visual */}
              <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
                {/* Expanding pulse rings */}
                <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-radar-ring-1"></div>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-radar-ring-2"></div>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-radar-ring-3"></div>

                {/* Central pin circle */}
                <div className="relative z-10 w-20 h-20 rounded-full bg-slate-900 text-white flex flex-col items-center justify-center shadow-elevated border-2 border-blue-400">
                  <Radar className="w-8 h-8 text-blue-400 animate-spin" style={{ animationDuration: '4s' }} />
                  <span className="text-[10px] font-bold text-emerald-400 mt-1">Kalyani</span>
                </div>
              </div>

              <div className="max-w-xs mx-auto">
                <h4 className="text-base font-bold text-slate-900">
                  {radarProgress < 100 
                    ? `Searching verified ${selectedCat.name}s near ${selectedLocation.name}...` 
                    : `Verified Worker Matched!`}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {radarProgress < 50 && "Scanning Kalyani B-Block, Ghoshpara & Central Park..."}
                  {radarProgress >= 50 && radarProgress < 100 && "Matching highest-rated technician with required tools..."}
                  {radarProgress === 100 && matchedWorker && `Found ${matchedWorker.name} (0.9 km away). Dispatching now...`}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${radarProgress}%` }}
                ></div>
              </div>

              {matchedWorker && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-left animate-in fade-in zoom-in-95">
                  <img
                    src={matchedWorker.avatar}
                    alt={matchedWorker.name}
                    className="w-12 h-12 rounded-xl object-cover border border-emerald-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900">{matchedWorker.name}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <p className="text-xs text-emerald-800 font-medium">En route • ETA 11 mins</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {currentStep < 5 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep((currentStep - 1) as any)}
                className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div></div>
            )}

            <button
              onClick={() => {
                if (currentStep < 4) {
                  setCurrentStep((currentStep + 1) as any);
                } else if (currentStep === 4) {
                  setCurrentStep(5);
                }
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition active:scale-95"
            >
              <span>
                {currentStep === 1 && 'Next: Select Time Slot'}
                {currentStep === 2 && 'Next: Enter Address'}
                {currentStep === 3 && 'Next: View Fair Price'}
                {currentStep === 4 && t.confirmAndFindWorker}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
