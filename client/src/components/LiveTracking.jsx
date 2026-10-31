import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  ShieldCheck, 
  Star, 
  MapPin, 
  CheckCircle2, 
  KeyRound, 
  HeartHandshake, 
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TRANSLATIONS } from '../utils/i18n';
import { DEFAULT_AVATAR } from '../utils/defaultAvatar';

export const LiveTracking = ({
  booking,
  isOpen,
  onClose,
  onUpdateStatus,
  onCompleteBooking,
  language,
  onOpenChat,
  canUpdateStatus = false,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [selectedRating, setSelectedRating] = useState(5);
  const [selectedTip, setSelectedTip] = useState(50);
  const [reviewText, setReviewText] = useState('');
  const [showReviewSuccess, setShowReviewSuccess] = useState(false);

  if (!isOpen || !booking) return null;

  const worker = booking.worker;

  const handleNextStatus = () => {
    if (booking.status === 'en_route') {
      onUpdateStatus('arrived');
    } else if (booking.status === 'arrived') {
      onUpdateStatus('in_progress');
    } else if (booking.status === 'in_progress') {
      onUpdateStatus('completed');
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // ignore
      }
    }
  };

  const handleFinishReview = () => {
    onCompleteBooking(selectedRating, selectedTip, reviewText);
    setShowReviewSuccess(true);
    setTimeout(() => {
      setShowReviewSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-elevated border border-slate-200 overflow-hidden flex flex-col my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-base font-bold text-slate-900">
              {t.liveStatusTitle}
            </h3>
            <span className="text-xs font-mono text-slate-500">#{booking.id}</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto max-h-[75vh] space-y-5">
          {/* Status Stepper Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-emerald-400 font-bold uppercase tracking-wider">
                Current Status
              </span>
              <span className="text-slate-400">
                {booking.status === 'en_route' && 'ETA: ~9 minutes'}
                {booking.status === 'arrived' && 'At your door'}
                {booking.status === 'in_progress' && 'Estimated 35 mins remaining'}
                {booking.status === 'completed' && 'Payment & Review'}
              </span>
            </div>

            <div className="text-lg font-bold text-white mb-4">
              {booking.status === 'en_route' && t.statusEnRoute}
              {booking.status === 'arrived' && t.statusArrived}
              {booking.status === 'in_progress' && t.statusInProgress}
              {booking.status === 'completed' && t.statusCompleted}
            </div>

            {/* Stepper Dots */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-semibold text-slate-400">
              <div className="flex flex-col items-center gap-1">
                <div className="w-full h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-emerald-400">En Route</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-full h-1.5 rounded-full ${
                  booking.status === 'arrived' || booking.status === 'in_progress' || booking.status === 'completed' 
                    ? 'bg-emerald-500' : 'bg-slate-700'
                }`}></div>
                <span className={booking.status !== 'en_route' ? 'text-emerald-400' : ''}>Arrived</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-full h-1.5 rounded-full ${
                  booking.status === 'in_progress' || booking.status === 'completed' 
                    ? 'bg-emerald-500' : 'bg-slate-700'
                }`}></div>
                <span className={booking.status === 'in_progress' || booking.status === 'completed' ? 'text-emerald-400' : ''}>Working</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-full h-1.5 rounded-full ${
                  booking.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-700'
                }`}></div>
                <span className={booking.status === 'completed' ? 'text-emerald-400' : ''}>Complete</span>
              </div>
            </div>

            {/* OTP Box */}
            {booking.status !== 'completed' && (
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-slate-300">Start Job OTP:</span>
                </div>
                <div className="text-xl font-mono font-bold tracking-widest text-amber-300 bg-slate-900 px-3 py-0.5 rounded border border-amber-400/30">
                  {booking.otp}
                </div>
              </div>
            )}
          </div>

          {/* Worker Card */}
          {worker && (
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-subtle flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <img
                  src={worker.avatar || DEFAULT_AVATAR}
                  alt={worker.name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-base font-bold text-slate-900">{worker.name}</h4>
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-xs text-slate-500">{worker.tradeTitle}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="text-amber-600 font-bold flex items-center gap-0.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      {worker.rating}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">{worker.experienceYears} yrs in Kalyani</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-1.5">
                <button onClick={() => onOpenChat?.(booking)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-800" title="Message securely in KaamConnect">
                  <MessageSquare className="h-4 w-4" /> Chat
                </button>
              </div>
            </div>
          )}

          {/* Job Details Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span>Task: {booking.taskName}</span>
              <span className="text-sm font-bold font-mono text-slate-900">₹{booking.finalPrice}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
              <span>{booking.addressDetails}</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
              <span>Payment: {booking.paymentMethod?.toUpperCase()} on Completion</span>
              <span>100% Direct to Worker</span>
            </div>
          </div>

          {/* Interactive Simulation Helper Button */}
          {canUpdateStatus && booking.status !== 'completed' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-blue-900 block">Simulation Step Control</span>
                <span className="text-blue-700 text-[11px]">Advance worker progression without waiting</span>
              </div>
              <button
                onClick={handleNextStatus}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1"
              >
                <span>Advance to {booking.status === 'en_route' ? 'Arrived' : booking.status === 'arrived' ? 'Working' : 'Complete'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Rating, Review & Tipping Modal upon Completion */}
          {booking.status === 'completed' && (
            <div className="p-5 bg-white border-2 border-emerald-200 rounded-2xl space-y-4 animate-in fade-in">
              <div className="text-center">
                <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
                <h4 className="text-base font-bold text-slate-900">
                  Job Completed & Verified!
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  How was your experience with {worker?.name}?
                </p>
              </div>

              {/* Star Rating */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star)}
                    className="p-1 text-amber-400 hover:scale-110 transition"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= selectedRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Fair Tip for Good Service */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 text-center">
                  Add a Tip for Quality Service (100% to worker)
                </label>
                <div className="flex justify-center gap-2">
                  {[0, 20, 50, 100].map((tip) => (
                    <button
                      key={tip}
                      onClick={() => setSelectedTip(tip)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        selectedTip === tip
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {tip === 0 ? 'No Tip' : `+ ₹${tip}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Text */}
              <div>
                <textarea
                  rows={2}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Leave honest feedback for Kalyani neighbors..."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <button
                onClick={handleFinishReview}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>{showReviewSuccess ? 'Review Submitted!' : 'Submit Review & Close'}</span>
                <HeartHandshake className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
