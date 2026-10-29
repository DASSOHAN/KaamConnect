import React, { useState, useMemo } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  Star, 
  MapPin, 
  Zap, 
  ArrowUpDown,
  FilterX
} from 'lucide-react';
import { Worker, ServiceCategoryId, Language } from '../types';
import { WorkerCard } from './WorkerCard';
import { TRANSLATIONS } from '../utils/i18n';

interface WorkerListProps {
  workers: Worker[];
  selectedCategory: ServiceCategoryId | 'all';
  onCategoryChange: (cat: ServiceCategoryId | 'all') => void;
  onBookWorker: (worker: Worker) => void;
  language: Language;
  onContactWorker: (type: 'call' | 'whatsapp', worker: Worker) => void;
  selectedRadius: number;
}

export const WorkerList: React.FC<WorkerListProps> = ({
  workers,
  selectedCategory,
  onCategoryChange,
  onBookWorker,
  language,
  onContactWorker,
  selectedRadius,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'nearest' | 'rating' | 'price'>('nearest');
  const t = TRANSLATIONS[language];

  const categoriesList: { id: ServiceCategoryId | 'all'; label: string }[] = [
    { id: 'all', label: t.allCategories },
    { id: 'electrician', label: 'Electricians' },
    { id: 'plumber', label: 'Plumbers' },
    { id: 'carpenter', label: 'Carpenters' },
    { id: 'painter', label: 'Painters' },
    { id: 'cleaner', label: 'Cleaners' },
    { id: 'mason', label: 'Masons & Labor' },
  ];

  // Filter and sort workers
  const filteredWorkers = useMemo(() => {
    return workers
      .filter((w) => {
        // Trade filter
        if (selectedCategory !== 'all' && w.tradeId !== selectedCategory) {
          return false;
        }
        // Radius filter
        if (w.distanceKm > selectedRadius) {
          return false;
        }
        // Search query
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchName = w.name.toLowerCase().includes(q) || w.nameBn.includes(q) || w.nameHi.includes(q);
          const matchSkills = w.skills.some((s) => s.toLowerCase().includes(q));
          const matchTrade = w.tradeTitle.toLowerCase().includes(q);
          return matchName || matchSkills || matchTrade;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'nearest') return a.distanceKm - b.distanceKm;
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'price') return a.halfDayRate - b.halfDayRate;
        return 0;
      });
  }, [workers, selectedCategory, selectedRadius, searchQuery, sortBy]);

  return (
    <section className="py-6 sm:py-8 border-t border-slate-200/80">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Verified Nadia Technicians in Your Radius ({selectedRadius} km)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Real background-checked informal workers with zero middleman exploitation.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by worker name, skill, or task..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter and Sorting Pills Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-2">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-subtle'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            Sort:
          </span>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setSortBy('nearest')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                sortBy === 'nearest' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.nearestFirst}
            </button>
            <button
              onClick={() => setSortBy('rating')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                sortBy === 'rating' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.highestRated}
            </button>
            <button
              onClick={() => setSortBy('price')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                sortBy === 'price' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.priceLowToHigh}
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Worker Cards */}
      {filteredWorkers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWorkers.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onBook={onBookWorker}
              language={language}
              onContact={onContactWorker}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FilterX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No technicians found in this radius</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try expanding your discovery radius to 3 km or 5 km, or reset your search filters.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setSearchQuery('');
                onCategoryChange('all');
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
