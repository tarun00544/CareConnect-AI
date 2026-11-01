const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const aiService = require('../services/aiService');
const Appointment = require('../models/Appointment');

// All AI endpoints operate strictly in a triage/informational capacity —
// see aiService.js SYSTEM_GUARDRAILS. No endpoint here can independently
// diagnose or prescribe; every response is normalized to include a
// medical disclaimer.
const assessment = asyncHandler(async (req, res) => {
  const result = await aiService.runAssessment(req.body);
  new ApiResponse(200, result, 'AI pre-consultation assessment generated').send(res);
});

const reportAnalysis = asyncHandler(async (req, res) => {
  const result = await aiService.runReportAnalysis(req.body);
  new ApiResponse(200, result, 'Report explained in general terms').send(res);
});

const consultationSummary = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  const result = await aiService.runConsultationSummary({
    symptomText: appointment.notes,
    doctorNotes: req.body.doctorNotes,
  });
  new ApiResponse(200, result, 'Consultation summary generated').send(res);
});

module.exports = { assessment, reportAnalysis, consultationSummary };
