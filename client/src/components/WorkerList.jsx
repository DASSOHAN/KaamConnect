import React, { useState, useMemo } from 'react';
import { ArrowUpDown, FilterX } from 'lucide-react';
import { WorkerCard } from './WorkerCard';
import { TRANSLATIONS } from '../utils/i18n';
import { getCategoryCatalog, getWorkerCategoryId } from '../utils/workerCategories';

export const WorkerList = ({
  workers = [],
  selectedCategory,
  onCategoryChange,
  onBookWorker,
  language,
  onContactWorker,
  selectedRadius,
  searchQuery = '',
  onClearSearch,
  isLoading = false,
  loadError = '',
  onRetry,
  heading,
  categories,
}) => {
  const [sortBy, setSortBy] = useState('nearest');
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const categoriesList = categories || [
    { id: 'all', label: t.allCategories },
    ...getCategoryCatalog([], workers),
  ].filter((category, index, list) => list.findIndex((item) => item.id === category.id) === index);

  // Filter and sort workers
  const filteredWorkers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const uniqueWorkers = new Map();

    workers
      .filter((w) => {
        if (selectedCategory !== 'all' && getWorkerCategoryId(w) !== selectedCategory) {
          return false;
        }
        if (Number(w.distanceKm) > Number(selectedRadius)) {
          return false;
        }
        if (query !== '') {
          const searchableFields = [
            w.name,
            w.nameBn,
            w.nameHi,
            w.tradeTitle,
            w.tradeId,
            categoriesList.find((category) => category.id === w.tradeId)?.label,
            w.locality,
            w.bio,
            ...(Array.isArray(w.skills) ? w.skills : []),
          ];

          return searchableFields.some((field) =>
            String(field ?? '').toLocaleLowerCase().includes(query)
          );
        }
        return true;
      })
      .forEach((worker) => {
        if (worker?.id && !uniqueWorkers.has(worker.id)) {
          uniqueWorkers.set(worker.id, worker);
        }
      });

    return Array.from(uniqueWorkers.values()).sort((a, b) => {
      if (sortBy === 'nearest') return Number(a.distanceKm) - Number(b.distanceKm);
      if (sortBy === 'rating') return Number(b.rating) - Number(a.rating);
      if (sortBy === 'price') return Number(a.halfDayRate) - Number(b.halfDayRate);
      return 0;
    });
  }, [workers, selectedCategory, selectedRadius, searchQuery, sortBy]);

  return (
    <section className="py-6 sm:py-8 border-t border-slate-200/80">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {heading || `Verified Nadia Technicians in Your Radius (${selectedRadius} km)`}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Fictional demo profiles for exploring KaamConnect worker discovery.
          </p>
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

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center" role="status" aria-live="polite">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-800">Loading worker profiles…</h3>
          <p className="text-xs text-slate-500 mt-1">Fetching fictional demo workers near Kalyani.</p>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 sm:p-12 text-center" role="alert">
          <h3 className="text-base font-bold text-slate-800">Worker profiles are unavailable</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{loadError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
          >
            Try again
          </button>
        </div>
      ) : (

      /* Grid of Worker Cards */
      filteredWorkers.length > 0 ? (
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
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FilterX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No workers found.</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try another service, skill, worker name, or locality. You can also expand your radius or reset the filters.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                onClearSearch?.();
                onCategoryChange('all');
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )
      )}
    </section>
  );
};
