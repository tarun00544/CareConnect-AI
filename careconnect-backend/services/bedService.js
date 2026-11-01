const mongoose = require('mongoose');
const Bed = require('../models/Bed');
const Admission = require('../models/Admission');
const ApiError = require('../utils/ApiError');
const { BED_STATUS, ADMISSION_STATUS } = require('../config/constants');
const notificationService = require('./notificationService');

// Ensures one bed cannot be assigned to two active patients:
// 1. Atomic findOneAndUpdate with a status:AVAILABLE filter guarantees only
//    one concurrent request can flip a given bed to OCCUPIED.
// 2. Backed by a unique partial index on {_id, assignedPatientId} while
//    status=OCCUPIED (see models/Bed.js) as a hard database-level guarantee.
async function allocateBed({ bedId, admissionId }) {
  const session = await mongoose.startSession();
  try {
    let bed;
    await session.withTransaction(async () => {
      const admission = await Admission.findById(admissionId).session(session);
      if (!admission) throw ApiError.notFound('Admission not found');

      bed = await Bed.findOneAndUpdate(
        { _id: bedId, status: BED_STATUS.AVAILABLE },
        { status: BED_STATUS.OCCUPIED, assignedPatientId: admission.patientId },
        { new: true, session }
      );

      if (!bed) {
        throw ApiError.conflict('Selected bed is no longer available');
      }

      admission.bedId = bed._id;
      admission.roomId = bed.roomId;
      admission.status = ADMISSION_STATUS.BED_ASSIGNED;
      await admission.save({ session });
    });

    const Patient = require('../models/Patient');
    const admission = await Admission.findById(admissionId);
    const patient = await Patient.findById(admission.patientId);
    if (patient) await notificationService.bedAllocated(patient.userId, bed._id);

    return bed;
  } finally {
    session.endSession();
  }
}

async function releaseBed(bedId) {
  const bed = await Bed.findByIdAndUpdate(
    bedId,
    { status: BED_STATUS.AVAILABLE, assignedPatientId: null },
    { new: true }
  );
  if (!bed) throw ApiError.notFound('Bed not found');
  return bed;
}

module.exports = { allocateBed, releaseBed };
