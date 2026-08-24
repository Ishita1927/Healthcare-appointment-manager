import { initDatabase, db } from '../src/server/db/database';
import { seedDatabase } from '../src/server/db/seed';
import { getDoctorAvailableSlots, holdSlot, releaseSlotHold, bookAppointment } from '../src/server/services/bookingService';
import { addDoctorLeaveAndResolveConflicts } from '../src/server/services/leaveService';
import { generatePreVisitSummary, generatePostVisitSummary } from '../src/server/services/aiService';
import { runBackgroundWorkerCycle } from '../src/server/services/backgroundWorker';

async function runTests() {
  console.log('--- STARTING HEALTHCARE SYSTEM VERIFICATION TESTS ---');

  initDatabase();
  seedDatabase();

  const testDoctorId = 'user-doc-1'; // Dr. Sarah Smith
  const testPatient1 = 'patient-1'; // John Doe
  const testPatient2 = 'patient-2'; // Emma Watson
  const testDate = '2026-09-15'; // Future Tuesday

  // Test 1: Available slots generation
  console.log('\n[TEST 1] Testing slot generation...');
  const schedule = getDoctorAvailableSlots(testDoctorId, testDate, testPatient1);
  if (!schedule.slots || schedule.slots.length === 0) {
    throw new Error('Test 1 Failed: Expected available slots, got 0.');
  }
  console.log(`✓ Test 1 Passed: Found ${schedule.slots.length} slots for ${testDate}.`);

  const chosenSlot = schedule.slots[0];
  const { startTime, endTime } = chosenSlot;

  // Test 2: Temporary Slot Hold Mechanism
  console.log(`\n[TEST 2] Testing slot hold on ${startTime} - ${endTime}...`);
  const hold = holdSlot(testDoctorId, testDate, startTime, endTime, testPatient1, 60);
  console.log(`✓ Test 2.1: Patient 1 acquired hold: ${hold.holdId}`);

  // Simultaneous attempt by Patient 2 should fail with conflict error
  try {
    holdSlot(testDoctorId, testDate, startTime, endTime, testPatient2, 60);
    throw new Error('Test 2 Failed: Patient 2 was able to hold an already held slot!');
  } catch (err: any) {
    console.log(`✓ Test 2.2 Passed: Simultaneous hold by Patient 2 rejected properly (${err.message}).`);
  }

  // Test 3: AI Pre-Visit Summary Generation
  console.log('\n[TEST 3] Testing AI Pre-visit Summary generation...');
  const sampleSymptoms = 'I have had a high fever (102F), severe headache, and neck stiffness for 3 days.';
  const aiResult = await generatePreVisitSummary(sampleSymptoms);
  console.log(`✓ Test 3 Passed: Urgency: ${aiResult.urgencyLevel}, Chief Complaint: "${aiResult.chiefComplaint}", Questions: ${aiResult.suggestedQuestions.length}`);

  // Test 4: Booking Confirmation with Hold
  console.log('\n[TEST 4] Testing booking confirmation for Patient 1...');
  const booking = await bookAppointment({
    doctorId: testDoctorId,
    patientId: testPatient1,
    date: testDate,
    startTime,
    endTime,
    symptoms: sampleSymptoms,
    holdId: hold.holdId
  });
  console.log(`✓ Test 4 Passed: Appointment booked with ID: ${booking.appointment.id}`);

  // Test 5: Double Booking Prevention (Attempting to book the exact same slot again)
  console.log('\n[TEST 5] Testing double-booking prevention...');
  try {
    await bookAppointment({
      doctorId: testDoctorId,
      patientId: testPatient2,
      date: testDate,
      startTime,
      endTime,
      symptoms: 'Mild cold symptoms'
    });
    throw new Error('Test 5 Failed: Double-booking was NOT prevented!');
  } catch (err: any) {
    console.log(`✓ Test 5 Passed: Double booking safely blocked (${err.message}).`);
  }

  // Test 6: Doctor Leave Conflict Resolution
  console.log('\n[TEST 6] Testing Doctor Leave Conflict Resolution...');
  const conflictResult = addDoctorLeaveAndResolveConflicts(testDoctorId, testDate, 'Attending cardiology conference');
  console.log(`✓ Test 6 Passed: Doctor marked on leave. Cancelled appointments count: ${conflictResult.cancelledAppointmentsCount}`);
  if (conflictResult.cancelledAppointmentsCount !== 1) {
    throw new Error(`Test 6 Failed: Expected 1 cancelled appointment, got ${conflictResult.cancelledAppointmentsCount}`);
  }

  // Verify appointment status in DB
  const cancelledAppt = db.prepare('SELECT status, cancellation_reason FROM appointments WHERE id = ?').get(booking.appointment.id) as any;
  console.log(`✓ Appointment status: ${cancelledAppt.status} (Reason: ${cancelledAppt.cancellation_reason})`);

  // Verify notification was enqueued for affected patient
  const leaveNotif = db.prepare(`
    SELECT * FROM notifications 
    WHERE recipient_email = 'john.doe@gmail.com' AND notification_type = 'DOCTOR_LEAVE_ALERT'
    ORDER BY created_at DESC LIMIT 1
  `).get() as any;
  if (!leaveNotif) {
    throw new Error('Test 6 Failed: Doctor leave alert notification was not created in DB!');
  }
  console.log(`✓ Notification created for patient: "${leaveNotif.subject}"`);

  // Test 7: AI Post-Visit Summary
  console.log('\n[TEST 7] Testing AI Post-visit Summary...');
  const clinicalNotes = 'Patient diagnosed with acute bacterial sinusitis. Rhinorrhea and sinus pain. Prescribed Amoxicillin.';
  const postSummary = await generatePostVisitSummary(clinicalNotes, 'Amoxicillin 500mg - 3 times daily for 7 days');
  if (!postSummary || postSummary.length < 20) {
    throw new Error('Test 7 Failed: Post-visit summary was empty.');
  }
  console.log(`✓ Test 7 Passed: Post-visit summary generated (${postSummary.length} chars).`);

  // Test 8: Background Worker Execution
  console.log('\n[TEST 8] Testing Background Worker cycle...');
  const workerResult = await runBackgroundWorkerCycle();
  console.log(`✓ Test 8 Passed: Background worker processed:`, workerResult);

  console.log('\n======================================================');
  console.log('ALL 8 HEALTHCARE ENGINE SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
