import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';

/**
 * Standard Loading / Error+Retry / Empty / Success wrapper for every API-driven region.
 * `isEmpty` decides whether to show the empty state. `skeleton` replaces the spinner on first load.
 */
export default function DataState({ loading, error, data, isEmpty, onRetry, empty, skeleton, children, minHeight }) {
  const hasData = data !== null && data !== undefined;
  if (loading && !hasData) return skeleton || <div style={{ minHeight }}><LoadingSpinner /></div>;
  if (error && !hasData) return <ErrorState error={error} onRetry={onRetry} />;
  const emptyNow = typeof isEmpty === 'function' ? isEmpty(data) : isEmpty ?? (Array.isArray(data) && data.length === 0);
  if (hasData && emptyNow) return empty || <EmptyState />;
  return (
    <>
      {error && hasData && <ErrorState error={error} onRetry={onRetry} compact />}
      {children}
    </>
  );
}
