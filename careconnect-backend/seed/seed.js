/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const Department = require('../models/Department');
const Room = require('../models/Room');
const Bed = require('../models/Bed');
const Medicine = require('../models/Medicine');
const AuditLog = require('../models/AuditLog');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const ReportComparison = require('../models/ReportComparison');
const FollowUp = require('../models/FollowUp');
const Referral = require('../models/Referral');
const PatientSummary = require('../models/PatientSummary');
const Prescription = require('../models/Prescription');

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB for seeding...');

  // Wipe existing demo data (development convenience only — never run this
  // against a production database).
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    Doctor.deleteMany({}),
    Hospital.deleteMany({}),
    Department.deleteMany({}),
    Room.deleteMany({}),
    Bed.deleteMany({}),
    Medicine.deleteMany({}),
    AuditLog.deleteMany({}),
    Appointment.deleteMany({}),
    MedicalRecord.deleteMany({}),
    ReportComparison.deleteMany({}),
    FollowUp.deleteMany({}),
    Referral.deleteMany({}),
    PatientSummary.deleteMany({}),
    Prescription.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash('Password@123', 12);

  const hospital = await Hospital.create({
    name: 'CareConnect General Hospital',
    address: { line1: 'MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    contact: { phone: '+91-9999999999', email: 'contact@careconnect.example' },
    facilities: ['ICU', 'Emergency', 'Pharmacy', 'Lab'],
  });

  const cardiology = await Department.create({ name: 'Cardiology', description: 'Heart care', hospitalId: hospital._id });
  const general = await Department.create({ name: 'General Medicine', description: 'General physician consultations', hospitalId: hospital._id });
  const pediatrics = await Department.create({ name: 'Pediatrics', description: 'Child healthcare', hospitalId: hospital._id });
  hospital.departments = [cardiology._id, general._id, pediatrics._id];
  await hospital.save();

  const superAdminUser = await User.create({
    name: 'Super Admin',
    email: 'superadmin@careconnect.example',
    passwordHash,
    role: 'SUPER_ADMIN',
    emailVerified: true,
  });

  const hospitalAdminUser = await User.create({
    name: 'Hospital Admin',
    email: 'hospitaladmin@careconnect.example',
    passwordHash,
    role: 'HOSPITAL_ADMIN',
    hospitalId: hospital._id,
  });

  const pharmacyAdminUser = await User.create({
    name: 'Pharmacy Admin',
    email: 'pharmacyadmin@careconnect.example',
    passwordHash,
    role: 'PHARMACY_ADMIN',
  });

  const doctorUser = await User.create({
    name: 'Dr. Anjali Sharma',
    email: 'doctor@careconnect.example',
    passwordHash,
    role: 'DOCTOR',
    hospitalId: hospital._id,
    emailVerified: true,
  });
  const doctor = await Doctor.create({
    userId: doctorUser._id,
    departmentId: cardiology._id,
    hospitalId: hospital._id,
    qualification: 'MBBS, MD (Cardiology)',
    specialization: 'Cardiologist',
    experience: 10,
    consultationFee: 800,
    bio: 'Experienced cardiologist focused on preventive heart care.',
    professionalCategory: 'MEDICAL_DOCTOR',
    consultationModes: ['IN_PERSON', 'VIDEO', 'AUDIO', 'CHAT'],
    // DEMO DATA ONLY: marked verified so the seeded doctor is bookable. Real doctors must go through
    // the document-review workflow (PATCH /api/admin/doctors/:id/verification).
    verification: { status: 'VERIFIED', verifiedAt: new Date(), method: 'MIGRATION', notes: 'Seeded demo doctor' },
    availability: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 },
      { dayOfWeek: 3, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 },
      { dayOfWeek: 5, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 },
    ],
  });

  const patientUser = await User.create({
    name: 'Rohan Verma',
    email: 'patient@careconnect.example',
    passwordHash,
    role: 'PATIENT',
  });
  const patient = await Patient.create({
    userId: patientUser._id,
    dateOfBirth: new Date('1995-06-15'),
    gender: 'MALE',
    bloodGroup: 'O+',
    address: { line1: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560034' },
    emergencyContact: { name: 'Priya Verma', phone: '+91-9876543210', relation: 'Sister' },
    allergies: ['Penicillin'],
    medicalHistory: ['Mild asthma', 'Borderline dyslipidemia'],
    currentMedicines: ['Metformin 500mg', 'Salbutamol inhaler PRN'],
  });

  // Seed active consultation appointment for doctor-patient relationship
  const todayDate = new Date();
  todayDate.setUTCHours(0, 0, 0, 0);

  const appointment = await Appointment.create({
    patientId: patient._id,
    doctorId: doctor._id,
    hospitalId: hospital._id,
    departmentId: cardiology._id,
    date: todayDate,
    startTime: '10:00',
    endTime: '10:20',
    consultationType: 'VIDEO',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    notes: 'Follow-up for metabolic profile evaluation and cardiovascular risk assessment.',
  });

  // Seed baseline and follow-up medical records with extracted parameters
  const baselineRecord = await MedicalRecord.create({
    patientId: patient._id,
    doctorId: doctor._id,
    type: 'LAB_REPORT',
    title: 'Baseline Metabolic & Lipid Profile',
    description: 'Fasting Blood Sugar: 128 mg/dL, HbA1c: 7.1%, Total Cholesterol: 235 mg/dL, Triglycerides: 180 mg/dL, Serum Creatinine: 1.0 mg/dL',
    rawText: 'Fasting Blood Sugar: 128 mg/dL\nHbA1c: 7.1 %\nTotal Cholesterol: 235 mg/dL\nTriglycerides: 180 mg/dL\nSerum Creatinine: 1.0 mg/dL',
    extractedParameters: [
      { name: 'Fasting Blood Sugar', value: 128, unit: 'mg/dL', referenceRange: '70 - 99 mg/dL', minRange: 70, maxRange: 99, flag: 'HIGH' },
      { name: 'HbA1c', value: 7.1, unit: '%', referenceRange: '4.0 - 5.6 %', minRange: 4.0, maxRange: 5.6, flag: 'HIGH' },
      { name: 'Total Cholesterol', value: 235, unit: 'mg/dL', referenceRange: '125 - 200 mg/dL', minRange: 125, maxRange: 200, flag: 'HIGH' },
      { name: 'Triglycerides', value: 180, unit: 'mg/dL', referenceRange: '50 - 150 mg/dL', minRange: 50, maxRange: 150, flag: 'HIGH' },
      { name: 'Serum Creatinine', value: 1.0, unit: 'mg/dL', referenceRange: '0.6 - 1.2 mg/dL', minRange: 0.6, maxRange: 1.2, flag: 'NORMAL' },
    ],
  });

  const currentRecord = await MedicalRecord.create({
    patientId: patient._id,
    doctorId: doctor._id,
    type: 'LAB_REPORT',
    title: '3-Month Follow-up Metabolic & Lipid Panel',
    description: 'Fasting Blood Sugar: 104 mg/dL, HbA1c: 6.3%, Total Cholesterol: 192 mg/dL, Triglycerides: 138 mg/dL, Serum Creatinine: 0.9 mg/dL',
    rawText: 'Fasting Blood Sugar: 104 mg/dL\nHbA1c: 6.3 %\nTotal Cholesterol: 192 mg/dL\nTriglycerides: 138 mg/dL\nSerum Creatinine: 0.9 mg/dL',
    extractedParameters: [
      { name: 'Fasting Blood Sugar', value: 104, unit: 'mg/dL', referenceRange: '70 - 99 mg/dL', minRange: 70, maxRange: 99, flag: 'HIGH' },
      { name: 'HbA1c', value: 6.3, unit: '%', referenceRange: '4.0 - 5.6 %', minRange: 4.0, maxRange: 5.6, flag: 'HIGH' },
      { name: 'Total Cholesterol', value: 192, unit: 'mg/dL', referenceRange: '125 - 200 mg/dL', minRange: 125, maxRange: 200, flag: 'NORMAL' },
      { name: 'Triglycerides', value: 138, unit: 'mg/dL', referenceRange: '50 - 150 mg/dL', minRange: 50, maxRange: 150, flag: 'NORMAL' },
      { name: 'Serum Creatinine', value: 0.9, unit: 'mg/dL', referenceRange: '0.6 - 1.2 mg/dL', minRange: 0.6, maxRange: 1.2, flag: 'NORMAL' },
    ],
  });

  // Seed Report Comparison
  await ReportComparison.create({
    patientId: patient._id,
    doctorId: doctor._id,
    baselineRecordId: baselineRecord._id,
    currentRecordId: currentRecord._id,
    parameters: [
      { name: 'Fasting Blood Sugar', baselineValue: 128, currentValue: 104, unit: 'mg/dL', delta: -24, percentChange: -18.8, referenceRange: '70 - 99 mg/dL', minRange: 70, maxRange: 99, baselineFlag: 'HIGH', currentFlag: 'HIGH' },
      { name: 'HbA1c', baselineValue: 7.1, currentValue: 6.3, unit: '%', delta: -0.8, percentChange: -11.3, referenceRange: '4.0 - 5.6 %', minRange: 4.0, maxRange: 5.6, baselineFlag: 'HIGH', currentFlag: 'HIGH' },
      { name: 'Total Cholesterol', baselineValue: 235, currentValue: 192, unit: 'mg/dL', delta: -43, percentChange: -18.3, referenceRange: '125 - 200 mg/dL', minRange: 125, maxRange: 200, baselineFlag: 'HIGH', currentFlag: 'NORMAL' },
      { name: 'Triglycerides', baselineValue: 180, currentValue: 138, unit: 'mg/dL', delta: -42, percentChange: -23.3, referenceRange: '50 - 150 mg/dL', minRange: 50, maxRange: 150, baselineFlag: 'HIGH', currentFlag: 'NORMAL' },
      { name: 'Serum Creatinine', baselineValue: 1.0, currentValue: 0.9, unit: 'mg/dL', delta: -0.1, percentChange: -10, referenceRange: '0.6 - 1.2 mg/dL', minRange: 0.6, maxRange: 1.2, baselineFlag: 'NORMAL', currentFlag: 'NORMAL' },
    ],
    aiDraftAnalysis: {
      summary: 'Compared 5 common biomarkers across 3 months. Fasting Blood Sugar and HbA1c demonstrated marked downward shifts toward target brackets. Total Cholesterol and Triglycerides normalized into standard laboratory ranges.',
      significantChanges: [
        'Total Cholesterol shifted from 235 to 192 mg/dL (-18.3%). Latest status: NORMAL.',
        'Triglycerides shifted from 180 to 138 mg/dL (-23.3%). Latest status: NORMAL.',
        'HbA1c decreased from 7.1% to 6.3% (-11.3%).',
      ],
      unmatchedParameters: [],
      safetyNotice: 'Notice: Numerical differences do not automatically imply improvement without clinical context. Consult your doctor for diagnosis and management.',
    },
    doctorObservation: {
      notes: 'Substantial improvement in lipid profile and glycemic indices following 3 months of lifestyle modification and metformin. Cardiovascular risk profile favorably reduced.',
      nextConsultationNotes: 'Continue current Metformin 500mg daily. Repeat lipid panel and HbA1c in 6 months.',
      approved: true,
      approvedBy: doctor._id,
      approvedAt: new Date(),
    },
    status: 'APPROVED',
  });

  // Seed Follow-up Task
  const followUpDueDate = new Date();
  followUpDueDate.setDate(followUpDueDate.getDate() + 14);

  await FollowUp.create({
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentId: appointment._id,
    title: 'Post-Glycemic Adjustment Checkpoint',
    instructions: 'Monitor morning fasting glucose twice weekly. Record readings in health diary.',
    dueDate: followUpDueDate,
    status: 'UPCOMING',
    requestedReportType: 'LAB_REPORT',
    requestedReportDescription: 'Fasting Blood Glucose 2-Week Log',
  });

  // Seed Certified Patient Summary
  await PatientSummary.create({
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentId: appointment._id,
    aiGenerated: {
      patientOverview: '31-year-old male with mild asthma and borderline dyslipidemia.',
      previousConsultationSummary: 'Last consultation focused on cardiovascular risk assessment.',
      currentConcerns: 'Patient adheres well to metformin; reports mild afternoon fatigue.',
      relevantMedicalHistory: 'Mild asthma, managed with Salbutamol as needed. Penicillin allergy.',
      recentReportComparisonSummary: 'Fasting blood sugar down 18.8%; total cholesterol normalized to 192 mg/dL.',
      pendingFollowUpTasks: 'Post-Glycemic Adjustment Checkpoint due in 2 weeks.',
      suggestedDoctorQuestions: [
        'Any episodes of nighttime wheezing or shortness of breath?',
        'How is your exercise tolerability on the current routine?',
      ],
    },
    doctorDraft: {
      patientOverview: '31-year-old male presenting for continuity evaluation.',
      previousConsultationSummary: 'Lipid and metabolic control reviewed with positive response.',
      currentConcerns: 'Fatigue improving with regular morning walk routine.',
      relevantMedicalHistory: 'Mild asthma; Penicillin allergy documented.',
      recentReportComparisonSummary: 'Biomarkers demonstrate favorable trend across all 5 parameters.',
      pendingFollowUpTasks: 'Fasting blood sugar log review in 14 days.',
      clinicalObservations: 'Metabolic markers stabilizing nicely. Medication regimen unchanged.',
      suggestedQuestions: [
        'Have you noticed any hypoglycemic episodes (shakiness, diaphoresis)?',
      ],
    },
    status: 'SHARED_WITH_PATIENT',
    isApproved: true,
    approvedAt: new Date(),
    sharedWithPatient: true,
    sharedAt: new Date(),
  });

  // Seed Specialist Referral
  await Referral.create({
    patientId: patient._id,
    referringDoctorId: doctor._id,
    reason: 'Pulmonary consultation for spirometry and seasonal asthma check',
    clinicalNotes: 'Occasional seasonal cough and wheeze; uses salbutamol 1-2 times a month. Lungs currently clear.',
    priority: 'ROUTINE',
    status: 'ACCEPTED',
    patientConsent: {
      granted: true,
      consentDate: new Date(),
      notes: 'Patient consented to sharing medical records with pulmonary specialist.',
    },
    receivingDoctorNotes: 'Referral accepted. Spirometry scheduled.',
  });

  // Seed Sample Prescription
  await Prescription.create({
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentId: appointment._id,
    medicines: [
      { name: 'Metformin 500mg', dosage: '500mg', frequency: 'Once daily after dinner', duration: '90 days' },
      { name: 'Salbutamol Inhaler 100mcg', dosage: '2 puffs', frequency: 'As needed for wheezing', duration: '30 days' },
    ],
    instructions: 'Take Metformin with food. Keep inhaler readily accessible during outdoor exercise.',
  });

  const room101 = await Room.create({ hospitalId: hospital._id, roomNumber: '101', roomType: 'GENERAL', floor: '1' });
  const room201 = await Room.create({ hospitalId: hospital._id, roomNumber: '201', roomType: 'ICU', floor: '2' });
  await Bed.insertMany([
    { hospitalId: hospital._id, roomId: room101._id, bedNumber: 'A' },
    { hospitalId: hospital._id, roomId: room101._id, bedNumber: 'B' },
    { hospitalId: hospital._id, roomId: room201._id, bedNumber: 'ICU-1' },
  ]);

  await Medicine.insertMany([
    { name: 'Paracetamol 500mg', genericName: 'Paracetamol', category: 'Analgesic', manufacturer: 'GenPharma', price: 25, stock: 500, requiresPrescription: false },
    { name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', category: 'Antibiotic', manufacturer: 'MediCore', price: 85, stock: 200, requiresPrescription: true },
    { name: 'Cetirizine 10mg', genericName: 'Cetirizine', category: 'Antihistamine', manufacturer: 'GenPharma', price: 30, stock: 300, requiresPrescription: false },
    { name: 'Atorvastatin 20mg', genericName: 'Atorvastatin', category: 'Statin', manufacturer: 'CardioLabs', price: 120, stock: 150, requiresPrescription: true },
  ]);

  console.log('\nSeed complete. Demo accounts (password: Password@123):');
  console.log(`  SUPER_ADMIN     -> ${superAdminUser.email}`);
  console.log(`  HOSPITAL_ADMIN  -> ${hospitalAdminUser.email}`);
  console.log(`  PHARMACY_ADMIN  -> ${pharmacyAdminUser.email}`);
  console.log(`  DOCTOR          -> ${doctorUser.email} (doctorId: ${doctor._id})`);
  console.log(`  PATIENT         -> ${patientUser.email}`);
  console.log(`  Hospital ID     -> ${hospital._id}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
