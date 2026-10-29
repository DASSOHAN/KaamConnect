const CATEGORY_LABELS = {
  electrician: 'Electricians',
  plumber: 'Plumbers',
  carpenter: 'Carpenters',
  painter: 'Painters',
  cleaner: 'Cleaners',
  mason: 'Masons & Labor',
  'ac-repair': 'AC Repair',
  maintenance: 'General Maintenance',
};
const FALLBACK_CATEGORY_IDS = [
  'electrician',
  'plumber',
  'carpenter',
  'painter',
  'cleaner',
  'mason',
  'ac-repair',
  'maintenance',
];
const CATEGORY_SLUGS = {
  electrician: 'electricians',
  plumber: 'plumbers',
  carpenter: 'carpenters',
  painter: 'painters',
  cleaner: 'cleaners',
  mason: 'masons-labor',
  'ac-repair': 'ac-repair',
  maintenance: 'general-maintenance',
};

const normalize = (value) => String(value || '').trim().toLowerCase();

// AC technicians and maintenance workers use the existing electrician/mason
// trade IDs for booking compatibility, so their category is derived from the
// service title and skills before falling back to the stored trade ID.
export const getWorkerCategoryId = (worker = {}) => {
  const serviceText = normalize([
    worker.tradeTitle,
    worker.bio,
    ...(Array.isArray(worker.skills) ? worker.skills : []),
  ].join(' '));

  if (/\bac\b|air\s*condition|cooling/.test(serviceText)) return 'ac-repair';
  if (/general\s+maintenance|handyman|minor\s+repairs/.test(serviceText)) return 'maintenance';
  return normalize(worker.tradeId) || 'other';
};

export const getCategoryLabel = (id, services = []) => {
  if (CATEGORY_LABELS[id]) return CATEGORY_LABELS[id];
  const service = services.find((item) => normalize(item.id) === id);
  return service?.name || id.replace(/-/g, ' ');
};

export const getCategoryCatalog = (services = [], workers = []) => {
  const ids = [
    ...FALLBACK_CATEGORY_IDS,
    ...services.map((service) => normalize(service.id)),
    ...workers.map((worker) => getWorkerCategoryId(worker)),
  ];

  return [...new Set(ids)]
    .filter((id) => id && id !== 'other')
    .map((id) => ({
      id,
      label: getCategoryLabel(id, services),
      slug: CATEGORY_SLUGS[id] || id,
    }));
};
