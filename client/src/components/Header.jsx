import React, { useState } from 'react';
import {
  Activity, BarChart3, Briefcase, Check, ChevronDown, Clock, Languages, MapPin,
  Menu, MessageSquare, Monitor, ShieldCheck, Smartphone, Sparkles, UserRound, Users, X,
} from 'lucide-react';
import { TRANSLATIONS } from '../utils/i18n';

export const Header = ({
  currentRole, language, setLanguage, selectedLocation, setSelectedLocation,
  selectedRadius, setSelectedRadius, isMobileEmulation, setIsMobileEmulation,
  onHome,
  hasActiveBooking, onOpenActiveBooking, onOpenMyJobs, onOpenWorkerDashboard,
  onOpenWorkerJobs, onOpenAdmin, onOpenMessages, unreadMessageCount = 0,
  onOpenAccount, onSignOut, isAuthenticated = false, locations = [],
  onJoinCustomer, onJoinWorker, onOpenElectronicsCare, onBrowseJobs, onOpenAICare,
}) => {
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [isRadiusOpen, setIsRadiusOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const radiusOptions = [1, 3, 5];
  const locationName = (loc) => !loc ? 'Kalyani' : language === 'bn' ? loc.nameBn || loc.name : language === 'hi' ? loc.nameHi || loc.name : loc.name;
  const closeMenu = () => { setIsMenuOpen(false); setIsJoinOpen(false); };

  const JoinButtons = ({ mobile = false }) => (
    <div className={`${mobile ? 'grid grid-cols-2' : 'absolute right-0 top-full z-50 mt-2 grid w-56'} gap-2 rounded-xl ${mobile ? '' : 'border border-slate-200 bg-white p-2 shadow-elevated'}`}>
      <button type="button" onClick={() => { closeMenu(); onJoinCustomer?.(); }} className="rounded-lg bg-blue-700 px-3 py-2 text-left text-xs font-bold text-white">Join as Customer</button>
      <button type="button" onClick={() => { closeMenu(); onJoinWorker?.(); }} className="rounded-lg bg-amber-400 px-3 py-2 text-left text-xs font-bold text-slate-950">Join as Worker</button>
    </div>
  );

  const MenuItems = ({ mobile = false }) => (
    <div className={mobile ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap items-center gap-2'}>
      {hasActiveBooking && <NavButton onClick={() => { closeMenu(); onOpenActiveBooking?.(); }} icon={<Activity />} highlight>Live job</NavButton>}
      {currentRole === 'customer' && <NavButton onClick={() => { closeMenu(); onOpenMyJobs?.(); }} icon={<Clock />}>My Bookings</NavButton>}
      <NavButton onClick={() => { closeMenu(); onOpenAICare?.(); }} icon={<Sparkles />} highlight>✨ AI Care</NavButton>
      {currentRole === 'customer' && <NavButton onClick={() => { closeMenu(); onOpenElectronicsCare?.(); }} icon={<Monitor />}>Home Electronics Care</NavButton>}
      {!isAuthenticated && <NavButton onClick={() => { closeMenu(); onBrowseJobs?.(); }} icon={<Briefcase />}>Browse jobs</NavButton>}
      {currentRole === 'worker' && <>
        <NavButton onClick={() => { closeMenu(); onOpenWorkerDashboard?.(); }} icon={<Briefcase />}>Worker dashboard</NavButton>
        <NavButton onClick={() => { closeMenu(); onOpenWorkerJobs?.(); }} icon={<Users />}>Available jobs</NavButton>
      </>}
      {currentRole === 'admin' && <NavButton onClick={() => { closeMenu(); onOpenAdmin?.(); }} icon={<BarChart3 />}>Admin dashboard</NavButton>}
      <div className={mobile ? 'col-span-2 flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 p-2' : 'ml-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1'}>
        <span className="px-1 text-[10px] font-semibold text-slate-500"><Languages className="mr-1 inline h-3 w-3" />Language</span>
        {['en', 'bn', 'hi'].map((lang) => <button key={lang} type="button" onClick={() => setLanguage(lang)} className={`rounded-lg px-2 py-1 text-xs font-bold ${language === lang ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{lang.toUpperCase()}</button>)}
      </div>
      <button type="button" onClick={() => { setIsMobileEmulation(!isMobileEmulation); closeMenu(); }} className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 xl:inline-flex">
        {isMobileEmulation ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}{isMobileEmulation ? 'Desktop view' : 'Mobile emulate'}
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="bg-slate-900 px-3 py-1.5 text-xs text-slate-200 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />Nadia District Grid</span>
          <span className="hidden min-w-0 truncate text-slate-400 md:inline">Kalyani Subdivision Fair-Wage Accord: Zero Middleman Cuts</span>
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-slate-300 xl:inline-flex"><Clock className="h-3 w-3 text-slate-400" />Avg Arrival: <strong className="text-white">12 mins</strong></span>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 lg:inline-flex"><ShieldCheck className="h-3.5 w-3.5 text-blue-400" />Verified worker network</span>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <button type="button" onClick={onHome} className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center gap-0.5 rounded-xl border font-bold shadow-sm" style={{ backgroundColor: '#F2F0E9', borderColor: '#F2F0E9' }}><span className="inline-block text-xl tracking-tighter" style={{ backgroundImage: 'linear-gradient(to bottom, #FFD43B 0%, #FFD43B 50%, #242629 50%, #242629 75%, #C5CAD0 75%, #C5CAD0 100%)', color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', WebkitTextStroke: '0.5px #242629', transform: 'scale(1.12)' }}>K</span><span className="inline-block text-xl tracking-tighter" style={{ backgroundImage: 'linear-gradient(to bottom, #FFD43B 0%, #FFD43B 50%, #242629 50%, #242629 75%, #C5CAD0 75%, #C5CAD0 100%)', color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', WebkitTextStroke: '0.5px #242629', transform: 'scale(1.12)' }}>C</span></span>
            <span className="hidden min-w-0 xs:block"><span className="flex items-center gap-1.5"><span className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">{t.brandName}</span><span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700">Kalyani</span></span><span className="hidden text-[10px] font-medium text-slate-500 sm:block">Nadia District Informal Labor Platform</span></span>
          </button>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => { onOpenAICare?.(); closeMenu(); }} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:from-blue-600 hover:to-indigo-600 transition">
              <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" /><span>AI Care</span>
            </button>
            <button type="button" onClick={() => { onOpenMessages?.(); closeMenu(); }} className="relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:px-3" aria-label={`Messages${unreadMessageCount ? `, ${unreadMessageCount} unread` : ''}`}>
              <MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Messages</span>
              {unreadMessageCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">{unreadMessageCount > 99 ? '99+' : unreadMessageCount}</span>}
            </button>
            <div className="relative hidden sm:block">
              {isAuthenticated ? <button type="button" onClick={onOpenAccount} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><UserRound className="h-4 w-4" /><span>Account</span></button> : <>
                <button type="button" onClick={onOpenAccount} className="shrink-0 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Sign in</button>
                <button type="button" onClick={() => setIsJoinOpen((value) => !value)} className="ml-1 shrink-0 whitespace-nowrap rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300">Join KaamConnect</button>
                {isJoinOpen && <JoinButtons />}
              </>}
            </div>
            {isAuthenticated && <button type="button" onClick={onSignOut} className="hidden shrink-0 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex">Sign out</button>}
            <button type="button" onClick={() => { setIsMenuOpen((value) => !value); setIsJoinOpen(false); }} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden" aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={isMenuOpen}>{isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:inline-flex sm:w-fit sm:max-w-full">
          <div className="relative min-w-0">
            <button type="button" aria-expanded={isLocationOpen} onClick={() => { setIsLocationOpen((value) => !value); setIsRadiusOpen(false); }} className="flex min-w-0 w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-white sm:max-w-[360px] sm:px-3">
              <MapPin className="h-4 w-4 shrink-0 text-rose-500" /><span className="min-w-0 flex-1 truncate">{locationName(selectedLocation)}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </button>
            {isLocationOpen && <div className="absolute left-0 top-full z-50 mt-2 w-[min(19rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-elevated"><div className="mb-1 border-b border-slate-100 p-2"><div className="text-xs font-bold uppercase tracking-wider text-slate-800">Kalyani & Nadia Localities</div><p className="text-[11px] text-slate-500">Select service area</p></div><div className="max-h-64 space-y-1 overflow-y-auto">{locations.map((loc) => <button key={loc.id} type="button" onClick={() => { setSelectedLocation(loc); setIsLocationOpen(false); }} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs ${selectedLocation?.id === loc.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}><span className="min-w-0"><span className="block truncate">{locationName(loc)}</span><span className="block truncate text-[10px] font-normal text-slate-400">{loc.wardOrBlock}</span></span>{loc.isPopular && <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">POPULAR</span>}</button>)}</div></div>}
          </div>
          <div className="relative shrink-0">
            <button type="button" aria-expanded={isRadiusOpen} onClick={() => { setIsRadiusOpen((value) => !value); setIsLocationOpen(false); }} className="inline-flex min-w-[112px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-white"><span className="text-slate-500">Radius</span><strong className="text-slate-900">{selectedRadius} km</strong><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button>
            {isRadiusOpen && <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-elevated"><div className="border-b border-slate-100 p-2"><div className="text-xs font-bold text-slate-800">Dispatch Radius</div><p className="text-[11px] text-slate-500">Fastest arrival zone</p></div>{radiusOptions.map((radius) => <button key={radius} type="button" onClick={() => { setSelectedRadius(radius); setIsRadiusOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs ${selectedRadius === radius ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}><span>Within {radius} km</span><span className="text-[10px] text-slate-400">{radius === 1 ? '< 10 mins' : radius === 3 ? '< 18 mins' : '< 25 mins'}</span></button>)}</div>}
          </div>
        </div>

        <div className="hidden items-center justify-between gap-3 lg:flex"><MenuItems /></div>
        {isMenuOpen && <nav className="grid gap-3 border-t border-slate-200 pt-3 lg:hidden" aria-label="Main navigation">
          {isAuthenticated ? <><MenuItems mobile /><button type="button" onClick={() => { closeMenu(); onOpenAccount?.(); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700">My account</button><button type="button" onClick={() => { closeMenu(); onSignOut?.(); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700">Sign out</button></> : <>
            <button type="button" onClick={() => { closeMenu(); onOpenAccount?.(); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700">Sign in</button>
            <p className="text-xs font-bold text-slate-700">Join KaamConnect</p><JoinButtons mobile />
            <MenuItems mobile />
          </>}
        </nav>}
      </div>
    </header>
  );
};

function NavButton({ onClick, icon, children, highlight = false }) {
  return <button type="button" onClick={onClick} className={`inline-flex min-w-max items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold ${highlight ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
    {React.cloneElement(icon, { className: 'h-3.5 w-3.5 shrink-0' })}{children}
  </button>;
}
