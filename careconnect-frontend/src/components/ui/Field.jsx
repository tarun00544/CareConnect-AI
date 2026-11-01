/** Label + control + error wrapper used by every form. */
export default function Field({ label, htmlFor, error, hint, required, children, className = '' }) {
  return (
    <div className={`field ${error ? 'field-invalid' : ''} ${className}`}>
      {label && (
        <label htmlFor={htmlFor}>
          {label}
          {required && <span className="req" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <div className="field-hint">{hint}</div>}
      {error && <div className="field-error" role="alert">{error}</div>}
    </div>
  );
}
