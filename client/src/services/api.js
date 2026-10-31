// API Service connecting pure React frontend with Express backend

const BASE_URL = '/api';
let csrfToken = '';
let csrfPromise;
async function securityToken(){
  if(csrfToken)return csrfToken;
  csrfPromise ||= window.fetch(`${BASE_URL}/auth/csrf`,{credentials:'include'}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.message||'Unable to initialize request security.');csrfToken=body.data.token;return csrfToken;}).finally(()=>{csrfPromise=null;});
  return csrfPromise;
}
async function apiFetch(url,options={}){
  const method=String(options.method||'GET').toUpperCase(),headers={...(options.body && typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}; delete headers.Authorization;
  if(!['GET','HEAD','OPTIONS'].includes(method))headers['X-CSRF-Token']=await securityToken();
  return window.fetch(url,{...options,method,headers,credentials:'include'});
}

async function authorizedRequest(path, token, options = {}) {
  let res;
  try {
    res = await apiFetch(`${BASE_URL}${path}`, options);
  } catch {
    throw new Error('KaamConnect API is unreachable. Start the Express server on port 5000 and retry.');
  }
  const responseText = await res.text();
  let json = {};
  try { json = responseText ? JSON.parse(responseText) : {}; }
  catch {
    if (res.status === 502 || res.status === 503) {
      throw new Error('The Vite proxy could not reach the Express API. Confirm the backend is running on http://localhost:5000, then restart Vite.');
    }
    throw new Error(`The API returned an unreadable response (HTTP ${res.status}).`);
  }
  if (json.data?.csrfToken) csrfToken = json.data.csrfToken;
  if (!res.ok || json.success === false) {
    const error = new Error(json.message || (res.status === 502
      ? 'The Express API is unavailable through the Vite proxy. Confirm the backend is running on http://localhost:5000, then restart Vite.'
      : `Request failed (HTTP ${res.status}).`));
    error.status = res.status;
    error.code = json.code;
    throw error;
  }
  return json.data;
}

export const api = {
  initializeSecurity: securityToken,
  getCurrentUser: () => authorizedRequest('/auth/me'),
  register: (details) => authorizedRequest('/auth/register', null, { method: 'POST', body: JSON.stringify(details) }),
  login: (details) => authorizedRequest('/auth/login', null, { method: 'POST', body: JSON.stringify(details) }),
  logout: () => authorizedRequest('/auth/logout', null, { method: 'POST' }),
  uploadWorkerPhoto: async (file) => {const body=new FormData();body.append('photo',file);const res=await apiFetch(`${BASE_URL}/workers/photo`,{method:'POST',body});const json=await res.json();if(!res.ok)throw new Error(json.message||'Unable to upload profile photo.');return json.data.url;},
  uploadChatAttachment: async (conversationId,file) => {const body=new FormData();body.append('photo',file);const res=await apiFetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}/attachments`,{method:'POST',body});const json=await res.json();if(!res.ok)throw new Error(json.message||'Unable to upload chat image.');return json.data.attachmentPath;},
  getAccountProfile: (token) => authorizedRequest('/account/profile', token),
  saveAccountProfile: (token, profile) => authorizedRequest('/account/profile', token, { method: 'POST', body: JSON.stringify(profile) }),
  getConversations: (token) => authorizedRequest('/conversations', token),
  createConversation: (token, relatedTo) => authorizedRequest('/conversations', token, { method: 'POST', body: JSON.stringify(relatedTo) }),
  getConversationMessages: (token, conversationId) => authorizedRequest(`/conversations/${encodeURIComponent(conversationId)}/messages`, token),
  sendMessage: (token, conversationId, message) => authorizedRequest(`/conversations/${encodeURIComponent(conversationId)}/messages`, token, { method: 'POST', body: JSON.stringify(message) }),
  createQuotation: (token, conversationId, quote) => authorizedRequest(`/conversations/${encodeURIComponent(conversationId)}/quotations`, token, { method: 'POST', body: JSON.stringify(quote) }),
  respondToQuotation: (token, quotationId, response) => authorizedRequest(`/quotations/${encodeURIComponent(quotationId)}/respond`, token, { method: 'POST', body: JSON.stringify(response) }),
  reportMessage: (token, messageId, reason) => authorizedRequest(`/messages/${encodeURIComponent(messageId)}/report`, token, { method: 'POST', body: JSON.stringify({ reason }) }),
  getUnreadMessageCount: (token) => authorizedRequest('/messages/unread-count', token),
  getAdminMessageReports: (token) => authorizedRequest('/admin/message-reports', token),
  getAdminConversation: (token, conversationId) => authorizedRequest(`/admin/conversations/${encodeURIComponent(conversationId)}`, token),
  updateAdminMessageReport: (token, reportId, updates) => authorizedRequest(`/admin/message-reports/${encodeURIComponent(reportId)}`, token, { method: 'PATCH', body: JSON.stringify(updates) }),
  moderateAccount: (token, userId, isSuspended) => authorizedRequest(`/admin/users/${encodeURIComponent(userId)}/suspension`, token, { method: 'PATCH', body: JSON.stringify({ isSuspended }) }),
  moderateConversation: (token, conversationId, status, notes) => authorizedRequest(`/admin/conversations/${encodeURIComponent(conversationId)}`, token, { method: 'PATCH', body: JSON.stringify({ status, notes }) }),
  createJob: async (job, token) => {
    const res = await apiFetch(`${BASE_URL}/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(job) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Unable to post your job');
    return json.data;
  },

  getJobs: async (customerId) => {
    const params = new URLSearchParams();
    if (customerId) params.set('customerId', customerId);
    const res = await apiFetch(`${BASE_URL}/jobs?${params}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Unable to load jobs');
    return Array.isArray(json.data) ? json.data : [];
  },
  getPublicJobs: async () => {
    const res = await apiFetch(`${BASE_URL}/jobs`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Unable to load public jobs');
    return Array.isArray(json.data) ? json.data : [];
  },

  getWorkerJobsBoard: (token) => authorizedRequest('/jobs', token),
  getJobOffers: (token, jobId) => authorizedRequest(`/jobs/${encodeURIComponent(jobId)}/offers`, token),
  sendJobOffer: (token, jobId, offeredPrice, message) => authorizedRequest(`/jobs/${encodeURIComponent(jobId)}/offers`, token, { method: 'POST', body: JSON.stringify({ offeredPrice, message }) }),
  acceptJobOffer: (token, jobId, offerId) => authorizedRequest(`/jobs/${encodeURIComponent(jobId)}/accept-offer`, token, { method: 'POST', body: JSON.stringify({ offerId }) }),

  getJob: async (jobId, token) => {
    const res = await apiFetch(`${BASE_URL}/jobs/${encodeURIComponent(jobId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Unable to load this job');
    return json.data;
  },

  // Health
  checkHealth: async () => {
    try {
      const res = await apiFetch(`${BASE_URL}/health`);
      return await res.json();
    } catch {
      console.warn('Backend not responding yet, fallback active:', e);
      return { status: 'fallback' };
    }
  },

  // Locations
  getLocations: async () => {
    try {
      const res = await apiFetch(`${BASE_URL}/locations`);
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  // Services
  getServices: async () => {
    try {
      const res = await apiFetch(`${BASE_URL}/services`);
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  // Workers
  getWorkers: async (trade = 'all', maxDistance = null, query = '') => {
    const params = new URLSearchParams();
    if (trade && trade !== 'all') params.append('trade', trade);
    if (maxDistance) params.append('maxDistance', maxDistance);
    if (query) params.append('q', query);

    const res = await apiFetch(`${BASE_URL}/workers?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Worker API returned HTTP ${res.status}`);
    }

    const json = await res.json();
    if (!Array.isArray(json.data)) {
      throw new Error('Worker API returned an invalid response');
    }
    return json.data;
  },
  getWorkerReviews: async (workerId) => {
    const res = await apiFetch(`${BASE_URL}/workers/${encodeURIComponent(workerId)}/reviews`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Unable to load public reviews');
    return Array.isArray(json.data) ? json.data : [];
  },

  getBookings: async (customerId, token) => {
    const res = await apiFetch(`${BASE_URL}/bookings?customerId=${encodeURIComponent(customerId || '')}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`Bookings API returned HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  },

  getElectronicsCareCatalog: async () => {
    const res = await apiFetch(`${BASE_URL}/electronics-care/catalog`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `Appliance services request failed (HTTP ${res.status}).`);
    if (!json.success || !json.data || !Array.isArray(json.data.appliances)) {
      throw new Error('The appliance services API returned an invalid response.');
    }
    return json.data;
  },

  createElectronicsCareBooking: async (request, token) => {
    const res = await apiFetch(`${BASE_URL}/electronics-care/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(request),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.message || 'Unable to submit the appliance service request.');
    return json.data;
  },

  cancelBooking: async (bookingId, customerId, token) => {
    const res = await apiFetch(`${BASE_URL}/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ customerId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unable to cancel this booking');
    return json.data;
  },

  registerWorker: async (profile, token) => {
    const res = await apiFetch(`${BASE_URL}/workers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

  getMyWorkerProfile: (token) => authorizedRequest('/workers/me', token),
  getWorkerJobs: async (workerId, ownerId, token) => {
    const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
    const res = await apiFetch(`${BASE_URL}/workers/${workerId}/jobs${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unable to load worker jobs');
    return Array.isArray(json.data) ? json.data : [];
  },

  updateWorkerProfile: async (workerId, profile, token) => {
    const res = await apiFetch(`${BASE_URL}/workers/${workerId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(profile),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unable to update worker profile');
    return json.data;
  },

  updateWorkerJobStatus: async (bookingId, workerId, ownerId, status, token) => {
    const res = await apiFetch(`${BASE_URL}/bookings/${bookingId}/worker-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ workerId, ownerId, status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Unable to update job status');
    return json.data;
  },

  // Toggle KYC
  toggleWorkerKyc: async (workerId, kycVerified, token) => {
    try {
      const res = await apiFetch(`${BASE_URL}/workers/${workerId}/kyc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ kycVerified }),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  // Toggle Duty
  toggleWorkerDuty: async (workerId, isAvailable, ownerId, token) => {
    try {
      const res = await apiFetch(`${BASE_URL}/workers/${workerId}/duty`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ isAvailable, ownerId }),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  // Create Booking
  createBooking: async (bookingData, token) => {
    const res = await apiFetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(bookingData),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.message || 'Unable to create booking');
    return json.data;
  },

  // Update Booking Status
  updateBookingStatus: async (bookingId, status, token) => {
    try {
      const res = await apiFetch(`${BASE_URL}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  // Review Booking
  reviewBooking: async (bookingId, rating, tipAmount, reviewComment, token) => {
    try {
      const res = await apiFetch(`${BASE_URL}/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rating, tipAmount, reviewComment }),
      });
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  // Analytics
  getAnalytics: async () => {
    try {
      const res = await apiFetch(`${BASE_URL}/analytics`);
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  // Worker Incoming Job
  getIncomingJob: async () => {
    try {
      const res = await apiFetch(`${BASE_URL}/jobs/incoming`);
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  // Worker Accept Job
  acceptJob: async () => {
    try {
      const res = await apiFetch(`${BASE_URL}/jobs/incoming/accept`, {
        method: 'POST',
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },
};
