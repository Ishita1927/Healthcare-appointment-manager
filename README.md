# ClinicPulse - Healthcare Appointment & Follow-Up Manager

A full-stack, enterprise-grade healthcare appointment platform featuring role-based portals for **Patients**, **Doctors**, and **Administrators**, powered by **LLM-driven pre-visit and post-visit summaries**, **ACID-compliant concurrency protection**, **automated doctor leave conflict resolution**, **background medication reminders**, and **Google Calendar & email notifications**.

---

## 🌟 Key Features

### 1. Dedicated Multi-Role Portals (RBAC)
- **Patient Portal**: Search doctors by specialization, view real-time availability, acquire temporary slot holds, fill clinical symptom forms, receive pre-visit AI insights, and access post-visit prescriptions & care plans.
- **Doctor Portal**: Daily appointment queue with AI Urgency Badges (Low / Medium / High), chief complaints, 3 suggested diagnostic questions, clinical notes input, prescription builder, and leave scheduling.
- **Admin Portal**: Doctor profile provisioning (hours, slot duration, fee), leave conflict remediation engine, clinic analytics, email queue monitor, and manual background worker triggers.

### 2. Concurrency & Double-Booking Protection
- Database-level unique index `UNIQUE(doctor_id, appointment_date, start_time)` on active appointments.
- Temporary **5-Minute Slot Hold** mechanism with live countdown preventing simultaneous booking collisions.
- Strict ACID transactions ensuring 100% serialization safety.

### 3. Doctor Leave Conflict Resolution
- When a doctor is marked on leave, the system atomically identifies all affected bookings, sets their status to `CANCELLED_BY_DOCTOR_LEAVE`, and enqueues high-priority email alerts to all affected patients with rescheduling links.

### 4. LLM Pre-Visit & Post-Visit Summaries
- **Pre-Visit Prompt**: Analyzes raw symptoms to return urgency level (Low / Medium / High), chief complaint, and three targeted questions for the doctor.
- **Post-Visit Prompt**: Converts doctor's clinical shorthand notes and prescriptions into an empathetic, patient-friendly summary with medication schedules and self-care steps.
- **Graceful Fallback Engine**: If Gemini/OpenAI API keys are missing or rate-limited, the system executes an intelligent medical NLP heuristic fallback so the platform **never breaks**.

### 5. Notification Reliability & Background Jobs
- Scheduled worker sweeps every 15s to dispatch daily medication reminders based on prescription frequency and retry failed email notifications using **exponential backoff** ($30\text{s} \times 2^{\text{attempt}-1}$).
- Built-in **Live In-App Outbox Viewer** to inspect all generated and sent emails directly in the UI.

### 6. Google Calendar Integration
- 1-Click direct Google Calendar event creation (`action=TEMPLATE`), RFC5545 `.ics` iCalendar file download, and full Google Calendar API OAuth 2.0 client integration.

---

## 🚀 Quickstart & How to Run

### Step 1: Install Dependencies
```bash
cd healthcare-manager
npm install
```

### Step 2: Seed Database (Auto-seeds on startup or run manually)
```bash
npm run seed
```

### Step 3: Run the Application
```bash
# Option A: Run Full-Stack Development Mode (Client on :3000, API on :5000)
npm run dev

# Option B: Run Unified Production Server (All-in-one on :5000)
npm run build
npm start
```

### 🔗 Application URL
Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)** (or **[http://localhost:5000](http://localhost:5000)** for production)

---

## 👥 Pre-Configured Demo Accounts

Use the **"Demo Switcher"** button in the top navigation bar for instant 1-click login, or use the credentials below (password is `password123` for all accounts):

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Admin** | Clinic Administrator | `admin@clinicpulse.health` | `password123` |
| **Doctor** | Dr. Sarah Smith, MD (Cardiology) | `dr.smith@clinicpulse.health` | `password123` |
| **Doctor** | Dr. Michael Chen, MD (Dermatology) | `dr.chen@clinicpulse.health` | `password123` |
| **Doctor** | Dr. Priya Patel, MD (Neurology) | `dr.patel@clinicpulse.health` | `password123` |
| **Patient** | John Doe | `john.doe@gmail.com` | `password123` |
| **Patient** | Emma Watson | `emma.watson@gmail.com` | `password123` |

---

## ⚙️ Environment Configuration (`.env`)

A `.env.example` file is included with sensible defaults:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=super_secret_jwt_key_healthcare_app_2026

# LLM Configuration (Optional - Graceful fallback included if omitted)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Email / SMTP Configuration (Optional - In-app live outbox captures all emails automatically)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=no-reply@clinicpulse.health

# Google Calendar Integration (Optional - Direct URL and iCal links always work seamlessly)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/calendar/oauth2callback
```

---

## 📡 API Documentation

### 1. Authentication (`/api/auth`)
- `POST /api/auth/register`: Register new Patient or Doctor.
- `POST /api/auth/login`: Authenticate and receive JWT token.
- `GET /api/auth/me`: Fetch current user profile.
- `GET /api/auth/demo-accounts`: List quick demo login accounts.

### 2. Patient Services (`/api/patient`)
- `GET /api/patient/doctors?specialization=Cardiology&search=Smith`: Search doctors with live filters.
- `GET /api/patient/doctors/:id/slots?date=YYYY-MM-DD`: Compute real-time available time slots.
- `POST /api/patient/hold-slot`: Acquire a 5-minute temporary slot reservation.
- `POST /api/patient/release-hold`: Release a held slot.
- `POST /api/patient/book`: Confirm booking with symptoms; returns pre-visit AI summary + calendar links.
- `GET /api/patient/appointments`: Fetch patient's appointments and AI summaries.
- `POST /api/patient/appointments/:id/cancel`: Cancel an appointment and trigger doctor notification.
- `GET /api/patient/appointments/:id/ical`: Download RFC5545 `.ics` file.
- `GET /api/patient/prescriptions`: List active medications and schedules.

### 3. Doctor Services (`/api/doctor`)
- `GET /api/doctor/appointments?date=YYYY-MM-DD&status=CONFIRMED`: Fetch doctor's queue with AI urgency level.
- `POST /api/doctor/appointments/:id/complete`: Complete consultation, submit clinical notes + prescription; triggers LLM post-visit summary and patient email.
- `GET /api/doctor/profile`: Retrieve doctor working hours and schedule.
- `POST /api/doctor/leaves`: Record doctor leave date and resolve booking conflicts.

### 4. Administrator Services (`/api/admin`)
- `GET /api/admin/stats`: Get dashboard KPIs (total patients, doctors, appointments, email retry queue).
- `GET /api/admin/doctors`: List all doctor profiles and leave dates.
- `POST /api/admin/doctors`: Provision a new doctor account with working hours and slot durations.
- `POST /api/admin/leaves`: Mark doctor on leave, cancel conflicting bookings, and notify affected patients.
- `DELETE /api/admin/leaves/:id`: Remove doctor leave.
- `POST /api/admin/worker/trigger`: Manually trigger background jobs (reminders and retry queue).

### 5. System Diagnostics & Outbox (`/api/system`)
- `GET /api/system/outbox`: View recent email notifications, delivery status, and full HTML templates.
- `GET /api/system/health`: System health and connection status.
- `POST /api/system/ai-test`: Live playground for testing LLM prompt transformations.

---

## 🗄️ Database Schema

The database uses SQLite with Write-Ahead Logging (WAL):

```
+-----------------------------------------------------------------------------------+
| users: id, email, password_hash, role (PATIENT/DOCTOR/ADMIN), name, phone         |
+-----------------------------------------------------------------------------------+
       | 1:1                                  | 1:N
       v                                      v
+-----------------------------+        +--------------------------------------------+
| doctor_profiles:            |        | appointments:                              |
| id, user_id, specialization,|        | id, patient_id, doctor_id, appointment_date|
| working_hour_start/end,     |        | start_time, end_time, status, symptoms_raw |
| slot_duration_minutes,      |        | urgency_level, chief_complaint,            |
| working_days, fee           |        | doctor_questions, ai_previsit_summary,     |
+-----------------------------+        | clinical_notes, prescription_notes,        |
       | 1:N                           | ai_postvisit_summary, cancellation_reason  |
       v                               +--------------------------------------------+
+-----------------------------+                       | 1:N
| doctor_leaves:              |                       v
| id, doctor_id, leave_date,  |        +--------------------------------------------+
| reason                      |        | prescriptions:                             |
+-----------------------------+        | id, appointment_id, patient_id, doctor_id, |
                                       | medication_name, dosage, frequency,        |
+-----------------------------+        | duration_days, instructions, active        |
| slot_holds:                 |        +--------------------------------------------+
| id, doctor_id, slot_date,   |
| start_time, end_time,       |        +--------------------------------------------+
| held_by_patient_id,         |        | notifications:                             |
| expires_at                  |        | id, recipient_email, notification_type,    |
+-----------------------------+        | subject, body_html, status, attempts,      |
                                       | next_retry_at, error_message               |
                                       +--------------------------------------------+
```

---

## 🧠 LLM Prompts & Graceful Fallback Strategy

### Pre-Visit Prompt Specification:
```text
Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>
```
**JSON Output Structure:**
```json
{
  "urgencyLevel": "Low" | "Medium" | "High",
  "chiefComplaint": "Concise primary complaint summary",
  "suggestedQuestions": [
    "Question 1 for doctor to ask",
    "Question 2 for doctor to ask",
    "Question 3 for doctor to ask"
  ],
  "fullSummary": "Clinical overview"
}
```

### Post-Visit Prompt Specification:
```text
Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>
```

---

## 📅 Google Calendar Setup Steps

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project and enable the **Google Calendar API**.
3. Create **OAuth 2.0 Client IDs** (Web application) and add `http://localhost:5000/api/calendar/oauth2callback` to Authorized Redirect URIs.
4. Copy `Client ID` and `Client Secret` into your `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```
5. *Note:* In addition to OAuth 2.0 API calls, ClinicPulse automatically generates direct 1-click Google Calendar links and `.ics` iCalendar downloads that work out of the box with zero external configuration required.

---

## 🧪 Automated Testing

Execute the complete end-to-end integration and concurrency test suite:
```bash
npm test
```
Verifies:
1. Dynamic slot calculation.
2. 5-Minute temporary slot hold mechanism.
3. Simultaneous double-booking rejection.
4. Doctor leave conflict detection and automated patient cancellation & notifications.
5. AI pre-visit and post-visit summaries.
6. Background worker medication reminders and notification retry queues.
