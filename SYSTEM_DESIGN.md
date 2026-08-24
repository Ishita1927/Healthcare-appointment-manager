# ClinicPulse Healthcare Appointment & Follow-Up Manager
## System Design Document (800 Words Maximum)

### 1. Executive Summary & Architecture
ClinicPulse is an enterprise-grade healthcare consultation and follow-up management platform engineered to eliminate scheduling collisions, bridge patient-doctor clinical communication via Large Language Models (LLMs), and maintain resilient background communication channels. The system is built on a full-stack Node.js/TypeScript architecture backed by an ACID-compliant SQLite engine utilizing Write-Ahead Logging (WAL) for high-throughput concurrent operations.

---

### 2. Concurrency & Double-Booking Prevention
In high-demand medical practices, concurrent requests for the same time slot can lead to catastrophic double-booking. ClinicPulse mitigates race conditions through a two-tiered defensive synchronization model:

1. **Database-Level Partial Unique Index:**
   A unique index is enforced at the database engine level:
   ```sql
   CREATE UNIQUE INDEX idx_unique_active_slot 
   ON appointments(doctor_id, appointment_date, start_time) 
   WHERE status = 'CONFIRMED';
   ```
   Even under extreme simultaneous concurrency across distributed processes, the storage engine guarantees strict isolation, immediately failing secondary write transactions with an index conflict rather than creating inconsistent states.

2. **ACID Transaction Isolation:**
   All slot confirmations run inside exclusive transactions. Prior to committing a booking, the query atomically validates that:
   - No active confirmed appointment exists for `(doctor_id, date, start_time)`.
   - The doctor is not marked on scheduled medical/personal leave.
   - Any active temporary slot hold is owned by the requesting patient session.

---

### 3. Temporary Slot Hold Mechanism
Because patients are required to complete a comprehensive symptom intake form prior to confirming their consultation, a critical race window exists between selecting a slot and final submission. ClinicPulse resolves this with a temporary reservation layer:

1. **Deterministic Slot Reservation:**
   Upon selecting a slot, an ephemeral record is inserted into the `slot_holds` table with an expiration timestamp:
   $$\text{expires\_at} = \text{Date.now}() + 300\,000\text{ ms } (5\text{ minutes})$$
   During this window, schedule calculation queries mark the slot as `isHeld: true`, preventing other patients from selecting or holding it.

2. **TTL & Non-Blocking Auto-Expiry:**
   Holds automatically expire if the patient abandons the booking flow. Expiration is handled through two complementary mechanisms:
   - **Lazy Deletion:** Every slot query and hold request executes `DELETE FROM slot_holds WHERE expires_at <= CURRENT_TIMESTAMP`.
   - **Active Worker Sweeps:** The background daemon scans and purges stale holds every 15 seconds, returning unconfirmed slots back to the public pool without locking active tables.

---

### 4. Doctor Leave Conflict Handling Engine
When an administrator or practitioner schedules leave on a date containing pre-existing confirmed appointments, automated conflict remediation executes atomically:

1. **Atomic Batch Conflict Detection & Status Transition:**
   Inside a single database transaction:
   - The leave date is recorded in `doctor_leaves`.
   - All active `CONFIRMED` appointments matching `(doctor_id, leave_date)` are transitioned to `CANCELLED_BY_DOCTOR_LEAVE`.
   - The system sets `cancellation_reason` with the administrator's leave notes.
   - All active slot holds on that date are purged.

2. **Automated Patient Remediation & Alerts:**
   The conflict engine identifies every affected patient and dispatches high-priority `DOCTOR_LEAVE_ALERT` email notifications containing the cancellation rationale, physician details, and one-click rescheduling shortcuts.

3. **Calendar Synchronization:**
   Corresponding Google Calendar events are marked cancelled or purged via the Google Calendar API.

---

### 5. Notification Reliability & Exponential Backoff Retry Engine
External email services (SMTP, SendGrid, Mailgun) are susceptible to rate limiting, network partitions, and transient downstream failures. ClinicPulse guarantees reliable delivery via a durable transactional outbox:

1. **Persistent Notification Queue:**
   Notifications are enqueued in a durable `notifications` table with status `PENDING`, full recipient metadata, HTML payload, and retry counters.

2. **Exponential Backoff Algorithm:**
   When a delivery attempt fails, the retry interval is computed exponentially:
   $$\text{Delay}(\text{attempt}) = \min\left(30\text{s} \times 2^{\text{attempt} - 1},\, 600\text{s}\right)$$
   The item status is set to `RETRYING` with `next_retry_at` set to $\text{now} + \text{Delay}$.

3. **Background Worker Daemon:**
   A background processor sweeps the queue every 15 seconds, executing eligible retries up to `max_attempts = 5`. Items exceeding the threshold are transitioned to `FAILED` with logged diagnostic error traces.

4. **Medication Reminder Dispatcher:**
   The background engine continuously checks active prescriptions, computing daily intervals and dispatching automated reminders to patients based on their prescribed medication schedule.
