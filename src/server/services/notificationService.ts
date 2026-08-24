import nodemailer from 'nodemailer';
import { db } from '../db/database';
import crypto from 'crypto';

export interface EnqueueNotificationParams {
  recipientEmail: string;
  recipientName?: string;
  recipientRole?: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  notificationType: 'BOOKING_CONFIRMATION' | 'APPOINTMENT_REMINDER' | 'APPOINTMENT_CANCELLED' | 'DOCTOR_LEAVE_ALERT' | 'MEDICATION_REMINDER' | 'POST_VISIT_SUMMARY';
  subject: string;
  bodyText: string;
  bodyHtml: string;
  metadata?: Record<string, any>;
}

// Nodemailer transport setup
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (user && pass) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
    } else {
      // Test mock/stream transport for robust zero-config execution
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows'
      });
    }
  }
  return transporter;
}

/**
 * Enqueue notification into database table with PENDING status
 */
export function enqueueNotification(params: EnqueueNotificationParams): string {
  const id = `notif-${crypto.randomUUID()}`;
  const metadataStr = params.metadata ? JSON.stringify(params.metadata) : null;

  const stmt = db.prepare(`
    INSERT INTO notifications (
      id, recipient_email, recipient_name, recipient_role, notification_type,
      subject, body_text, body_html, status, attempts, max_attempts, next_retry_at, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, 5, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(
    id,
    params.recipientEmail,
    params.recipientName || 'Valued User',
    params.recipientRole || 'PATIENT',
    params.notificationType,
    params.subject,
    params.bodyText,
    params.bodyHtml,
    Date.now(), // eligible immediately
    metadataStr
  );

  console.log(`[Notification Service] Enqueued ${params.notificationType} for ${params.recipientEmail} (ID: ${id})`);

  // Try immediate dispatch
  processNotificationItem(id).catch(err => {
    console.warn(`[Notification Service] Immediate dispatch failed, will retry:`, err.message);
  });

  return id;
}

/**
 * Process a single notification item by ID
 */
export async function processNotificationItem(notificationId: string): Promise<boolean> {
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId) as any;
  if (!row) return false;

  const now = Date.now();
  const currentAttempts = (row.attempts || 0) + 1;
  const maxAttempts = row.max_attempts || 5;

  try {
    const fromAddress = process.env.FROM_EMAIL || 'no-reply@clinicpulse.health';
    const transport = getTransporter();

    await transport.sendMail({
      from: `"ClinicPulse Health" <${fromAddress}>`,
      to: row.recipient_email,
      subject: row.subject,
      text: row.body_text,
      html: row.body_html
    });

    // Mark as SENT
    db.prepare(`
      UPDATE notifications 
      SET status = 'SENT', attempts = ?, sent_at = CURRENT_TIMESTAMP, error_message = NULL 
      WHERE id = ?
    `).run(currentAttempts, notificationId);

    console.log(`[Notification Service] Successfully sent notification ${notificationId} to ${row.recipient_email}`);
    return true;
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown email delivery error';
    console.error(`[Notification Service] Delivery failed for ${notificationId} (Attempt ${currentAttempts}/${maxAttempts}):`, errorMsg);

    if (currentAttempts >= maxAttempts) {
      // Exceeded max attempts -> mark as FAILED
      db.prepare(`
        UPDATE notifications 
        SET status = 'FAILED', attempts = ?, error_message = ? 
        WHERE id = ?
      `).run(currentAttempts, `Max retries exceeded: ${errorMsg}`, notificationId);
    } else {
      // Calculate exponential backoff: 30s * 2^(attempts-1) (e.g. 30s, 60s, 120s, 240s)
      const delayMs = Math.min(30000 * Math.pow(2, currentAttempts - 1), 600000);
      const nextRetry = now + delayMs;

      db.prepare(`
        UPDATE notifications 
        SET status = 'RETRYING', attempts = ?, next_retry_at = ?, error_message = ? 
        WHERE id = ?
      `).run(currentAttempts, nextRetry, errorMsg, notificationId);
    }
    return false;
  }
}

/**
 * Process all pending and eligible retrying notifications in the queue
 */
export async function processNotificationQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = Date.now();
  const pendingItems = db.prepare(`
    SELECT id FROM notifications 
    WHERE (status = 'PENDING' OR (status = 'RETRYING' AND next_retry_at <= ?))
    ORDER BY created_at ASC
    LIMIT 20
  `).all(now) as { id: string }[];

  let succeeded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    const success = await processNotificationItem(item.id);
    if (success) succeeded++;
    else failed++;
  }

  return { processed: pendingItems.length, succeeded, failed };
}

/**
 * Helper helpers to compose templates
 */
export function sendBookingConfirmation(appointment: any, doctor: any, patient: any) {
  // 1. To Patient
  const patientHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0284c7;">Appointment Confirmed!</h2>
      <p>Dear <strong>${patient.name}</strong>,</p>
      <p>Your appointment with <strong>${doctor.name}</strong> (${doctor.specialization}) has been confirmed.</p>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 4px 0;"><strong>Date:</strong> ${appointment.appointment_date}</p>
        <p style="margin: 4px 0;"><strong>Time:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
        <p style="margin: 4px 0;"><strong>Doctor:</strong> ${doctor.name}</p>
        <p style="margin: 4px 0;"><strong>Specialization:</strong> ${doctor.specialization}</p>
      </div>
      <p>Your symptoms have been processed by our AI system and a pre-visit summary has been prepared for your doctor.</p>
      <p style="font-size: 13px; color: #64748b;">Please arrive 10 minutes prior to your scheduled consultation time.</p>
    </div>
  `;

  enqueueNotification({
    recipientEmail: patient.email,
    recipientName: patient.name,
    recipientRole: 'PATIENT',
    notificationType: 'BOOKING_CONFIRMATION',
    subject: `Booking Confirmed: Consultation with ${doctor.name} on ${appointment.appointment_date}`,
    bodyText: `Your appointment with ${doctor.name} on ${appointment.appointment_date} from ${appointment.start_time} to ${appointment.end_time} is confirmed.`,
    bodyHtml: patientHtml,
    metadata: { appointmentId: appointment.id, role: 'PATIENT' }
  });

  // 2. To Doctor
  const doctorHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0284c7;">New Patient Appointment Scheduled</h2>
      <p>Dear <strong>${doctor.name}</strong>,</p>
      <p>A new consultation has been booked with <strong>${patient.name}</strong>.</p>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 4px 0;"><strong>Patient:</strong> ${patient.name} (${patient.email})</p>
        <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${appointment.appointment_date} at ${appointment.start_time}</p>
        <p style="margin: 4px 0;"><strong>AI Urgency Level:</strong> <span style="font-weight:bold; color: ${appointment.urgency_level === 'High' ? '#dc2626' : appointment.urgency_level === 'Medium' ? '#d97706' : '#16a34a'};">${appointment.urgency_level || 'Low'}</span></p>
        <p style="margin: 4px 0;"><strong>Chief Complaint:</strong> ${appointment.chief_complaint || 'N/A'}</p>
      </div>
      <p>You can review the full AI pre-visit summary and suggested diagnostic questions in your Doctor Portal.</p>
    </div>
  `;

  enqueueNotification({
    recipientEmail: doctor.email,
    recipientName: doctor.name,
    recipientRole: 'DOCTOR',
    notificationType: 'BOOKING_CONFIRMATION',
    subject: `New Patient Booking: ${patient.name} on ${appointment.appointment_date} at ${appointment.start_time}`,
    bodyText: `New appointment booked by ${patient.name} on ${appointment.appointment_date} at ${appointment.start_time}. Urgency: ${appointment.urgency_level}`,
    bodyHtml: doctorHtml,
    metadata: { appointmentId: appointment.id, role: 'DOCTOR' }
  });
}

export function sendDoctorLeaveAlert(appointment: any, doctor: any, patient: any, leaveDate: string, reason: string) {
  const patientHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 8px;">
      <h2 style="color: #dc2626;">Important: Appointment Rescheduling Required</h2>
      <p>Dear <strong>${patient.name}</strong>,</p>
      <p>We regret to inform you that <strong>${doctor.name}</strong> is on approved medical/clinical leave on <strong>${leaveDate}</strong>.</p>
      <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #ef4444;">
        <p style="margin: 4px 0;"><strong>Original Appointment:</strong> ${appointment.appointment_date} at ${appointment.start_time}</p>
        <p style="margin: 4px 0;"><strong>Doctor:</strong> ${doctor.name}</p>
        <p style="margin: 4px 0;"><strong>Reason:</strong> ${reason || 'Scheduled Doctor Leave'}</p>
      </div>
      <p>Your appointment has been automatically cancelled, and our booking portal is available for you to select an alternative slot or another specialist immediately.</p>
      <p>We sincerely apologize for any inconvenience caused to your schedule.</p>
    </div>
  `;

  enqueueNotification({
    recipientEmail: patient.email,
    recipientName: patient.name,
    recipientRole: 'PATIENT',
    notificationType: 'DOCTOR_LEAVE_ALERT',
    subject: `Action Required: Appointment Cancelled due to Doctor Leave (${doctor.name})`,
    bodyText: `Your appointment with ${doctor.name} on ${leaveDate} was cancelled due to doctor leave (${reason}). Please book a new slot.`,
    bodyHtml: patientHtml,
    metadata: { appointmentId: appointment.id, leaveDate, reason }
  });
}

export function sendCancellationNotification(appointment: any, doctor: any, patient: any, cancelledBy: string, reason: string) {
  const isPatientCancelling = cancelledBy === 'PATIENT';

  // Email to Patient
  enqueueNotification({
    recipientEmail: patient.email,
    recipientName: patient.name,
    recipientRole: 'PATIENT',
    notificationType: 'APPOINTMENT_CANCELLED',
    subject: `Appointment Cancelled: Consultation with ${doctor.name}`,
    bodyText: `Your appointment with ${doctor.name} on ${appointment.appointment_date} at ${appointment.start_time} has been cancelled. Reason: ${reason}`,
    bodyHtml: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #64748b;">Appointment Cancellation Notice</h2>
        <p>Dear <strong>${patient.name}</strong>,</p>
        <p>Your appointment on <strong>${appointment.appointment_date} at ${appointment.start_time}</strong> with <strong>${doctor.name}</strong> has been cancelled.</p>
        <p><strong>Cancellation Reason:</strong> ${reason || 'Patient/Clinic request'}</p>
      </div>
    `,
    metadata: { appointmentId: appointment.id }
  });

  // Email to Doctor
  enqueueNotification({
    recipientEmail: doctor.email,
    recipientName: doctor.name,
    recipientRole: 'DOCTOR',
    notificationType: 'APPOINTMENT_CANCELLED',
    subject: `Cancelled Appointment: ${patient.name} on ${appointment.appointment_date}`,
    bodyText: `The appointment with ${patient.name} on ${appointment.appointment_date} at ${appointment.start_time} has been cancelled. Reason: ${reason}`,
    bodyHtml: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #64748b;">Appointment Cancellation</h2>
        <p>Dear <strong>${doctor.name}</strong>,</p>
        <p>The appointment with <strong>${patient.name}</strong> scheduled for <strong>${appointment.appointment_date} at ${appointment.start_time}</strong> has been cancelled.</p>
        <p><strong>Reason:</strong> ${reason || 'Scheduled slot released'}</p>
      </div>
    `,
    metadata: { appointmentId: appointment.id }
  });
}

export function sendMedicationReminder(prescription: any, patient: any, doctor: any) {
  const reminderHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0f2fe; border-radius: 8px;">
      <h2 style="color: #0284c7;">💊 Medication Reminder</h2>
      <p>Dear <strong>${patient.name}</strong>,</p>
      <p>This is your automated reminder from ClinicPulse to take your scheduled medication:</p>
      <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #0284c7;">
        <p style="margin: 4px 0; font-size: 16px;"><strong>Medication:</strong> ${prescription.medication_name} (${prescription.dosage})</p>
        <p style="margin: 4px 0;"><strong>Frequency:</strong> ${prescription.frequency}</p>
        <p style="margin: 4px 0;"><strong>Instructions:</strong> ${prescription.instructions || 'Take as directed by your physician'}</p>
        <p style="margin: 4px 0;"><strong>Prescribed by:</strong> ${doctor.name}</p>
      </div>
      <p style="font-size: 13px; color: #64748b;">Keeping to your medication schedule is critical for your recovery and long-term health.</p>
    </div>
  `;

  enqueueNotification({
    recipientEmail: patient.email,
    recipientName: patient.name,
    recipientRole: 'PATIENT',
    notificationType: 'MEDICATION_REMINDER',
    subject: `Medication Reminder: ${prescription.medication_name} (${prescription.dosage})`,
    bodyText: `Medication Reminder: Time to take ${prescription.medication_name} (${prescription.dosage}). ${prescription.instructions}`,
    bodyHtml: reminderHtml,
    metadata: { prescriptionId: prescription.id }
  });
}

export function sendPostVisitSummaryNotification(appointment: any, doctor: any, patient: any, summaryMarkdown: string) {
  const summaryHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0284c7;">Your Post-Visit Clinical Summary</h2>
      <p>Dear <strong>${patient.name}</strong>,</p>
      <p>Thank you for consulting with <strong>${doctor.name}</strong> on ${appointment.appointment_date}.</p>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">
${summaryMarkdown}
      </div>
      <p>You can also access this complete summary, medication schedule, and history in your Patient Portal anytime.</p>
    </div>
  `;

  enqueueNotification({
    recipientEmail: patient.email,
    recipientName: patient.name,
    recipientRole: 'PATIENT',
    notificationType: 'POST_VISIT_SUMMARY',
    subject: `Post-Visit Summary & Care Plan - Consultation with ${doctor.name}`,
    bodyText: `Your post-visit clinical summary with ${doctor.name} is ready. Please check your patient portal for full medication schedules and follow-up guidance.`,
    bodyHtml: summaryHtml,
    metadata: { appointmentId: appointment.id }
  });
}
