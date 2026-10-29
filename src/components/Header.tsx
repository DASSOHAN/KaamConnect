import React, { useState } from 'react';
import { 
  MapPin, 
  ChevronDown, 
  Smartphone, 
  Monitor, 
  ShieldCheck, 
  Users, 
  Briefcase, 
  BarChart3, 
  Languages,
  Activity,
  Clock
} from 'lucide-react';
import { Language, UserRole, KalyaniLocation } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { KALYANI_LOCATIONS } from '../data/mockData';

interface HeaderProps {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  selectedLocation: KalyaniLocation;
  setSelectedLocation: (loc: KalyaniLocation) => void;
  selectedRadius: number; // in km
  setSelectedRadius: (radius: number) => void;
  isMobileEmulation: boolean;
  setIsMobileEmulation: (em: boolean) => void;
  hasActiveBooking: boolean;
  onOpenActiveBooking: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  setRole,
  language,
  setLanguage,
  selectedLocation,
  setSelectedLocation,
  selectedRadius,
  setSelectedRadius,
  isMobileEmulation,
  setIsMobileEmulation,
  hasActiveBooking,
  onOpenActiveBooking,
}) => {
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [isRadiusOpen, setIsRadiusOpen] = useState(false);
  const t = TRANSLATIONS[language];

  const radiusOptions = [1, 3, 5];

  const getLocalizedLocName = (loc: KalyaniLocation) => {
    if (language === 'bn') return loc.nameBn;
    if (language === 'hi') return loc.nameHi;
    return loc.name;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      {/* Top Banner: District Trust Bar */}
      <div className="bg-slate-900 text-slate-200 px-4 py-1 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Nadia District Grid
          </span>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-300 hidden sm:inline">
            Kalyani Subdivision Fair-Wage Accord: Zero Middleman Cuts
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-slate-300 hidden md:inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              Avg Arrival: <strong className="text-white">12 mins</strong>
            </span>
            <span className="text-slate-500 hidden md:inline">|</span>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded-full text-[11px] text-slate-300 border border-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>West Bengal Govt ID & Police Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo & Geolocation */}
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setRole('customer')}>
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm shadow-slate-900/10 border border-slate-800">
              <span className="text-xl tracking-tighter text-blue-400">K</span>
              <span className="text-xl tracking-tighter text-emerald-400">C</span>
            </div>
            <div className="hidden xs:block">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-slate-900 tracking-tight">
                  {t.brandName}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Kalyani
                </span>
              </div>
              <p className="text-[11px] text-slate-500 -mt-0.5 font-medium hidden sm:block">
                Nadia District Informal Labor Platform
              </p>
            </div>
          </div>

          {/* Hyperlocal Location & Radius Picker */}
          <div className="relative">
            <div className="flex items-center bg-slate-100 hover:bg-slate-150 border border-slate-200/90 rounded-xl p-1 text-xs">
              <button
                onClick={() => {
                  setIsLocationOpen(!isLocationOpen);
                  setIsRadiusOpen(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-slate-800 font-semibold hover:text-blue-700 transition"
                title="Change Kalyani Locality"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                <span className="truncate max-w-[130px] sm:max-w-[170px]">
                  {getLocalizedLocName(selectedLocation)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <div className="h-4 w-px bg-slate-200"></div>

              {/* Radius Trigger */}
              <button
                onClick={() => {
                  setIsRadiusOpen(!isRadiusOpen);
                  setIsLocationOpen(false);
                }}
                className="flex items-center gap-1 px-2 py-1 text-slate-600 font-medium hover:text-slate-900 transition"
                title="Change discovery radius"
              >
                <span className="text-[11px] text-slate-500">Radius:</span>
                <span className="font-bold text-slate-900">{selectedRadius} km</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            {/* Location Dropdown Menu */}
            {isLocationOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl shadow-elevated border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2 border-b border-slate-100 mb-1">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Kalyani & Nadia Localities
                  </div>
                  <p className="text-[11px] text-slate-500">Select pickup or service address</p>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {KALYANI_LOCATIONS.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        setSelectedLocation(loc);
                        setIsLocationOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                        selectedLocation.id === loc.id
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div>{getLocalizedLocName(loc)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{loc.wardOrBlock}</div>
                      </div>
                      {loc.isPopular && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                          POPULAR
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Radius Dropdown Menu */}
            {isRadiusOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-elevated border border-slate-200 p-2 z-50">
                <div className="p-2 border-b border-slate-100 mb-1">
                  <div className="text-xs font-bold text-slate-800">Dispatch Radius</div>
                  <p className="text-[11px] text-slate-500">Fastest arrival zone</p>
                </div>
                {radiusOptions.map((rad) => (
                  <button
                    key={rad}
                    onClick={() => {
                      setSelectedRadius(rad);
                      setIsRadiusOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                      selectedRadius === rad
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Within {rad} km</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {rad === 1 ? '< 10 mins' : rad === 3 ? '< 18 mins' : '< 25 mins'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center / Right: Persistent Perspective Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Booking Floating Indicator */}
          {hasActiveBooking && (
            <button
              onClick={onOpenActiveBooking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition animate-pulse"
              title="Track ongoing booking"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Job Active</span>
            </button>
          )}

          {/* Perspective Switcher: Customer / Worker / Admin */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center">
            <button
              onClick={() => setRole('customer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentRole === 'customer'
                  ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">{t.customerView}</span>
              <span className="md:hidden">User</span>
            </button>

            <button
              onClick={() => setRole('worker')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentRole === 'worker'
                  ? 'bg-slate-900 text-white shadow-subtle font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{t.workerMode}</span>
              <span className="md:hidden">Worker</span>
            </button>

            <button
              onClick={() => setRole('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentRole === 'admin'
                  ? 'bg-blue-700 text-white shadow-subtle font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-200" />
              <span className="hidden md:inline">{t.adminHub}</span>
              <span className="md:hidden">Admin</span>
            </button>
          </div>

          {/* Trilingual Switcher (English / বাংলা / हिंदी) */}
          <div className="relative group">
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-lg font-medium transition ${
                  language === 'en' ? 'bg-white text-slate-900 font-bold shadow-subtle' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('bn')}
                className={`px-2 py-1 rounded-lg font-medium transition ${
                  language === 'bn' ? 'bg-white text-slate-900 font-bold shadow-subtle' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="বাংলা"
              >
                বাংলা
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2 py-1 rounded-lg font-medium transition ${
                  language === 'hi' ? 'bg-white text-slate-900 font-bold shadow-subtle' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="हिंदी"
              >
                हिंदी
              </button>
            </div>
          </div>

          {/* Mobile Emulation Toggle for Desktop Testing */}
          <button
            onClick={() => setIsMobileEmulation(!isMobileEmulation)}
            className={`hidden lg:flex items-center gap-1.5 p-2 rounded-xl text-xs font-medium border transition ${
              isMobileEmulation
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Mobile Viewport Simulation"
          >
            {isMobileEmulation ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            <span className="text-[11px] font-semibold">
              {isMobileEmulation ? 'Desktop View' : 'Mobile Emulate'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
