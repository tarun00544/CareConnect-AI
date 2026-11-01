import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, RefreshCw, Trash2, UploadCloud, XCircle } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { UPLOAD_ACCEPT, UPLOAD_MAX_MB } from '../../constants';

/**
 * Reusable file picker with client-side validation that mirrors backend/middleware/upload.js
 * (jpeg/png/webp/pdf, 10 MB) plus optional upload with progress.
 *
 * Props:
 *  - onUpload(file, onProgress) → Promise   (optional; when omitted the component only selects a file via onSelect)
 *  - onSelect(file|null)
 *  - onUploaded(result)
 */
export default function FileUploader({
  label = 'Upload a file',
  hint,
  accept = UPLOAD_ACCEPT,
  maxMb = UPLOAD_MAX_MB,
  onUpload,
  onSelect,
  onUploaded,
  autoUpload = false,
  buttonLabel = 'Upload',
  disabled = false,
  preview = true,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | uploading | success | error
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (file && preview && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
    return undefined;
  }, [file, preview]);

  const validate = (f) => {
    if (!accept.includes(f.type)) return `Unsupported file type. Allowed: JPG, PNG, WebP or PDF.`;
    if (f.size > maxMb * 1024 * 1024) return `File is too large (${formatBytes(f.size)}). Maximum size is ${maxMb} MB.`;
    return null;
  };

  const startUpload = async (f) => {
    if (!onUpload) return;
    setPhase('uploading');
    setProgress(0);
    setError(null);
    try {
      const result = await onUpload(f, setProgress);
      setPhase('success');
      setProgress(100);
      onUploaded?.(result);
    } catch (e) {
      setPhase('error');
      setError(e?.message || 'Upload failed. Please try again.');
    }
  };

  const choose = (f) => {
    if (!f) return;
    const problem = validate(f);
    if (problem) {
      setFile(null);
      setPhase('error');
      setError(problem);
      onSelect?.(null);
      return;
    }
    setFile(f);
    setPhase('idle');
    setError(null);
    onSelect?.(f);
    if (autoUpload) startUpload(f);
  };

  const remove = () => {
    setFile(null);
    setPhase('idle');
    setError(null);
    setProgress(0);
    onSelect?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="uploader">
      <div
        className={`dropzone ${drag ? 'drag' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) choose(e.dataTransfer.files?.[0]); }}
      >
        <UploadCloud size={26} aria-hidden="true" />
        <div>
          <strong>{label}</strong>
          <div className="muted small">{hint || `JPG, PNG, WebP or PDF · up to ${maxMb} MB`}</div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || phase === 'uploading'} onClick={() => inputRef.current?.click()}>
          {file ? 'Replace file' : 'Choose file'}
        </button>
        <input ref={inputRef} type="file" hidden accept={accept.join(',')} onChange={(e) => choose(e.target.files?.[0])} />
      </div>

      {file && (
        <div className="file-row">
          {previewUrl ? <img src={previewUrl} alt="Selected file preview" className="file-thumb" /> : <span className="file-thumb file-thumb-icon"><FileText size={20} /></span>}
          <div className="file-meta">
            <div className="file-name">{file.name}</div>
            <div className="muted small">{formatBytes(file.size)} · {file.type.split('/')[1]?.toUpperCase()}</div>
            {phase === 'uploading' && (
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          <div className="row gap-sm">
            {phase === 'success' && <span className="text-success row gap-xs"><CheckCircle2 size={16} /> Uploaded</span>}
            {phase === 'error' && onUpload && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => startUpload(file)}><RefreshCw size={14} /> Retry</button>
            )}
            {onUpload && !autoUpload && phase === 'idle' && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => startUpload(file)}>{buttonLabel}</button>
            )}
            <button type="button" className="icon-btn" onClick={remove} disabled={phase === 'uploading'} aria-label="Remove file"><Trash2 size={16} /></button>
          </div>
        </div>
      )}

      {error && (
        <div className="field-error row gap-xs" role="alert">
          <XCircle size={15} /> {error}
        </div>
      )}
    </div>
  );
}
