// API Service connecting pure React frontend with Express backend

const BASE_URL = '/api';

export const api = {
  // Health
  checkHealth: async () => {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      return await res.json();
    } catch (e) {
      console.warn('Backend not responding yet, fallback active:', e);
      return { status: 'fallback' };
    }
  },

  // Locations
  getLocations: async () => {
    try {
      const res = await fetch(`${BASE_URL}/locations`);
      const json = await res.json();
      return json.data;
    } catch (e) {
      return null;
    }
  },

  // Services
  getServices: async () => {
    try {
      const res = await fetch(`${BASE_URL}/services`);
      const json = await res.json();
      return json.data;
    } catch (e) {
      return null;
    }
  },

  // Workers
  getWorkers: async (trade = 'all', maxDistance = null, query = '') => {
    const params = new URLSearchParams();
    if (trade && trade !== 'all') params.append('trade', trade);
    if (maxDistance) params.append('maxDistance', maxDistance);
    if (query) params.append('q', query);

    const res = await fetch(`${BASE_URL}/workers?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Worker API returned HTTP ${res.status}`);
    }

    const json = await res.json();
    if (!Array.isArray(json.data)) {
      throw new Error('Worker API returned an invalid response');
    }
    return json.data;
  },

  getBookings: async (customerId) => {
    const res = await fetch(`${BASE_URL}/bookings?customerId=${encodeURIComponent(customerId || '')}`);
    if (!res.ok) throw new Error(`Bookings API returned HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  },

  cancelBooking: async (bookingId, customerId) => {
    const res = await fetch(`${BASE_URL}/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unable to cancel this booking');
    return json.data;
  },

  registerWorker: async (profile) => {
    const res = await fetch(`${BASE_URL}/workers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const json = await res.json();
    if (!res.ok) {
      const error = new Error(json.message || 'Unable to register worker profile');
      error.fieldErrors = json.errors || {};
      throw error;
    }
    return json.data;
  },

  getWorkerJobs: async (workerId, ownerId) => {
    const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
    const res = await fetch(`${BASE_URL}/workers/${workerId}/jobs${query}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unable to load worker jobs');
    return Array.isArray(json.data) ? json.data : [];
  },

  updateWorkerProfile: async (workerId, profile) => {
    const res = await fetch(`${BASE_URL}/workers/${workerId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unable to update worker profile');
    return json.data;
  },

  updateWorkerJobStatus: async (bookingId, workerId, ownerId, status) => {
    const res = await fetch(`${BASE_URL}/bookings/${bookingId}/worker-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, ownerId, status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unable to update job status');
    return json.data;
  },

  // Toggle KYC
  toggleWorkerKyc: async (workerId, kycVerified) => {
    try {
      const res = await fetch(`${BASE_URL}/workers/${workerId}/kyc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kycVerified }),
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },

  // Toggle Duty
  toggleWorkerDuty: async (workerId, isAvailable, ownerId) => {
    try {
      const res = await fetch(`${BASE_URL}/workers/${workerId}/duty`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable, ownerId }),
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },

  // Create Booking
  createBooking: async (bookingData) => {
    try {
      const res = await fetch(`${BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });
      const json = await res.json();
      return json.data;
    } catch (e) {
      return null;
    }
  },

  // Update Booking Status
  updateBookingStatus: async (bookingId, status) => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      return json.data;
    } catch (e) {
      return null;
    }
  },

  // Review Booking
  reviewBooking: async (bookingId, rating, tipAmount, reviewComment) => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, tipAmount, reviewComment }),
      });
      const json = await res.json();
      return json.data;
    } catch (e) {
      return null;
    }
  },

  // Analytics
  getAnalytics: async () => {
    try {
      const res = await fetch(`${BASE_URL}/analytics`);
      const json = await res.json();
      return json.data;
    } catch (e) {
      return null;
    }
  },

  // Worker Incoming Job
  getIncomingJob: async () => {
    try {
      const res = await fetch(`${BASE_URL}/jobs/incoming`);
      const json = await res.json();
      return json.data;
    } catch (e) {
      return null;
    }
  },

  // Worker Accept Job
  acceptJob: async () => {
    try {
      const res = await fetch(`${BASE_URL}/jobs/incoming/accept`, {
        method: 'POST',
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },
};
