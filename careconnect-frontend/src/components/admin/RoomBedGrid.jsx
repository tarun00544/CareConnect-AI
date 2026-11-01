import { Bed } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { refId, refObj } from '../../utils/format';

/**
 * Visual room → bed layout. `beds` items carry roomId either populated (object) or as an id; `rooms` (optional)
 * supplies room metadata. `renderActions(bed)` renders per-bed controls (admin only).
 * Backend only exposes `assignedPatientId` (an id) on a bed — no patient/doctor names — so we show "Assigned" only.
 */
export default function RoomBedGrid({ beds, rooms = [], renderActions, showAssignment = false }) {
  const roomMap = {};
  rooms.forEach((r) => { roomMap[r._id] = r; });
  const groups = new Map();
  beds.forEach((b) => {
    const room = refObj(b.roomId) || roomMap[refId(b.roomId)] || { _id: refId(b.roomId) };
    const key = room._id || 'unknown';
    if (!groups.has(key)) groups.set(key, { room, beds: [] });
    groups.get(key).beds.push(b);
  });
  const list = [...groups.values()].sort((a, b) => String(a.room.roomNumber).localeCompare(String(b.room.roomNumber), undefined, { numeric: true }));

  return (
    <div className="room-grid">
      {list.map(({ room, beds: rb }) => (
        <section key={room._id || 'unknown'} className="card room-card" aria-label={`Room ${room.roomNumber || ''}`}>
          <div className="row between">
            <h3>Room {room.roomNumber || '—'}</h3>
            {room.roomType && <span className="chip">{String(room.roomType).replace('_', ' ')}</span>}
          </div>
          {room.floor && <div className="muted small">Floor {room.floor}</div>}
          <div className="bed-grid">
            {rb.sort((a, b) => String(a.bedNumber).localeCompare(String(b.bedNumber), undefined, { numeric: true })).map((b) => (
              <div key={b._id} className={`bed bed-${String(b.status).toLowerCase()}`}>
                <div className="row between gap-xs">
                  <span className="bed-num"><Bed size={16} aria-hidden="true" /> {b.bedNumber}</span>
                  <StatusBadge status={b.status} size="sm" />
                </div>
                {showAssignment && b.assignedPatientId && <div className="muted small">Patient assigned</div>}
                {renderActions && <div className="bed-actions">{renderActions(b)}</div>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
