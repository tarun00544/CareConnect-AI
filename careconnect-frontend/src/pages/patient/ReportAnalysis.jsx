import { useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import FileUploader from '../../components/ui/FileUploader';
import AIResult from '../../components/medical/AIResult';
import { AIDisclaimer } from '../../components/medical/DisclaimerBanner';
import FormError from '../../components/common/FormError';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { runReportAnalysis } from '../../services/aiService';
import { uploadReport } from '../../services/uploadService';
import { useToast } from '../../context/AppContext';
import { RECORD_TYPES } from '../../constants';
import { titleCase } from '../../utils/format';

/**
 * Backend contract: POST /api/ai/report-analysis reads ONLY `reportText` and `question`.
 * `fileUrl` is accepted but ignored, and the backend does no OCR/PDF parsing. So:
 *  - the AI analysis works on text the patient pastes (or from a plain .txt file),
 *  - an uploaded file can be saved to their records via POST /api/uploads/report, separately.
 * This is stated in the UI so it never implies the AI "read" the PDF/image.
 */
export default function ReportAnalysis() {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [recordType, setRecordType] = useState('LAB_REPORT');
  const [saved, setSaved] = useState(null);
  const [reportText, setReportText] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const saveToRecords = async (f, onProgress) => {
    const rec = await uploadReport(f, { type: recordType, title: f.name, onProgress });
    setSaved(rec);
    toast.success('Report saved to your medical records');
    return rec;
  };

  const analyse = async (e) => {
    e.preventDefault();
    if (busy || !reportText.trim()) return;
    setBusy(true); setError(null); setResult(null);
    try {
      setResult(await runReportAnalysis({ reportText: reportText.trim(), fileUrl: saved?.fileUrl, question: question.trim() }));
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="AI Report Analysis" subtitle="Get a plain-language, general explanation of a report — not a diagnosis." />
      <AIDisclaimer />
      <div className="grid grid-2 align-start">
        <section className="card stack">
          <h3><FileText size={18} aria-hidden="true" /> 1. Keep the file (optional)</h3>
          <p className="muted small">Upload a PDF or image to save it to your medical records. The AI explains text, so paste the report's wording in step 2.</p>
          <Field label="Record type" htmlFor="rtype">
            <select id="rtype" className="select" value={recordType} onChange={(e) => setRecordType(e.target.value)}>{RECORD_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
          </Field>
          <FileUploader label="Upload report" onSelect={setFile} onUpload={saveToRecords} buttonLabel="Save to my records" />
          {saved && <p className="text-success small">Saved as “{saved.title}”. View it under Medical Records.</p>}
        </section>

        <section className="card">
          <form className="stack" onSubmit={analyse}>
            <h3><Sparkles size={18} aria-hidden="true" /> 2. Ask for a general explanation</h3>
            <Field label="Report text" htmlFor="rtext" required hint="Copy the text from your report (values, findings, remarks).">
              <textarea id="rtext" className="input" rows={8} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Paste the report text here…" />
            </Field>
            <Field label="Your question (optional)" htmlFor="rq"><input id="rq" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What do these values generally mean?" /></Field>
            <FormError error={error} />
            <button type="submit" className="btn btn-primary" disabled={busy || !reportText.trim()}>{busy ? 'Analysing…' : 'Explain in general terms'}</button>
          </form>
        </section>
      </div>
      {busy && <LoadingSpinner label="Preparing a general explanation…" />}
      {result && <section className="card"><AIResult result={result} variant="report" /></section>}
    </div>
  );
}
