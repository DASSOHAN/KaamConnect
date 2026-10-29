import React from 'react';
import { 
  Zap, 
  Droplet, 
  Hammer, 
  Paintbrush, 
  Sparkles, 
  Building, 
  Clock, 
  Users, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { ServiceCategory, ServiceCategoryId, Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

interface ServiceGridProps {
  categories: ServiceCategory[];
  selectedCategory: ServiceCategoryId | 'all';
  onSelectCategory: (id: ServiceCategoryId) => void;
  onBookCategory: (category: ServiceCategory) => void;
  language: Language;
}

export const ServiceGrid: React.FC<ServiceGridProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  onBookCategory,
  language,
}) => {
  const t = TRANSLATIONS[language];

  // Helper to map icon string to Lucide icon
  const renderIcon = (name: string) => {
    const props = { className: "w-6 h-6" };
    switch (name) {
      case 'Zap': return <Zap {...props} className="w-6 h-6 text-amber-500" />;
      case 'Droplet': return <Droplet {...props} className="w-6 h-6 text-sky-500" />;
      case 'Hammer': return <Hammer {...props} className="w-6 h-6 text-orange-500" />;
      case 'Paintbrush': return <Paintbrush {...props} className="w-6 h-6 text-rose-500" />;
      case 'Sparkles': return <Sparkles {...props} className="w-6 h-6 text-emerald-500" />;
      case 'Building': return <Building {...props} className="w-6 h-6 text-indigo-500" />;
      default: return <Zap {...props} className="w-6 h-6 text-blue-500" />;
    }
  };

  const getLocalizedName = (cat: ServiceCategory) => {
    if (language === 'bn') return cat.nameBn;
    if (language === 'hi') return cat.nameHi;
    return cat.name;
  };

  const getLocalizedUnit = (cat: ServiceCategory) => {
    if (language === 'bn') return cat.fairWageRange.unitBn;
    if (language === 'hi') return cat.fairWageRange.unitHi;
    return cat.fairWageRange.unit;
  };

  return (
    <section className="py-6 sm:py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nadia District Fair-Wage Protocol</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.exploreServices}
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {t.exploreDesc}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            160+ Active technicians in Kalyani
          </span>
        </div>
      </div>

      {/* Grid of 6 Services */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;

          return (
            <div
              key={cat.id}
              className={`group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                isSelected 
                  ? 'border-blue-600 shadow-md ring-2 ring-blue-500/20' 
                  : 'border-slate-200 hover:border-slate-300 shadow-subtle hover:shadow-card'
              }`}
            >
              <div className="p-5 sm:p-6">
                {/* Header row: Icon & Status */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {renderIcon(cat.iconName)}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {cat.typicalResponseTime}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {cat.activeWorkersCount} {t.availableNearYou}
                    </span>
                  </div>
                </div>

                {/* Title & Tagline */}
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {getLocalizedName(cat)}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {cat.tagline}
                </p>

                {/* Popular Tasks Pills */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Popular Tasks
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.popularTasks.slice(0, 3).map((task) => (
                      <span
                        key={task.id}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-150"
                      >
                        {task.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Wage Baseline & CTAs */}
              <div className="px-5 sm:px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 mt-auto">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    {t.fairWageGuarantee}
                  </span>
                  <div className="text-sm font-extrabold text-slate-900 tracking-tight font-mono">
                    ₹{cat.fairWageRange.min} - ₹{cat.fairWageRange.max}
                    <span className="text-xs text-slate-500 font-normal ml-1">/ {getLocalizedUnit(cat)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectCategory(cat.id)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition"
                    title="Filter workers below"
                  >
                    {t.viewWorkers}
                  </button>
                  <button
                    onClick={() => onBookCategory(cat)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition active:scale-95"
                  >
                    <span>{t.bookNow}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
