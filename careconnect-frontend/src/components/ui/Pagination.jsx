import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Works with the backend `pagination` object: { total, page, limit, totalPages }. */
export default function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted small">Page {page} of {totalPages} · {total} total</span>
      <div className="row gap-sm">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={15} /> Previous
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
