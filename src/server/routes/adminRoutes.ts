import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { addDoctorLeaveAndResolveConflicts, removeDoctorLeave, getDoctorLeaves } from '../services/leaveService';
import { runBackgroundWorkerCycle } from '../services/backgroundWorker';

const router = Router();

// Require ADMIN role for all routes in this router
router.use(requireAuth, requireRole('ADMIN'));

// 1. Clinic System Statistics
router.get('/stats', (_req, res) => {
  try {
    const totalDoctors = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'DOCTOR'").get() as any;
    const totalPatients = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'PATIENT'").get() as any;
    const totalAppointments = db.prepare('SELECT COUNT(*) as count FROM appointments').get() as any;
    const highUrgencyCount = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE urgency_level = 'High'").get() as any;
    const pendingNotifications = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE status IN ('PENDING', 'RETRYING')").get() as any;
    const activePrescriptions = db.prepare('SELECT COUNT(*) as count FROM prescriptions WHERE active = 1').get() as any;

    return res.json({
      totalDoctors: totalDoctors.count,
      totalPatients: totalPatients.count,
      totalAppointments: totalAppointments.count,
      highUrgencyCount: highUrgencyCount.count,
      pendingNotifications: pendingNotifications.count,
      activePrescriptions: activePrescriptions.count
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

// 2. List All Doctors with profiles and leave dates
router.get('/doctors', (_req, res) => {
  try {
    const doctors = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
             dp.id as profile_id, dp.specialization, dp.bio,
             dp.working_hour_start, dp.working_hour_end, dp.slot_duration_minutes,
             dp.working_days, dp.consultation_fee
      FROM users u
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE u.role = 'DOCTOR'
      ORDER BY u.name ASC
    `).all() as any[];

    const enriched = doctors.map(d => {
      const leaves = getDoctorLeaves(d.id);
      return { ...d, leaves };
    });

    return res.json({ doctors: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch doctors.' });
  }
});

// 3. Create Doctor Profile
router.post('/doctors', (req, res) => {
  try {
    const { name, email, password, phone, specialization, bio, workingHourStart, workingHourEnd, slotDurationMinutes, consultationFee } = req.body;

    if (!name || !email || !password || !specialization) {
      return res.status(400).json({ error: 'Name, email, password, and specialization are required.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const userId = `user-${crypto.randomUUID()}`;
    const profileId = `profile-${crypto.randomUUID()}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, name, phone)
        VALUES (?, ?, ?, 'DOCTOR', ?, ?)
      `).run(userId, email.toLowerCase(), passwordHash, name, phone || null);

      db.prepare(`
        INSERT INTO doctor_profiles (
          id, user_id, specialization, bio, working_hour_start, working_hour_end,
          slot_duration_minutes, working_days, consultation_fee
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '[1,2,3,4,5]', ?)
      `).run(
        profileId,
        userId,
        specialization,
        bio || 'Board-certified medical practitioner.',
        workingHourStart || '09:00',
        workingHourEnd || '17:00',
        slotDurationMinutes || 30,
        consultationFee || 100.0
      );
    })();

    return res.status(201).json({
      message: 'Doctor account and profile created successfully.',
      doctorId: userId
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create doctor.' });
  }
});

// 4. Update Doctor Profile (Admin)
router.put('/doctors/:id', (req, res) => {
  try {
    const doctorId = req.params.id;
    const { name, phone, specialization, bio, workingHourStart, workingHourEnd, slotDurationMinutes, consultationFee } = req.body;

    db.transaction(() => {
      if (name || phone) {
        db.prepare(`
          UPDATE users 
          SET name = COALESCE(?, name), phone = COALESCE(?, phone) 
          WHERE id = ?
        `).run(name, phone, doctorId);
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

    return res.json({ message: 'Doctor profile updated.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update doctor profile.' });
  }
});

// 5. Mark Doctor on Leave & Resolve Conflicts
router.post('/leaves', (req, res) => {
  try {
    const { doctorId, leaveDate, reason } = req.body;

    if (!doctorId || !leaveDate) {
      return res.status(400).json({ error: 'doctorId and leaveDate (YYYY-MM-DD) are required.' });
    }

    const result = addDoctorLeaveAndResolveConflicts(doctorId, leaveDate, reason || 'Scheduled Doctor Leave');

    return res.status(201).json({
      message: `Doctor marked on leave for ${leaveDate}. Resolved ${result.cancelledAppointmentsCount} conflicting bookings.`,
      ...result
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to mark doctor leave.' });
  }
});

// 6. Delete Doctor Leave
router.delete('/leaves/:id', (req, res) => {
  try {
    const leaveId = req.params.id;
    removeDoctorLeave(leaveId);
    return res.json({ message: 'Doctor leave removed.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to remove leave.' });
  }
});

// 7. View All Appointments (Clinic-wide)
router.get('/appointments', (req, res) => {
  try {
    const { status, doctorId } = req.query;
    let query = `
      SELECT a.*, p.name as patient_name, p.email as patient_email,
             d.name as doctor_name, d.email as doctor_email, dp.specialization
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      JOIN users d ON a.doctor_id = d.id
      JOIN doctor_profiles dp ON d.id = dp.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'ALL') {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    if (doctorId) {
      query += ` AND a.doctor_id = ?`;
      params.push(doctorId);
    }

    query += ` ORDER BY a.appointment_date DESC, a.start_time ASC`;

    const appointments = db.prepare(query).all(...params) as any[];

    return res.json({ appointments });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch clinic appointments.' });
  }
});

// 8. Trigger Background Worker
router.post('/worker/trigger', async (_req, res) => {
  try {
    const result = await runBackgroundWorkerCycle();
    return res.json({
      message: 'Background worker cycle completed successfully.',
      ...result
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Worker execution failed.' });
  }
});

export default router;
