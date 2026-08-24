import { db } from '../db/database';
import crypto from 'crypto';
import { sendDoctorLeaveAlert } from './notificationService';

export interface LeaveConflictResult {
  leaveId: string;
  doctorId: string;
  leaveDate: string;
  reason: string;
  cancelledAppointmentsCount: number;
  affectedAppointments: Array<{
    appointmentId: string;
    patientId: string;
    patientName: string;
    patientEmail: string;
    startTime: string;
    endTime: string;
  }>;
}

/**
 * Mark a doctor on leave for a specific date and resolve all booking conflicts atomically
 */
export function addDoctorLeaveAndResolveConflicts(
  doctorId: string,
  leaveDate: string,
  reason: string = 'Doctor on scheduled leave'
): LeaveConflictResult {
  const result = db.transaction(() => {
    // 1. Check if leave already marked
    const existingLeave = db.prepare('SELECT id FROM doctor_leaves WHERE doctor_id = ? AND leave_date = ?').get(doctorId, leaveDate) as any;
    let leaveId = existingLeave ? existingLeave.id : `leave-${crypto.randomUUID()}`;

    if (!existingLeave) {
      db.prepare(`
        INSERT INTO doctor_leaves (id, doctor_id, leave_date, reason)
        VALUES (?, ?, ?, ?)
      `).run(leaveId, doctorId, leaveDate, reason);
    } else {
      db.prepare('UPDATE doctor_leaves SET reason = ? WHERE id = ?').run(reason, leaveId);
    }

    // 2. Clear any active temporary slot holds on this date
    db.prepare('DELETE FROM slot_holds WHERE doctor_id = ? AND slot_date = ?').run(doctorId, leaveDate);

    // 3. Find all affected confirmed appointments
    const affected = db.prepare(`
      SELECT a.id, a.patient_id, a.start_time, a.end_time, a.appointment_date,
             p.name as patient_name, p.email as patient_email,
             d.name as doctor_name, d.email as doctor_email
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      JOIN users d ON a.doctor_id = d.id
      WHERE a.doctor_id = ? AND a.appointment_date = ? AND a.status = 'CONFIRMED'
    `).all(doctorId, leaveDate) as any[];

    // 4. Atomically cancel affected appointments
    if (affected.length > 0) {
      const cancelStmt = db.prepare(`
        UPDATE appointments 
        SET status = 'CANCELLED_BY_DOCTOR_LEAVE',
            cancellation_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      for (const appt of affected) {
        cancelStmt.run(`Doctor on leave: ${reason}`, appt.id);
      }
    }

    return {
      leaveId,
      doctorId,
      leaveDate,
      reason,
      affected
    };
  })();

  // 5. Outside transaction, fetch doctor profile and dispatch notification alerts
  const doctor = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(doctorId) as any;

  for (const appt of result.affected) {
    const patient = { id: appt.patient_id, name: appt.patient_name, email: appt.patient_email };
    sendDoctorLeaveAlert(appt, doctor, patient, leaveDate, reason);
  }

  return {
    leaveId: result.leaveId,
    doctorId: result.doctorId,
    leaveDate: result.leaveDate,
    reason: result.reason,
    cancelledAppointmentsCount: result.affected.length,
    affectedAppointments: result.affected.map(a => ({
      appointmentId: a.id,
      patientId: a.patient_id,
      patientName: a.patient_name,
      patientEmail: a.patient_email,
      startTime: a.start_time,
      endTime: a.end_time
    }))
  };
}

/**
 * Remove a doctor leave entry
 */
export function removeDoctorLeave(leaveId: string): boolean {
  const res = db.prepare('DELETE FROM doctor_leaves WHERE id = ?').run(leaveId);
  return res.changes > 0;
}

/**
 * Get all leave records for a doctor
 */
export function getDoctorLeaves(doctorId: string): any[] {
  return db.prepare(`
    SELECT * FROM doctor_leaves 
    WHERE doctor_id = ? 
    ORDER BY leave_date ASC
  `).all(doctorId);
}
