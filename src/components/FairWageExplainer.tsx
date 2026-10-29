import React from 'react';
import { ShieldCheck, HeartHandshake, Zap, Scale, CheckCircle2 } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

interface FairWageExplainerProps {
  language: Language;
  onOpenBooking: () => void;
}

export const FairWageExplainer: React.FC<FairWageExplainerProps> = ({ language, onOpenBooking }) => {
  const t = TRANSLATIONS[language];

  return (
    <section className="my-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-6 sm:p-10 border border-slate-800 shadow-elevated overflow-hidden relative">
      {/* Background subtle geometric accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

      <div className="relative z-10 max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-4">
          <Scale className="w-3.5 h-3.5" />
          <span>The Kalyani & Nadia Fair-Wage Accord</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
          Dignity for Informal Technicians. <br className="hidden sm:inline" />
          Reliability & Honesty for Kalyani Residents.
        </h2>

        <p className="text-slate-300 text-sm sm:text-base mt-3 leading-relaxed max-w-2xl">
          Unlike corporate aggregator apps that extract 20% to 35% commission cuts or arbitrary surge pricing, KaamConnect empowers Nadia's plumbers, electricians, painters, and laborers with 100% direct payouts.
        </p>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-8">
          <div className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/80">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">0% Platform Cut</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Every single rupee calculated by our fair-wage engine goes directly to the worker's hands or UPI account.
            </p>
          </div>

          <div className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/80">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Local Police & Aadhaar KYC</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Only verified residents of Kalyani, Chakdaha, and Ranaghat with cleared credentials are dispatched to your home.
            </p>
          </div>

          <div className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/80">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">&lt; 15 Mins Rapid Dispatch</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Hyperlocal proximity matching alerts nearby available workers in Ghoshpara, B-Block, or Central Park instantly.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            onClick={onOpenBooking}
            className="px-6 py-3 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs sm:text-sm shadow-md transition transform active:scale-95 flex items-center gap-2"
          >
            <span>Book a Verified Technician Now</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </button>
          <span className="text-xs text-slate-400">
            No pre-payment required. Pay only after work is completed and verified.
          </span>
        </div>
      </div>
    </section>
  );
};
