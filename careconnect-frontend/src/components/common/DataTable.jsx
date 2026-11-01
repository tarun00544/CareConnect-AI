/**
 * Responsive table: scrolls horizontally inside its own container so the page never scrolls sideways.
 * columns: [{ key, header, render?(row), className }]
 */
export default function DataTable({ columns, rows, rowKey = '_id', onRowClick, caption }) {
  return (
    <div className="table-wrap">
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={c.className}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[rowKey] || i} onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? 'clickable' : ''}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} className={c.className}>{c.render ? c.render(row) : row[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
