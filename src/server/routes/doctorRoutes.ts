import { Router } from 'express';
import { db } from '../db/database';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth';
import { generatePostVisitSummary } from '../services/aiService';
import { sendPostVisitSummaryNotification } from '../services/notificationService';
import { addDoctorLeaveAndResolveConflicts } from '../services/leaveService';

const router = Router();

// 1. Get Doctor's Appointments
router.get('/appointments', requireAuth, requireRole('DOCTOR'), (req, res) => {
  try {
    const doctorId = req.user!.id;
    const { date, status } = req.query;

    let query = `
      SELECT a.*, p.name as patient_name, p.email as patient_email, p.phone as patient_phone
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      WHERE a.doctor_id = ?
    `;
    const params: any[] = [doctorId];

    if (date) {
      query += ` AND a.appointment_date = ?`;
      params.push(date);
    }

    if (status && status !== 'ALL') {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY a.appointment_date DESC, a.start_time ASC`;

    const appointments = db.prepare(query).all(...params) as any[];

    const enriched = appointments.map(appt => {
      let doctorQuestions: string[] = [];
      try {
        if (appt.doctor_questions) doctorQuestions = JSON.parse(appt.doctor_questions);
      } catch (e) {}

      // Fetch any existing prescriptions
      const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE appointment_id = ?').all(appt.id);

      return {
        ...appt,
        doctor_questions: doctorQuestions,
        prescriptions
      };
    });

    return res.json({ appointments: enriched });
  } catch (err: any) {
    console.error('Doctor appointments fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch doctor appointments.' });
  }
});

// 2. Get Single Appointment Details
router.get('/appointments/:id', requireAuth, requireRole('DOCTOR'), (req, res) => {
  try {
    const doctorId = req.user!.id;
    const apptId = req.params.id;

    const appt = db.prepare(`
      SELECT a.*, p.name as patient_name, p.email as patient_email, p.phone as patient_phone
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      WHERE a.id = ? AND a.doctor_id = ?
    `).get(apptId, doctorId) as any;

    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    let doctorQuestions: string[] = [];
    try {
      if (appt.doctor_questions) doctorQuestions = JSON.parse(appt.doctor_questions);
    } catch (e) {}

    const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE appointment_id = ?').all(appt.id);

    return res.json({
      appointment: {
        ...appt,
        doctor_questions: doctorQuestions,
        prescriptions
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch appointment details.' });
  }
});

// 3. Complete Consultation & Submit Clinical Notes + Prescriptions
router.post('/appointments/:id/complete', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  try {
    const doctorId = req.user!.id;
    const apptId = req.params.id;
    const { clinicalNotes, prescriptionItems, prescriptionText } = req.body;

    if (!clinicalNotes || clinicalNotes.trim().length === 0) {
      return res.status(400).json({ error: 'Clinical diagnosis/consultation notes are required.' });
    }

    const appt = db.prepare(`
      SELECT a.*, p.name as patient_name, p.email as patient_email
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      WHERE a.id = ? AND a.doctor_id = ?
    `).get(apptId, doctorId) as any;

    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    // Format prescription string
    let rxText = prescriptionText || '';
    const parsedRxItems: any[] = Array.isArray(prescriptionItems) ? prescriptionItems : [];

    if (parsedRxItems.length > 0 && !rxText) {
      rxText = parsedRxItems.map(
        item => `- ${item.medicationName} (${item.dosage}): ${item.frequency} for ${item.durationDays} days. ${item.instructions || ''}`
      ).join('\n');
    }

    // 1. Generate LLM Post-Visit Summary (with graceful fallback)
    const aiSummary = await generatePostVisitSummary(clinicalNotes, rxText);

    // 2. Update appointment record and save prescriptions in a transaction
    const completeTx = db.transaction(() => {
      db.prepare(`
        UPDATE appointments
        SET status = 'COMPLETED',
            clinical_notes = ?,
            prescription_notes = ?,
            ai_postvisit_summary = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(clinicalNotes, rxText, aiSummary, apptId);

      // Insert structured prescription items
      const todayStr = new Date().toISOString().split('T')[0];
      const insertRx = db.prepare(`
        INSERT INTO prescriptions (
          id, appointment_id, patient_id, doctor_id, medication_name,
          dosage, frequency, duration_days, instructions, start_date, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      for (const item of parsedRxItems) {
        if (item.medicationName) {
          const rxId = `rx-${crypto.randomUUID()}`;
          insertRx.run(
            rxId,
            apptId,
            appt.patient_id,
            doctorId,
            item.medicationName,
            item.dosage || 'Standard Dose',
            item.frequency || 'Daily',
            parseInt(item.durationDays || '7', 10),
            item.instructions || '',
            todayStr
          );
        }
      }
    });

    completeTx();

    // 3. Dispatch post-visit notification to patient
    const doctorUser = db.prepare('SELECT name, email FROM users WHERE id = ?').get(doctorId) as any;
    const patientUser = { name: appt.patient_name, email: appt.patient_email };
    sendPostVisitSummaryNotification(appt, doctorUser, patientUser, aiSummary);

    return res.json({
      message: 'Consultation completed successfully. AI Post-Visit summary generated and dispatched to patient.',
      aiPostVisitSummary: aiSummary
    });
  } catch (err: any) {
    console.error('Complete appointment error:', err);
    return res.status(500).json({ error: err.message || 'Failed to complete appointment.' });
  }
});

// 4. Get Doctor Profile & Schedule Settings
router.get('/profile', requireAuth, requireRole('DOCTOR'), (req, res) => {
  try {
    const doctorId = req.user!.id;
    const profile = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone,
             dp.id as profile_id, dp.specialization, dp.bio,
             dp.working_hour_start, dp.working_hour_end, dp.slot_duration_minutes,
             dp.working_days, dp.consultation_fee
      FROM users u
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE u.id = ?
    `).get(doctorId) as any;

    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    const leaves = db.prepare('SELECT * FROM doctor_leaves WHERE doctor_id = ? ORDER BY leave_date ASC').all(doctorId);

    return res.json({ profile, leaves });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch doctor profile.' });
  }
});

// 5. Update Profile / Working hours
router.put('/profile', requireAuth, requireRole('DOCTOR'), (req, res) => {
  try {
    const doctorId = req.user!.id;
    const { specialization, bio, workingHourStart, workingHourEnd, slotDurationMinutes, consultationFee, phone } = req.body;

    db.transaction(() => {
      if (phone) {
        db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, doctorId);
      }

      db.prepare(`
        UPDATE doctor_profiles
        SET specialization = COALESCE(?, specialization),
            bio = COALESCE(?, bio),
            working_hour_start = COALESCE(?, working_hour_start),
            working_hour_end = COALESCE(?, working_hour_end),
            slot_duration_minutes = COALESCE(?, slot_duration_minutes),
            consultation_fee = COALESCE(?, consultation_fee)
        WHERE user_id = ?
      `).run(specialization, bio, workingHourStart, workingHourEnd, slotDurationMinutes, consultationFee, doctorId);
    })();

    return res.json({ message: 'Profile updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// 6. Manage Doctor Leaves
router.post('/leaves', requireAuth, requireRole('DOCTOR'), (req, res) => {
  try {
    const doctorId = req.user!.id;
    const { leaveDate, reason } = req.body;

    if (!leaveDate) {
      return res.status(400).json({ error: 'Leave date is required (YYYY-MM-DD).' });
    }

    const conflictResult = addDoctorLeaveAndResolveConflicts(doctorId, leaveDate, reason || 'Doctor personal leave');

    return res.status(201).json({
      message: `Leave recorded for ${leaveDate}. ${conflictResult.cancelledAppointmentsCount} conflicting bookings resolved.`,
      ...conflictResult
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record leave.' });
  }
});

export default router;
