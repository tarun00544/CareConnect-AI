import { Link } from 'react-router-dom';

/** items: [{ id, icon: Component, title, description, date(string), tone, to, badge }] */
export default function Timeline({ items }) {
  return (
    <ol className="timeline">
      {items.map((it) => {
        const Icon = it.icon;
        const body = (
          <>
            <div className="tl-head">
              <strong>{it.title}</strong>
              {it.badge}
            </div>
            {it.description && <div className="muted small">{it.description}</div>}
            <div className="tl-date">{it.date}</div>
          </>
        );
        return (
          <li key={it.id} className={`tl-item tl-${it.tone || 'teal'}`}>
            <span className="tl-dot" aria-hidden="true">{Icon && <Icon size={14} />}</span>
            <div className="tl-card">{it.to ? <Link to={it.to} className="tl-link">{body}</Link> : body}</div>
          </li>
        );
      })}
    </ol>
  );
}
