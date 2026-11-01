import { useState } from 'react';
import { ArrowDown, ArrowUp, Minus, AlertTriangle, CheckCircle, SlidersHorizontal } from 'lucide-react';

export default function ComparisonChart({ parameters = [] }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'OUT_OF_RANGE' | 'SIGNIFICANT'

  if (!parameters || parameters.length === 0) {
    return (
      <div className="card text-center py-6 muted small">
        No numeric parameters available to chart.
      </div>
    );
  }

  const filtered = parameters.filter((p) => {
    if (filter === 'OUT_OF_RANGE') return p.currentFlag !== 'NORMAL' && p.currentFlag !== 'UNKNOWN';
    if (filter === 'SIGNIFICANT') return Math.abs(p.percentChange) >= 10;
    return true;
  });

  return (
    <div className="stack">
      <div className="row between wrap gap-sm">
        <h4 className="row gap-xs">
          <SlidersHorizontal size={16} className="muted" />
          <span>Biomarker Evolution Comparison ({filtered.length} of {parameters.length})</span>
        </h4>
        <div className="btn-group row gap-xs">
          <button
            type="button"
            className={`btn btn-sm ${filter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('ALL')}
          >
            All Parameters
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filter === 'OUT_OF_RANGE' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('OUT_OF_RANGE')}
          >
            Out of Range
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filter === 'SIGNIFICANT' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('SIGNIFICANT')}
          >
            Significant Shifts (≥10%)
          </button>
        </div>
      </div>

      <div className="grid gap-sm">
        {filtered.map((param, idx) => {
          const isUp = param.delta > 0;
          const isDown = param.delta < 0;
          const isUnchanged = param.delta === 0;

          const isOutRange = param.currentFlag === 'HIGH' || param.currentFlag === 'LOW';

          return (
            <div
              key={idx}
              className="card p-sm"
              style={{
                borderLeft: `4px solid ${
                  isOutRange ? 'var(--red-600, #dc2626)' : 'var(--teal-500, #14b8a6)'
                }`,
                background: isOutRange ? 'rgba(254, 242, 242, 0.4)' : '#ffffff',
              }}
            >
              <div className="row between wrap gap-sm">
                <div>
                  <div className="row gap-xs">
                    <strong style={{ fontSize: '0.98rem' }}>{param.name}</strong>
                    {isOutRange ? (
                      <span className="badge badge-danger row gap-xs" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                        <AlertTriangle size={12} /> {param.currentFlag}
                      </span>
                    ) : (
                      <span className="badge badge-success row gap-xs" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                        <CheckCircle size={12} /> NORMAL
                      </span>
                    )}
                  </div>
                  <div className="muted small" style={{ marginTop: '3px' }}>
                    Standard Ref: {param.referenceRange || 'Lab reference standard'}
                  </div>
                </div>

                {/* Values Comparison */}
                <div className="row gap-md align-center">
                  <div className="text-right">
                    <div className="muted small">Baseline</div>
                    <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>
                      {param.baselineValue} <span className="small muted">{param.unit}</span>
                    </div>
                  </div>

                  <div className="row center" style={{ width: '28px' }}>
                    {isUp && <ArrowUp size={18} color="var(--red-600)" />}
                    {isDown && <ArrowDown size={18} color="var(--teal-600)" />}
                    {isUnchanged && <Minus size={18} className="muted" />}
                  </div>

                  <div className="text-right">
                    <div className="muted small">Latest</div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: isOutRange ? 'var(--red-600)' : 'var(--navy-900)' }}>
                      {param.currentValue} <span className="small muted">{param.unit}</span>
                    </div>
                  </div>

                  <div style={{ minWidth: '85px', textAlign: 'right' }}>
                    <span
                      className={`badge ${
                        Math.abs(param.percentChange) >= 10
                          ? isUp ? 'badge-danger' : 'badge-info'
                          : 'badge-ghost'
                      }`}
                      style={{ fontSize: '0.82rem', padding: '3px 8px' }}
                    >
                      {param.delta > 0 ? `+${param.delta}` : param.delta} {param.unit}
                      <br />
                      <span style={{ fontSize: '0.72rem' }}>
                        ({param.percentChange > 0 ? `+${param.percentChange}` : param.percentChange}%)
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Graphical Delta Bar representation */}
              <div style={{ marginTop: '10px', background: 'var(--gray-100)', height: '6px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(15, (param.currentValue / (param.maxRange || (param.currentValue * 1.5))) * 100))}%`,
                    background: isOutRange ? 'var(--red-600, #dc2626)' : 'var(--teal-500, #14b8a6)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
