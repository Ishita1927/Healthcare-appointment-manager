# 🛠️ System Design Write-Up: Healthcare Appointment Manager

## 1. Concurrency & Double-Booking Prevention

Preventing overlapping appointments across simultaneous booking attempts is critical to system integrity. The application employs a multi-layered concurrency strategy combining database-level unique constraints, isolated atomic transactions, and optimistic locking principles to eliminate race conditions under high concurrent traffic.

### Database Constraints & Transactional Control
Each appointment slot is defined by a composite key identity consisting of `(doctor_id, appointment_date, start_time)`. 
* **Unique Indexes:** A conditional unique index on `UNIQUE(doctor_id, appointment_date, start_time)` for non-cancelled statuses prevents duplicate entries directly at the database engine level.
* **ACID Transactions:** When a patient attempts to reserve a slot, the operation executes within an isolated database transaction:
  ```sql
  BEGIN IMMEDIATE TRANSACTION;
  
  -- Step 1: Check existing slot availability
  SELECT id FROM appointments 
  WHERE doctor_id = ? 
    AND appointment_date = ? 
    AND start_time = ? 
    AND (status IN ('BOOKED', 'HELD') AND (status != 'HELD' OR held_until > CURRENT_TIMESTAMP));

  -- Step 2: Conditionally insert reservation if free
  INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, status, held_until) 
  VALUES (?, ?, ?, ?, 'HELD', DATETIME('now', '+5 minutes'));
  
  COMMIT;S
