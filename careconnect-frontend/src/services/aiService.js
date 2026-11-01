import api from './api';
import { unwrap } from '../utils/response';

// In-flight request deduplication to prevent duplicate submissions from rapid clicks or race conditions
const inFlightRequests = new Map();

async function deduplicatedPost(url, body) {
  const key = `${url}:${JSON.stringify(body)}`;
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = (async () => {
    try {
      const response = await api.post(url, body);
      return unwrap(response);
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

// POST /api/ai/assessment  body: { symptoms: string[] (min 1), duration?, age?(0-130 int), additionalInfo? }
export const runAssessment = async ({ symptoms, duration, age, additionalInfo }) => {
  const body = { symptoms };
  if (duration) body.duration = duration;
  if (age !== undefined && age !== null && age !== '') body.age = Number(age);
  if (additionalInfo) body.additionalInfo = additionalInfo;
  return deduplicatedPost('/api/ai/assessment', body);
};

// POST /api/ai/report-analysis  body: { reportText?, fileUrl?, question? }
export const runReportAnalysis = async ({ reportText, fileUrl, question }) => {
  const body = {};
  if (reportText) body.reportText = reportText;
  if (fileUrl) body.fileUrl = fileUrl;
  if (question) body.question = question;
  return deduplicatedPost('/api/ai/report-analysis', body);
};

// POST /api/ai/consultation-summary  body: { appointmentId, doctorNotes? } (any authenticated role)
export const runConsultationSummary = async ({ appointmentId, doctorNotes }) => {
  const body = { appointmentId };
  if (doctorNotes) body.doctorNotes = doctorNotes;
  return deduplicatedPost('/api/ai/consultation-summary', body);
};
