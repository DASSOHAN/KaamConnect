import React, { useState } from 'react';
import { 
  Star, 
  ShieldCheck, 
  MapPin, 
  Languages,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { TRANSLATIONS } from '../utils/i18n';

export const WorkerCard = ({
  worker,
  onBook,
  language,
  _onContact,
  onOpenProfile,
}) => {
  const [showReviews, setShowReviews] = useState(false);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const getLocalizedWorkerName = (w) => {
    if (language === 'bn') return w.nameBn || w.name;
    if (language === 'hi') return w.nameHi || w.name;
    return w.name;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-subtle hover:shadow-card transition-all duration-200 p-5 flex flex-col justify-between">
      <div>
        {/* Top Info: Avatar, Name, Verification Badge, Distance */}
        <div className="flex items-start gap-3.5 mb-3.5">
          <div className="relative">
            <img
              src={worker.avatar}
              alt={worker.name}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
            />
            {worker.isAvailable ? (
              <span 
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"
                title="Available Now"
              ></span>
            ) : (
              <span 
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-400 border-2 border-white rounded-full"
                title="Currently on a job"
              ></span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button type="button" onClick={() => onOpenProfile?.(worker)} className="text-left text-base font-bold text-slate-900 truncate hover:text-blue-700">
                {getLocalizedWorkerName(worker)}
              </button>
              {worker.isDemo ? (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200"
                  title="Fictional demonstration profile"
                >
                  Demo Profile
                </span>
              ) : worker.kycVerified && (
                <span 
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200"
                  title="Aadhaar KYC & Local Police Verification Cleared"
                >
                  <ShieldCheck className="w-3 h-3 text-blue-600" />
                  <span>Govt ID Verified</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 font-medium">{worker.tradeTitle}</p>

            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1 text-amber-600 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                {worker.rating}
                <span className="text-slate-400 font-normal">({worker.completedJobs} {t.jobsCompleted})</span>
              </span>
              <span>•</span>
              <span className="text-slate-600">{worker.experienceYears} {t.yearsExp}</span>
            </div>
          </div>
        </div>

        {/* Location & Languages */}
        <div className="space-y-1.5 py-2.5 border-y border-slate-100 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
              <span className="truncate">{worker.locality}</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md flex-shrink-0">
              {worker.distanceKm} km away
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Languages className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">Speaks: {worker.languages?.join(', ')}</span>
          </div>
        </div>

        {/* Skill Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {worker.skills?.map((skill, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-700 font-medium"
            >
              {skill}
            </span>
          ))}
        </div>

        {/* Reviews Accordion toggle */}
        {worker.recentReviews?.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowReviews(!showReviews)}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <span>{showReviews ? 'Hide Local Reviews' : `See ${worker.recentReviews.length} Kalyani reviews`}</span>
              {showReviews ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showReviews && (
              <div className="mt-2 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                {worker.recentReviews.map((rev) => (
                  <div key={rev.id} className="border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{rev.author} ({rev.locality})</span>
                      <span className="text-[10px] text-slate-500">{rev.date}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">"{rev.comment}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Fair Daily Rates & CTAs */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fair Wage</span>
          <div className="text-sm font-bold text-slate-900 font-mono">
            ₹{worker.halfDayRate} <span className="text-[11px] text-slate-500 font-normal">/ half day</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onBook(worker)}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition active:scale-95"
          >
            {t.bookNow}
          </button>
        </div>
      </div>
    </div>
  );
};
