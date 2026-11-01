const Referral = require('../models/Referral');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { REFERRAL_STATUS } = require('../config/constants');

async function createReferral({
  patientId,
  referringDoctorId,
  referredDoctorId = null,
  referredDepartmentId = null,
  referredHospitalId = null,
  reason,
  clinicalNotes = '',
  priority = 'ROUTINE',
}) {
  if (!patientId || !referringDoctorId || !reason) {
    throw ApiError.badRequest('patientId, referringDoctorId, and reason are required');
  }

  const referral = await Referral.create({
    patientId,
    referringDoctorId,
    referredDoctorId,
    referredDepartmentId,
    referredHospitalId,
    reason: reason.trim(),
    clinicalNotes: clinicalNotes.trim(),
    priority,
    status: REFERRAL_STATUS.PENDING,
    patientConsent: {
      granted: false,
      consentDate: null,
      notes: '',
    },
  });

  // Notify patient for consent
  try {
    const patient = await Patient.findById(patientId);
    if (patient) {
      await notificationService.referralConsentRequest(patient.userId, referral);
    }
    // If referred to a specific doctor, notify that doctor
    if (referredDoctorId) {
      const doc = await Doctor.findById(referredDoctorId);
      if (doc?.userId) {
        await notificationService.referralReceived(doc.userId, referral);
      }
    }
  } catch (err) {
    logger.warn('Failed to dispatch referral creation notifications:', err.message);
  }

  return referral;
}

async function updatePatientConsent({ referralId, patientId, granted, notes = '' }) {
  const referral = await Referral.findOne({ _id: referralId, patientId });
  if (!referral) throw ApiError.notFound('Referral not found for this patient');

  referral.patientConsent = {
    granted: !!granted,
    consentDate: new Date(),
    notes: notes.trim(),
  };

  if (granted && referral.status === REFERRAL_STATUS.PENDING) {
    // Ready for referred doctor
  } else if (!granted) {
    referral.status = REFERRAL_STATUS.CANCELLED;
  }

  await referral.save();

  // Notify referring and receiving doctors
  try {
    const referringDoc = await Doctor.findById(referral.referringDoctorId);
    if (referringDoc?.userId) {
      await notificationService.referralUpdated(referringDoc.userId, referral);
    }
  } catch (err) {
    logger.warn('Failed to notify doctor of patient consent update:', err.message);
  }

  return referral;
}

async function updateReferralStatus({
  referralId,
  doctorId,
  status,
  receivingDoctorNotes = '',
}) {
  const referral = await Referral.findById(referralId);
  if (!referral) throw ApiError.notFound('Referral not found');

  if (status) {
    referral.status = status;
  }
  if (receivingDoctorNotes) {
    referral.receivingDoctorNotes = receivingDoctorNotes.trim();
  }
  if (status === REFERRAL_STATUS.COMPLETED) {
    referral.completedAt = new Date();
  }

  await referral.save();

  // Notify patient
  try {
    const patient = await Patient.findById(referral.patientId);
    if (patient) {
      await notificationService.referralUpdated(patient.userId, referral);
    }
  } catch (err) {
    logger.warn('Failed to notify patient of referral status change:', err.message);
  }

  return referral;
}

async function getDoctorReferrals(doctorId) {
  const referrals = await Referral.find({
    $or: [{ referringDoctorId: doctorId }, { referredDoctorId: doctorId }],
  })
    .sort({ createdAt: -1 })
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({ path: 'referringDoctorId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'referredDoctorId', populate: { path: 'userId', select: 'name' } })
    .populate('referredDepartmentId', 'name');

  return referrals;
}

async function getPatientReferrals(patientId) {
  const referrals = await Referral.find({ patientId })
    .sort({ createdAt: -1 })
    .populate({ path: 'referringDoctorId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'referredDoctorId', populate: { path: 'userId', select: 'name' } })
    .populate('referredDepartmentId', 'name');

  return referrals;
}

module.exports = {
  createReferral,
  updatePatientConsent,
  updateReferralStatus,
  getDoctorReferrals,
  getPatientReferrals,
};
