import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Lock, Mail, User, Shield, Stethoscope, ArrowRight, CheckCircle2, Search } from 'lucide-react';
import { UserRole } from '../types';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, register, quickSwitchUser, demoAccounts } = useAuth();
  
  // Auth Modes: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginRole, setLoginRole] = useState<UserRole>('PATIENT');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>('PATIENT');
  const [specialization, setSpecialization] = useState('Cardiology');

  // Directory filter search
  const [directorySearch, setDirectorySearch] = useState('');
  const [showDirectory, setShowDirectory] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await register(name, email, password, registerRole, specialization);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDemoAccounts = demoAccounts.filter((acc: any) => {
    const q = directorySearch.toLowerCase();
    return (
      acc.name.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q) ||
      (acc.specialization && acc.specialization.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-4xl mx-auto my-8 px-4 space-y-6">
      
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white mx-auto shadow-md shadow-brand-500/20">
          <Activity className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Welcome to ClinicPulse India
        </h1>
        <p className="text-xs text-slate-500">
          Multi-Specialty Healthcare Consultation & Follow-up Platform
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Authentication Box */}
        <div className="lg:col-span-7 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          
          {/* Top Auth Mode Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => {
                setAuthMode('login');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In to Your Account
            </button>
            <button
              onClick={() => {
                setAuthMode('register');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Register New Account
            </button>
          </div>

          {/* SIGN IN VIEW */}
          {authMode === 'login' && (
            <div className="space-y-5">
              
              {/* Role Selectors */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Role to Log In
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { role: 'PATIENT' as UserRole, label: 'Patient', icon: User },
                    { role: 'DOCTOR' as UserRole, label: 'Doctor', icon: Stethoscope },
                    { role: 'ADMIN' as UserRole, label: 'Admin', icon: Shield }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = loginRole === item.role;
                    return (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => setLoginRole(item.role)}
                        className={`p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                          isSelected
                            ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      placeholder={
                        loginRole === 'PATIENT' ? 'e.g. rahul.verma@gmail.com' :
                        loginRole === 'DOCTOR' ? 'e.g. dr.rajesh.sharma@clinicpulse.in' :
                        'admin@clinicpulse.in'
                      }
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="Enter your password (e.g. password123)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Default password for demo accounts is: <code>password123</code></p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                >
                  <span>Sign In as {loginRole.charAt(0) + loginRole.slice(1).toLowerCase()}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* REGISTER VIEW */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Account Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterRole('PATIENT')}
                    className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      registerRole === 'PATIENT' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Patient Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterRole('DOCTOR')}
                    className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      registerRole === 'DOCTOR' ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Stethoscope className="w-4 h-4" />
                    Doctor Account
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder={registerRole === 'DOCTOR' ? 'Dr. Ramesh Gupta, MD' : 'Siddharth Nair'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Mobile Phone (India)</label>
                <input
                  type="text"
                  placeholder="+91-98765-43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="Create a secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              {registerRole === 'DOCTOR' && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Medical Specialization / Department</label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Cardiology">Cardiology</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Orthopaedics">Orthopaedics</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="General Medicine">General Medicine</option>
                    <option value="Gynecology">Gynecology</option>
                    <option value="ENT">ENT</option>
                    <option value="Gastroenterology">Gastroenterology</option>
                    <option value="Psychiatry">Psychiatry</option>
                    <option value="Pulmonology">Pulmonology</option>
                    <option value="Ophthalmology">Ophthalmology</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                <span>Create {registerRole.charAt(0) + registerRole.slice(1).toLowerCase()} Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

        </div>

        {/* Searchable Hospital Staff & Patients Directory */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-600" />
                Hospital Staff & Patient Directory
              </h3>
              <p className="text-[11px] text-slate-500">24 Doctors across 12 Departments (1-Click Login)</p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search doctor, department, or patient..."
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
            {filteredDemoAccounts.map((acc: any) => (
              <div
                key={acc.id}
                onClick={async () => {
                  await quickSwitchUser(acc.email);
                  onSuccess();
                }}
                className="pt-2 pb-1 hover:bg-slate-50 p-2 rounded-xl cursor-pointer transition flex items-center justify-between group"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-bold text-xs text-slate-900 group-hover:text-brand-600 truncate">
                    {acc.name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{acc.email}</div>
                  {acc.specialization && (
                    <div className="text-[10px] text-brand-600 font-semibold mt-0.5">
                      {acc.specialization} • Fee: ₹{acc.consultation_fee}
                    </div>
                  )}
                </div>

                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase shrink-0 ${
                  acc.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                  acc.role === 'DOCTOR' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {acc.role}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
