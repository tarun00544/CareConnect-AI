export default function PageHeader({ title, subtitle, actions, action, eyebrow }) {
  const acts = actions || action;
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {acts && <div className="page-actions">{acts}</div>}
    </header>
  );
}
