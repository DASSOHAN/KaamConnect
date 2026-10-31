import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  HelpCircle,
  PhoneCall,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  RotateCcw,
  Zap,
  Wind,
  Droplets,
  Tv,
  Flame,
  Check
} from 'lucide-react';
import { api } from '../services/api';

const APPLIANCE_OPTIONS = [
  { id: 'air-conditioner', name: 'Air Conditioner', icon: Wind, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { id: 'washing-machine', name: 'Washing Machine', icon: Droplets, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'refrigerator', name: 'Refrigerator', icon: Zap, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'ceiling-fan', name: 'Ceiling Fan', icon: Wind, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'water-pump', name: 'Water Pump', icon: Droplets, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { id: 'geyser', name: 'Geyser / Water Heater', icon: Flame, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'other', name: 'Other Appliance', icon: Wrench, color: 'text-slate-600 bg-slate-50 border-slate-200' },
];

const SUGGESTED_QUERIES = [
  'My AC is running but the room is not getting cold.',
  'My washing machine is repeatedly failing to drain water.',
  'My refrigerator is not cooling properly.',
  'The ceiling fan is wobbling and making unusual noise.',
  'My refrigerator is not cooling and my AC is also not cooling.'
];

export function AICareModal({
  isOpen,
  onClose,
  sessionUser,
  selectedLocation,
  onOpenBookingModal,
  onOpenElectronicsCare,
  onRequireAuth
}) {
  const [selectedAppliance, setSelectedAppliance] = useState('air-conditioner');
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAssessment, setCurrentAssessment] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Booking Handoff Confirmation State
  const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);
  const [matchedWorkers, setMatchedWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduledSlot, setScheduledSlot] = useState('02:00 PM - 04:00 PM');
  const [addressDetails, setAddressDetails] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && !sessionId) {
      initSession();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentAssessment, isConfirmingBooking]);

  const initSession = async (category = selectedAppliance) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.createAICareSession({ applianceCategory: category });
      setSessionId(res.session.id);
      setCurrentAssessment(null);
      setBookingSuccess(null);
      setIsConfirmingBooking(false);

      const welcomeMsg = {
        id: 'welcome',
        sender: 'assistant',
        content: `Hello! I am **KaamConnect AI Care** (Understand. Resolve. Connect.).\n\nTell me what issue you are experiencing with your **${APPLIANCE_OPTIONS.find(a => a.id === category)?.name || 'appliance'}**. I'll help you check safe basic steps and connect you with a verified Kalyani technician if needed.`,
        created_at: new Date().toISOString()
      };
      setMessages([welcomeMsg]);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to start AI Care session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = String(textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    setErrorMsg('');

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'customer',
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const initRes = await api.createAICareSession({ applianceCategory: selectedAppliance });
        currentSessionId = initRes.session.id;
        setSessionId(currentSessionId);
      }

      const res = await api.sendAICareChat({
        sessionId: currentSessionId,
        message: text,
        applianceCategory: selectedAppliance
      });

      const assessment = res.assessment;
      setCurrentAssessment(assessment);

      const assistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        content: assessment.message,
        structured_payload: assessment,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If PROFESSIONAL_HELP, fetch matched workers for discovery
      if (assessment.status === 'PROFESSIONAL_HELP') {
        fetchMatchedWorkers(currentSessionId);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Communication failure. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMatchedWorkers = async (sid) => {
    try {
      const res = await api.getAICareMatchedWorkers(sid);
      if (res?.workers?.length) {
        setMatchedWorkers(res.workers);
        setSelectedWorkerId(res.workers[0].id);
      }
    } catch {
      // Fallback: worker discovery handled via general booking
    }
  };

  const handleConfirmBooking = async () => {
    if (!sessionUser) {
      onRequireAuth?.();
      return;
    }

    setIsSubmittingBooking(true);
    setErrorMsg('');

    try {
      const res = await api.confirmAICareBooking({
        sessionId,
        workerId: selectedWorkerId || null,
        serviceId: currentAssessment?.suggested_service_category || 'electrician',
        scheduledDate,
        scheduledSlot,
        locality: selectedLocation?.name || 'Kalyani',
        addressDetails: addressDetails || 'Kalyani, Nadia District',
        problemSummary: currentAssessment?.problem_summary || {}
      });

      setBookingSuccess(res.booking);
      setIsConfirmingBooking(false);
    } catch (err) {
      setErrorMsg(err.message || 'Booking confirmation failed.');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex flex-col w-full max-w-3xl h-[90vh] max-h-[820px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">KaamConnect AI Care</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Gemma Diagnostics
                </span>
              </div>
              <p className="text-xs text-slate-300">Understand. Resolve. Connect. • Nadia & Kalyani Grid</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => initSession(selectedAppliance)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Restart Assessment"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              aria-label="Close AI Care"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Appliance Selector Strip */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto scrollbar-none flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider shrink-0 mr-1">Appliance:</span>
          {APPLIANCE_OPTIONS.map((app) => {
            const Icon = app.icon;
            const isSelected = selectedAppliance === app.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  setSelectedAppliance(app.id);
                  initSession(app.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{app.name}</span>
              </button>
            );
          })}
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-100/50">
          {messages.map((msg) => {
            const isUser = msg.sender === 'customer';
            const payload = msg.structured_payload;

            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 shadow-sm text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-line font-medium">{msg.content}</p>

                  {/* Structured Payload Rendering */}
                  {payload && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                      
                      {/* 1. URGENT SAFETY ALERT */}
                      {payload.status === 'URGENT_SAFETY' && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-950 space-y-2.5">
                          <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Immediate Action Required</span>
                          </div>
                          <ul className="text-xs space-y-1 list-disc list-inside text-rose-900 font-medium">
                            {payload.safe_guidance_steps?.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                          {payload.emergency_contacts && (
                            <div className="pt-2 border-t border-rose-200">
                              <span className="text-[11px] font-bold uppercase text-rose-800 block mb-1">Emergency Hotlines:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {payload.emergency_contacts.map((contact, idx) => (
                                  <a
                                    key={idx}
                                    href={`tel:${contact.number}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 transition"
                                  >
                                    <PhoneCall className="w-3 h-3" />
                                    <span>{contact.name}: <strong>{contact.number}</strong></span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="text-[11px] text-rose-700 italic font-semibold">
                            ⚠️ Marketplace technicians are not emergency services. Ensure your home is safe first.
                          </p>
                        </div>
                      )}

                      {/* 2. SELF-HELP SAFE GUIDANCE */}
                      {payload.status === 'SELF_HELP' && payload.safe_guidance_steps?.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Recommended Safe Checks</span>
                          </div>
                          <ul className="text-xs space-y-1.5 list-disc list-inside text-emerald-900">
                            {payload.safe_guidance_steps.map((step, idx) => (
                              <li key={idx} className="font-medium">{step}</li>
                            ))}
                          </ul>
                          <p className="text-[11px] text-emerald-800 bg-emerald-100/70 p-2 rounded-lg font-medium">
                            ℹ️ Note: These are safe preliminary checks. Never dismantle internal covers or touch wiring. If the fault persists, request professional inspection.
                          </p>
                        </div>
                      )}

                      {/* 3. PROFESSIONAL HELP & PROBLEM SUMMARY */}
                      {payload.status === 'PROFESSIONAL_HELP' && payload.problem_summary && (
                        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs uppercase tracking-wider">
                              <Wrench className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>Structured Problem Summary</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200 text-blue-800">
                              Verified Technician Required
                            </span>
                          </div>
                          <div className="text-xs space-y-1 bg-white p-3 rounded-lg border border-blue-100">
                            <p><strong>Appliance:</strong> {payload.problem_summary.appliance}</p>
                            <p><strong>Reported Symptoms:</strong> {payload.problem_summary.reported_symptoms?.join(', ')}</p>
                            {payload.problem_summary.confirmed_error_codes?.length > 0 && (
                              <p><strong>Error Codes:</strong> {payload.problem_summary.confirmed_error_codes.join(', ')}</p>
                            )}
                            {payload.problem_summary.checks_already_performed?.length > 0 && (
                              <p><strong>Completed Checks:</strong> {payload.problem_summary.checks_already_performed.join(', ')}</p>
                            )}
                            <p><strong>Recommended Trade:</strong> {payload.problem_summary.recommended_service_category}</p>
                          </div>

                          {/* Multi-appliance coordinated note */}
                          {payload.multi_appliance_data?.length > 1 && (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                              <strong>Multi-Appliance Coordination:</strong> You have {payload.multi_appliance_data.length} separate appliance issues. You can book a coordinated visit through Home Electronics Care.
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenElectronicsCare?.();
                                }}
                                className="mt-2 block w-full py-1.5 px-3 bg-amber-500 text-slate-950 font-bold rounded-lg text-center hover:bg-amber-400 transition"
                              >
                                Open Home Electronics Care Coordinator
                              </button>
                            </div>
                          )}

                          {!bookingSuccess && (
                            <button
                              type="button"
                              onClick={() => setIsConfirmingBooking(true)}
                              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm hover:bg-blue-700 transition"
                            >
                              <span>Review & Confirm Technician Booking</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* 4. FOLLOW-UP QUESTIONS (Interactive Quick Replies) */}
                      {payload.follow_up_questions?.length > 0 && (
                        <div className="pt-2 space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Suggested Details:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {payload.follow_up_questions.map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSendMessage(q)}
                                className="text-left text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-700 transition"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Booking Confirmation Card */}
          {isConfirmingBooking && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-blue-500 shadow-md space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">Confirm Your Service Dispatch</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmingBooking(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p>The AI problem summary will be attached to the booking so your technician arrives with appropriate tools.</p>
              </div>

              {/* Matched Workers */}
              {matchedWorkers.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Select Verified Technician ({selectedLocation?.name || 'Kalyani'} Area):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchedWorkers.slice(0, 4).map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWorkerId(w.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition ${
                          selectedWorkerId === w.id
                            ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                          {w.name?.charAt(0) || 'W'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate">{w.name}</span>
                            <span className="text-[10px] text-amber-600 font-bold">★ {w.rating || '4.9'}</span>
                          </div>
                          <p className="text-[10px] text-slate-500">{w.locality || 'Kalyani'} • ₹{w.halfDayRate}/half-day</p>
                        </div>
                        {selectedWorkerId === w.id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule and Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Preferred Date:</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Time Slot:</label>
                  <select
                    value={scheduledSlot}
                    onChange={(e) => setScheduledSlot(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Immediate Dispatch">Immediate Dispatch (15-20 mins)</option>
                    <option value="10:00 AM - 12:00 PM">Morning (10:00 AM - 12:00 PM)</option>
                    <option value="02:00 PM - 04:00 PM">Afternoon (02:00 PM - 04:00 PM)</option>
                    <option value="05:00 PM - 07:00 PM">Evening (05:00 PM - 07:00 PM)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Service Address / Apartment:</label>
                  <input
                    type="text"
                    value={addressDetails}
                    onChange={(e) => setAddressDetails(e.target.value)}
                    placeholder="e.g. Flat 3B, Ghoshpara Station Road, Kalyani"
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmittingBooking}
                onClick={handleConfirmBooking}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {isSubmittingBooking ? 'Confirming Dispatch...' : 'Confirm Technician Booking (No Prepayment Required)'}
              </button>
            </div>
          )}

          {/* Booking Success Notice */}
          {bookingSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Technician Dispatch Placed Successfully!</span>
              </div>
              <p className="text-xs">
                Your booking ID is <strong>{bookingSuccess.id}</strong>. The technician has received your AI problem assessment and will arrive during your selected slot.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white p-3 rounded-2xl border border-slate-200 w-fit">
              <Sparkles className="w-4 h-4 text-blue-500 animate-spin" />
              <span>Gemma AI Care is analyzing symptoms & safety rules...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg('')} className="font-bold underline text-[11px]">Dismiss</button>
          </div>
        )}

        {/* Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase">Try:</span>
            {SUGGESTED_QUERIES.map((query, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(query)}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 whitespace-nowrap shrink-0 transition"
              >
                {query}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Describe the problem with your ${APPLIANCE_OPTIONS.find(a => a.id === selectedAppliance)?.name || 'appliance'}...`}
              disabled={isLoading}
              className="flex-1 p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2.5 sm:p-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
              aria-label="Send message"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
            <span>Safety priority enabled • Zero arbitrary diagnosis</span>
            <span>Local SQLite • Kalyani Subdivision Accord</span>
          </div>
        </div>

      </div>
    </div>
  );
}
