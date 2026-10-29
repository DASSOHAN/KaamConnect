import React from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { WorkerList } from './WorkerList';

export const CategoryResultsPage = ({
  category,
  workers,
  selectedRadius,
  onBookWorker,
  language,
  onContactWorker,
  isLoading,
  loadError,
  onRetry,
  onBack,
}) => (
  <div className="space-y-4">
    <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-subtle sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to worker discovery
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {category.label} Near You
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Fictional demo profiles matched to the {category.label.toLowerCase()} category.
        </p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        Search another category
      </button>
    </div>

    <WorkerList
      workers={workers}
      selectedCategory={category.id}
      onCategoryChange={() => {}}
      onBookWorker={onBookWorker}
      language={language}
      onContactWorker={onContactWorker}
      selectedRadius={selectedRadius}
      searchQuery=""
      isLoading={isLoading}
      loadError={loadError}
      onRetry={onRetry}
      heading={`${category.label} Near You`}
      categories={[category]}
    />
  </div>
);

