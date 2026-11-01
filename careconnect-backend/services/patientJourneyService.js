const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const Prescription = require('../models/Prescription');
const Admission = require('../models/Admission');
const FollowUp = require('../models/FollowUp');
const ReportComparison = require('../models/ReportComparison');
const Referral = require('../models/Referral');
const PatientJourneyEvent = require('../models/PatientJourneyEvent');
const ApiError = require('../utils/ApiError');

async function getPatientCompleteJourney(patientId) {
  const patient = await Patient.findById(patientId).populate('userId', 'name email createdAt');
  if (!patient) throw ApiError.notFound('Patient profile not found');

  const [
    appointments,
    records,
    prescriptions,
    admissions,
    followUps,
    comparisons,
    referrals,
    customEvents,
  ] = await Promise.all([
    Appointment.find({ patientId }).populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } }).populate('departmentId', 'name'),
    MedicalRecord.find({ patientId }).populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } }),
    Prescription.find({ patientId }).populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } }),
    Admission.find({ patientId }).populate('hospitalId', 'name'),
    FollowUp.find({ patientId }).populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } }),
    ReportComparison.find({ patientId }).populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } }),
    Referral.find({ patientId }).populate({ path: 'referringDoctorId', populate: { path: 'userId', select: 'name' } }).populate({ path: 'referredDoctorId', populate: { path: 'userId', select: 'name' } }),
    PatientJourneyEvent.find({ patientId }).populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } }),
  ]);

  const timelineEvents = [];

  // 1. Patient Registration
  if (patient.createdAt || patient.userId?.createdAt) {
    timelineEvents.push({
      id: `reg-${patient._id}`,
      title: 'CareConnect AI Journey Began',
      category: 'REGISTRATION',
      timestamp: patient.createdAt || patient.userId?.createdAt,
      description: 'Account registered and digital health passport activated.',
      doctorName: null,
      relatedModel: 'Patient',
      relatedId: patient._id,
      link: '/patient/profile',
      status: 'COMPLETED',
      badgeTone: 'blue',
    });
  }

  // 2. Appointments & Consultations
  appointments.forEach((a) => {
    const isCompleted = a.status === 'COMPLETED';
    const docName = a.doctorId?.userId?.name || 'Assigned Specialist';
    timelineEvents.push({
      id: `appt-${a._id}`,
      title: isCompleted ? `Consultation with Dr. ${docName}` : `Scheduled Appointment (${a.consultationType})`,
      category: isCompleted ? 'CONSULTATION' : 'APPOINTMENT',
      timestamp: a.date ? new Date(a.date) : a.createdAt,
      description: a.notes ? `Clinical notes: ${a.notes}` : `Appointment status: ${a.status}. Department: ${a.departmentId?.name || 'General'}.`,
      doctorName: docName,
      relatedModel: 'Appointment',
      relatedId: a._id,
      link: `/patient/appointments/${a._id}`,
      status: a.status,
      badgeTone: isCompleted ? 'teal' : 'blue',
    });
  });

  // 3. Medical Record Uploads
  records.forEach((r) => {
    const docName = r.doctorId?.userId?.name || null;
    timelineEvents.push({
      id: `rec-${r._id}`,
      title: `Medical Report: ${r.title}`,
      category: 'REPORT_UPLOAD',
      timestamp: r.createdAt,
      description: r.description || `Uploaded document type: ${r.type}. Extracted parameters: ${r.extractedParameters?.length || 0}.`,
      doctorName: docName,
      relatedModel: 'MedicalRecord',
      relatedId: r._id,
      link: '/patient/records',
      status: 'UPLOADED',
      badgeTone: 'teal',
      fileUrl: r.fileUrl,
    });
  });

  // 4. Report Comparisons
  comparisons.forEach((c) => {
    const docName = c.doctorId?.userId?.name || (c.doctorObservation?.approvedBy ? 'Doctor Reviewed' : null);
    timelineEvents.push({
      id: `comp-${c._id}`,
      title: `AI Report Evolution Comparison (${c.parameters?.length || 0} metrics)`,
      category: 'REPORT_COMPARISON',
      timestamp: c.createdAt,
      description: c.doctorObservation?.approved
        ? `Doctor approved: ${c.doctorObservation.notes || 'Clinical observations verified.'}`
        : (c.aiDraftAnalysis?.summary || 'Report evolution tracked across timepoints.'),
      doctorName: docName,
      relatedModel: 'ReportComparison',
      relatedId: c._id,
      link: '/patient/report-comparison',
      status: c.status,
      badgeTone: c.doctorObservation?.approved ? 'teal' : 'amber',
    });
  });

  // 5. Prescriptions
  prescriptions.forEach((p) => {
    const docName = p.doctorId?.userId?.name || 'Doctor';
    const medCount = p.medicines?.length || 0;
    timelineEvents.push({
      id: `rx-${p._id}`,
      title: `Prescription from Dr. ${docName}`,
      category: 'PRESCRIPTION',
      timestamp: p.createdAt,
      description: `${medCount} medication(s) prescribed. Instructions: ${p.instructions || 'Follow dosage routine'}.`,
      doctorName: docName,
      relatedModel: 'Prescription',
      relatedId: p._id,
      link: `/patient/prescriptions/${p._id}`,
      status: 'ISSUED',
      badgeTone: 'blue',
    });
  });

  // 6. Admissions & Discharges
  admissions.forEach((adm) => {
    timelineEvents.push({
      id: `adm-req-${adm._id}`,
      title: 'Hospital Admission Requested',
      category: 'ADMISSION',
      timestamp: adm.createdAt,
      description: `Hospital: ${adm.hospitalId?.name || 'CareConnect Hospital'}. Reason: ${adm.reason || 'Inpatient care'}.`,
      doctorName: null,
      relatedModel: 'Admission',
      relatedId: adm._id,
      link: `/patient/admission/${adm._id}`,
      status: adm.status,
      badgeTone: 'red',
    });

    if (adm.admissionDate) {
      timelineEvents.push({
        id: `adm-in-${adm._id}`,
        title: 'Admitted to Hospital Facility',
        category: 'ADMISSION',
        timestamp: new Date(adm.admissionDate),
        description: `Admitted under ward care. Bed status assigned.`,
        doctorName: null,
        relatedModel: 'Admission',
        relatedId: adm._id,
        link: `/patient/admission/${adm._id}`,
        status: 'ADMITTED',
        badgeTone: 'red',
      });
    }

    if (adm.dischargeDate) {
      timelineEvents.push({
        id: `adm-dis-${adm._id}`,
        title: 'Hospital Discharge Summary Issued',
        category: 'DISCHARGE',
        timestamp: new Date(adm.dischargeDate),
        description: `Patient successfully discharged. Follow-up plan outlined in discharge notes.`,
        doctorName: null,
        relatedModel: 'Admission',
        relatedId: adm._id,
        link: `/patient/admission/${adm._id}`,
        status: 'DISCHARGED',
        badgeTone: 'green',
      });
    }
  });

  // 7. Follow-ups
  followUps.forEach((f) => {
    const docName = f.doctorId?.userId?.name || 'Doctor';
    timelineEvents.push({
      id: `fu-cr-${f._id}`,
      title: `Follow-Up Scheduled: ${f.title}`,
      category: 'FOLLOW_UP_CREATED',
      timestamp: f.createdAt,
      description: `Due date: ${new Date(f.dueDate).toLocaleDateString()}. Instructions: ${f.instructions || 'Monitor symptoms'}.`,
      doctorName: docName,
      relatedModel: 'FollowUp',
      relatedId: f._id,
      link: '/patient/follow-ups',
      status: f.status,
      badgeTone: f.status === 'COMPLETED' ? 'teal' : (f.status === 'OVERDUE' ? 'red' : 'blue'),
    });

    if (f.status === 'COMPLETED' && f.completedAt) {
      timelineEvents.push({
        id: `fu-done-${f._id}`,
        title: `Follow-Up Completed: ${f.title}`,
        category: 'FOLLOW_UP_COMPLETED',
        timestamp: new Date(f.completedAt),
        description: f.completionNotes ? `Doctor review: ${f.completionNotes}` : 'Care milestone successfully evaluated.',
        doctorName: docName,
        relatedModel: 'FollowUp',
        relatedId: f._id,
        link: '/patient/follow-ups',
        status: 'COMPLETED',
        badgeTone: 'green',
      });
    }
  });

  // 8. Referrals
  referrals.forEach((ref) => {
    const refDoc = ref.referringDoctorId?.userId?.name || 'Doctor';
    const recDoc = ref.referredDoctorId?.userId?.name || 'Specialist';
    timelineEvents.push({
      id: `ref-${ref._id}`,
      title: `Specialist Referral to Dr. ${recDoc}`,
      category: 'REFERRAL',
      timestamp: ref.createdAt,
      description: `Referred by Dr. ${refDoc} for: ${ref.reason}. Priority: ${ref.priority}. Consent status: ${ref.patientConsent?.granted ? 'Consent Granted' : 'Pending Patient Consent'}.`,
      doctorName: recDoc,
      relatedModel: 'Referral',
      relatedId: ref._id,
      link: '/patient/referrals',
      status: ref.status,
      badgeTone: 'blue',
    });
  });

  // 9. Custom Journey Events
  customEvents.forEach((ev) => {
    timelineEvents.push({
      id: `custom-${ev._id}`,
      title: ev.title,
      category: ev.category,
      timestamp: ev.eventDate || ev.createdAt,
      description: ev.description,
      doctorName: ev.doctorId?.userId?.name || null,
      relatedModel: ev.relatedModel,
      relatedId: ev.relatedId,
      link: '/patient/timeline',
      status: 'VERIFIED',
      badgeTone: 'teal',
    });
  });

  // Sort chronologically descending (latest first)
  timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return timelineEvents;
}

module.exports = {
  getPatientCompleteJourney,
};
