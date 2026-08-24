export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  doctorProfile?: DoctorProfile;
}

export interface DoctorProfile {
  id: string;
  user_id: string;
  specialization: string;
  bio?: string;
  working_hour_start: string;
  working_hour_end: string;
  slot_duration_minutes: number;
  working_days: string;
  consultation_fee: number;
}

export interface DoctorWithProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  specialization: string;
  bio?: string;
  working_hour_start: string;
  working_hour_end: string;
  slot_duration_minutes: number;
  working_days: string;
  consultation_fee: number;
  leaves?: DoctorLeave[];
}

export interface DoctorLeave {
  id: string;
  doctor_id: string;
  leave_date: string;
  reason?: string;
  created_at: string;
}

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

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLED_BY_DOCTOR_LEAVE';
  symptoms_raw?: string;
  urgency_level?: 'Low' | 'Medium' | 'High' | 'LOW' | 'MEDIUM' | 'HIGH';
  chief_complaint?: string;
  doctor_questions?: string[];
  ai_previsit_summary?: string;
  clinical_notes?: string;
  prescription_notes?: string;
  ai_postvisit_summary?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  // Joins
  doctor_name?: string;
  doctor_email?: string;
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
  specialization?: string;
  consultation_fee?: number;
  gcal_url?: string;
  prescriptions?: Prescription[];
}

export interface Prescription {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions?: string;
  start_date: string;
  active: number;
  created_at: string;
  doctor_name?: string;
  specialization?: string;
}

export interface NotificationItem {
  id: string;
  recipient_email: string;
  recipient_name?: string;
  recipient_role?: string;
  notification_type: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
  attempts: number;
  max_attempts: number;
  next_retry_at: number;
  error_message?: string;
  created_at: string;
  sent_at?: string;
}
