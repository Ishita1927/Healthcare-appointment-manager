import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Appointment, DoctorProfile, DoctorLeave } from '../types';
import { UrgencyBadge } from '../components/UrgencyBadge';
import {
  Calendar, Clock, User, Sparkles, CheckCircle2, AlertCircle, FileText,
  Pill, Plus, Trash2, Shield, Settings, X, Send, HelpCircle, AlertTriangle
} from 'lucide-react';

export const DoctorPortal: React.FC = () => {
  const { user, fetchWithAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<'queue' | 'schedule'>('queue');

  // Appointments Queue
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loadingAppts, setLoadingAppts] = useState(false);

  // Consultation Completion Modal State
  const [activeApptToComplete, setActiveApptToComplete] = useState<Appointment | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState<Array<{
    medicationName: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    instructions: string;
  }>>([
    { medicationName: '', dosage: '', frequency: 'Twice daily', durationDays: 7, instructions: 'Take after meals' }
  ]);
  const [completing, setCompleting] = useState(false);
  const [completionSuccess, setCompletionSuccess] = useState<string | null>(null);

  // Profile & Leave Management
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [leaveDate, setLeaveDate] = useState<string>('');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [addingLeave, setAddingLeave] = useState(false);
  const [leaveResultMsg, setLeaveResultMsg] = useState<string | null>(null);

  // Selected Appointment Inspection Drawer
  const [inspectedAppt, setInspectedAppt] = useState<Appointment | null>(null);

  const fetchDoctorAppointments = async () => {
    setLoadingAppts(true);
    try {
      let url = '/api/doctor/appointments?';
      if (filterDate) url += `date=${filterDate}&`;
      if (filterStatus !== 'ALL') url += `status=${filterStatus}`;

      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error('Failed to load doctor appointments:', err);
    } finally {
      setLoadingAppts(false);
    }
  };

  const fetchDoctorProfileAndLeaves = async () => {
    try {
      const res = await fetchWithAuth('/api/doctor/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setLeaves(data.leaves || []);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'DOCTOR') {
      fetchDoctorAppointments();
      fetchDoctorProfileAndLeaves();
    }
  }, [user, filterDate, filterStatus]);

  // Add Prescription Item row
  const addPrescriptionRow = () => {
    setPrescriptionItems([
      ...prescriptionItems,
      { medicationName: '', dosage: '', frequency: 'Once daily', durationDays: 7, instructions: '' }
    ]);
  };

  const removePrescriptionRow = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const updatePrescriptionRow = (index: number, field: string, value: any) => {
    const updated = [...prescriptionItems];
    (updated[index] as any)[field] = value;
    setPrescriptionItems(updated);
  };

  // Submit Consultation Completion
  const handleCompleteConsultation = async () => {
    if (!activeApptToComplete || !clinicalNotes.trim()) {
      alert('Please provide clinical diagnosis notes before completing.');
      return;
    }

    setCompleting(true);
    setCompletionSuccess(null);

    const validRxItems = prescriptionItems.filter(p => p.medicationName.trim().length > 0);

    try {
      const res = await fetchWithAuth(`/api/doctor/appointments/${activeApptToComplete.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          clinicalNotes,
          prescriptionItems: validRxItems
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete appointment.');
      }

      setCompletionSuccess(data.aiPostVisitSummary);
      fetchDoctorAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCompleting(false);
    }
  };

  // Apply for Doctor Leave
  const handleApplyLeave = async () => {
    if (!leaveDate) {
      alert('Please select a leave date.');
      return;
    }

    setAddingLeave(true);
    setLeaveResultMsg(null);

    try {
      const res = await fetchWithAuth('/api/doctor/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveDate,
          reason: leaveReason || 'Doctor scheduled leave'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark leave.');

      setLeaveResultMsg(`Leave recorded for ${leaveDate}. ${data.cancelledAppointmentsCount} conflicting bookings were automatically cancelled and patients notified.`);
      setLeaveDate('');
      setLeaveReason('');
      fetchDoctorProfileAndLeaves();
      fetchDoctorAppointments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingLeave(false);
    }
  };

  if (user?.role !== 'DOCTOR') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-sky-100 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Doctor Portal Access</h2>
          <p className="text-xs text-slate-500">
            Please log in as a Doctor using the <strong>Sign In</strong> tab or select any specialist from the Hospital Staff Directory.
          </p>
        </div>
      </div>
    );
  }

  const urgentCount = appointments.filter(a => a.status === 'CONFIRMED' && (a.urgency_level === 'High' || a.urgency_level === 'HIGH')).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-sky-600 uppercase tracking-widest bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
            Doctor Clinical Workspace
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-2">Doctor Consultation Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review patient pre-visit AI insights, manage daily patient queue, and issue post-visit care plans.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'queue' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Patient Queue {urgentCount > 0 && (
              <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full animate-pulse">
                {urgentCount} Urgent
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'schedule' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            Schedule & Leave
          </button>
        </div>
      </div>

      {/* TAB 1: PATIENT QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Date:</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="text-xs text-brand-600 font-semibold hover:underline"
                >
                  Show All Dates
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
              {['ALL', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    filterStatus === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Queue List */}
          {loadingAppts ? (
            <div className="text-center py-16 text-slate-400">Loading patient queue...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No appointments found</h3>
              <p className="text-xs text-slate-500 mt-1">There are no consultations matching the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appt) => {
                const isConfirmed = appt.status === 'CONFIRMED';
                const isCompleted = appt.status === 'COMPLETED';
                const isHighUrgency = appt.urgency_level === 'High' || appt.urgency_level === 'HIGH';

                return (
                  <div
                    key={appt.id}
                    className={`bg-white rounded-3xl border p-6 shadow-sm hover:shadow transition flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 ${
                      isHighUrgency && isConfirmed ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          isConfirmed ? 'bg-sky-100 text-sky-800' :
                          isCompleted ? 'bg-emerald-100 text-emerald-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {appt.status}
                        </span>
                        <UrgencyBadge level={appt.urgency_level} size="sm" />
                        <span className="text-xs text-slate-400 font-mono">ID: {appt.id.slice(0, 8)}</span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <User className="w-4 h-4 text-brand-600" />
                          {appt.patient_name}
                          <span className="text-xs font-normal text-slate-500">({appt.patient_email})</span>
                        </h3>
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {appt.appointment_date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {appt.start_time} - {appt.end_time}
                          </span>
                        </div>
                      </div>

                      {/* AI Pre-Visit Brief Box */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 max-w-3xl">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            AI Chief Complaint:
                          </span>
                          <span className="text-slate-600 font-medium">{appt.chief_complaint || 'N/A'}</span>
                        </div>

                        {appt.doctor_questions && appt.doctor_questions.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-200 text-xs text-slate-600">
                            <span className="font-bold text-slate-700 block mb-0.5">Suggested Clinical Inquiries:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                              {appt.doctor_questions.map((q, idx) => (
                                <li key={idx}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2.5 shrink-0 w-full lg:w-auto">
                      <button
                        onClick={() => setInspectedAppt(appt)}
                        className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                      >
                        Inspect Patient History
                      </button>

                      {isConfirmed && (
                        <button
                          onClick={() => {
                            setActiveApptToComplete(appt);
                            setClinicalNotes('');
                            setPrescriptionItems([
                              { medicationName: '', dosage: '', frequency: 'Twice daily', durationDays: 7, instructions: 'Take after meals' }
                            ]);
                            setCompletionSuccess(null);
                          }}
                          className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md transition flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Complete Visit & Prescribe
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCHEDULE & LEAVE */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Working Hours & Settings */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              Practice Configuration
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Specialization</span>
                <span className="font-bold text-slate-800">{profile?.specialization}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Practicing Hours</span>
                <span className="font-bold text-slate-800">{profile?.working_hour_start} - {profile?.working_hour_end}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Slot Duration</span>
                <span className="font-bold text-slate-800">{profile?.slot_duration_minutes} Minutes</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Consultation Fee</span>
                <span className="font-extrabold text-emerald-600">₹{profile?.consultation_fee}</span>
              </div>
            </div>
          </div>

          {/* Schedule Leave & Automated Conflict Resolution */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-600" />
                Schedule Doctor Leave
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                When you mark leave on a date, any existing bookings will be automatically cancelled, slots closed, and affected patients immediately notified with reason.
              </p>
            </div>

            {leaveResultMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
                ✓ {leaveResultMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Leave Date *</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reason for Leave</label>
                <input
                  type="text"
                  placeholder="e.g. Medical Conference, Personal Leave"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <button
              onClick={handleApplyLeave}
              disabled={addingLeave || !leaveDate}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50"
            >
              {addingLeave ? 'Resolving Conflicts & Marking Leave...' : 'Schedule Leave & Resolve Conflicts'}
            </button>

            {/* Scheduled Leaves List */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Recorded Leave Days</h4>
              {leaves.length === 0 ? (
                <p className="text-xs text-slate-400">No scheduled leaves on record.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {leaves.map((l) => (
                    <div key={l.id} className="p-3 text-xs flex items-center justify-between bg-slate-50/50">
                      <div>
                        <span className="font-bold text-slate-800 mr-2">{l.leave_date}</span>
                        <span className="text-slate-500">({l.reason || 'Personal Leave'})</span>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded text-[10px]">
                        On Leave
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* COMPLETE CONSULTATION MODAL */}
      {activeApptToComplete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">Post-Visit Documentation</span>
                <h3 className="text-lg font-extrabold text-slate-900">Complete Consultation for {activeApptToComplete.patient_name}</h3>
                <p className="text-xs text-slate-500">{activeApptToComplete.appointment_date} at {activeApptToComplete.start_time}</p>
              </div>
              <button onClick={() => setActiveApptToComplete(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {completionSuccess ? (
              <div className="p-6 space-y-6 flex-1 overflow-y-auto text-center">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Consultation Completed & Patient Notified</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    AI generated patient-friendly summary and dispatched the care plan and medication schedule to {activeApptToComplete.patient_email}.
                  </p>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left space-y-2">
                  <span className="text-xs font-bold text-brand-600 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Generated Patient-Friendly Summary
                  </span>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {completionSuccess}
                  </div>
                </div>

                <button
                  onClick={() => setActiveApptToComplete(null)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                
                {/* Pre-visit Symptoms Reference */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-0.5">Patient Reported Symptoms:</span>
                  <p className="text-slate-600 italic">{activeApptToComplete.symptoms_raw}</p>
                </div>

                {/* Clinical Notes */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    1. Clinical Notes & Diagnosis *
                  </label>
                  <textarea
                    rows={4}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Enter clinical examination notes, vitals, diagnosis, and care instructions..."
                    className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
                  />
                </div>

                {/* Prescription Items Builder */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-emerald-600" />
                      2. Prescribe Medications (Enables Automated Reminders)
                    </label>
                    <button
                      onClick={addPrescriptionRow}
                      className="text-xs text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Medication
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {prescriptionItems.map((rx, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Medication name"
                          value={rx.medicationName}
                          onChange={(e) => updatePrescriptionRow(idx, 'medicationName', e.target.value)}
                          className="sm:col-span-2 text-xs p-2 bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Dosage (e.g. 500mg)"
                          value={rx.dosage}
                          onChange={(e) => updatePrescriptionRow(idx, 'dosage', e.target.value)}
                          className="text-xs p-2 bg-white border border-slate-200 rounded-lg"
                        />
                        <select
                          value={rx.frequency}
                          onChange={(e) => updatePrescriptionRow(idx, 'frequency', e.target.value)}
                          className="text-xs p-2 bg-white border border-slate-200 rounded-lg"
                        >
                          <option value="Once daily">Once daily</option>
                          <option value="Twice daily">Twice daily</option>
                          <option value="Three times daily">Three times daily</option>
                          <option value="As needed (PRN)">As needed</option>
                        </select>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={90}
                            placeholder="Days"
                            value={rx.durationDays}
                            onChange={(e) => updatePrescriptionRow(idx, 'durationDays', parseInt(e.target.value) || 7)}
                            className="text-xs p-2 bg-white border border-slate-200 rounded-lg w-16"
                          />
                          {prescriptionItems.length > 1 && (
                            <button
                              onClick={() => removePrescriptionRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200 text-xs text-purple-900 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Automated AI Post-Visit Processing</span>
                    Clicking complete triggers LLM transformation to convert technical notes into an empathetic, jargon-free summary with bulleted medication schedule and follow-up guidance.
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setActiveApptToComplete(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteConsultation}
                    disabled={completing || !clinicalNotes.trim()}
                    className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {completing ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        Generating Summary & Dispatching...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Complete Visit & Send Care Plan
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* INSPECT PATIENT HISTORY MODAL */}
      {inspectedAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-brand-600">Patient Case Brief</span>
                <h3 className="text-lg font-bold text-slate-900">{inspectedAppt.patient_name}</h3>
                <p className="text-xs text-slate-500">{inspectedAppt.patient_email} • {inspectedAppt.patient_phone || 'No phone recorded'}</p>
              </div>
              <button onClick={() => setInspectedAppt(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">Urgency Assessment:</span>
                <UrgencyBadge level={inspectedAppt.urgency_level} size="md" />
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 uppercase tracking-wider block">Raw Reported Symptoms:</span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-wrap">
                  {inspectedAppt.symptoms_raw}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 uppercase tracking-wider block">AI Generated Clinical Summary:</span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-wrap">
                  {inspectedAppt.ai_previsit_summary || 'N/A'}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectedAppt(null)}
                className="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
