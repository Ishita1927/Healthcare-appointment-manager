import bcrypt from 'bcryptjs';
import { db } from './database';

export function seedDatabase(forceReset = false) {
  const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 10);
  const defaultPassword = hashPassword('password123');

  if (forceReset) {
    console.log('Force resetting database with Indian Healthcare ecosystem...');
    db.exec(`
      DELETE FROM notifications;
      DELETE FROM prescriptions;
      DELETE FROM appointments;
      DELETE FROM slot_holds;
      DELETE FROM doctor_leaves;
      DELETE FROM doctor_profiles;
      DELETE FROM users;
    `);
  } else {
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (existingUsers.count > 0) {
      console.log('Database already has data. Force resetting to apply 10+ departments & Indian profiles...');
      db.exec(`
        DELETE FROM notifications;
        DELETE FROM prescriptions;
        DELETE FROM appointments;
        DELETE FROM slot_holds;
        DELETE FROM doctor_leaves;
        DELETE FROM doctor_profiles;
        DELETE FROM users;
      `);
    }
  }

  console.log('Seeding comprehensive Indian Healthcare Clinic with 10+ departments and 24+ doctors...');

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertDoctorProfile = db.prepare(`
    INSERT INTO doctor_profiles (id, user_id, specialization, bio, working_hour_start, working_hour_end, slot_duration_minutes, working_days, consultation_fee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Admin
  insertUser.run(
    'admin-1',
    'admin@clinicpulse.in',
    defaultPassword,
    'ADMIN',
    'Dr. Vikramaditya Sen (Medical Director & Administrator)',
    '+91-98110-12345'
  );

  // 2. 12 Departments with at least 2 Doctors each (Total 24 Doctors)
  const indianDoctors = [
    // 1. Cardiology (Heart & Vascular)
    {
      id: 'doc-cardio-1',
      userId: 'user-doc-cardio-1',
      email: 'dr.rajesh.sharma@clinicpulse.in',
      name: 'Dr. Rajesh Sharma, MD, DM (Cardiology)',
      phone: '+91-98201-11001',
      specialization: 'Cardiology',
      bio: 'Senior Interventional Cardiologist with 18 years of clinical experience at AIIMS & Fortis, specializing in coronary angioplasty, hypertension, and preventive cardiovascular wellness.',
      start: '09:00',
      end: '16:30',
      duration: 30,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 1200.0
    },
    {
      id: 'doc-cardio-2',
      userId: 'user-doc-cardio-2',
      email: 'dr.ananya.iyer@clinicpulse.in',
      name: 'Dr. Ananya Iyer, MD, DNB (Cardiology)',
      phone: '+91-98201-11002',
      specialization: 'Cardiology',
      bio: 'Specialist in non-invasive cardiology, pediatric cardiac screenings, arrhythmia management, and heart failure rehabilitation.',
      start: '10:00',
      end: '18:00',
      duration: 30,
      days: JSON.stringify([1, 2, 3, 4, 5]),
      fee: 1000.0
    },

    // 2. Dermatology & Cosmetology
    {
      id: 'doc-derma-1',
      userId: 'user-doc-derma-1',
      email: 'dr.vikram.malhotra@clinicpulse.in',
      name: 'Dr. Vikram Malhotra, MD (Dermatology & Venereology)',
      phone: '+91-98201-11003',
      specialization: 'Dermatology',
      bio: 'Consultant Dermatologist and Trichologist with 12 years of experience treating chronic eczema, psoriasis, acne vulgaris, and laser skin treatments.',
      start: '09:30',
      end: '17:00',
      duration: 20,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 800.0
    },
    {
      id: 'doc-derma-2',
      userId: 'user-doc-derma-2',
      email: 'dr.pooja.nair@clinicpulse.in',
      name: 'Dr. Pooja Nair, MD, DVD (Skin & Aesthetics)',
      phone: '+91-98201-11004',
      specialization: 'Dermatology',
      bio: 'Aesthetic dermatologist and clinical researcher specializing in pediatric skin conditions, allergy patch testing, and anti-aging therapies.',
      start: '11:00',
      end: '19:00',
      duration: 20,
      days: JSON.stringify([1, 3, 4, 5, 6]),
      fee: 900.0
    },

    // 3. Neurology & Neurosurgery
    {
      id: 'doc-neuro-1',
      userId: 'user-doc-neuro-1',
      email: 'dr.suresh.kulkarni@clinicpulse.in',
      name: 'Dr. Suresh Kulkarni, MD, DM (Neurology)',
      phone: '+91-98201-11005',
      specialization: 'Neurology',
      bio: 'Leading Neurologist with 20 years experience in stroke management, epilepsy, Parkinson’s disease, and chronic migraine therapy.',
      start: '09:00',
      end: '15:00',
      duration: 30,
      days: JSON.stringify([1, 2, 3, 4, 5]),
      fee: 1500.0
    },
    {
      id: 'doc-neuro-2',
      userId: 'user-doc-neuro-2',
      email: 'dr.meera.nambiar@clinicpulse.in',
      name: 'Dr. Meera Nambiar, MD, DNB (Neurology)',
      phone: '+91-98201-11006',
      specialization: 'Neurology',
      bio: 'Consultant Neurologist specializing in neuropathy, multiple sclerosis, vertigo disorders, and sleep apnea evaluation.',
      start: '12:00',
      end: '18:30',
      duration: 30,
      days: JSON.stringify([2, 3, 4, 5, 6]),
      fee: 1300.0
    },

    // 4. Orthopaedics & Joint Replacement
    {
      id: 'doc-ortho-1',
      userId: 'user-doc-ortho-1',
      email: 'dr.rohan.joshi@clinicpulse.in',
      name: 'Dr. Rohan Joshi, MS (Orthopaedics), MCh',
      phone: '+91-98201-11007',
      specialization: 'Orthopaedics',
      bio: 'Joint replacement and arthroscopy surgeon specializing in knee and hip replacement, sports injuries, and complex fracture trauma care.',
      start: '08:30',
      end: '16:00',
      duration: 30,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 1100.0
    },
    {
      id: 'doc-ortho-2',
      userId: 'user-doc-ortho-2',
      email: 'dr.kavita.rao@clinicpulse.in',
      name: 'Dr. Kavita Rao, MS (Ortho), Fellowship in Spine Surgery',
      phone: '+91-98201-11008',
      specialization: 'Orthopaedics',
      bio: 'Spine specialist and pediatric orthopaedic consultant focusing on sciatica, degenerative disc disorders, and posture rehabilitation.',
      start: '10:00',
      end: '17:30',
      duration: 30,
      days: JSON.stringify([1, 2, 4, 5, 6]),
      fee: 1000.0
    },

    // 5. Pediatrics & Child Care
    {
      id: 'doc-pedia-1',
      userId: 'user-doc-pedia-1',
      email: 'dr.amit.verma@clinicpulse.in',
      name: 'Dr. Amit Verma, MD (Pediatrics), FIAP',
      phone: '+91-98201-11009',
      specialization: 'Pediatrics',
      bio: 'Senior Pediatrician with 15 years experience in newborn care, child immunization, developmental tracking, and infectious diseases.',
      start: '09:00',
      end: '16:00',
      duration: 20,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 700.0
    },
    {
      id: 'doc-pedia-2',
      userId: 'user-doc-pedia-2',
      email: 'dr.sunita.deshmukh@clinicpulse.in',
      name: 'Dr. Sunita Deshmukh, DCH, DNB (Pediatrics)',
      phone: '+91-98201-11010',
      specialization: 'Pediatrics',
      bio: 'Child health expert specializing in pediatric asthma, childhood allergies, nutrition guidance, and adolescent health.',
      start: '11:00',
      end: '18:00',
      duration: 20,
      days: JSON.stringify([1, 2, 3, 5, 6]),
      fee: 750.0
    },

    // 6. General Medicine & Diabetology
    {
      id: 'doc-genmed-1',
      userId: 'user-doc-genmed-1',
      email: 'dr.deepak.mehta@clinicpulse.in',
      name: 'Dr. Deepak Mehta, MD (General Medicine), C.Diab',
      phone: '+91-98201-11011',
      specialization: 'General Medicine',
      bio: 'Physician and Diabetologist with 16 years of expertise in Type 1 & 2 diabetes management, hypertension, thyroid conditions, and viral fever care.',
      start: '08:30',
      end: '16:00',
      duration: 20,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 600.0
    },
    {
      id: 'doc-genmed-2',
      userId: 'user-doc-genmed-2',
      email: 'dr.shalini.sen@clinicpulse.in',
      name: 'Dr. Shalini Sen, MD (Internal Medicine)',
      phone: '+91-98201-11012',
      specialization: 'General Medicine',
      bio: 'Internal medicine consultant focusing on geriatric wellness, lifestyle metabolic disorders, chronic pain management, and preventive health screenings.',
      start: '10:00',
      end: '17:30',
      duration: 20,
      days: JSON.stringify([1, 2, 3, 4, 5]),
      fee: 650.0
    },

    // 7. Gynecology & Obstetrics
    {
      id: 'doc-gyn-1',
      userId: 'user-doc-gyn-1',
      email: 'dr.neha.agarwal@clinicpulse.in',
      name: 'Dr. Neha Agarwal, MS (OBG), FICOG',
      phone: '+91-98201-11013',
      specialization: 'Gynecology',
      bio: 'Senior Obstetrician and Gynecologist specializing in high-risk pregnancy care, PCOS/PCOD management, infertility evaluations, and laparoscopic surgery.',
      start: '09:00',
      end: '16:00',
      duration: 30,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 900.0
    },
    {
      id: 'doc-gyn-2',
      userId: 'user-doc-gyn-2',
      email: 'dr.ritu.saxena@clinicpulse.in',
      name: 'Dr. Ritu Saxena, DGO, DNB (Obstetrics & Gynaecology)',
      phone: '+91-98201-11014',
      specialization: 'Gynecology',
      bio: 'Consultant Gynecologist focusing on adolescent reproductive health, menopause clinic, prenatal counseling, and cervical cancer screenings.',
      start: '11:00',
      end: '18:30',
      duration: 30,
      days: JSON.stringify([1, 2, 3, 5, 6]),
      fee: 850.0
    },

    // 8. ENT (Ear, Nose, Throat) & Head-Neck
    {
      id: 'doc-ent-1',
      userId: 'user-doc-ent-1',
      email: 'dr.alok.chatterjee@clinicpulse.in',
      name: 'Dr. Alok Chatterjee, MS (ENT), DLO',
      phone: '+91-98201-11015',
      specialization: 'ENT',
      bio: 'ENT Surgeon with 14 years experience in endoscopic sinus surgery, micro-ear surgery, hearing loss treatments, and chronic tonsillitis.',
      start: '09:30',
      end: '16:30',
      duration: 20,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 750.0
    },
    {
      id: 'doc-ent-2',
      userId: 'user-doc-ent-2',
      email: 'dr.vandana.hegde@clinicpulse.in',
      name: 'Dr. Vandana Hegde, MS (ENT), Fellowship in Rhinology',
      phone: '+91-98201-11016',
      specialization: 'ENT',
      bio: 'Specialist in allergic rhinitis, snoring/sleep surgery, voice disorders, and pediatric ENT consultations.',
      start: '11:30',
      end: '18:30',
      duration: 20,
      days: JSON.stringify([1, 3, 4, 5, 6]),
      fee: 700.0
    },

    // 9. Gastroenterology & Hepatology
    {
      id: 'doc-gastro-1',
      userId: 'user-doc-gastro-1',
      email: 'dr.harish.bhat@clinicpulse.in',
      name: 'Dr. Harish Bhat, MD, DM (Gastroenterology)',
      phone: '+91-98201-11017',
      specialization: 'Gastroenterology',
      bio: 'Consultant Gastroenterologist specializing in acidity/GERD, fatty liver disease, IBS, ulcerative colitis, and diagnostic endoscopies.',
      start: '09:00',
      end: '15:30',
      duration: 30,
      days: JSON.stringify([1, 2, 3, 4, 5]),
      fee: 1100.0
    },
    {
      id: 'doc-gastro-2',
      userId: 'user-doc-gastro-2',
      email: 'dr.divya.menon@clinicpulse.in',
      name: 'Dr. Divya Menon, MD, DNB (Medical Gastroenterology)',
      phone: '+91-98201-11018',
      specialization: 'Gastroenterology',
      bio: 'Expert in chronic liver disorders, pancreatitis, celiac disease, and clinical nutrition for digestive health.',
      start: '11:00',
      end: '18:00',
      duration: 30,
      days: JSON.stringify([2, 3, 4, 5, 6]),
      fee: 1050.0
    },

    // 10. Psychiatry & Mental Health
    {
      id: 'doc-psych-1',
      userId: 'user-doc-psych-1',
      email: 'dr.siddharth.kapoor@clinicpulse.in',
      name: 'Dr. Siddharth Kapoor, MD (Psychiatry), DPM',
      phone: '+91-98201-11019',
      specialization: 'Psychiatry',
      bio: 'Psychiatrist and Behavioral Therapist with 13 years experience in anxiety disorders, clinical depression, OCD, and stress management.',
      start: '10:00',
      end: '18:00',
      duration: 45,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 1400.0
    },
    {
      id: 'doc-psych-2',
      userId: 'user-doc-psych-2',
      email: 'dr.pallavi.mukherjee@clinicpulse.in',
      name: 'Dr. Pallavi Mukherjee, MD (Psychiatry), MRCPsych',
      phone: '+91-98201-11020',
      specialization: 'Psychiatry',
      bio: 'Consultant in adult neuropsychiatry, sleep disorders, cognitive behavioral therapy (CBT), and burnout recovery for professionals.',
      start: '12:00',
      end: '19:30',
      duration: 45,
      days: JSON.stringify([1, 2, 4, 5, 6]),
      fee: 1350.0
    },

    // 11. Pulmonology (Chest & Respiratory Medicine)
    {
      id: 'doc-pulmo-1',
      userId: 'user-doc-pulmo-1',
      email: 'dr.sandeep.pillai@clinicpulse.in',
      name: 'Dr. Sandeep Pillai, MD (Pulmonary Medicine), DTCD',
      phone: '+91-98201-11021',
      specialization: 'Pulmonology',
      bio: 'Chest physician specializing in asthma, COPD, post-COVID lung recovery, pneumonia, and sleep-related breathing disorders.',
      start: '09:00',
      end: '16:00',
      duration: 25,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 850.0
    },
    {
      id: 'doc-pulmo-2',
      userId: 'user-doc-pulmo-2',
      email: 'dr.geeta.krishnan@clinicpulse.in',
      name: 'Dr. Geeta Krishnan, DNB (Respiratory Diseases)',
      phone: '+91-98201-11022',
      specialization: 'Pulmonology',
      bio: 'Expert in allergy immunotherapy, interstitial lung diseases (ILD), occupational lung health, and spirometry diagnostics.',
      start: '11:00',
      end: '18:00',
      duration: 25,
      days: JSON.stringify([1, 2, 3, 5, 6]),
      fee: 800.0
    },

    // 12. Ophthalmology (Eye Care)
    {
      id: 'doc-ophthal-1',
      userId: 'user-doc-ophthal-1',
      email: 'dr.arjun.reddy@clinicpulse.in',
      name: 'Dr. Arjun Reddy, MS (Ophthalmology), FICO',
      phone: '+91-98201-11023',
      specialization: 'Ophthalmology',
      bio: 'Cataract, refractive, and cornea surgeon specializing in LASIK evaluation, computer vision syndrome, and glaucoma management.',
      start: '09:30',
      end: '16:30',
      duration: 20,
      days: JSON.stringify([1, 2, 3, 4, 5, 6]),
      fee: 700.0
    },
    {
      id: 'doc-ophthal-2',
      userId: 'user-doc-ophthal-2',
      email: 'dr.tanvi.gokhale@clinicpulse.in',
      name: 'Dr. Tanvi Gokhale, DNB, Fellowship in Medical Retina',
      phone: '+91-98201-11024',
      specialization: 'Ophthalmology',
      bio: 'Retina specialist focusing on diabetic retinopathy screenings, macular degeneration, and pediatric vision health.',
      start: '11:00',
      end: '18:30',
      duration: 20,
      days: JSON.stringify([1, 2, 4, 5, 6]),
      fee: 750.0
    }
  ];

  for (const doc of indianDoctors) {
    insertUser.run(doc.userId, doc.email, defaultPassword, 'DOCTOR', doc.name, doc.phone);
    insertDoctorProfile.run(doc.id, doc.userId, doc.specialization, doc.bio, doc.start, doc.end, doc.duration, doc.days, doc.fee);
  }

  // 3. Indian Patients
  const indianPatients = [
    {
      id: 'patient-in-1',
      email: 'rahul.verma@gmail.com',
      name: 'Rahul Verma',
      phone: '+91-98765-43210'
    },
    {
      id: 'patient-in-2',
      email: 'priya.sharma@gmail.com',
      name: 'Priya Sharma',
      phone: '+91-98765-43211'
    },
    {
      id: 'patient-in-3',
      email: 'sneha.reddy@gmail.com',
      name: 'Sneha Reddy',
      phone: '+91-98765-43212'
    },
    {
      id: 'patient-in-4',
      email: 'aarav.patel@gmail.com',
      name: 'Aarav Patel',
      phone: '+91-98765-43213'
    },
    {
      id: 'patient-in-5',
      email: 'ananya.deshmukh@gmail.com',
      name: 'Ananya Deshmukh',
      phone: '+91-98765-43214'
    }
  ];

  for (const p of indianPatients) {
    insertUser.run(p.id, p.email, defaultPassword, 'PATIENT', p.name, p.phone);
  }

  // 4. Sample Completed Consultation with Indian Currency & Prescription
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const insertAppt = db.prepare(`
    INSERT INTO appointments (
      id, patient_id, doctor_id, appointment_date, start_time, end_time, status,
      symptoms_raw, urgency_level, chief_complaint, doctor_questions, ai_previsit_summary,
      clinical_notes, prescription_notes, ai_postvisit_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAppt.run(
    'appt-sample-in-1',
    'patient-in-1',
    'user-doc-cardio-1',
    yesterday,
    '10:00',
    '10:30',
    'COMPLETED',
    'Experiencing mild chest heaviness during brisk morning walks and occasional palpitations for 10 days.',
    'Medium',
    'Exertional chest heaviness and palpitations for 10 days',
    JSON.stringify([
      'Does the discomfort subside when you rest or sit down?',
      'Do you have any family history of early heart disease or high blood pressure?',
      'Are you taking any ayurvedic or allopathic medications currently?'
    ]),
    'AI Assessment: Exertional cardiac symptoms. Requires blood pressure monitoring and lipid profile check. Urgency: Medium.',
    'Patient evaluated for exertional chest heaviness. Resting ECG normal. BP 138/88 mmHg. Advised 2D Echocardiogram, Fasting Lipid Profile, and TSH. Prescribed Telmisartan 40mg once daily.',
    'Tab. Telmisartan 40mg - 1 tablet once daily morning after breakfast for 30 days.\nDietary Advice: Low salt diet, avoid fried snacks.',
    '### Patient-Friendly Consultation Summary\n\n**Doctor Visited:** Dr. Rajesh Sharma (Cardiology)\n\n**Diagnosis & Findings:**\nYour in-clinic ECG was reassuring. Your blood pressure was slightly elevated (138/88). To keep your heart healthy and blood pressure optimal, you have been prescribed Telmisartan.\n\n**Medication Schedule:**\n- **Telmisartan 40mg**: Take 1 tablet daily every morning after breakfast for 30 days.\n\n**Follow-up & Self Care:**\n1. Get fasting lipid profile and 2D Echo done within 10 days.\n2. Limit dietary salt and walk 30 minutes daily at a comfortable pace.\n3. Follow up with reports in 2 weeks.'
  );

  // Sample Prescription Item
  const insertPrescription = db.prepare(`
    INSERT INTO prescriptions (id, appointment_id, patient_id, doctor_id, medication_name, dosage, frequency, duration_days, instructions, start_date, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPrescription.run(
    'rx-sample-in-1',
    'appt-sample-in-1',
    'patient-in-1',
    'user-doc-cardio-1',
    'Telmisartan',
    '40mg',
    'Once daily (Morning)',
    30,
    'Take 1 tablet after breakfast with plain water.',
    yesterday,
    1
  );

  console.log(`Database successfully seeded with 24 Indian Specialist Doctors across 12 Departments!`);
}

if (require.main === module) {
  seedDatabase(true);
}
