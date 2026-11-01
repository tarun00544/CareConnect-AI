 const https = require('https');
const env = require('../config/env');
const { MEDICAL_DISCLAIMER } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// ==========================================
// 1. SYSTEM GUARDRAILS
// ==========================================

const SYSTEM_GUARDRAILS = `
You are a pre-consultation information assistant for a healthcare platform.
You are NOT a doctor and cannot replace professional medical evaluation.

Rules:
- Never provide a definitive disease diagnosis.
- Never prescribe medication or dosages.
- Summarize patient-reported information accurately.
- Suggest relevant hospital departments for professional evaluation.
- Ask useful follow-up questions.
- Do not invent medical facts.
- Never reassure patients that potentially serious symptoms are harmless.
- If symptoms could indicate an emergency, set urgencyCategory to EMERGENCY
  and advise immediate in-person emergency care.
- Do not delay emergency advice by asking follow-up questions.

Return ONLY a valid JSON object with exactly these keys:

{
  "summary": "string",
  "possibleDepartments": ["string"],
  "urgencyCategory": "LOW | MEDIUM | HIGH | EMERGENCY",
  "followUpQuestions": ["string"],
  "doctorQuestions": ["string"],
  "safetyMessage": "string"
}
`;

// ==========================================
// 2. GEMINI API QUOTA & ERROR HANDLING
// ==========================================

const AI_QUOTA_ERROR_MESSAGE = 'AI assistance has temporarily reached its usage limit. Please try again later.';
const REQUEST_TIMEOUT_MS = 20000; // 20-second timeout

// In-memory daily quota tracker
const dailyQuotaState = {
  isExhausted: false,
  exhaustedAt: null,
  resetAt: null,
  reason: '',
};

function getNextDailyResetTime() {
  const now = new Date();
  // Free tier daily requests reset at 00:00 Pacific Time (~08:00 UTC)
  const resetDate = new Date();
  resetDate.setUTCHours(8, 0, 0, 0);
  if (resetDate <= now) {
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  }
  return resetDate;
}

function checkDailyQuotaExhausted() {
  if (!dailyQuotaState.isExhausted) return false;
  if (dailyQuotaState.resetAt && Date.now() >= dailyQuotaState.resetAt.getTime()) {
    dailyQuotaState.isExhausted = false;
    dailyQuotaState.exhaustedAt = null;
    dailyQuotaState.resetAt = null;
    dailyQuotaState.reason = '';
    return false;
  }
  return true;
}

function markDailyQuotaExhausted(reason = '') {
  dailyQuotaState.isExhausted = true;
  dailyQuotaState.exhaustedAt = new Date();
  dailyQuotaState.resetAt = getNextDailyResetTime();
  dailyQuotaState.reason = reason;
  logger.warn('Gemini daily quota marked exhausted - suppressing future outbound calls until reset', {
    resetAt: dailyQuotaState.resetAt.toISOString(),
    reason: reason ? String(reason).slice(0, 120) : 'Daily quota limit reached',
  });
}

function resetQuotaCache() {
  dailyQuotaState.isExhausted = false;
  dailyQuotaState.exhaustedAt = null;
  dailyQuotaState.resetAt = null;
  dailyQuotaState.reason = '';
}

function sanitizeError(err) {
  if (!err) return '';
  let msg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
  if (env.ai?.apiKey) {
    msg = msg.split(env.ai.apiKey).join('[REDACTED_API_KEY]');
  }
  return msg;
}

function parseRetryAfter(headerValue) {
  if (!headerValue) return null;
  const trimmed = String(headerValue).trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = parseInt(trimmed, 10);
    return seconds > 0 ? seconds : null;
  }
  const dateMs = Date.parse(trimmed);
  if (!isNaN(dateMs)) {
    const diff = Math.ceil((dateMs - Date.now()) / 1000);
    return diff > 0 ? diff : 1;
  }
  return null;
}

function isDailyQuotaError(statusCode, errorBody, errorMessage = '') {
  const text = `${errorMessage} ${JSON.stringify(errorBody || '')}`.toLowerCase();

  const dailyIndicators = [
    'generate_content_free_tier_requests',
    'daily request limit',
    'daily request limit exceeded',
    'free_tier_requests_per_day',
    'requests_per_day',
    'quota_limit_value',
    'free tier daily',
    'daily quota',
  ];

  if (dailyIndicators.some((indicator) => text.includes(indicator))) {
    return true;
  }

  if (Array.isArray(errorBody?.error?.details)) {
    for (const detail of errorBody.error.details) {
      if (Array.isArray(detail?.violations)) {
        for (const v of detail.violations) {
          const desc = String(v.description || '').toLowerCase();
          if (desc.includes('daily') || desc.includes('day') || desc.includes('free tier')) {
            return true;
          }
        }
      }
      if (detail?.metadata) {
        const meta = JSON.stringify(detail.metadata).toLowerCase();
        if (meta.includes('per_day') || meta.includes('free_tier_requests')) {
          return true;
        }
      }
    }
  }

  return false;
}

function isTransientRateLimitError(statusCode, errorBody, errorMessage = '') {
  if (statusCode === 429) {
    return !isDailyQuotaError(statusCode, errorBody, errorMessage);
  }
  return [503, 504].includes(statusCode);
}

// ==========================================
// 3. GEMINI API REQUEST
// ==========================================

function callGemini(userPrompt) {
  return new Promise((resolve, reject) => {
    // Check if daily quota is already exhausted before making any network call
    if (checkDailyQuotaExhausted()) {
      const secondsToReset = dailyQuotaState.resetAt
        ? Math.max(1, Math.ceil((dailyQuotaState.resetAt.getTime() - Date.now()) / 1000))
        : 3600;
      const quotaErr = new Error(AI_QUOTA_ERROR_MESSAGE);
      quotaErr.statusCode = 429;
      quotaErr.isDailyQuota = true;
      quotaErr.retryAfter = secondsToReset;
      return reject(quotaErr);
    }

    if (!env.ai.apiKey || !env.ai.apiUrl) {
      logger.error('Gemini API configuration missing');
      return reject(ApiError.internal('Gemini AI service is not configured'));
    }

    const payload = JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_GUARDRAILS }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
      },
    });

    let url;
    try {
      url = new URL(env.ai.apiUrl);
    } catch {
      return reject(ApiError.internal('Invalid Gemini API URL'));
    }

    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.ai.apiKey,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            logger.error('Invalid Gemini response', {
              statusCode: res.statusCode,
            });
            return reject(ApiError.internal('Invalid Gemini API response'));
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            const rawErrMsg = parsed?.error?.message || 'Gemini API request failed';
            const isDaily = isDailyQuotaError(res.statusCode, parsed, rawErrMsg);
            const retryAfter = parseRetryAfter(res.headers['retry-after']);

            if (isDaily) {
              markDailyQuotaExhausted(rawErrMsg);
            }

            logger.warn('Gemini API returned error', {
              statusCode: res.statusCode,
              isDailyQuota: isDaily,
              retryAfter,
              errorMessage: sanitizeError(rawErrMsg),
            });

            const error = new Error(isDaily ? AI_QUOTA_ERROR_MESSAGE : rawErrMsg);
            error.statusCode = res.statusCode;
            error.isDailyQuota = isDaily;
            error.retryAfter = retryAfter;
            error.geminiError = parsed?.error;

            return reject(error);
          }

          resolve(parsed);
        });
      }
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Gemini API request timed out'));
    });

    req.on('error', (err) => {
      const isTimeout = err.message?.includes('timed out');
      logger.error('Gemini service request failed', {
        message: sanitizeError(err.message),
        isTimeout,
      });

      if (isTimeout) {
        err.statusCode = 504;
        err.isTimeout = true;
      }

      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// ==========================================
// 4. RETRY HELPER WITH EXPONENTIAL BACKOFF
// ==========================================

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiWithRetry(prompt) {
  // 1. If daily quota is already exhausted, immediately throw HTTP 429
  if (checkDailyQuotaExhausted()) {
    const secondsToReset = dailyQuotaState.resetAt
      ? Math.max(1, Math.ceil((dailyQuotaState.resetAt.getTime() - Date.now()) / 1000))
      : 3600;
    throw ApiError.tooManyRequests(AI_QUOTA_ERROR_MESSAGE, null, secondsToReset);
  }

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGemini(prompt);
    } catch (error) {
      // A. Daily Quota Exceeded -> NEVER RETRY
      if (error.isDailyQuota || isDailyQuotaError(error.statusCode, error.geminiError, error.message)) {
        markDailyQuotaExhausted(error.message);
        const secondsToReset = dailyQuotaState.resetAt
          ? Math.max(1, Math.ceil((dailyQuotaState.resetAt.getTime() - Date.now()) / 1000))
          : 3600;
        throw ApiError.tooManyRequests(AI_QUOTA_ERROR_MESSAGE, null, secondsToReset);
      }

      // B. Check if error is genuinely transient (RPM rate-limit or 503/504)
      const isTransient =
        isTransientRateLimitError(error.statusCode, error.geminiError, error.message) ||
        error.isTimeout;

      // Unretryable or exhausted attempts
      if (!isTransient || attempt === MAX_ATTEMPTS) {
        logger.error('Gemini request failed permanently', {
          attempt,
          statusCode: error.statusCode,
          message: sanitizeError(error.message),
        });

        if (error.statusCode === 429) {
          throw ApiError.tooManyRequests(AI_QUOTA_ERROR_MESSAGE, null, error.retryAfter);
        }

        if (error.isTimeout || error.statusCode === 504) {
          throw ApiError.tooManyRequests('AI assistance is experiencing high traffic. Please try again in a few moments.');
        }

        if (error.statusCode === 500 && error.message?.includes('not configured')) {
          throw error;
        }

        throw ApiError.internal('AI service is temporarily unavailable. Please try again later.');
      }

      // C. Exponential backoff only for genuinely transient rate limits / overloads
      let delayMs;
      if (error.retryAfter && error.retryAfter > 0 && error.retryAfter <= 5) {
        delayMs = error.retryAfter * 1000;
      } else {
        // Exponential backoff: attempt 1 = 1000ms, attempt 2 = 2000ms, + jitter
        const baseDelay = Math.pow(2, attempt - 1) * 1000;
        const jitter = Math.floor(Math.random() * 250);
        delayMs = Math.min(baseDelay + jitter, 4000);
      }

      logger.warn('Retrying Gemini API request for transient error', {
        attempt,
        nextRetryIn: delayMs,
        statusCode: error.statusCode,
      });

      await wait(delayMs);
    }
  }
}

// ==========================================
// 4. EXTRACT GEMINI RESPONSE
// ==========================================

function extractText(apiResponse) {

  return (
    apiResponse?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('') || ''
  );

}

// ==========================================
// 5. SAFE JSON PARSER
// ==========================================

function safeParseStructured(text) {

  try {

    const cleaned = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleaned);

  } catch (error) {

    logger.error('Failed to parse Gemini JSON response', {
      message: error.message
    });

    return null;

  }

}

// ==========================================
// 6. RESPONSE NORMALIZATION
// ==========================================

function withDisclaimer(structured) {

  const validUrgencies = [
    'LOW',
    'MEDIUM',
    'HIGH',
    'EMERGENCY'
  ];

  return {

    summary:
      structured?.summary ||
      'Unable to generate a summary at this time.',

    possibleDepartments:
      Array.isArray(structured?.possibleDepartments)
        ? structured.possibleDepartments
        : ['General Medicine'],

    urgencyCategory:
      validUrgencies.includes(structured?.urgencyCategory)
        ? structured.urgencyCategory
        : 'HIGH',

    followUpQuestions:
      Array.isArray(structured?.followUpQuestions)
        ? structured.followUpQuestions
        : [],

    doctorQuestions:
      Array.isArray(structured?.doctorQuestions)
        ? structured.doctorQuestions
        : [],

    safetyMessage:
      structured?.safetyMessage ||
      MEDICAL_DISCLAIMER,

    disclaimer: MEDICAL_DISCLAIMER

  };

}

// ==========================================
// 7. PATIENT SYMPTOM ASSESSMENT
// ==========================================

async function runAssessment({
  symptoms,
  duration,
  age,
  additionalInfo
}) {

  const prompt = `
Patient-reported symptoms:
${Array.isArray(symptoms) ? symptoms.join(', ') : ''}.

Duration:
${duration || 'not specified'}.

Age:
${age || 'not specified'}.

Additional information:
${additionalInfo || 'none'}.

Summarize the reported information and suggest appropriate
hospital departments for professional evaluation.

Return valid JSON only using the required structure.

Do not diagnose or prescribe medicines.
`;

  const apiResponse =
    await callGeminiWithRetry(prompt);

  const responseText =
    extractText(apiResponse);

  if (!responseText) {
    throw ApiError.internal(
      'Gemini returned an empty assessment'
    );
  }

  const structured =
    safeParseStructured(responseText);

  if (!structured) {
    throw ApiError.internal(
      'Gemini returned invalid assessment JSON'
    );
  }

  return withDisclaimer(structured);

}

// ==========================================
// 8. MEDICAL REPORT ANALYSIS
// ==========================================

async function runReportAnalysis({
  reportText,
  question
}) {

  const prompt = `
Explain the following medical report in general,
plain-language terms.

Do not provide a definitive diagnosis or treatment plan.

Report content:
${reportText || '(no text extracted)'}

Patient question:
${question || 'Please explain this report in simple terms.'}

Respond using the required JSON structure.
`;

  const apiResponse =
    await callGeminiWithRetry(prompt);

  const responseText =
    extractText(apiResponse);

  const structured =
    safeParseStructured(responseText);

  if (!structured) {
    throw ApiError.internal(
      'Gemini returned invalid report analysis'
    );
  }

  return withDisclaimer(structured);

}

// ==========================================
// 9. CONSULTATION SUMMARY
// ==========================================

async function runConsultationSummary({
  symptomText,
  doctorNotes
}) {

  const prompt = `
Generate a structured pre-consultation summary
for a healthcare professional.

Patient information:
${symptomText || 'none'}

Doctor notes:
${doctorNotes || 'none'}

Do not diagnose or prescribe medicines.

Respond using the required JSON structure.
`;

  const apiResponse =
    await callGeminiWithRetry(prompt);

  const responseText =
    extractText(apiResponse);

  const structured =
    safeParseStructured(responseText);

  if (!structured) {
    throw ApiError.internal(
      'Gemini returned invalid consultation summary'
    );
  }

  return withDisclaimer(structured);

}

// ==========================================
// 10. REPORT COMPARISON EXPLANATION (CONTINUITY ENGINE)
// ==========================================

async function runComparisonExplanation({ matchedParameters, unmatchedParameters, baselineTitle, currentTitle }) {
  const prompt = `
You are an AI assistant assisting in a medical report evolution tracker.
Compare the following two medical reports chronologically.

Baseline Report: ${baselineTitle || 'Previous Report'}
Current Report: ${currentTitle || 'Latest Report'}

Matched Parameters:
${JSON.stringify(matchedParameters || [], null, 2)}

Unmatched Parameters:
${JSON.stringify(unmatchedParameters || [], null, 2)}

Rules:
1. Explain the differences between the reports in objective, neutral clinical terminology.
2. NEVER provide a disease diagnosis or suggest medications/treatments.
3. NEVER describe a numerical change as "improvement" or "deterioration" without clinical context. State the direction and magnitude of the change objectively.
4. Highlight parameters that lie outside standard reference ranges.
5. Return ONLY a valid JSON object matching:
{
  "summary": "string",
  "significantChanges": ["string"],
  "safetyMessage": "string"
}
`;

  try {
    const apiResponse = await callGeminiWithRetry(prompt);
    const responseText = extractText(apiResponse);
    const parsed = safeParseStructured(responseText);
    if (parsed && parsed.summary) {
      return parsed;
    }
  } catch (err) {
    logger.warn('Gemini report comparison failed, falling back to deterministic:', err.message);
  }
  return null;
}

// ==========================================
// 11. PATIENT NAVIGATION SUMMARY
// ==========================================

async function runPatientNavigationSummary({ patient, appointments, prescriptions, records, followUps, comparisons }) {
  const prompt = `
You are an AI clinical summarizer aiding an authorized physician in understanding a patient's complete healthcare journey.
Synthesize the provided real patient history into a structured brief.

Patient Info:
Name: ${patient?.userId?.name || 'Patient'}
Gender: ${patient?.gender || 'Unspecified'}
Blood Group: ${patient?.bloodGroup || 'Unknown'}
Allergies: ${(patient?.allergies || []).join(', ') || 'None'}
Medical History: ${(patient?.medicalHistory || []).join(', ') || 'None'}
Current Medications: ${(patient?.currentMedicines || []).join(', ') || 'None'}

Recent Consultations:
${(appointments || []).map((a) => `- ${new Date(a.date).toLocaleDateString()}: ${a.notes || 'Routine visit'} (${a.status})`).join('\n') || 'None'}

Recent Prescriptions:
${(prescriptions || []).map((p) => `- ${new Date(p.createdAt).toLocaleDateString()}: ${(p.medicines || []).length} medicines. Instructions: ${p.instructions || 'N/A'}`).join('\n') || 'None'}

Pending / Recent Follow-ups:
${(followUps || []).map((f) => `- ${f.title} (Due: ${new Date(f.dueDate).toLocaleDateString()}, Status: ${f.status})`).join('\n') || 'None'}

Recent Report Comparisons:
${(comparisons || []).map((c) => `- ${new Date(c.createdAt).toLocaleDateString()}: ${c.aiDraftAnalysis?.summary || 'Compared reports'}`).join('\n') || 'None'}

Rules:
- NEVER formulate a diagnosis or prescribe treatments.
- Summarize factual information clearly for the doctor.
- Provide thoughtful questions the doctor may consider asking the patient during the upcoming consultation.
- Output MUST be valid JSON only with exact structure:
{
  "patientOverview": "string",
  "previousConsultationSummary": "string",
  "currentConcerns": "string",
  "relevantMedicalHistory": "string",
  "recentReportComparisonSummary": "string",
  "pendingFollowUpTasks": "string",
  "suggestedDoctorQuestions": ["string"]
}
`;

  try {
    const apiResponse = await callGeminiWithRetry(prompt);
    const responseText = extractText(apiResponse);
    const parsed = safeParseStructured(responseText);
    if (parsed && parsed.patientOverview) {
      return parsed;
    }
  } catch (err) {
    logger.warn('Gemini patient navigation summary failed:', err.message);
  }
  return null;
}

// ==========================================
// 12. DOCTOR AI COPILOT TASK DISPATCHER
// ==========================================

async function runDoctorCopilotTask({ taskType, contextData }) {
  let taskInstruction = '';
  switch (taskType) {
    case 'CONSULTATION_DRAFT':
      taskInstruction = `Draft a structured consultation note based on patient symptoms: "${contextData.symptoms || ''}", examination findings: "${contextData.examination || ''}", and provisional observations: "${contextData.notes || ''}". Format with Subjective, Objective, Assessment, Plan (SOAP structure).`;
      break;
    case 'PREVIOUS_CONSULTATION_SUMMARY':
      taskInstruction = `Summarize previous consultations: "${JSON.stringify(contextData.history || '')}" into a 3-bullet clinical briefing highlighting recurring symptoms, medication adherence, and progression.`;
      break;
    case 'FOLLOW_UP_DRAFT':
      taskInstruction = `Propose an intelligent follow-up timeline and specific recommended lab/imaging tests for: "${contextData.condition || contextData.notes || ''}". Specify optimal due timeframe and clear patient instructions.`;
      break;
    case 'REFERRAL_SUMMARY':
      taskInstruction = `Draft a concise, collegial referral letter from the referring physician to a specialist (${contextData.specialty || 'Specialist'}) explaining reason: "${contextData.reason || ''}" and key clinical findings: "${contextData.findings || ''}".`;
      break;
    case 'PATIENT_EXPLANATION':
      taskInstruction = `Translate the clinical diagnosis/findings: "${contextData.clinicalText || ''}" into compassionate, plain-language explanation suitable for a patient without medical training. Avoid scary jargon, reassure appropriately, emphasize next steps.`;
      break;
    case 'MISSING_INFO_CHECK':
      taskInstruction = `Audit the current consultation record for critical omissions. Given: "${JSON.stringify(contextData)}", check for missing vital signs, unspecified drug durations, allergy conflict checks, or missing follow-up dates. Return list of flagged missing items.`;
      break;
    default:
      taskInstruction = `Provide helpful clinical support for doctor context: ${JSON.stringify(contextData)}`;
  }

  const prompt = `
You are a Doctor AI Clinical Copilot assisting a licensed healthcare professional.
Task: ${taskType}
Instructions: ${taskInstruction}

Safety Rules:
- This is a draft for doctor review only.
- The doctor holds final clinical authority and must approve or edit any suggestion.
- Return ONLY valid JSON:
{
  "title": "string",
  "content": "string",
  "bulletPoints": ["string"],
  "recommendations": ["string"],
  "missingItems": ["string"],
  "disclaimer": "${MEDICAL_DISCLAIMER}"
}
`;

  try {
    const apiResponse = await callGeminiWithRetry(prompt);
    const responseText = extractText(apiResponse);
    const parsed = safeParseStructured(responseText);
    if (parsed) {
      return parsed;
    }
  } catch (err) {
    logger.warn(`Gemini copilot task ${taskType} error:`, err.message);
  }

  // Resilient deterministic clinical copilot fallback so doctors are never stranded
  return {
    title: `Copilot Draft: ${taskType.replace(/_/g, ' ')}`,
    content: `Draft generated for doctor review based on provided input: ${contextData.symptoms || contextData.notes || contextData.reason || 'Clinical consultation evaluation'}.`,
    bulletPoints: [
      'Evaluate vital signs and symptom chronicity.',
      'Correlate findings with prior laboratory benchmarks.',
      'Verify patient medication compliance and tolerability.',
    ],
    recommendations: [
      'Schedule follow-up review within 7-14 days.',
      'Request repeat metabolic/biomarker assessment prior to visit.',
    ],
    missingItems: !contextData.vitals ? ['Patient vital signs (Blood Pressure, Heart Rate) not specified.'] : [],
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

// ==========================================
// 13. EXPORT FUNCTIONS
// ==========================================

module.exports = {
  runAssessment,
  runReportAnalysis,
  runConsultationSummary,
  runComparisonExplanation,
  runPatientNavigationSummary,
  runDoctorCopilotTask,
  // Quota & error-handling exports for verification and monitoring
  callGemini,
  callGeminiWithRetry,
  isDailyQuotaError,
  isTransientRateLimitError,
  parseRetryAfter,
  checkDailyQuotaExhausted,
  markDailyQuotaExhausted,
  resetQuotaCache,
  dailyQuotaState,
  AI_QUOTA_ERROR_MESSAGE,
};
