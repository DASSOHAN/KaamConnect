import { INITIAL_SERVICES } from './data.js';

const inspectionService = { id: 'diagnosis', name: 'Inspection & diagnosis', unitPrice: null, pricingType: 'quotation', quoteRequired: true };

// Rates on the original six services are retained as explicitly provisional estimates.
// Linked services below take their price from the existing service task records.
const applianceDefinitions = [
  { id: 'air-conditioner', name: 'Air conditioner (AC)', description: 'Cooling, cleaning, and repair assessment.', teamCategory: 'AC service technician', iconName: 'AirVent', services: [
    { id: 'routine', name: 'Routine cleaning & maintenance', unitPrice: 499, pricingType: 'provisional', quoteRequired: false },
    { id: 'diagnosis', name: 'Diagnosis & repair estimate', unitPrice: 249, pricingType: 'provisional', quoteRequired: true },
  ] },
  { id: 'refrigerator', name: 'Refrigerator', description: 'Cooling fault inspection and repair assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Refrigerator', services: [{ ...inspectionService }] },
  { id: 'washing-machine', name: 'Washing machine', description: 'Wash, spin, drainage, or electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'WashingMachine', services: [{ ...inspectionService }] },
  { id: 'television', name: 'Television (TV)', description: 'Display, sound, power, and connection fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Tv', services: [{ ...inspectionService }] },
  { id: 'microwave', name: 'Microwave oven', description: 'Heating, control, and electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Microwave', services: [{ ...inspectionService }] },
  { id: 'water-purifier', name: 'Water purifier (RO)', description: 'Purification, flow, and electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Droplets', services: [{ ...inspectionService }] },
  { id: 'geyser', name: 'Geyser / water heater', description: 'Heating, water flow, and electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Flame', services: [{ ...inspectionService }] },
  { id: 'kitchen-chimney', name: 'Kitchen chimney', description: 'Configured chimney and kitchen slab degreasing service.', teamCategory: 'Chimney cleaning service', iconName: 'Wind', services: [{ id: 'cleaning', name: 'Kitchen Chimney & Slab Degrease', priceSourceTaskId: 'cl-kitchen', pricingType: 'configured', quoteRequired: false }] },
  { id: 'induction-cooktop', name: 'Induction cooktop', description: 'Heating, controls, and power fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'CookingPot', services: [{ ...inspectionService }] },
  { id: 'electric-oven', name: 'Electric oven', description: 'Heating element, controls, and power fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Microwave', services: [{ ...inspectionService }] },
  { id: 'dishwasher', name: 'Dishwasher', description: 'Wash cycle, drainage, and electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'WashingMachine', services: [{ ...inspectionService }] },
  { id: 'ceiling-fan', name: 'Ceiling fan', description: 'Existing configured fan installation and repair service.', teamCategory: 'Electrician', iconName: 'Fan', services: [{ id: 'installation-repair', name: 'Ceiling Fan Installation / Fix', priceSourceTaskId: 'el-fan', pricingType: 'configured', quoteRequired: false }] },
  { id: 'exhaust-fan', name: 'Exhaust fan', description: 'Motor, vibration, and electrical fault assessment.', teamCategory: 'Electrician', iconName: 'Fan', services: [{ ...inspectionService }] },
  { id: 'air-cooler', name: 'Air cooler', description: 'Airflow, water pump, and electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Wind', services: [{ ...inspectionService }] },
  { id: 'water-pump', name: 'Water pump', description: 'Existing configured pump and motor check.', teamCategory: 'Plumber', iconName: 'Droplets', services: [{ id: 'inspection', name: 'Water Pump / Motor Check', priceSourceTaskId: 'pl-motor', pricingType: 'configured', quoteRequired: false }] },
  { id: 'mixer-grinder', name: 'Mixer grinder', description: 'Motor, blade, and electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Blend', services: [{ ...inspectionService }] },
  { id: 'electric-kettle', name: 'Electric kettle', description: 'Heating and electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Coffee', services: [{ ...inspectionService }] },
  { id: 'inverter-ups', name: 'Inverter / home UPS', description: 'Existing configured inverter and circuit troubleshooting.', teamCategory: 'Electrician', iconName: 'CircuitBoard', services: [{ id: 'troubleshooting', name: 'MCB / Inverter Tripping Fix', priceSourceTaskId: 'el-mcb', pricingType: 'configured', quoteRequired: false }] },
  { id: 'room-heater', name: 'Room heater', description: 'Heating and electrical fault assessment.', teamCategory: 'Home appliance repair technician', iconName: 'Heater', services: [{ ...inspectionService }] },
];

export const ELECTRONICS_CARE_CATALOG = buildElectronicsCareCatalog(INITIAL_SERVICES);

export function buildElectronicsCareCatalog(serviceRows = []) {
  const taskPrices = new Map();
  for (const service of serviceRows || []) {
    for (const task of service.service_tasks || service.popularTasks || []) {
      if (task.active === false) continue;
      taskPrices.set(String(task.id), Number(task.base_price ?? task.basePrice));
    }
  }
  const appliances = applianceDefinitions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    teamCategory: definition.teamCategory,
    iconName: definition.iconName,
    services: definition.services.map((service) => {
      if (!service.priceSourceTaskId) return { ...service };
      const configuredPrice = taskPrices.get(service.priceSourceTaskId);
      return {
        ...service,
        unitPrice: Number.isFinite(configuredPrice) && configuredPrice > 0 ? configuredPrice : null,
        pricingType: Number.isFinite(configuredPrice) && configuredPrice > 0 ? 'configured' : 'quotation',
        quoteRequired: !(Number.isFinite(configuredPrice) && configuredPrice > 0),
      };
    }),
  }));
  return {
    pricesAreProvisional: true,
    pricingNotice: 'Original appliance rates are provisional estimates. Other displayed rates come from configured KaamConnect service tasks. For services without a configured price, inspection is required and the final price will be confirmed after diagnosis.',
    quotationMessage: 'Inspection required — final price after diagnosis',
    appliances,
  };
}

export function validateElectronicsCareRequest(body = {}, catalog = ELECTRONICS_CARE_CATALOG) {
  const entries = body.appliances;
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 16) {
    return { error: 'Select between 1 and 16 appliance types.' };
  }

  const appliancesById = new Map(catalog.appliances.map((item) => [item.id, item]));
  const seen = new Set();
  let unitCount = 0;
  let knownSubtotal = 0;
  let hasQuotation = false;
  const lineItems = [];
  for (const entry of entries) {
    const appliance = appliancesById.get(String(entry?.applianceId || ''));
    const service = appliance?.services.find((item) => item.id === String(entry?.serviceId || ''));
    const quantity = Number(entry?.quantity);
    if (!appliance || !service) return { error: 'One or more selected appliance services are not supported.' };
    if (seen.has(appliance.id)) return { error: 'Each appliance type must appear only once; use its quantity instead.' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 8) return { error: 'Each appliance quantity must be between 1 and 8.' };
    unitCount += quantity;
    if (unitCount > 16) return { error: 'A combined request can include up to 16 appliances.' };
    seen.add(appliance.id);
    const unitPrice = Number.isFinite(service.unitPrice) && service.unitPrice > 0 ? service.unitPrice : null;
    const lineSubtotal = unitPrice === null ? null : quantity * unitPrice;
    if (lineSubtotal === null) hasQuotation = true;
    else knownSubtotal += lineSubtotal;
    lineItems.push({
      applianceId: appliance.id,
      applianceName: appliance.name,
      serviceId: service.id,
      serviceName: service.name,
      quantity,
      unitPrice,
      lineSubtotal,
      pricingType: service.pricingType,
      quoteRequired: service.quoteRequired || unitPrice === null,
      teamCategory: appliance.teamCategory,
      brand: String(entry?.brand || '').trim().slice(0, 60),
      problemDescription: String(entry?.problemDescription || '').trim().slice(0, 500),
    });
  }

  const requestedDate = String(body.requestedDate || '');
  const requestedTime = String(body.requestedTime || '');
  const dateValue = new Date(`${requestedDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || Number.isNaN(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== requestedDate || requestedDate < new Date().toISOString().slice(0, 10)) {
    return { error: 'Choose a valid preferred service date that is not in the past.' };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedTime)) return { error: 'Choose a valid preferred time.' };
  const locality = String(body.locality || '').trim().slice(0, 100);
  const addressDetails = String(body.addressDetails || '').trim().slice(0, 300);
  if (locality.length < 2) return { error: 'Enter your locality.' };
  if (addressDetails.length < 8) return { error: 'Enter a complete home address.' };

  return {
    value: {
      lineItems,
      subtotal: knownSubtotal,
      knownSubtotal,
      estimatedTotal: hasQuotation ? null : knownSubtotal,
      hasQuotation,
      requestedDate,
      requestedTime,
      locality,
      addressDetails,
      unitCount,
      teamCategories: [...new Set(lineItems.map((line) => line.teamCategory))],
      pricingNotice: catalog.pricingNotice,
      quotationMessage: catalog.quotationMessage,
    },
  };
}
