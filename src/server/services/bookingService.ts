import { db } from '../db/database';
import crypto from 'crypto';
import { generatePreVisitSummary } from './aiService';
import { sendBookingConfirmation } from './notificationService';
import { generateGoogleCalendarUrl } from './calendarService';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isHeld: boolean;
  heldByMe?: boolean;
}

export interface DoctorSchedule {
  doctorId: string;
  doctorName: string;
  specialization: string;
  date: string;
  isOnLeave: boolean;
  leaveReason?: string;
  slots: TimeSlot[];
}

/**
 * Clean up expired slot holds
 */
export function cleanupExpiredHolds(): number {
  const now = Date.now();
  const info = db.prepare('DELETE FROM slot_holds WHERE expires_at <= ?').run(now);
  return info.changes;
}

/**
 * Calculate available slots for a doctor on a specific date
 */
export function getDoctorAvailableSlots(doctorUserId: string, dateStr: string, currentPatientId?: string): DoctorSchedule {
  cleanupExpiredHolds();

  // 1. Fetch Doctor Profile and User Details
  const doctor = db.prepare(`
    SELECT u.id as user_id, u.name, u.email, dp.id as profile_id, dp.specialization,
           dp.working_hour_start, dp.working_hour_end, dp.slot_duration_minutes,
           dp.working_days, dp.consultation_fee
    FROM users u
    JOIN doctor_profiles dp ON u.id = dp.user_id
    WHERE u.id = ? AND u.role = 'DOCTOR'
  `).get(doctorUserId) as any;

  if (!doctor) {
    throw new Error(`Doctor not found with ID: ${doctorUserId}`);
  }

  // 2. Check if doctor is on leave on this date
  const leave = db.prepare(`
    SELECT * FROM doctor_leaves WHERE doctor_id = ? AND leave_date = ?
  `).get(doctorUserId, dateStr) as any;

  if (leave) {
    return {
      doctorId: doctor.user_id,
      doctorName: doctor.name,
      specialization: doctor.specialization,
      date: dateStr,
      isOnLeave: true,
      leaveReason: leave.reason || 'Doctor is on scheduled leave',
      slots: []
    };
  }

  // 3. Check if date falls on doctor's working day
  const targetDate = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 1 is Monday...
  const workingDays = JSON.parse(doctor.working_days || '[1,2,3,4,5]');

  if (!workingDays.includes(dayOfWeek)) {
    return {
      doctorId: doctor.user_id,
      doctorName: doctor.name,
      specialization: doctor.specialization,
      date: dateStr,
      isOnLeave: false,
      leaveReason: 'Doctor does not practice on this day of the week',
      slots: []
    };
  }

  // 4. Fetch existing confirmed appointments on this date
  const existingAppts = db.prepare(`
    SELECT start_time, end_time FROM appointments
    WHERE doctor_id = ? AND appointment_date = ? AND status = 'CONFIRMED'
  `).all(doctorUserId, dateStr) as { start_time: string; end_time: string }[];

  const bookedStarts = new Set(existingAppts.map(a => a.start_time));

  // 5. Fetch active slot holds
  const activeHolds = db.prepare(`
    SELECT start_time, end_time, held_by_patient_id FROM slot_holds
    WHERE doctor_id = ? AND slot_date = ? AND expires_at > ?
  `).all(doctorUserId, dateStr, Date.now()) as { start_time: string; end_time: string; held_by_patient_id: string }[];

  const holdMap = new Map<string, string>();
  activeHolds.forEach(h => holdMap.set(h.start_time, h.held_by_patient_id));

  // 6. Generate time slots based on working hours and duration
  const startMinutes = parseTimeToMinutes(doctor.working_hour_start || '09:00');
  const endMinutes = parseTimeToMinutes(doctor.working_hour_end || '17:00');
  const duration = doctor.slot_duration_minutes || 30;

  const slots: TimeSlot[] = [];
  for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
    const slotStart = formatMinutesToTime(m);
    const slotEnd = formatMinutesToTime(m + duration);

    const isBooked = bookedStarts.has(slotStart);
    const heldBy = holdMap.get(slotStart);
    const isHeldByAnother = !!(heldBy && heldBy !== currentPatientId);
    const isHeldByMe = !!(heldBy && heldBy === currentPatientId);

    const isAvailable = !isBooked && !isHeldByAnother;

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      isAvailable,
      isHeld: !!heldBy,
      heldByMe: isHeldByMe
    });
  }

  return {
    doctorId: doctor.user_id,
    doctorName: doctor.name,
    specialization: doctor.specialization,
    date: dateStr,
    isOnLeave: false,
    slots
  };
}

/**
 * Acquire a temporary hold on a slot (e.g. for 5 minutes during symptom input)
 */
export function holdSlot(
  doctorId: string,
  slotDate: string,
  startTime: string,
  endTime: string,
  patientId: string,
  holdDurationSeconds: number = 300
): { holdId: string; expiresAt: number } {
  cleanupExpiredHolds();

  const acquireTransaction = db.transaction(() => {
    // 1. Check if doctor is on leave
    const leave = db.prepare('SELECT id FROM doctor_leaves WHERE doctor_id = ? AND leave_date = ?').get(doctorId, slotDate);
    if (leave) {
      throw new Error('Doctor is on leave on this date.');
    }

    // 2. Check if slot is already booked
    const existing = db.prepare(`
      SELECT id FROM appointments 
      WHERE doctor_id = ? AND appointment_date = ? AND start_time = ? AND status = 'CONFIRMED'
    `).get(doctorId, slotDate, startTime);

    if (existing) {
      throw new Error('This slot is already booked by another patient.');
    }

    // 3. Check if slot is currently held by someone else
    const currentHold = db.prepare(`
      SELECT id, held_by_patient_id, expires_at FROM slot_holds 
      WHERE doctor_id = ? AND slot_date = ? AND start_time = ? AND expires_at > ?
    `).get(doctorId, slotDate, startTime, Date.now()) as any;

    if (currentHold && currentHold.held_by_patient_id !== patientId) {
      throw new Error('This slot is currently being held by another patient. Please select another slot or retry in a few minutes.');
    }

    // Delete any existing holds for this user on this slot
    db.prepare('DELETE FROM slot_holds WHERE doctor_id = ? AND slot_date = ? AND start_time = ?').run(doctorId, slotDate, startTime);

    const holdId = `hold-${crypto.randomUUID()}`;
    const expiresAt = Date.now() + (holdDurationSeconds * 1000);

    db.prepare(`
      INSERT INTO slot_holds (id, doctor_id, slot_date, start_time, end_time, held_by_patient_id, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(holdId, doctorId, slotDate, startTime, endTime, patientId, expiresAt);

    return { holdId, expiresAt };
  });

  return acquireTransaction();
}

/**
 * Release a temporary hold
 */
export function releaseSlotHold(holdId: string, patientId: string): boolean {
  const res = db.prepare('DELETE FROM slot_holds WHERE id = ? AND held_by_patient_id = ?').run(holdId, patientId);
  return res.changes > 0;
}

/**
 * Confirm and Book Appointment safely with transactional guard & LLM summary integration
 */
export async function bookAppointment(params: {
  doctorId: string;
  patientId: string;
  date: string;
  startTime: string;
  endTime: string;
  symptoms: string;
  holdId?: string;
}): Promise<any> {
  const { doctorId, patientId, date, startTime, endTime, symptoms, holdId } = params;

  if (!symptoms || symptoms.trim().length === 0) {
    throw new Error('Patient symptoms are required prior to booking confirmation.');
  }

  // 1. Generate AI Pre-visit summary (LLM with graceful fallback)
  const aiResult = await generatePreVisitSummary(symptoms);

  // 2. Execute transactional booking
  const bookTx = db.transaction(() => {
    cleanupExpiredHolds();

    // Check doctor leave
    const leave = db.prepare('SELECT id FROM doctor_leaves WHERE doctor_id = ? AND leave_date = ?').get(doctorId, date);
    if (leave) {
      throw new Error('Doctor is on leave on this date. Booking cannot proceed.');
    }

    // Check double booking
    const existing = db.prepare(`
      SELECT id FROM appointments 
      WHERE doctor_id = ? AND appointment_date = ? AND start_time = ? AND status = 'CONFIRMED'
    `).get(doctorId, date, startTime);

    if (existing) {
      throw new Error('Slot conflict: This time slot was just confirmed by another patient.');
    }

    // Check hold ownership if holdId was passed or if someone else held it
    const activeHold = db.prepare(`
      SELECT id, held_by_patient_id FROM slot_holds 
      WHERE doctor_id = ? AND slot_date = ? AND start_time = ? AND expires_at > ?
    `).get(doctorId, date, startTime, Date.now()) as any;

    if (activeHold && activeHold.held_by_patient_id !== patientId) {
      throw new Error('Slot conflict: This time slot is reserved by another patient.');
    }

    const appointmentId = `appt-${crypto.randomUUID()}`;

    // Insert Appointment
    db.prepare(`
      INSERT INTO appointments (
        id, patient_id, doctor_id, appointment_date, start_time, end_time, status,
        symptoms_raw, urgency_level, chief_complaint, doctor_questions, ai_previsit_summary,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      appointmentId,
      patientId,
      doctorId,
      date,
      startTime,
      endTime,
      symptoms,
      aiResult.urgencyLevel,
      aiResult.chiefComplaint,
      JSON.stringify(aiResult.suggestedQuestions),
      aiResult.fullSummary
    );

    // Delete any slot hold
    db.prepare('DELETE FROM slot_holds WHERE doctor_id = ? AND slot_date = ? AND start_time = ?').run(doctorId, date, startTime);

    return appointmentId;
  });

  const apptId = bookTx();

  // 3. Fetch full details for notification and calendar
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId) as any;
  const doctor = db.prepare(`
    SELECT u.id, u.name, u.email, dp.specialization 
    FROM users u 
    JOIN doctor_profiles dp ON u.id = dp.user_id 
    WHERE u.id = ?
  `).get(doctorId) as any;
  const patient = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(patientId) as any;

  // 4. Generate Google Calendar URL
  const gcalUrl = generateGoogleCalendarUrl({
    appointmentId: apptId,
    doctorName: doctor.name,
    patientName: patient.name,
    specialization: doctor.specialization,
    date,
    startTime,
    endTime,
    summary: `Clinic Consultation: ${patient.name} & ${doctor.name}`,
    description: `Pre-Visit Urgency: ${aiResult.urgencyLevel}\nChief Complaint: ${aiResult.chiefComplaint}\nSymptoms: ${symptoms}`,
    patientEmail: patient.email,
    doctorEmail: doctor.email
  });

  // 5. Send Email notifications to both doctor and patient
  sendBookingConfirmation(appointment, doctor, patient);

  return {
    appointment: {
      ...appointment,
      doctor_name: doctor.name,
      specialization: doctor.specialization,
      patient_name: patient.name,
      gcal_url: gcalUrl
    },
    aiSummary: aiResult
  };
}

// Helpers
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
