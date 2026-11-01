import { formatHHmm } from '../../utils/format';

/**
 * slots: [{ startTime, endTime, available }] straight from GET /api/doctors/:id/availability.
 * `isPast(slot)` lets the caller disable slots that already passed today.
 */
export default function TimeSlotPicker({ slots, selected, onSelect, isPast }) {
  return (
    <div className="slot-grid" role="listbox" aria-label="Available time slots">
      {slots.map((s) => {
        const past = isPast ? isPast(s) : false;
        const disabled = !s.available || past;
        const active = selected?.startTime === s.startTime;
        return (
          <button
            key={s.startTime}
            type="button"
            role="option"
            aria-selected={active}
            disabled={disabled}
            className={`slot ${active ? 'active' : ''}`}
            onClick={() => onSelect(s)}
            title={!s.available ? 'Already booked' : past ? 'This time has passed' : undefined}
          >
            {formatHHmm(s.startTime)}
            {!s.available && <span className="slot-note">Booked</span>}
          </button>
        );
      })}
    </div>
  );
}
