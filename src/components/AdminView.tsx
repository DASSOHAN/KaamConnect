import React, { useState } from 'react';
import { 
  BarChart3, 
  Users, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Check, 
  X, 
  Filter, 
  Search, 
  AlertCircle,
  FileCheck,
  Building,
  ArrowUpRight,
  Sliders
} from 'lucide-react';
import { Worker, Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { DISTRICT_ANALYTICS, MOCK_WORKERS } from '../data/mockData';

interface AdminViewProps {
  language: Language;
  showToast: (title: string, message?: string, type?: 'success' | 'info' | 'warning') => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ language, showToast }) => {
  const t = TRANSLATIONS[language];
  const [workersList, setWorkersList] = useState<Worker[]>(MOCK_WORKERS);
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const toggleWorkerKyc = (workerId: string) => {
    setWorkersList((prev) =>
      prev.map((w) => {
        if (w.id === workerId) {
          const nextStatus = !w.kycVerified;
          showToast(
            nextStatus ? 'KYC Approved' : 'KYC Suspended',
            `${w.name}'s West Bengal Govt verification status updated`,
            nextStatus ? 'success' : 'warning'
          );
          return { ...w, kycVerified: nextStatus, aadhaarVerified: nextStatus };
        }
        return w;
      })
    );
  };

  const filteredWorkers = workersList.filter((w) => {
    if (tradeFilter !== 'all' && w.tradeId !== tradeFilter) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return w.name.toLowerCase().includes(q) || w.locality.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="py-6 sm:py-8 space-y-8 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30 mb-2">
              <Building className="w-3.5 h-3.5 text-blue-400" />
              <span>Nadia District Administrative Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t.districtMetrics}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Monitoring fair-wage index, automated match dispatch latency, and informal worker social security across Kalyani Subdivision.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700">
              Region: <strong>Kalyani, Nadia (WB)</strong>
            </span>
          </div>
        </div>

        {/* 4 Core District KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-400 font-medium block">
              {t.activeInNadia}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">
              {DISTRICT_ANALYTICS.totalActiveWorkers}
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              98.2% on duty today
            </span>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-400 font-medium block">
              {t.avgMatchTime}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">
              {DISTRICT_ANALYTICS.averageMatchTimeMinutes} mins
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Rapido-grade automated dispatch
            </span>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-400 font-medium block">
              {t.completedJobs}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">
              {DISTRICT_ANALYTICS.completedJobsToday}
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">
              +14% vs yesterday
            </span>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-400 font-medium block">
              {t.fairWageIndex}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-mono flex items-center gap-1">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
              +{DISTRICT_ANALYTICS.fairWageGrowthPct}%
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Zero middleman commission deduction
            </span>
          </div>
        </div>
      </div>

      {/* Fair Wage Comparison Matrix */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Fair-Wage Index vs Unregulated Middleman Rates (Nadia District)
            </h2>
            <p className="text-xs text-slate-500">
              Comparison between traditional daily-wage labor chalk-markets and KaamConnect guaranteed baseline.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl">
            Strict Price Transparency
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Trade Category</th>
                <th className="py-3 px-4">Traditional Middleman Rate</th>
                <th className="py-3 px-4">KaamConnect Fair Wage</th>
                <th className="py-3 px-4">Direct Worker Net Gain</th>
                <th className="py-3 px-4">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DISTRICT_ANALYTICS.wageIndexBenchmark.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-bold text-slate-800">{row.trade}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono line-through">{row.informalMiddlemanRate}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.kaamConnectFairWage}</td>
                  <td className="py-3 px-4 font-bold text-emerald-600 font-mono">{row.workerGain}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Audited
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verified Worker Roster & KYC Governance */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-subtle space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {t.verifiedRoster}
            </h2>
            <p className="text-xs text-slate-500">
              Manage Govt Aadhaar, police clearance, and active booking availability.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search technician..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Trades</option>
              <option value="electrician">Electrician</option>
              <option value="plumber">Plumber</option>
              <option value="carpenter">Carpenter</option>
              <option value="painter">Painter</option>
              <option value="cleaner">Cleaner</option>
              <option value="mason">Mason</option>
            </select>
          </div>
        </div>

        {/* Worker Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-4">Trade & Base</th>
                <th className="py-3 px-4">Rating & Jobs</th>
                <th className="py-3 px-4">Govt Aadhaar / Police KYC</th>
                <th className="py-3 px-4 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkers.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={w.avatar}
                        alt={w.name}
                        className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{w.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{w.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{w.tradeTitle}</div>
                    <div className="text-[11px] text-slate-400">{w.locality}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-amber-600">{w.rating} ★</div>
                    <div className="text-[11px] text-slate-500">{w.completedJobs} bookings</div>
                  </td>
                  <td className="py-3 px-4">
                    {w.kycVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Verified (WB Police)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Suspended / Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => toggleWorkerKyc(w.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                        w.kycVerified
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                      }`}
                    >
                      {w.kycVerified ? t.suspendWorker : t.approveKyc}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regional Demand Heatmap */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-subtle">
        <h2 className="text-base font-bold text-slate-900 mb-3">
          Hyperlocal Real-time Demand Distribution in Kalyani & Surrounds
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {DISTRICT_ANALYTICS.activeAreas.map((area, i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-800 block truncate">{area.name}</span>
              <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                {area.activeWorkers} workers
              </div>
              <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                area.demand === 'Peak' 
                  ? 'bg-rose-100 text-rose-800' 
                  : area.demand === 'High' 
                  ? 'bg-amber-100 text-amber-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {area.demand} Demand
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
