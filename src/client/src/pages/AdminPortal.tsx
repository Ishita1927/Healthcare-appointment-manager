import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DoctorWithProfile, Appointment } from '../types';
import { UrgencyBadge } from '../components/UrgencyBadge';
import {
  Shield, Users, Calendar, Stethoscope, Mail, Plus, Edit2, Play,
  AlertTriangle, CheckCircle2, Clock, Trash2, X, RefreshCw, Layers
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const { user, fetchWithAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<'doctors' | 'leaves' | 'appointments' | 'worker'>('doctors');

  // Stats
  const [stats, setStats] = useState<any>({
    totalDoctors: 0,
    totalPatients: 0,
    totalAppointments: 0,
    highUrgencyCount: 0,
    pendingNotifications: 0,
    activePrescriptions: 0
  });

  // Doctor Management State
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [newDoctorForm, setNewDoctorForm] = useState({
    name: '',
    email: '',
    password: 'password123',
    phone: '',
    specialization: 'Cardiology',
    bio: '',
    workingHourStart: '09:00',
    workingHourEnd: '17:00',
    slotDurationMinutes: 30,
    consultationFee: 800
  });

  // Doctor Leave & Conflict State
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [leaveDate, setLeaveDate] = useState<string>('');
  const [leaveReason, setLeaveReason] = useState<string>('Clinical administrative leave');
  const [resolvingLeave, setResolvingLeave] = useState(false);
  const [conflictReport, setConflictReport] = useState<any | null>(null);

  // All Appointments
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [apptStatusFilter, setApptStatusFilter] = useState<string>('ALL');

  // Worker State
  const [workerResult, setWorkerResult] = useState<any | null>(null);
  const [runningWorker, setRunningWorker] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    }
  };

  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const res = await fetchWithAuth('/api/admin/doctors');
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors || []);
        if (data.doctors.length > 0 && !selectedDocId) {
          setSelectedDocId(data.doctors[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const fetchAllAppointments = async () => {
    try {
      const res = await fetchWithAuth(`/api/admin/appointments?status=${apptStatusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setAllAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchStats();
      fetchDoctors();
      fetchAllAppointments();
    }
  }, [user, apptStatusFilter]);

  // Create Doctor
  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/admin/doctors', {
        method: 'POST',
        body: JSON.stringify(newDoctorForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create doctor.');

      setShowAddDoctorModal(false);
      fetchDoctors();
      fetchStats();
      setNewDoctorForm({
        name: '',
        email: '',
        password: 'password123',
        phone: '',
        specialization: 'Cardiology',
        bio: '',
        workingHourStart: '09:00',
        workingHourEnd: '17:00',
        slotDurationMinutes: 30,
        consultationFee: 800
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Schedule Leave & Conflict Resolution
  const handleScheduleLeave = async () => {
    if (!selectedDocId || !leaveDate) {
      alert('Please select a doctor and date.');
      return;
    }

    setResolvingLeave(true);
    setConflictReport(null);

    try {
      const res = await fetchWithAuth('/api/admin/leaves', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDocId,
          leaveDate,
          reason: leaveReason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record leave.');

      setConflictReport(data);
      fetchDoctors();
      fetchStats();
      fetchAllAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResolvingLeave(false);
    }
  };

  // Remove Leave
  const handleRemoveLeave = async (leaveId: string) => {
    try {
      const res = await fetchWithAuth(`/api/admin/leaves/${leaveId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDoctors();
      }
    } catch (err) {
      console.error('Failed to remove leave:', err);
    }
  };

  // Trigger Worker
  const handleRunWorker = async () => {
    setRunningWorker(true);
    try {
      const res = await fetchWithAuth('/api/admin/worker/trigger', { method: 'POST' });
      const data = await res.json();
      setWorkerResult(data);
      fetchStats();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRunningWorker(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Admin Portal Restricted</h2>
          <p className="text-xs text-slate-500">
            Please log in as Administrator using the <strong>Sign In</strong> page or select Medical Director from the Directory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-purple-600 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
            Admin Master Console • ClinicPulse India
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-2">Hospital Administration & Operations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Doctor profile provisioning, leave conflict resolution, automated retry monitoring, and hospital metrics.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowAddDoctorModal(true)}
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 self-start md:self-auto transition"
        >
          <Plus className="w-4 h-4" />
          Create Doctor Profile
        </button>
      </div>

      {/* METRIC STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Doctors</span>
          <p className="text-2xl font-black text-slate-900">{stats.totalDoctors}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Patients</span>
          <p className="text-2xl font-black text-slate-900">{stats.totalPatients}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Appointments</span>
          <p className="text-2xl font-black text-brand-600">{stats.totalAppointments}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-rose-500 uppercase">High Urgency</span>
          <p className="text-2xl font-black text-rose-600">{stats.highUrgencyCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-amber-500 uppercase">Email Retries</span>
          <p className="text-2xl font-black text-amber-600">{stats.pendingNotifications}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-emerald-500 uppercase">Active Rx</span>
          <p className="text-2xl font-black text-emerald-600">{stats.activePrescriptions}</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'doctors', label: 'Doctor Profiles & Hours', icon: Stethoscope },
          { id: 'leaves', label: 'Doctor Leaves & Conflict Resolution', icon: Calendar },
          { id: 'appointments', label: 'All Hospital Bookings', icon: Layers },
          { id: 'worker', label: 'Background Worker Monitor', icon: Play }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DOCTORS DIRECTORY & PROFILE PROVISIONING */}
      {activeTab === 'doctors' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doc) => (
              <div key={doc.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{doc.name}</h3>
                    <p className="text-xs text-brand-600 font-semibold">{doc.specialization}</p>
                    <p className="text-xs text-slate-400">{doc.email}</p>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Working Hours:</span>
                    <span className="font-semibold text-slate-700">{doc.working_hour_start} - {doc.working_hour_end}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Slot Duration:</span>
                    <span className="font-semibold text-slate-700">{doc.slot_duration_minutes} Mins</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Consultation Fee:</span>
                    <span className="font-bold text-emerald-600">₹{doc.consultation_fee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recorded Leaves:</span>
                    <span className="font-semibold text-slate-700">{doc.leaves?.length || 0} days</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: DOCTOR LEAVES & AUTOMATED CONFLICT ENGINE */}
      {activeTab === 'leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Leave Form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-600" />
              Mark Doctor on Leave
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              When an administrator marks a doctor on leave, the system executes an automated conflict check to cancel affected bookings and notify patients.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Select Doctor</label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Leave Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Clinical Leave, Medical Conference"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <button
                onClick={handleScheduleLeave}
                disabled={resolvingLeave || !selectedDocId || !leaveDate}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {resolvingLeave ? 'Processing Conflicts...' : 'Mark Leave & Resolve Conflicts'}
              </button>
            </div>
          </div>

          {/* Conflict Report & Active Leaves List */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Conflict Report Card if generated */}
            {conflictReport && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Conflict Resolution Report for {conflictReport.leaveDate}
                </div>
                <p className="text-xs text-amber-800">
                  {conflictReport.cancelledAppointmentsCount > 0
                    ? `Found and resolved ${conflictReport.cancelledAppointmentsCount} conflicting bookings. All affected patients have been notified by email.`
                    : 'No existing appointments conflicted with this leave date. Slots closed safely.'}
                </p>

                {conflictReport.affectedAppointments?.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">Cancelled Bookings:</span>
                    {conflictReport.affectedAppointments.map((a: any) => (
                      <div key={a.appointmentId} className="bg-white p-2.5 rounded-xl text-xs flex items-center justify-between border border-amber-200">
                        <div>
                          <span className="font-bold text-slate-800">{a.patientName}</span>
                          <span className="text-slate-500 ml-2">({a.startTime} - {a.endTime})</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded">
                          Notified & Cancelled
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Existing Leaves List */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">Hospital Doctor Leaves</h3>
              <div className="divide-y divide-slate-100">
                {doctors.flatMap(d => (d.leaves || []).map(l => ({ ...l, doctor_name: d.name }))).length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">No active doctor leaves recorded.</p>
                ) : (
                  doctors.flatMap(d => (d.leaves || []).map(l => ({ ...l, doctor_name: d.name }))).map((l) => (
                    <div key={l.id} className="py-3 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{l.doctor_name}</span>
                        <span className="text-slate-500 ml-2 font-medium">on {l.leave_date}</span>
                        <span className="text-slate-400 ml-2 italic">({l.reason})</span>
                      </div>
                      <button
                        onClick={() => handleRemoveLeave(l.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        title="Remove leave"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 3: ALL HOSPITAL APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Filter Status:</span>
            <div className="flex gap-2">
              {['ALL', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setApptStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    apptStatusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {allAppointments.map((appt) => (
              <div key={appt.id} className="p-4 hover:bg-slate-50 flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      appt.status === 'CONFIRMED' ? 'bg-sky-100 text-sky-800' :
                      appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {appt.status}
                    </span>
                    <UrgencyBadge level={appt.urgency_level} size="sm" />
                    <span className="text-slate-400 font-mono">ID: {appt.id.slice(0, 8)}</span>
                  </div>

                  <p className="font-bold text-slate-800">
                    Patient: {appt.patient_name} <span className="font-normal text-slate-500">with</span> {appt.doctor_name} ({appt.specialization})
                  </p>
                  <p className="text-slate-500">
                    {appt.appointment_date} at {appt.start_time} - {appt.end_time}
                  </p>
                </div>

                <div className="text-right">
                  {appt.chief_complaint && (
                    <span className="text-[11px] text-slate-500 max-w-xs truncate block">{appt.chief_complaint}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BACKGROUND WORKER & EMAIL QUEUE MONITOR */}
      {activeTab === 'worker' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" />
                Background Worker & Scheduled Jobs Monitor
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                The automated background engine processes medication reminders based on prescription frequency, retries failed notifications with exponential backoff, and clears stale slot holds.
              </p>
            </div>

            <button
              onClick={handleRunWorker}
              disabled={runningWorker}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${runningWorker ? 'animate-spin' : ''}`} />
              {runningWorker ? 'Executing Cycle...' : 'Run Cycle Now'}
            </button>
          </div>

          {workerResult && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-slate-800 block">Cycle Execution Results:</span>
              <pre className="font-mono bg-slate-900 text-emerald-400 p-3 rounded-lg overflow-x-auto text-[11px]">
                {JSON.stringify(workerResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* CREATE DOCTOR MODAL */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase">Hospital Provisioning</span>
                <h3 className="text-lg font-bold text-slate-900">Add Doctor Profile</h3>
              </div>
              <button onClick={() => setShowAddDoctorModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDoctor} className="p-6 space-y-4 flex-1 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Dr. K. S. Ramanujan, MS"
                    value={newDoctorForm.name}
                    onChange={(e) => setNewDoctorForm({ ...newDoctorForm, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="dr.ramanujan@clinicpulse.in"
                    value={newDoctorForm.email}
                    onChange={(e) => setNewDoctorForm({ ...newDoctorForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Department *</label>
                  <select
                    value={newDoctorForm.specialization}
                    onChange={(e) => setNewDoctorForm({ ...newDoctorForm, specialization: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
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
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    placeholder="+91-98765-43210"
                    value={newDoctorForm.phone}
                    onChange={(e) => setNewDoctorForm({ ...newDoctorForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Start Hour</label>
                  <input
                    type="time"
                    value={newDoctorForm.workingHourStart}
                    onChange={(e) => setNewDoctorForm({ ...newDoctorForm, workingHourStart: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">End Hour</label>
                  <input
                    type="time"
                    value={newDoctorForm.workingHourEnd}
                    onChange={(e) => setNewDoctorForm({ ...newDoctorForm, workingHourEnd: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Slot Mins</label>
                  <select
                    value={newDoctorForm.slotDurationMinutes}
                    onChange={(e) => setNewDoctorForm({ ...newDoctorForm, slotDurationMinutes: parseInt(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value={15}>15 Mins</option>
                    <option value={20}>20 Mins</option>
                    <option value={30}>30 Mins</option>
                    <option value={45}>45 Mins</option>
                    <option value={60}>60 Mins</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Consultation Fee in INR (₹)</label>
                <input
                  type="number"
                  value={newDoctorForm.consultationFee}
                  onChange={(e) => setNewDoctorForm({ ...newDoctorForm, consultationFee: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow"
                >
                  Save Doctor Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
