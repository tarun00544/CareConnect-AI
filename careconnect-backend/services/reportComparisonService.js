const MedicalRecord = require('../models/MedicalRecord');
const ReportComparison = require('../models/ReportComparison');
const Patient = require('../models/Patient');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { REPORT_COMPARISON_STATUS } = require('../config/constants');

// Evidence-based standard laboratory reference ranges
const STANDARD_REFERENCE_RANGES = {
  'fasting blood sugar': { min: 70, max: 99, unit: 'mg/dL', label: 'Fasting Blood Sugar' },
  'post prandial blood sugar': { min: 70, max: 140, unit: 'mg/dL', label: 'Post Prandial Blood Sugar' },
  'random blood sugar': { min: 70, max: 140, unit: 'mg/dL', label: 'Random Blood Sugar' },
  'hba1c': { min: 4.0, max: 5.6, unit: '%', label: 'HbA1c' },
  'total cholesterol': { min: 125, max: 200, unit: 'mg/dL', label: 'Total Cholesterol' },
  'hdl cholesterol': { min: 40, max: 60, unit: 'mg/dL', label: 'HDL Cholesterol' },
  'ldl cholesterol': { min: 50, max: 100, unit: 'mg/dL', label: 'LDL Cholesterol' },
  'triglycerides': { min: 50, max: 150, unit: 'mg/dL', label: 'Triglycerides' },
  'hemoglobin': { min: 12.0, max: 17.0, unit: 'g/dL', label: 'Hemoglobin' },
  'wbc count': { min: 4000, max: 11000, unit: 'cells/mcL', label: 'White Blood Cell Count' },
  'platelets': { min: 150000, max: 450000, unit: '/mcL', label: 'Platelet Count' },
  'serum creatinine': { min: 0.6, max: 1.2, unit: 'mg/dL', label: 'Serum Creatinine' },
  'blood urea nitrogen': { min: 7, max: 20, unit: 'mg/dL', label: 'Blood Urea Nitrogen (BUN)' },
  'systolic blood pressure': { min: 90, max: 120, unit: 'mmHg', label: 'Systolic Blood Pressure' },
  'diastolic blood pressure': { min: 60, max: 80, unit: 'mmHg', label: 'Diastolic Blood Pressure' },
  'tsh': { min: 0.4, max: 4.0, unit: 'mIU/L', label: 'Thyroid Stimulating Hormone (TSH)' },
  'uric acid': { min: 3.5, max: 7.2, unit: 'mg/dL', label: 'Uric Acid' },
  'sgpt / alt': { min: 7, max: 56, unit: 'U/L', label: 'SGPT / ALT' },
  'sgot / ast': { min: 10, max: 40, unit: 'U/L', label: 'SGOT / AST' },
};

function determineFlag(val, min, max) {
  if (min === null || max === null || isNaN(val)) return 'UNKNOWN';
  if (val < min) return 'LOW';
  if (val > max) return 'HIGH';
  return 'NORMAL';
}

function parseParametersFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/[\r\n;,]+/);
  const found = [];

  const patterns = [
    { key: 'fasting blood sugar', regex: /(?:fasting\s*(?:blood\s*)?sugar|fbs|fasting\s*glucose)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'post prandial blood sugar', regex: /(?:post\s*prandial|ppbs|pp\s*glucose)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'random blood sugar', regex: /(?:random\s*(?:blood\s*)?sugar|rbs)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'hba1c', regex: /(?:hba1c|glycated\s*hemoglobin)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'total cholesterol', regex: /(?:total\s*cholesterol|cholesterol\s*total)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'hdl cholesterol', regex: /(?:hdl(?:\s*cholesterol)?)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'ldl cholesterol', regex: /(?:ldl(?:\s*cholesterol)?)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'triglycerides', regex: /(?:triglycerides?)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'hemoglobin', regex: /(?:hemoglobin|hb(?!\w))[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'wbc count', regex: /(?:wbc|white\s*blood\s*cells?|total\s*leukocyte\s*count|tlc)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'platelets', regex: /(?:platelets?|platelet\s*count)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'serum creatinine', regex: /(?:serum\s*creatinine|creatinine)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'blood urea nitrogen', regex: /(?:blood\s*urea\s*nitrogen|bun|urea)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'systolic blood pressure', regex: /(?:systolic(?:\s*bp)?|blood\s*pressure)[\s:=]+([0-9]{2,3})\s*(?:\/|\s)/i },
    { key: 'diastolic blood pressure', regex: /(?:diastolic(?:\s*bp)?|\/\s*([0-9]{2,3})\s*mmhg)/i },
    { key: 'tsh', regex: /(?:tsh|thyroid\s*stimulating\s*hormone)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'uric acid', regex: /(?:uric\s*acid)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'sgpt / alt', regex: /(?:sgpt|alt)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'sgot / ast', regex: /(?:sgot|ast)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i },
  ];

  const seenKeys = new Set();

  // Try line by line and regex patterns
  for (const { key, regex } of patterns) {
    const match = text.match(regex);
    if (match && match[1] && !seenKeys.has(key)) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) {
        seenKeys.add(key);
        const ref = STANDARD_REFERENCE_RANGES[key];
        found.push({
          name: ref?.label || key.toUpperCase(),
          value: val,
          unit: ref?.unit || '',
          minRange: ref?.min ?? null,
          maxRange: ref?.max ?? null,
          referenceRange: ref ? `${ref.min} - ${ref.max} ${ref.unit}` : '',
          flag: determineFlag(val, ref?.min ?? null, ref?.max ?? null),
        });
      }
    }
  }

  // Also check if lines look like "Param Name: Value Unit (Ref: min - max)"
  for (const line of lines) {
    const genericMatch = line.match(/^([A-Za-z0-9\s/()._-]{3,40})[:=-]\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]*)/);
    if (genericMatch) {
      const rawName = genericMatch[1].trim();
      const val = parseFloat(genericMatch[2]);
      const unit = genericMatch[3]?.trim() || '';
      const normKey = rawName.toLowerCase();
      if (!seenKeys.has(normKey) && !isNaN(val)) {
        seenKeys.add(normKey);
        const ref = STANDARD_REFERENCE_RANGES[normKey];
        found.push({
          name: ref?.label || rawName,
          value: val,
          unit: unit || ref?.unit || '',
          minRange: ref?.min ?? null,
          maxRange: ref?.max ?? null,
          referenceRange: ref ? `${ref.min} - ${ref.max} ${ref.unit}` : '',
          flag: determineFlag(val, ref?.min ?? null, ref?.max ?? null),
        });
      }
    }
  }

  return found;
}

function generateDeterministicExplanation(parameters, unmatched) {
  if (!parameters || parameters.length === 0) {
    return {
      summary: 'No overlapping quantitative parameters were found between the two selected reports for direct numerical comparison.',
      significantChanges: [],
      unmatchedParameters: unmatched,
      safetyNotice: 'This comparative summary tracks recorded laboratory numbers only and is not a clinical diagnosis. Changes must be interpreted in clinical context by an authorized doctor.',
    };
  }

  const significant = [];
  const notableOutRange = [];

  parameters.forEach((p) => {
    const deltaStr = p.delta > 0 ? `+${p.delta}` : `${p.delta}`;
    const pctStr = p.percentChange !== 0 ? ` (${p.percentChange > 0 ? '+' : ''}${p.percentChange}%)` : '';
    if (Math.abs(p.percentChange) >= 10 || p.currentFlag !== 'NORMAL') {
      significant.push(`${p.name}: changed from ${p.baselineValue} to ${p.currentValue} ${p.unit}${pctStr}. Latest status: ${p.currentFlag}.`);
    }
    if (p.currentFlag !== 'NORMAL' && p.currentFlag !== 'UNKNOWN') {
      notableOutRange.push(`${p.name} is currently ${p.currentFlag} relative to standard reference bracket (${p.referenceRange}).`);
    }
  });

  const summary = `Compared ${parameters.length} common parameter(s) across selected reports. ${
    notableOutRange.length > 0 ? `${notableOutRange.length} value(s) fall outside standard laboratory reference ranges.` : 'Extracted values align closely with standard reference ranges.'
  } Please review with your doctor for clinical correlation.`;

  return {
    summary,
    significantChanges: significant.length > 0 ? significant : ['Parameters remained stable across both dates.'],
    unmatchedParameters: unmatched,
    safetyNotice: 'Notice: Numerical differences do not automatically imply improvement or deterioration without clinical context. Consult your doctor for diagnosis and management.',
  };
}

async function compareReports({ baselineRecordId, currentRecordId, patientId, doctorId = null }) {
  const [baselineRecord, currentRecord] = await Promise.all([
    MedicalRecord.findById(baselineRecordId),
    MedicalRecord.findById(currentRecordId),
  ]);

  if (!baselineRecord || !currentRecord) {
    throw ApiError.notFound('One or both medical records could not be found.');
  }

  if (String(baselineRecord.patientId) !== String(currentRecord.patientId)) {
    throw ApiError.badRequest('Both reports must belong to the same patient.');
  }

  if (patientId && String(baselineRecord.patientId) !== String(patientId)) {
    throw ApiError.forbidden('Access denied to requested patient reports.');
  }

  // Get extracted parameters from existing records or parse them from raw text
  let baselineParams = baselineRecord.extractedParameters?.length
    ? baselineRecord.extractedParameters
    : parseParametersFromText(baselineRecord.description + '\n' + (baselineRecord.rawText || ''));

  let currentParams = currentRecord.extractedParameters?.length
    ? currentRecord.extractedParameters
    : parseParametersFromText(currentRecord.description + '\n' + (currentRecord.rawText || ''));

  // Normalize map
  const baseMap = new Map();
  baselineParams.forEach((p) => {
    baseMap.set(p.name.toLowerCase().trim(), p);
  });

  const currentMap = new Map();
  currentParams.forEach((p) => {
    currentMap.set(p.name.toLowerCase().trim(), p);
  });

  const matched = [];
  const unmatched = [];

  for (const [key, curr] of currentMap.entries()) {
    if (baseMap.has(key)) {
      const base = baseMap.get(key);
      const delta = Math.round((curr.value - base.value) * 100) / 100;
      const percentChange = base.value !== 0 ? Math.round(((curr.value - base.value) / base.value) * 1000) / 10 : 0;
      matched.push({
        name: curr.name,
        baselineValue: base.value,
        currentValue: curr.value,
        unit: curr.unit || base.unit || '',
        delta,
        percentChange,
        referenceRange: curr.referenceRange || base.referenceRange || '',
        minRange: curr.minRange ?? base.minRange ?? null,
        maxRange: curr.maxRange ?? base.maxRange ?? null,
        baselineFlag: base.flag || determineFlag(base.value, base.minRange, base.maxRange),
        currentFlag: curr.flag || determineFlag(curr.value, curr.minRange, curr.maxRange),
      });
    } else {
      unmatched.push(`${curr.name} (present only in latest report: ${curr.value} ${curr.unit})`);
    }
  }

  for (const [key, base] of baseMap.entries()) {
    if (!currentMap.has(key)) {
      unmatched.push(`${base.name} (present only in baseline report: ${base.value} ${base.unit})`);
    }
  }

  const deterministicAnalysis = generateDeterministicExplanation(matched, unmatched);

  // Try Gemini AI enhancement if available, else keep deterministic
  let finalAiAnalysis = deterministicAnalysis;
  try {
    const aiService = require('./aiService');
    if (aiService.runComparisonExplanation) {
      const aiResult = await aiService.runComparisonExplanation({
        matchedParameters: matched,
        unmatchedParameters: unmatched,
        baselineTitle: baselineRecord.title,
        currentTitle: currentRecord.title,
      });
      if (aiResult?.summary) {
        finalAiAnalysis = {
          summary: aiResult.summary,
          significantChanges: aiResult.significantChanges?.length ? aiResult.significantChanges : deterministicAnalysis.significantChanges,
          unmatchedParameters: unmatched,
          safetyNotice: aiResult.safetyMessage || deterministicAnalysis.safetyNotice,
        };
      }
    }
  } catch (err) {
    logger.warn('AI comparison explanation service unavailable, using deterministic analysis:', err.message);
  }

  const comparison = await ReportComparison.create({
    patientId: baselineRecord.patientId,
    doctorId: doctorId || null,
    baselineRecordId,
    currentRecordId,
    parameters: matched,
    aiDraftAnalysis: finalAiAnalysis,
    doctorObservation: {
      notes: '',
      nextConsultationNotes: '',
      approved: false,
      approvedBy: null,
      approvedAt: null,
    },
    status: REPORT_COMPARISON_STATUS.AI_GENERATED,
    patientConsentGranted: true,
  });

  return comparison;
}

async function reviewComparison({ comparisonId, doctorId, notes = '', nextConsultationNotes = '', approved = true }) {
  const comparison = await ReportComparison.findById(comparisonId);
  if (!comparison) throw ApiError.notFound('Report comparison not found');

  comparison.doctorObservation = {
    notes: notes.trim(),
    nextConsultationNotes: nextConsultationNotes.trim(),
    approved: !!approved,
    approvedBy: doctorId,
    approvedAt: approved ? new Date() : null,
  };

  comparison.status = approved ? REPORT_COMPARISON_STATUS.APPROVED : REPORT_COMPARISON_STATUS.DOCTOR_REVIEWED;
  await comparison.save();

  // Notify patient when approved
  if (approved) {
    try {
      const patient = await Patient.findById(comparison.patientId);
      if (patient) {
        await notificationService.reportComparisonApproved(patient.userId, comparison);
      }
    } catch (e) {
      logger.warn('Failed to notify patient of report comparison review:', e.message);
    }
  }

  return comparison;
}

module.exports = {
  STANDARD_REFERENCE_RANGES,
  parseParametersFromText,
  compareReports,
  reviewComparison,
};
