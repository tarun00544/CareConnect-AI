export default function Skeleton({ height = 16, width = '100%', radius = 8, style }) {
  return <span className="skeleton" style={{ height, width, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function SkeletonCards({ count = 3, height = 120 }) {
  return (
    <div className="grid grid-cards" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card" key={i}>
          <Skeleton height={16} width="45%" />
          <div style={{ height: 10 }} />
          <Skeleton height={height} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="card" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '10px 0' }}>
          <Skeleton height={14} />
        </div>
      ))}
    </div>
  );
}
