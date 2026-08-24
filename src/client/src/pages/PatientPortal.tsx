import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DoctorWithProfile, DoctorSchedule, TimeSlot, Appointment, Prescription } from '../types';
import { UrgencyBadge } from '../components/UrgencyBadge';
import {
  Search, Calendar, Clock, Stethoscope, User, Sparkles, CheckCircle2,
  CalendarPlus, Download, AlertTriangle, Pill, X, ArrowRight, ShieldCheck,
  FileText, Ban, Layers
} from 'lucide-react';

export const PatientPortal: React.FC = () => {
  const { user, fetchWithAuth } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'find-doctor' | 'my-appointments' | 'my-prescriptions'>('find-doctor');

  // Search & Doctors
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Booking Flow State
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorWithProfile | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0] // Default tomorrow
  );
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  
  // Slot Hold
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [holdTimeLeft, setHoldTimeLeft] = useState<number>(0);
  const [holdingSlot, setHoldingSlot] = useState(false);

  // Symptoms & AI Summary
  const [symptomsInput, setSymptomsInput] = useState('');
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1); // 1: Slot, 2: Symptoms & AI Preview, 3: Success
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBookingResult, setConfirmedBookingResult] = useState<any | null>(null);

  // Patient's Data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [selectedApptDetail, setSelectedApptDetail] = useState<Appointment | null>(null);

  // Load Doctors
  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    try {
      let url = '/api/patient/doctors?';
      if (selectedSpecialization !== 'All') url += `specialization=${encodeURIComponent(selectedSpecialization)}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors || []);
        if (data.specializations) setSpecializations(data.specializations);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Load Slots for selected doctor & date
  const fetchSlots = async (doctorId: string, date: string) => {
    setLoadingSlots(true);
    try {
      const patientIdParam = user ? `&patientId=${user.id}` : '';
      const res = await fetch(`/api/patient/doctors/${doctorId}/slots?date=${date}${patientIdParam}`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Load patient's bookings
  const fetchMyAppointments = async () => {
    if (!user) return;
    setLoadingAppointments(true);
    try {
      const res = await fetchWithAuth('/api/patient/appointments');
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Load patient's prescriptions
  const fetchMyPrescriptions = async () => {
    if (!user) return;
    try {
      const res = await fetchWithAuth('/api/patient/prescriptions');
      if (res.ok) {
        const data = await res.json();
        setPrescriptions(data.prescriptions || []);
      }
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [selectedSpecialization]);

  useEffect(() => {
    if (activeSubTab === 'my-appointments') fetchMyAppointments();
    if (activeSubTab === 'my-prescriptions') fetchMyPrescriptions();
  }, [activeSubTab, user]);

  useEffect(() => {
    if (selectedDoctor && bookingDate) {
      fetchSlots(selectedDoctor.id, bookingDate);
    }
  }, [selectedDoctor, bookingDate]);

  // Hold Timer countdown
  useEffect(() => {
    if (!holdExpiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000));
      setHoldTimeLeft(remaining);
      if (remaining <= 0) {
        setActiveHoldId(null);
        setHoldExpiresAt(null);
        setSelectedSlot(null);
        setBookingStep(1);
        setBookingError('Slot hold expired. Please re-select a time slot.');
        if (selectedDoctor) fetchSlots(selectedDoctor.id, bookingDate);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [holdExpiresAt, selectedDoctor, bookingDate]);

  // Initiate Slot Hold
  const handleSelectSlot = async (slot: TimeSlot) => {
    if (!slot.isAvailable || !selectedDoctor) return;
    if (!user) {
      alert('Please log in as a Patient to book an appointment.');
      return;
    }

    setHoldingSlot(true);
    setBookingError(null);

    try {
      const res = await fetchWithAuth('/api/patient/hold-slot', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          date: bookingDate,
          startTime: slot.startTime,
          endTime: slot.endTime
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to acquire slot hold.');
      }

      setSelectedSlot(slot);
      setActiveHoldId(data.holdId);
      setHoldExpiresAt(data.expiresAt);
      setBookingStep(2); // Proceed to symptom intake
    } catch (err: any) {
      setBookingError(err.message);
      if (selectedDoctor) fetchSlots(selectedDoctor.id, bookingDate);
    } finally {
      setHoldingSlot(false);
    }
  };

  // Confirm and finalize booking
  const handleConfirmBooking = async () => {
    if (!selectedDoctor || !selectedSlot || !symptomsInput.trim()) {
      setBookingError('Please describe your symptoms and reasons for visit.');
      return;
    }

    setSubmittingBooking(true);
    setBookingError(null);

    try {
      const res = await fetchWithAuth('/api/patient/book', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          date: bookingDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          symptoms: symptomsInput,
          holdId: activeHoldId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Booking failed.');
      }

      setConfirmedBookingResult(data);
      setBookingStep(3);
      setActiveHoldId(null);
      setHoldExpiresAt(null);
      fetchMyAppointments();
    } catch (err: any) {
      setBookingError(err.message);
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Cancel Appointment
  const handleCancelAppointment = async (apptId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment? The doctor will be notified immediately.')) return;
    try {
      const res = await fetchWithAuth(`/api/patient/appointments/${apptId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Patient cancelled consultation online' })
      });
      if (res.ok) {
        fetchMyAppointments();
        if (selectedApptDetail?.id === apptId) setSelectedApptDetail(null);
      }
    } catch (err) {
      console.error('Failed to cancel appointment:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Portal Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-widest bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
            Patient Portal • ClinicPulse India
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-2">Find Doctors & Book Slots</h1>
          <p className="text-sm text-slate-500 mt-1">
            Consult top Indian medical specialists across 12 departments with instant AI pre-visit assessments.
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveSubTab('find-doctor')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'find-doctor' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Find Doctor & Book
          </button>
          <button
            onClick={() => setActiveSubTab('my-appointments')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'my-appointments' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            My Bookings {appointments.length > 0 && `(${appointments.length})`}
          </button>
          <button
            onClick={() => setActiveSubTab('my-prescriptions')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'my-prescriptions' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            Prescriptions
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: FIND DOCTOR & BOOK */}
      {activeSubTab === 'find-doctor' && (
        <div className="space-y-6">
          
          {/* Search & Department Selector */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search by doctor name, qualification, or condition..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchDoctors()}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                />
              </div>

              <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-600" />
                <span>Showing {doctors.length} Doctors across 12 Departments</span>
              </div>
            </div>

            {/* Department Pills */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedSpecialization('All')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                  selectedSpecialization === 'All'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Departments ({doctors.length})
              </button>
              {specializations.map((spec) => (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialization(spec)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                    selectedSpecialization === spec
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>

          {/* Doctor Cards Grid */}
          {loadingDoctors ? (
            <div className="text-center py-16 text-slate-400">Loading specialist directory...</div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
              <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No doctors found</h3>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or department filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        {doc.name.replace('Dr. ', '').charAt(0)}
                      </div>
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                        {doc.specialization}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-4 group-hover:text-brand-600 transition leading-snug">
                      {doc.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
                      {doc.bio || 'Board-certified healthcare specialist.'}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Hours</span>
                        <span className="font-semibold text-slate-700 text-[11px]">{doc.working_hour_start}-{doc.working_hour_end}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                        <span className="font-semibold text-slate-700 text-[11px]">{doc.slot_duration_minutes} Mins</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Fee (INR)</span>
                        <span className="font-extrabold text-emerald-600 text-xs">₹{doc.consultation_fee}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDoctor(doc);
                      setBookingStep(1);
                      setSelectedSlot(null);
                      setBookingError(null);
                      setSymptomsInput('');
                    }}
                    className="mt-6 w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Book Consultation (₹{doc.consultation_fee})
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* BOOKING MODAL WIZARD */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  Step {bookingStep} of 3 • Consultation Booking
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Booking with {selectedDoctor.name}
                </h3>
                <p className="text-xs text-slate-500">{selectedDoctor.specialization} • Consultation Fee: ₹{selectedDoctor.consultation_fee}</p>
              </div>

              <button
                onClick={() => {
                  setSelectedDoctor(null);
                  setActiveHoldId(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hold Timer Alert Banner */}
            {activeHoldId && holdTimeLeft > 0 && bookingStep === 2 && (
              <div className="bg-amber-500 text-white px-6 py-2 text-xs font-semibold flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Slot held exclusively for you! Please complete symptom intake before hold expires.
                </span>
                <span className="font-mono font-bold bg-amber-600 px-2 py-0.5 rounded">
                  {Math.floor(holdTimeLeft / 60)}:{(holdTimeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}

            {/* Error Message */}
            {bookingError && (
              <div className="m-6 mb-0 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{bookingError}</span>
              </div>
            )}

            {/* STEP 1: Select Date & Time Slot */}
            {bookingStep === 1 && (
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    1. Select Consultation Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      2. Available Slots ({selectedDoctor.slot_duration_minutes} Mins)
                    </label>
                    <span className="text-[11px] text-slate-400">Protected against double-booking</span>
                  </div>

                  {loadingSlots ? (
                    <div className="text-center py-8 text-slate-400 text-xs">Computing availability & checking conflicts...</div>
                  ) : schedule?.isOnLeave ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center">
                      <Ban className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-rose-800">Doctor is on Leave on this Date</p>
                      <p className="text-xs text-rose-600 mt-1">{schedule.leaveReason}</p>
                    </div>
                  ) : schedule?.slots.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                      {schedule.leaveReason || 'No practicing slots available on this day.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                      {schedule?.slots.map((slot) => {
                        const isAvailable = slot.isAvailable;
                        const isHeld = slot.isHeld;

                        return (
                          <button
                            key={slot.startTime}
                            disabled={!isAvailable || holdingSlot}
                            onClick={() => handleSelectSlot(slot)}
                            className={`p-2.5 rounded-xl text-xs font-bold text-center border transition flex flex-col items-center justify-center gap-0.5 ${
                              isAvailable
                                ? 'bg-white hover:bg-brand-50 hover:border-brand-500 text-slate-800 border-slate-200 shadow-sm'
                                : isHeld
                                ? 'bg-amber-50 text-amber-600 border-amber-200 cursor-not-allowed opacity-75'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <span className="font-mono text-xs">{slot.startTime}</span>
                            <span className="text-[10px] font-normal">
                              {isAvailable ? 'Available' : isHeld ? 'Temporarily Held' : 'Booked'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Symptoms Intake & AI Pre-Visit Preparation */}
            {bookingStep === 2 && (
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-sky-900 leading-relaxed">
                    <span className="font-bold block mb-1">AI Pre-Visit Intake</span>
                    Our clinical AI analyzes your symptoms prior to the consultation to identify urgency level (Low / Medium / High), summarize your chief complaint, and suggest targeted diagnostic questions for {selectedDoctor.name}.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Describe your Symptoms & Reason for Consultation *
                  </label>
                  <textarea
                    rows={4}
                    value={symptomsInput}
                    onChange={(e) => setSymptomsInput(e.target.value)}
                    placeholder="e.g. Experiencing persistent headache, nausea, mild fever of 100.4F for 3 days after travel..."
                    className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
                  />
                  <p className="text-[11px] text-slate-400">
                    Be as specific as possible regarding duration, intensity, triggers, and any medication taken.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block">Selected Slot:</span>
                    <span className="font-bold text-slate-800">{bookingDate} from {selectedSlot?.startTime} to {selectedSlot?.endTime}</span>
                  </div>
                  <button
                    onClick={() => setBookingStep(1)}
                    className="text-xs text-brand-600 hover:underline font-semibold"
                  >
                    Change Slot
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setBookingStep(1)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmBooking}
                    disabled={submittingBooking || !symptomsInput.trim()}
                    className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingBooking ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        Generating AI Summary & Confirming...
                      </>
                    ) : (
                      <>
                        <span>Confirm & Book (₹{selectedDoctor.consultation_fee})</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Booking Confirmed & Google Calendar Sync */}
            {bookingStep === 3 && confirmedBookingResult && (
              <div className="p-6 space-y-6 flex-1 overflow-y-auto text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">Appointment Confirmed!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Confirmation emails have been dispatched to both you and {selectedDoctor.name}.
                  </p>
                </div>

                {/* AI Summary Card */}
                {confirmedBookingResult.aiSummary && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Generated Pre-Visit AI Summary
                      </span>
                      <UrgencyBadge level={confirmedBookingResult.aiSummary.urgencyLevel} size="sm" />
                    </div>

                    <div className="text-xs space-y-1">
                      <p><span className="font-semibold text-slate-700">Chief Complaint:</span> {confirmedBookingResult.aiSummary.chiefComplaint}</p>
                    </div>

                    {confirmedBookingResult.aiSummary.suggestedQuestions?.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-[11px] font-bold text-slate-600 block mb-1">AI Suggested Questions for Doctor:</span>
                        <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                          {confirmedBookingResult.aiSummary.suggestedQuestions.map((q: string, idx: number) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Calendar Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {confirmedBookingResult.appointment?.gcal_url && (
                    <a
                      href={confirmedBookingResult.appointment.gcal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      Add to Google Calendar
                    </a>
                  )}

                  <a
                    href={`/api/patient/appointments/${confirmedBookingResult.appointment?.id}/ical`}
                    download
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download .ics File
                  </a>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setSelectedDoctor(null);
                      setActiveSubTab('my-appointments');
                    }}
                    className="px-6 py-2 text-xs font-bold text-brand-600 hover:bg-brand-50 rounded-xl transition"
                  >
                    View My Appointments
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SUB-TAB 2: MY APPOINTMENTS */}
      {activeSubTab === 'my-appointments' && (
        <div className="space-y-6">
          {loadingAppointments ? (
            <div className="text-center py-16 text-slate-400">Loading your appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No appointments scheduled</h3>
              <p className="text-xs text-slate-500 mt-1">Select "Find Doctor & Book" to schedule a consultation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appt) => {
                const isConfirmed = appt.status === 'CONFIRMED';
                const isCompleted = appt.status === 'COMPLETED';

                return (
                  <div
                    key={appt.id}
                    className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow transition flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          isConfirmed ? 'bg-sky-100 text-sky-800' :
                          isCompleted ? 'bg-emerald-100 text-emerald-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {appt.status.replace(/_/g, ' ')}
                        </span>
                        {appt.urgency_level && <UrgencyBadge level={appt.urgency_level} size="sm" />}
                        <span className="text-xs font-bold text-slate-400">ID: {appt.id.slice(0, 12)}</span>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">
                        {appt.doctor_name} <span className="text-sm font-semibold text-slate-500">({appt.specialization})</span>
                      </h3>

                      <div className="flex flex-wrap gap-4 text-xs text-slate-600 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-brand-600" />
                          {appt.appointment_date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-brand-600" />
                          {appt.start_time} - {appt.end_time}
                        </span>
                      </div>

                      {appt.chief_complaint && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 inline-block max-w-2xl">
                          <span className="font-semibold text-slate-800">Chief Complaint:</span> {appt.chief_complaint}
                        </p>
                      )}

                      {appt.cancellation_reason && (
                        <p className="text-xs text-rose-600 font-medium">
                          Cancellation Reason: {appt.cancellation_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap md:flex-col items-center md:items-end gap-2 shrink-0 w-full md:w-auto">
                      <button
                        onClick={() => setSelectedApptDetail(appt)}
                        className="px-4 py-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl transition flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Full Details
                      </button>

                      {isConfirmed && (
                        <>
                          {appt.gcal_url && (
                            <a
                              href={appt.gcal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-1.5 transition"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              Sync GCal
                            </a>
                          )}
                          <button
                            onClick={() => handleCancelAppointment(appt.id)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: MY PRESCRIPTIONS */}
      {activeSubTab === 'my-prescriptions' && (
        <div className="space-y-6">
          {prescriptions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
              <Pill className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No active prescriptions</h3>
              <p className="text-xs text-slate-500 mt-1">Prescriptions issued by your doctor after consultations will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {prescriptions.map((rx) => (
                <div
                  key={rx.id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 hover:shadow transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                        <Pill className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{rx.medication_name}</h4>
                        <span className="text-xs font-semibold text-slate-500">Dose: {rx.dosage}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      rx.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {rx.active ? 'Active' : 'Completed'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Frequency:</span>
                      <span className="font-semibold text-slate-800">{rx.frequency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <span className="font-semibold text-slate-800">{rx.duration_days} Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Prescribed By:</span>
                      <span className="font-semibold text-slate-800">{rx.doctor_name || 'Attending Specialist'}</span>
                    </div>
                    {rx.instructions && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-slate-400 block mb-0.5">Instructions:</span>
                        <span className="text-slate-700">{rx.instructions}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* APPOINTMENT DETAIL / POST-VISIT SUMMARY MODAL */}
      {selectedApptDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Consultation Record</span>
                <h3 className="text-lg font-bold text-slate-900">{selectedApptDetail.doctor_name} ({selectedApptDetail.specialization})</h3>
                <p className="text-xs text-slate-500">{selectedApptDetail.appointment_date} • {selectedApptDetail.start_time} - {selectedApptDetail.end_time}</p>
              </div>
              <button onClick={() => setSelectedApptDetail(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Pre-visit AI Assessment */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Pre-Visit AI Summary
                  </h4>
                  {selectedApptDetail.urgency_level && <UrgencyBadge level={selectedApptDetail.urgency_level} size="sm" />}
                </div>
                <p className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Chief Complaint:</span> {selectedApptDetail.chief_complaint || 'N/A'}</p>
                <p className="text-xs text-slate-500 whitespace-pre-wrap"><span className="font-semibold text-slate-700">Raw Symptoms:</span> {selectedApptDetail.symptoms_raw}</p>
              </div>

              {/* Post-visit Summary if Completed */}
              {selectedApptDetail.status === 'COMPLETED' && selectedApptDetail.ai_postvisit_summary ? (
                <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Doctor Post-Visit Summary & Care Plan
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedApptDetail.ai_postvisit_summary}
                  </div>
                </div>
              ) : selectedApptDetail.status === 'COMPLETED' ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold block mb-1">Clinical Notes:</span>
                  {selectedApptDetail.clinical_notes || 'Consultation completed.'}
                </div>
              ) : null}

            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedApptDetail(null)}
                className="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition"
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
