import { Router } from 'express';
import { db } from '../db/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { getDoctorAvailableSlots, holdSlot, releaseSlotHold, bookAppointment } from '../services/bookingService';
import { sendCancellationNotification } from '../services/notificationService';
import { generateICalString, generateGoogleCalendarUrl } from '../services/calendarService';

const router = Router();

// 1. Search and list doctors (Public or Authenticated)
router.get('/doctors', (req, res) => {
  try {
    const { specialization, search } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.phone,
             dp.specialization, dp.bio, dp.working_hour_start, dp.working_hour_end,
             dp.slot_duration_minutes, dp.working_days, dp.consultation_fee
      FROM users u
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE u.role = 'DOCTOR'
    `;
    const params: any[] = [];

    if (specialization && specialization !== 'All') {
      query += ` AND LOWER(dp.specialization) = LOWER(?)`;
      params.push(specialization);
    }

    if (search) {
      query += ` AND (LOWER(u.name) LIKE LOWER(?) OR LOWER(dp.specialization) LIKE LOWER(?) OR LOWER(dp.bio) LIKE LOWER(?))`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY u.name ASC`;

    const doctors = db.prepare(query).all(...params) as any[];

    // Extract unique specializations list for filter dropdown
    const specializations = db.prepare(`
      SELECT DISTINCT specialization FROM doctor_profiles ORDER BY specialization ASC
    `).all().map((r: any) => r.specialization);

    return res.json({ doctors, specializations });
  } catch (err: any) {
    console.error('Fetch doctors error:', err);
    return res.status(500).json({ error: 'Failed to fetch doctors.' });
  }
});

// 2. Get available slots for a doctor on a specific date
router.get('/doctors/:id/slots', (req, res) => {
  try {
    const doctorId = req.params.id;
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const patientId = req.query.patientId as string | undefined;

    const schedule = getDoctorAvailableSlots(doctorId, dateStr, patientId);
    return res.json(schedule);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to fetch slots.' });
  }
});

// 3. Acquire temporary slot hold
router.post('/hold-slot', requireAuth, requireRole('PATIENT'), (req, res) => {
  try {
    const { doctorId, date, startTime, endTime } = req.body;
    const patientId = req.user!.id;

    if (!doctorId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Doctor ID, date, startTime, and endTime are required.' });
    }

    const hold = holdSlot(doctorId, date, startTime, endTime, patientId, 300); // 5 minutes
    return res.json({
      message: 'Slot temporarily held for 5 minutes.',
      ...hold
    });
  } catch (err: any) {
    return res.status(409).json({ error: err.message || 'Failed to hold slot.' });
  }
});

// 4. Release slot hold
router.post('/release-hold', requireAuth, requireRole('PATIENT'), (req, res) => {
  try {
    const { holdId } = req.body;
    if (holdId) {
      releaseSlotHold(holdId, req.user!.id);
    }
    return res.json({ message: 'Hold released.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to release hold.' });
  }
});

// 5. Confirm and Book Appointment
router.post('/book', requireAuth, requireRole('PATIENT'), async (req, res) => {
  try {
    const { doctorId, date, startTime, endTime, symptoms, holdId } = req.body;
    const patientId = req.user!.id;

    if (!doctorId || !date || !startTime || !endTime || !symptoms) {
      return res.status(400).json({ error: 'All booking fields including symptoms are required.' });
    }

    const bookingResult = await bookAppointment({
      doctorId,
      patientId,
      date,
      startTime,
      endTime,
      symptoms,
      holdId
    });

    return res.status(201).json({
      message: 'Appointment booked successfully!',
      ...bookingResult
    });
  } catch (err: any) {
    console.error('Booking error:', err);
    return res.status(409).json({ error: err.message || 'Failed to book appointment.' });
  }
});

// 6. Get Patient Appointments
router.get('/appointments', requireAuth, requireRole('PATIENT'), (req, res) => {
  try {
    const patientId = req.user!.id;
    const appointments = db.prepare(`
      SELECT a.*, d.name as doctor_name, d.email as doctor_email, dp.specialization, dp.consultation_fee
      FROM appointments a
      JOIN users d ON a.doctor_id = d.id
      JOIN doctor_profiles dp ON d.id = dp.user_id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date DESC, a.start_time DESC
    `).all(patientId) as any[];

    // Parse JSON fields
    const enriched = appointments.map(appt => {
      let doctorQuestions: string[] = [];
      try {
        if (appt.doctor_questions) doctorQuestions = JSON.parse(appt.doctor_questions);
      } catch (e) {}

      const gcalUrl = generateGoogleCalendarUrl({
        appointmentId: appt.id,
        doctorName: appt.doctor_name,
        patientName: req.user!.name,
        specialization: appt.specialization,
        date: appt.appointment_date,
        startTime: appt.start_time,
        endTime: appt.end_time,
        summary: `Clinic Consultation with ${appt.doctor_name}`,
        description: `Status: ${appt.status}\nChief Complaint: ${appt.chief_complaint || ''}`,
        patientEmail: req.user!.email,
        doctorEmail: appt.doctor_email
      });

      return {
        ...appt,
        doctor_questions: doctorQuestions,
        gcal_url: gcalUrl
      };
    });

    return res.json({ appointments: enriched });
  } catch (err: any) {
    console.error('Fetch appointments error:', err);
    return res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
});

// 7. Cancel Appointment by Patient
router.post('/appointments/:id/cancel', requireAuth, requireRole('PATIENT'), (req, res) => {
  try {
    const apptId = req.params.id;
    const { reason = 'Cancelled by patient' } = req.body;
    const patientId = req.user!.id;

    const appt = db.prepare('SELECT * FROM appointments WHERE id = ? AND patient_id = ?').get(apptId, patientId) as any;
    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (appt.status !== 'CONFIRMED') {
      return res.status(400).json({ error: `Cannot cancel an appointment with status: ${appt.status}` });
    }

    db.prepare(`
      UPDATE appointments 
      SET status = 'CANCELLED', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(reason, apptId);

    const doctor = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(appt.doctor_id) as any;
    const patient = { id: req.user!.id, name: req.user!.name, email: req.user!.email };

    sendCancellationNotification(appt, doctor, patient, 'PATIENT', reason);

    return res.json({ message: 'Appointment successfully cancelled and doctor notified.' });
  } catch (err: any) {
    console.error('Cancel appointment error:', err);
    return res.status(500).json({ error: 'Failed to cancel appointment.' });
  }
});

// 8. Download iCalendar .ics file
router.get('/appointments/:id/ical', requireAuth, (req, res) => {
  try {
    const apptId = req.params.id;
    const appt = db.prepare(`
      SELECT a.*, p.name as patient_name, p.email as patient_email,
             d.name as doctor_name, d.email as doctor_email, dp.specialization
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      JOIN users d ON a.doctor_id = d.id
      JOIN doctor_profiles dp ON d.id = dp.user_id
      WHERE a.id = ?
    `).get(apptId) as any;

    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const icsContent = generateICalString({
      appointmentId: appt.id,
      doctorName: appt.doctor_name,
      patientName: appt.patient_name,
      specialization: appt.specialization,
      date: appt.appointment_date,
      startTime: appt.start_time,
      endTime: appt.end_time,
      summary: `Clinic Consultation with ${appt.doctor_name} (${appt.specialization})`,
      description: `Chief Complaint: ${appt.chief_complaint || 'N/A'}\nSymptoms: ${appt.symptoms_raw || ''}`,
      patientEmail: appt.patient_email,
      doctorEmail: appt.doctor_email
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${appt.appointment_date}.ics"`);
    return res.send(icsContent);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate calendar file.' });
  }
});

// 9. Get Patient Prescriptions
router.get('/prescriptions', requireAuth, requireRole('PATIENT'), (req, res) => {
  try {
    const patientId = req.user!.id;
    const prescriptions = db.prepare(`
      SELECT p.*, d.name as doctor_name, dp.specialization, a.appointment_date
      FROM prescriptions p
      JOIN users d ON p.doctor_id = d.id
      JOIN doctor_profiles dp ON d.id = dp.user_id
      JOIN appointments a ON p.appointment_id = a.id
      WHERE p.patient_id = ?
      ORDER BY p.created_at DESC
    `).all(patientId);

    return res.json({ prescriptions });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch prescriptions.' });
  }
});

export default router;
