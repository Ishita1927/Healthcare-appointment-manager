import React, { useState } from 'react';
import { Activity, User, Shield, Stethoscope, Mail, LogOut, FileText, ChevronDown, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenOutbox: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenOutbox }) => {
  const { user, logout, quickSwitchUser, demoAccounts } = useAuth();
  const [showDemoDropdown, setShowDemoDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <div
              onClick={() => setActiveTab(user ? (user.role === 'PATIENT' ? 'patient' : user.role === 'DOCTOR' ? 'doctor' : 'admin') : 'patient')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1">
                  Clinic<span className="text-brand-600">Pulse</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block -mt-1">
                  Healthcare India
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
              <button
                onClick={() => setActiveTab('patient')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'patient'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Patient Portal
              </button>

              <button
                onClick={() => setActiveTab('doctor')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'doctor'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Doctor Portal
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'admin'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin Portal
              </button>

              <button
                onClick={() => setActiveTab('system-design')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'system-design'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                System Design & LLM
              </button>
            </nav>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            
            {/* Live Outbox Trigger */}
            <button
              onClick={onOpenOutbox}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-sm transition"
              title="Inspect simulated / sent emails in real-time"
            >
              <div className="relative">
                <Mail className="w-4 h-4 text-brand-600" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              </div>
              <span className="hidden sm:inline">Live Outbox</span>
            </button>

            {/* Quick Demo Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowDemoDropdown(!showDemoDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
              >
                <Users className="w-3.5 h-3.5 opacity-80" />
                <span>Switch Role / User</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {showDemoDropdown && (
                <div className="absolute right-0 mt-2 w-80 max-h-[75vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                    Select Role / Doctor / Patient
                  </div>
                  {demoAccounts.map((acc: any) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        quickSwitchUser(acc.email);
                        setShowDemoDropdown(false);
                        if (acc.role === 'PATIENT') setActiveTab('patient');
                        else if (acc.role === 'DOCTOR') setActiveTab('doctor');
                        else setActiveTab('admin');
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-50 ${
                        user?.email === acc.email ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold truncate">{acc.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {acc.specialization ? `${acc.specialization} • ₹${acc.consultation_fee}` : acc.email}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                        acc.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                        acc.role === 'DOCTOR' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {acc.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Current User Badge & Logout / Sign In */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="text-right hidden sm:block max-w-[130px]">
                  <div className="text-xs font-bold text-slate-800 leading-tight truncate">{user.name}</div>
                  <div className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider">{user.role}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('auth')}
                className="px-3.5 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition"
              >
                Sign In
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
