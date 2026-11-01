// Reusable, configurable catalogue of professional categories, specializations and
// department suggestions. NOTHING here is mandatory for a hospital: departments are
// real per-hospital records (models/Department.js) and a hospital only has the ones
// it creates. `DEPARTMENT_SUGGESTIONS` only pre-fills ideas when a hospital admin
// creates a department.
//
// Three separate concepts (never conflated):
//   professionalCategory — what kind of licensed professional someone is
//   specialization       — their clinical focus (primary + optional additional)
//   department           — an organisational unit of ONE hospital

const { DOCUMENT_TYPES } = require('./constants');

const PROFESSIONAL_CATEGORIES = [
  {
    value: 'MEDICAL_DOCTOR',
    label: 'Medical Doctor (MBBS / MD / MS / DM / MCh)',
    registrationRequired: true,
    councilHint: 'National Medical Commission / State Medical Council',
    requiredDocuments: [DOCUMENT_TYPES.REGISTRATION_CERTIFICATE, DOCUMENT_TYPES.QUALIFICATION_CERTIFICATE],
  },
  {
    value: 'DENTIST',
    label: 'Dental Surgeon (BDS / MDS)',
    registrationRequired: true,
    councilHint: 'Dental Council of India / State Dental Council',
    requiredDocuments: [DOCUMENT_TYPES.REGISTRATION_CERTIFICATE, DOCUMENT_TYPES.QUALIFICATION_CERTIFICATE],
  },
  {
    value: 'CLINICAL_PSYCHOLOGIST',
    label: 'Clinical Psychologist',
    registrationRequired: true,
    councilHint: 'Rehabilitation Council of India (CRR)',
    requiredDocuments: [DOCUMENT_TYPES.REGISTRATION_CERTIFICATE, DOCUMENT_TYPES.QUALIFICATION_CERTIFICATE],
  },
  {
    value: 'PHYSIOTHERAPIST',
    label: 'Physiotherapist',
    registrationRequired: true,
    councilHint: 'State Physiotherapy / Allied Health Council',
    requiredDocuments: [DOCUMENT_TYPES.REGISTRATION_CERTIFICATE, DOCUMENT_TYPES.QUALIFICATION_CERTIFICATE],
  },
  {
    value: 'OTHER_ALLIED_HEALTH',
    label: 'Other allied health professional',
    registrationRequired: false,
    councilHint: 'Registration council, if applicable',
    requiredDocuments: [DOCUMENT_TYPES.QUALIFICATION_CERTIFICATE],
  },
];

const MD = ['MEDICAL_DOCTOR'];
const s = (label, categories = MD) => ({ value: label, label, categories });

// Order follows the product specification.
const SPECIALIZATIONS = [
  s('General Physician'), s('Family Medicine'), s('Internal Medicine'), s('Preventive Medicine'), s('Geriatric Medicine'),
  s('Cardiologist'), s('Neurologist'), s('Pulmonologist'), s('Gastroenterologist'), s('Nephrologist'),
  s('Endocrinologist'), s('Rheumatologist'), s('Hematologist'), s('Medical Oncologist'), s('Infectious Disease Specialist'),
  s('General Surgeon'), s('Orthopedic Surgeon'), s('Neurosurgeon'), s('Cardiothoracic Surgeon'),
  s('Plastic and Reconstructive Surgeon'), s('Vascular Surgeon'), s('Urologist'), s('Pediatric Surgeon'),
  s('Gynecologist'), s('Obstetrician'), s('Obstetrician-Gynecologist'), s('Pediatrician'), s('Neonatologist'),
  s('Reproductive Medicine Specialist'), s('Dermatologist'), s('Ophthalmologist'), s('ENT Specialist'),
  s('Psychiatrist'), s('Clinical Psychologist', ['CLINICAL_PSYCHOLOGIST']),
  s('Dentist', ['DENTIST']), s('Orthodontist', ['DENTIST']), s('Prosthodontist', ['DENTIST']), s('Periodontist', ['DENTIST']),
  s('Radiologist'), s('Pathologist'), s('Anesthesiologist'), s('Emergency Medicine Specialist'), s('Critical Care Specialist'),
  s('Physical Medicine and Rehabilitation Specialist'), s('Physiotherapist', ['PHYSIOTHERAPIST']),
];

// Specialization -> department names a hospital might create. Suggestions only.
const DEPARTMENT_SUGGESTIONS = {
  'General Physician': ['General Medicine'], 'Family Medicine': ['Family Medicine'], 'Internal Medicine': ['General Medicine'],
  'Preventive Medicine': ['Preventive Medicine'], 'Geriatric Medicine': ['Geriatrics'],
  Cardiologist: ['Cardiology'], Neurologist: ['Neurology'], Pulmonologist: ['Pulmonology'],
  Gastroenterologist: ['Gastroenterology'], Nephrologist: ['Nephrology'], Endocrinologist: ['Endocrinology'],
  Rheumatologist: ['Rheumatology'], Hematologist: ['Hematology'], 'Medical Oncologist': ['Oncology'],
  'Infectious Disease Specialist': ['Infectious Diseases'], 'General Surgeon': ['General Surgery'],
  'Orthopedic Surgeon': ['Orthopedics'], Neurosurgeon: ['Neurosurgery'], 'Cardiothoracic Surgeon': ['Cardiothoracic Surgery'],
  'Plastic and Reconstructive Surgeon': ['Plastic Surgery'], 'Vascular Surgeon': ['Vascular Surgery'], Urologist: ['Urology'],
  'Pediatric Surgeon': ['Pediatric Surgery', 'Pediatrics'], Gynecologist: ['Obstetrics & Gynecology'],
  Obstetrician: ['Obstetrics & Gynecology'], 'Obstetrician-Gynecologist': ['Obstetrics & Gynecology'],
  Pediatrician: ['Pediatrics'], Neonatologist: ['Neonatology', 'Pediatrics'],
  'Reproductive Medicine Specialist': ['Reproductive Medicine'], Dermatologist: ['Dermatology'],
  Ophthalmologist: ['Ophthalmology'], 'ENT Specialist': ['ENT'], Psychiatrist: ['Psychiatry'],
  'Clinical Psychologist': ['Psychology', 'Psychiatry'], Dentist: ['Dental'], Orthodontist: ['Dental'],
  Prosthodontist: ['Dental'], Periodontist: ['Dental'], Radiologist: ['Radiology'], Pathologist: ['Pathology'],
  Anesthesiologist: ['Anesthesiology'], 'Emergency Medicine Specialist': ['Emergency Medicine'],
  'Critical Care Specialist': ['Critical Care'], 'Physical Medicine and Rehabilitation Specialist': ['Rehabilitation'],
  Physiotherapist: ['Physiotherapy', 'Rehabilitation'],
};

const LANGUAGES = [
  'English', 'Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu', 'Gujarati', 'Kannada', 'Malayalam',
  'Odia', 'Punjabi', 'Assamese', 'Sanskrit',
];

const getCategory = (value) => PROFESSIONAL_CATEGORIES.find((c) => c.value === value);
const getSpecialization = (value) => SPECIALIZATIONS.find((x) => x.value === value);

module.exports = {
  PROFESSIONAL_CATEGORIES,
  SPECIALIZATIONS,
  DEPARTMENT_SUGGESTIONS,
  LANGUAGES,
  getCategory,
  getSpecialization,
};
