import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(__dirname, '../../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'healthcare.db');
export const db = new Database(dbPath);

// Enable WAL mode for better concurrency and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('PATIENT', 'DOCTOR', 'ADMIN')) NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Doctor Profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctor_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      specialization TEXT NOT NULL,
      bio TEXT,
      working_hour_start TEXT DEFAULT '09:00',
      working_hour_end TEXT DEFAULT '17:00',
      slot_duration_minutes INTEGER DEFAULT 30,
      working_days TEXT DEFAULT '[1,2,3,4,5]',
      consultation_fee REAL DEFAULT 50.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Doctor Leaves table
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctor_leaves (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL,
      leave_date TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(doctor_id, leave_date),
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Temporary Slot Holds table (Concurrency & race condition prevention)
  db.exec(`
    CREATE TABLE IF NOT EXISTS slot_holds (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL,
      slot_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      held_by_patient_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (held_by_patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_slot_holds ON slot_holds(doctor_id, slot_date, start_time);
  `);

  // 5. Appointments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT CHECK(status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'CANCELLED_BY_DOCTOR_LEAVE')) DEFAULT 'CONFIRMED',
      symptoms_raw TEXT,
      urgency_level TEXT CHECK(urgency_level IN ('Low', 'Medium', 'High', 'LOW', 'MEDIUM', 'HIGH', NULL)),
      chief_complaint TEXT,
      doctor_questions TEXT,
      ai_previsit_summary TEXT,
      clinical_notes TEXT,
      prescription_notes TEXT,
      ai_postvisit_summary TEXT,
      calendar_event_id TEXT,
      cancellation_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Unique index preventing double booking of active appointments
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_slot 
    ON appointments(doctor_id, appointment_date, start_time) 
    WHERE status IN ('CONFIRMED');
  `);

  // 6. Prescriptions and medication items
  db.exec(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      medication_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      instructions TEXT,
      start_date TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 7. Notification Queue & Outbox with exponential backoff retry support
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      recipient_role TEXT,
      notification_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_text TEXT,
      body_html TEXT,
      status TEXT CHECK(status IN ('PENDING', 'SENT', 'FAILED', 'RETRYING')) DEFAULT 'PENDING',
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      next_retry_at INTEGER DEFAULT 0,
      error_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_notif_retry ON notifications(status, next_retry_at);
  `);

  console.log('Database initialized successfully with WAL mode & indexes.');
}

// Call on startup
initDatabase();
