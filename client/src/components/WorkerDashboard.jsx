import React, { useState, useEffect } from 'react';
import { 
  Power, 
  Volume2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  Briefcase,
  Star,
  Settings,
  Sparkles
} from 'lucide-react';
import { TRANSLATIONS } from '../utils/i18n';
import { VoiceAssistant } from '../utils/voice';
import { DEFAULT_AVATAR } from '../utils/defaultAvatar';

export const WorkerDashboard = ({
  language,
  onJobAcceptedByWorker,
  showToast,
  workers = [],
  incomingJobData = null
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const defaultWorker = workers[0] || {
    id: 'w-subrata-das',
    name: 'Subrata Das',
    nameBn: 'সুব্রত দাস',
    tradeTitle: 'Certified Electrician & Wireman',
    locality: 'Ghoshpara Station Rd, Kalyani',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
    rating: 4.9,
    completedJobs: 142,
    halfDayRate: 380,
    dailyRate: 650,
    isAvailable: true,
  };

  const [worker, setWorker] = useState(defaultWorker);
  const [isDutyOn, setIsDutyOn] = useState(true);
  const [incomingJob, setIncomingJob] = useState(incomingJobData);
  const [countdown, setCountdown] = useState(58);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLang, setAudioLang] = useState('bn');

  // Daily earnings local state
  const [todayEarnings, setTodayEarnings] = useState(1450);
  const [completedJobsCount, setCompletedJobsCount] = useState(3);

  // Rate card modal state
  const [halfDayRate, setHalfDayRate] = useState(defaultWorker.halfDayRate);
  const [dailyRate, setDailyRate] = useState(defaultWorker.dailyRate);
  const [isEditingRates, setIsEditingRates] = useState(false);

  useEffect(() => {
    if (incomingJobData) {
      setIncomingJob(incomingJobData);
      setCountdown(incomingJobData.expiresInSeconds || 58);
    }
  }, [incomingJobData]);

  // Countdown timer for incoming job alert
  useEffect(() => {
    let timer;
    if (incomingJob && countdown > 0 && isDutyOn) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setIncomingJob(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [incomingJob, countdown, isDutyOn]);

  const handlePlayVoicePrompt = (langToUse) => {
    if (!incomingJob) return;

    if (isPlayingAudio && audioLang === langToUse) {
      VoiceAssistant.stop();
      setIsPlayingAudio(false);
      return;
    }

    setAudioLang(langToUse);
    setIsPlayingAudio(true);

    VoiceAssistant.speakJobAlert(
      {
        serviceTitle: incomingJob.serviceTitle,
        locality: incomingJob.locality,
        distanceKm: incomingJob.distanceKm,
        payoutAmount: incomingJob.payoutAmount,
      },
      langToUse,
      () => setIsPlayingAudio(true),
      () => setIsPlayingAudio(false)
    );

    showToast(
      langToUse === 'bn' ? 'ভয়েস বার্তা শুরু হয়েছে' : 'ध्वनि संदेश प्रारंभ हुआ',
      langToUse === 'bn' ? 'কাজের বিবরণ বাংলায় পড়ে শোনানো হচ্ছে' : 'काम का विवरण हिंदी में सुनाया जा रहा है',
      'info'
    );
  };

  const handleAcceptJob = () => {
    if (!incomingJob) return;
    VoiceAssistant.stop();
    setIsPlayingAudio(false);
    
    showToast(
      'Job Accepted! (কাজ গ্রহণ করা হয়েছে)',
      `Dispatched to ${incomingJob.locality}. Customer has been notified.`,
      'success'
    );

    if (onJobAcceptedByWorker) {
      onJobAcceptedByWorker(incomingJob);
    }

    setTodayEarnings((prev) => prev + incomingJob.payoutAmount);
    setCompletedJobsCount((prev) => prev + 1);
    setIncomingJob(null);
  };

  const handleDeclineJob = () => {
    VoiceAssistant.stop();
    setIsPlayingAudio(false);
    setIncomingJob(null);
    showToast('Job Declined', 'Alert passed to next nearest verified worker in Kalyani', 'info');
  };

  const handleSimulateNewAlert = () => {
    setCountdown(60);
    setIncomingJob({
      id: `req-kly-${Math.floor(100 + Math.random() * 900)}`,
      serviceId: worker.tradeId || 'electrician',
      serviceTitle: `${worker.tradeTitle || 'Electrician'}`,
      taskTitle: 'Urgent Main Line Earthing Repair',
      locality: 'Central Park Gate 3, Kalyani',
      distanceKm: 0.8,
      payoutAmount: 520,
      customerName: 'Prof. S. Sengupta',
      timeRequested: 'Just now',
      expiresInSeconds: 60,
      addressNote: 'Near Central Park Post Office',
    });
    showToast('New Job Dispatched', 'Simulated incoming request triggered!', 'info');
  };

  return (
    <div className="py-6 sm:py-8 space-y-6 max-w-5xl mx-auto">
      {/* Worker Header & Accessibility Badge */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-card border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={worker.avatar || DEFAULT_AVATAR}
                alt={worker.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-slate-700"
              />
              <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 ${
                isDutyOn ? 'bg-emerald-500' : 'bg-rose-500'
              }`}></span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {worker.name} ({worker.nameBn})
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t.kycVerifiedBadge}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                {worker.tradeTitle} • Base: {worker.locality}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {worker.rating} Rating
                </span>
                <span>•</span>
                <span>{worker.completedJobs} Lifetime Bookings</span>
              </div>
            </div>
          </div>

          {/* Large Duty Switch (Optimized for one-touch mobile use) */}
          <div className="flex flex-col items-stretch sm:items-end gap-2">
            <button
              onClick={() => {
                const nextDuty = !isDutyOn;
                setIsDutyOn(nextDuty);
                showToast(
                  nextDuty ? 'Duty ON: Ready for Jobs' : 'Duty OFF: Offline',
                  nextDuty ? 'You will now receive booking requests in Kalyani' : 'Incoming alerts paused',
                  nextDuty ? 'success' : 'info'
                );
              }}
              className={`px-6 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-elevated ${
                isDutyOn
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <Power className="w-6 h-6 stroke-[3]" />
              <span>{isDutyOn ? t.dutyOn : t.dutyOff}</span>
            </button>
            <span className="text-[11px] text-slate-400 text-center sm:text-right">
              {isDutyOn ? t.dutyOnDesc : t.dutyOffDesc}
            </span>
          </div>
        </div>
      </div>

      {/* INCOMING JOB ALERT BANNER */}
      {isDutyOn && incomingJob ? (
        <div className="relative bg-amber-500/10 border-2 border-amber-500 rounded-3xl p-6 sm:p-7 shadow-elevated animate-pulse-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
              <h2 className="text-lg sm:text-xl font-black text-slate-950">
                {t.jobAlert}
              </h2>
            </div>

            <div className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-slate-950 rounded-xl font-mono font-black text-sm">
              <Clock className="w-4 h-4" />
              <span>{countdown}s</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-5">
            <div>
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Service & Task
              </span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {incomingJob.serviceTitle}
              </div>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {incomingJob.taskTitle}
              </p>
              <p className="text-xs text-slate-600 mt-2 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                <strong>Address Note:</strong> {incomingJob.addressNote}
              </p>
            </div>

            <div className="flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-amber-200">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Distance</span>
                  <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>{incomingJob.distanceKm} km ({incomingJob.locality})</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 font-semibold block">{t.payoutFairWage}</span>
                  <div className="text-2xl font-black font-mono text-emerald-700">
                    ₹{incomingJob.payoutAmount}
                  </div>
                </div>
              </div>

              {/* Audio Accessibility Prompt */}
              <div className="p-3.5 bg-white rounded-2xl border border-amber-300 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    Audio Assistance (অডিও নির্দেশিকা)
                  </span>
                  {isPlayingAudio && (
                    <div className="flex items-center gap-1">
                      <span className="w-1 bg-blue-600 rounded wave-bar-1"></span>
                      <span className="w-1 bg-blue-600 rounded wave-bar-2"></span>
                      <span className="w-1 bg-blue-600 rounded wave-bar-3"></span>
                      <span className="w-1 bg-blue-600 rounded wave-bar-4"></span>
                      <span className="w-1 bg-blue-600 rounded wave-bar-5"></span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePlayVoicePrompt('bn')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      isPlayingAudio && audioLang === 'bn'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{isPlayingAudio && audioLang === 'bn' ? t.stopAudio : t.listenAudioBengali}</span>
                  </button>

                  <button
                    onClick={() => handlePlayVoicePrompt('hi')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      isPlayingAudio && audioLang === 'hi'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{isPlayingAudio && audioLang === 'hi' ? t.stopAudio : t.listenAudioHindi}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleAcceptJob}
              className="py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-black shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-6 h-6" />
              <span>{t.acceptJob}</span>
            </button>

            <button
              onClick={handleDeclineJob}
              className="py-4 px-6 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-base font-bold transition flex items-center justify-center gap-2"
            >
              <XCircle className="w-6 h-6 text-slate-500" />
              <span>{t.declineJob}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isDutyOn ? 'Waiting for New Booking Alerts...' : 'Duty is Currently OFF'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {isDutyOn
                ? 'Your location is active near Ghoshpara & B-Block. Customers will match with you based on proximity.'
                : 'Turn your duty ON at the top to receive incoming fair-wage job requests.'}
            </p>
          </div>

          {isDutyOn && (
            <button
              onClick={handleSimulateNewAlert}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Customer Job Dispatch</span>
            </button>
          )}
        </div>
      )}

      {/* Daily Earnings Summary Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-subtle">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {t.todayEarnings}
          </span>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
            ₹{todayEarnings}
          </div>
          <span className="text-xs text-emerald-700 font-semibold mt-1 block">
            +₹350 above traditional broker market
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-subtle">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {t.completedToday}
          </span>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
            {completedJobsCount} Jobs
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            100% 5-Star ratings received
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-subtle">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {t.payoutStatus}
          </span>
          <div className="text-sm font-bold text-slate-900 mt-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Direct Bank Settlement
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kalyani Gramin Bank • A/C Ending **4819 (Daily 8:00 PM auto-credit)
          </p>
        </div>
      </div>

      {/* Rate Card & Skill Profile Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t.dailyRateCard}
              </h3>
              <p className="text-xs text-slate-500">Nadia District Fair-Wage standard limits apply</p>
            </div>
            <button
              onClick={() => setIsEditingRates(!isEditingRates)}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{isEditingRates ? 'Done' : 'Adjust'}</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Half-Day (Up to 4 Hours)</span>
                <span className="text-[11px] text-slate-500">Standard switchboard / fan fixing</span>
              </div>
              {isEditingRates ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono">₹</span>
                  <input
                    type="number"
                    value={halfDayRate}
                    onChange={(e) => setHalfDayRate(Number(e.target.value))}
                    className="w-20 p-1 text-xs border rounded font-mono font-bold"
                  />
                </div>
              ) : (
                <span className="text-base font-bold font-mono text-slate-900">₹{halfDayRate}</span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Full Day (8 Hours Shift)</span>
                <span className="text-[11px] text-slate-500">Complete room wiring / renovations</span>
              </div>
              {isEditingRates ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono">₹</span>
                  <input
                    type="number"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(Number(e.target.value))}
                    className="w-20 p-1 text-xs border rounded font-mono font-bold"
                  />
                </div>
              ) : (
                <span className="text-base font-bold font-mono text-slate-900">₹{dailyRate}</span>
              )}
            </div>
          </div>
        </div>

        {/* Recent Job History Ledger */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">
              {t.jobHistory}
            </h3>
            <span className="text-xs text-slate-400 font-mono">Kalyani Ward 8</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">MCB Tripping Fix • B-Block Market</span>
                <span className="text-slate-500 text-[11px]">Today, 11:30 AM • Customer: Dr. Tanmoy Banerjee</span>
              </div>
              <span className="font-mono font-bold text-emerald-700">+₹450</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Ceiling Fan Installation • Central Park</span>
                <span className="text-slate-500 text-[11px]">Today, 02:15 PM • Customer: Soma Mukherjee</span>
              </div>
              <span className="font-mono font-bold text-emerald-700">+₹350</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Modular Switchboard Wiring • Ghoshpara</span>
                <span className="text-slate-500 text-[11px]">Today, 04:45 PM • Customer: Subhashis Sen</span>
              </div>
              <span className="font-mono font-bold text-emerald-700">+₹650</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
