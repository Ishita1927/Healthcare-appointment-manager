import { db } from '../db/database';
import { cleanupExpiredHolds } from './bookingService';
import { processNotificationQueue, sendMedicationReminder, sendBookingConfirmation, enqueueNotification } from './notificationService';

let workerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Process active prescriptions and send medication reminders
 */
export async function processMedicationReminders(): Promise<number> {
  const activePrescriptions = db.prepare(`
    SELECT p.*, pt.name as patient_name, pt.email as patient_email,
           d.name as doctor_name, d.email as doctor_email
    FROM prescriptions p
    JOIN users pt ON p.patient_id = pt.id
    JOIN users d ON p.doctor_id = d.id
    WHERE p.active = 1
  `).all() as any[];

  let remindersSent = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  for (const rx of activePrescriptions) {
    // Check if prescription is within duration
    const startDate = new Date(rx.start_date);
    const today = new Date(todayStr);
    const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays >= rx.duration_days) {
      // Deactivate expired prescription
      db.prepare('UPDATE prescriptions SET active = 0 WHERE id = ?').run(rx.id);
      continue;
    }

    // Check if a reminder was already sent today for this prescription
    const alreadySent = db.prepare(`
      SELECT id FROM notifications 
      WHERE notification_type = 'MEDICATION_REMINDER'
        AND metadata LIKE ?
        AND DATE(created_at) = ?
    `).get(`%"prescriptionId":"${rx.id}"%`, todayStr);

    if (!alreadySent) {
      const patient = { name: rx.patient_name, email: rx.patient_email };
      const doctor = { name: rx.doctor_name, email: rx.doctor_email };
      sendMedicationReminder(rx, patient, doctor);
      remindersSent++;
    }
  }

  return remindersSent;
}

/**
 * Send upcoming appointment reminders (e.g. for tomorrow's appointments)
 */
export async function processAppointmentReminders(): Promise<number> {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const upcomingAppts = db.prepare(`
    SELECT a.*, p.name as patient_name, p.email as patient_email,
           d.name as doctor_name, d.email as doctor_email, dp.specialization
    FROM appointments a
    JOIN users p ON a.patient_id = p.id
    JOIN users d ON a.doctor_id = d.id
    JOIN doctor_profiles dp ON d.id = dp.user_id
    WHERE a.appointment_date = ? AND a.status = 'CONFIRMED'
  `).all(tomorrow) as any[];

  let remindersSent = 0;

  for (const appt of upcomingAppts) {
    const alreadySent = db.prepare(`
      SELECT id FROM notifications 
      WHERE notification_type = 'APPOINTMENT_REMINDER'
        AND metadata LIKE ?
    `).get(`%"appointmentId":"${appt.id}"%`);

    if (!alreadySent) {
      enqueueNotification({
        recipientEmail: appt.patient_email,
        recipientName: appt.patient_name,
        recipientRole: 'PATIENT',
        notificationType: 'APPOINTMENT_REMINDER',
        subject: `Reminder: Consultation with ${appt.doctor_name} Tomorrow at ${appt.start_time}`,
        bodyText: `Friendly reminder of your consultation tomorrow with ${appt.doctor_name} (${appt.specialization}) at ${appt.start_time}.`,
        bodyHtml: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #bae6fd; border-radius: 8px;">
            <h2 style="color: #0284c7;">Upcoming Appointment Reminder</h2>
            <p>Dear <strong>${appt.patient_name}</strong>,</p>
            <p>This is a reminder that you have a scheduled appointment tomorrow:</p>
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p><strong>Doctor:</strong> ${appt.doctor_name} (${appt.specialization})</p>
              <p><strong>Date & Time:</strong> Tomorrow (${appt.appointment_date}) at ${appt.start_time}</p>
            </div>
            <p>Please log into your portal to review pre-visit notes or make any changes.</p>
          </div>
        `,
        metadata: { appointmentId: appt.id }
      });
      remindersSent++;
    }
  }

  return remindersSent;
}

/**
 * Execute a single cycle of all background maintenance and queue tasks
 */
export async function runBackgroundWorkerCycle(): Promise<{
  expiredHoldsCleared: number;
  medicationRemindersSent: number;
  appointmentRemindersSent: number;
  notificationQueueResult: { processed: number; succeeded: number; failed: number };
}> {
  const expiredHoldsCleared = cleanupExpiredHolds();
  const medicationRemindersSent = await processMedicationReminders();
  const appointmentRemindersSent = await processAppointmentReminders();
  const notificationQueueResult = await processNotificationQueue();

  return {
    expiredHoldsCleared,
    medicationRemindersSent,
    appointmentRemindersSent,
    notificationQueueResult
  };
}

/**
 * Start the background worker service
 */
export function startBackgroundWorker(intervalMs: number = 20000) {
  if (workerInterval) return;

  console.log(`[Background Worker] Starting scheduled worker (Cycle every ${intervalMs / 1000}s)...`);

  // Run initial cycle immediately
  runBackgroundWorkerCycle().catch(err => console.error('[Background Worker] Error in initial cycle:', err));

  workerInterval = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runBackgroundWorkerCycle();
    } catch (err: any) {
      console.error('[Background Worker] Error in background cycle:', err.message);
    } finally {
      isRunning = false;
    }
  }, intervalMs);
}

/**
 * Stop background worker
 */
export function stopBackgroundWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Background Worker] Stopped.');
  }
}
