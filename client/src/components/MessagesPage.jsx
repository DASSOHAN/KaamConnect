import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, LoaderCircle, MessageSquare, Send, ShieldCheck, Flag } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { browserSupabase } from '../lib/supabase';

const privacyMessage = 'To protect your privacy and keep your booking secure, please communicate through KaamConnect.';

export function MessagesPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState({ labourCost: '', materialCost: '0', travelCost: '0', notes: '' });
  const [showQuote, setShowQuote] = useState(false);
  const tail = useRef(null);
  const activeConversation = conversations.find((item) => item.id === conversationId);

  const loadConversations = useCallback(async () => {
    if (!session?.access_token) return;
    try { setConversations(await api.getConversations(session.access_token)); } catch (err) { setError(err.message); }
  }, [session?.access_token]);
  const loadMessages = useCallback(async () => {
    if (!session?.access_token || !conversationId) { setMessages([]); return; }
    try { setMessages(await api.getConversationMessages(session.access_token, conversationId)); setError(''); }
    catch (err) { setError(err.message); }
  }, [session?.access_token, conversationId]);
  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => {
    if (!conversationId) return undefined;
    const timer = window.setInterval(() => { loadMessages(); loadConversations(); }, 12000);
    let channel;
    if (browserSupabase) {
      channel = browserSupabase.channel(`chat-${conversationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => { loadMessages(); loadConversations(); }).subscribe();
    }
    return () => { window.clearInterval(timer); if (channel) browserSupabase.removeChannel(channel); };
  }, [conversationId, loadMessages, loadConversations]);
  useEffect(() => { tail.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (event) => {
    event.preventDefault(); if (!text.trim() || !conversationId || busy) return;
    setBusy(true); setError('');
    try { await api.sendMessage(session.access_token, conversationId, { type: 'text', text }); setText(''); await Promise.all([loadMessages(), loadConversations()]); }
    catch (err) { setError(err.code === 'CONTACT_DETAILS_BLOCKED' ? privacyMessage : err.message); }
    finally { setBusy(false); }
  };
  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError('Choose a JPG, PNG or WebP image under 8 MB.'); return; }
    if (!browserSupabase || !conversationId) { setError('Private photo upload is not configured.'); return; }
    setBusy(true); setError('');
    try {
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      const path = `${conversationId}/${profile.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await browserSupabase.storage.from('chat-attachments').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      await api.sendMessage(session.access_token, conversationId, { type: 'image', attachmentPath: path });
      await Promise.all([loadMessages(), loadConversations()]);
    } catch (err) { setError(err.message || 'Unable to upload this photo.'); }
    finally { setBusy(false); }
  };
  const sendQuote = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.createQuotation(session.access_token, conversationId, quote); setShowQuote(false); setQuote({ labourCost: '', materialCost: '0', travelCost: '0', notes: '' }); await Promise.all([loadMessages(), loadConversations()]); }
    catch (err) { setError(err.code === 'CONTACT_DETAILS_BLOCKED' ? privacyMessage : err.message); }
    finally { setBusy(false); }
  };
  const respondQuote = async (quotationId, action) => {
    setError(''); try { await api.respondToQuotation(session.access_token, quotationId, { action }); await Promise.all([loadMessages(), loadConversations()]); }
    catch (err) { setError(err.message); }
  };
  const report = async (message) => {
    const reason = window.prompt('Why are you reporting this message?');
    if (!reason) return;
    try { await api.reportMessage(session.access_token, message.id, reason); setError('Report sent to KaamConnect moderation.'); }
    catch (err) { setError(err.message); }
  };

  if (!session?.access_token) return <section className="mx-auto max-w-2xl py-12"><div className="rounded-2xl border border-slate-200 bg-white p-6"><h1 className="text-xl font-bold">Sign in to view private messages</h1><button onClick={() => navigate('/account?next=/messages')} className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Sign in</button></div></section>;
  if (!profile) return <section className="mx-auto max-w-2xl py-12"><div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Setting up your secure account…</div></section>;
  return <section className="mx-auto max-w-7xl py-5 sm:py-8">
    <div className="mb-4 flex items-center gap-3"><button onClick={() => navigate(-1)} aria-label="Back" className="rounded-lg border border-slate-200 bg-white p-2"><ArrowLeft className="h-4 w-4" /></button><div><h1 className="text-2xl font-extrabold text-slate-900">Messages</h1><p className="text-xs text-slate-500">Private conversations connected to your jobs and bookings</p></div></div>
    <div className="grid min-h-[65vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-subtle md:grid-cols-[300px_1fr]">
      <aside className={`${conversationId ? 'hidden md:block' : ''} border-r border-slate-200`}><div className="border-b p-4 font-bold text-slate-800">Your conversations</div>{conversations.length === 0 ? <p className="p-5 text-sm text-slate-500">No conversations yet. A chat opens when a worker responds to your job or a booking is created.</p> : conversations.map((item) => <button key={item.id} onClick={() => navigate(`/messages/${item.id}`)} className={`w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${conversationId === item.id ? 'bg-blue-50' : ''}`}><div className="flex items-center gap-3"><img src={item.peer?.avatar || '/favicon.svg'} className="h-10 w-10 rounded-xl bg-slate-100 object-cover" alt="" /><div className="min-w-0 flex-1"><div className="flex items-center gap-1 truncate text-sm font-bold text-slate-900">{item.peer?.name || 'KaamConnect member'}{item.peer?.verified && <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />}</div><p className="truncate text-xs text-slate-500">{item.job?.title || item.booking?.service_id || 'Service booking'}</p><p className="truncate text-xs text-slate-600">{item.lastMessage?.text || 'Start the conversation'}</p></div>{item.unreadCount > 0 && <span className="rounded-full bg-blue-700 px-2 py-1 text-[10px] font-bold text-white">{item.unreadCount}</span>}</div></button>)}</aside>
      {!conversationId ? <div className="hidden items-center justify-center p-8 text-center text-slate-400 md:flex"><div><MessageSquare className="mx-auto h-10 w-10" /><p className="mt-3 text-sm">Choose a conversation to start messaging</p></div></div> : <div className="flex min-h-[65vh] min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b p-4"><button onClick={() => navigate('/messages')} className="rounded-lg border p-2 md:hidden"><ArrowLeft className="h-4 w-4" /></button><img src={activeConversation?.peer?.avatar || '/favicon.svg'} alt="" className="h-10 w-10 rounded-xl bg-slate-100 object-cover" /><div className="min-w-0"><h2 className="flex items-center gap-1 text-sm font-bold text-slate-900">{activeConversation?.peer?.name || 'Conversation'}{activeConversation?.peer?.verified && <ShieldCheck className="h-4 w-4 text-blue-600" />}</h2><p className="truncate text-xs text-slate-500">{activeConversation?.job?.title || activeConversation?.booking?.service_id || 'Service conversation'} {activeConversation?.job?.locality ? `· ${activeConversation.job.locality}` : ''}</p></div></header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">{messages.map((message) => <div key={message.id} className={`group flex ${message.senderId === profile?.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${message.senderId === profile?.id ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
          {message.type === 'image' ? <img src={message.attachmentUrl} alt="Shared job photo" className="max-h-72 rounded-lg object-contain" /> : message.type === 'quote' ? <div className="min-w-56"><strong>Worker quotation</strong><p className="mt-2 text-xs">Labour ₹{message.quotation?.labour_cost} · Materials ₹{message.quotation?.material_cost} · Travel ₹{message.quotation?.travel_cost}</p><p className="mt-1 font-bold">Total estimate ₹{message.quotation?.total_estimate}</p>{message.quotation?.notes && <p className="mt-2 text-xs">{message.quotation.notes}</p>}<p className="mt-1 text-[10px] opacity-75">{message.quotation?.status}</p>{profile?.role === 'customer' && ['proposed','change_requested'].includes(message.quotation?.status) && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => respondQuote(message.quotation.id, 'accept')} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Accept</button><button onClick={() => respondQuote(message.quotation.id, 'change')} className="rounded-lg border px-2 py-1 text-xs">Request changes</button><button onClick={() => respondQuote(message.quotation.id, 'reject')} className="rounded-lg border px-2 py-1 text-xs">Reject</button></div>}</div> : <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          <div className="mt-1 flex items-center justify-between gap-3 text-[10px] opacity-60"><span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{message.senderId === profile?.id && message.isRead ? ' · Read' : ''}</span>{message.senderId !== profile?.id && <button title="Report message" onClick={() => report(message)}><Flag className="h-3 w-3" /></button>}</div>
        </div></div>)}<div ref={tail} /></div>
        {error && <p role="alert" className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</p>}
        {showQuote && profile?.role === 'worker' && <form onSubmit={sendQuote} className="grid gap-2 border-t p-3 sm:grid-cols-4"><input required type="number" min="0.01" step="0.01" placeholder="Labour cost" value={quote.labourCost} onChange={(e) => setQuote({ ...quote, labourCost: e.target.value })} className="rounded-lg border p-2 text-sm" /><input type="number" min="0" placeholder="Materials" value={quote.materialCost} onChange={(e) => setQuote({ ...quote, materialCost: e.target.value })} className="rounded-lg border p-2 text-sm" /><input type="number" min="0" placeholder="Travel" value={quote.travelCost} onChange={(e) => setQuote({ ...quote, travelCost: e.target.value })} className="rounded-lg border p-2 text-sm" /><input placeholder="Notes" maxLength="1000" value={quote.notes} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} className="rounded-lg border p-2 text-sm" /><button disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white sm:col-span-4">Send quotation · ₹{Number(quote.labourCost || 0) + Number(quote.materialCost || 0) + Number(quote.travelCost || 0)}</button></form>}
        <form onSubmit={send} className="flex items-end gap-2 border-t bg-white p-3"><label className="cursor-pointer rounded-xl border border-slate-200 p-3 text-slate-600" title="Attach photo"><ImagePlus className="h-5 w-5" /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={busy} className="hidden" /></label><textarea rows={1} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} placeholder="Write a message..." className="max-h-28 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /><button type="submit" disabled={busy || !text.trim()} className="rounded-xl bg-blue-700 p-3 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>{profile?.role === 'worker' && <button type="button" onClick={() => setShowQuote((open) => !open)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Quote</button>}{busy && <LoaderCircle className="h-4 w-4 animate-spin text-blue-700" />}</form>
      </div>}
    </div>
    <p className="mt-3 text-center text-xs text-slate-500">Keep your contact details private. KaamConnect filters phone numbers, email addresses and WhatsApp links.</p>
  </section>;
}
