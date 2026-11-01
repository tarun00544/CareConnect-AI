import { Check, CheckCheck, Paperclip } from 'lucide-react';
import { formatTimeOfDay } from '../../utils/format';
import { fileHref } from '../../utils/env';

export default function MessageBubble({ message: m, mine }) {
  return (
    <div className={`bubble-row ${mine ? 'mine' : 'theirs'}`}>
      <div className={`bubble ${mine ? 'bubble-mine' : 'bubble-theirs'}`}>
        {m.attachment?.url && (
          <a className="bubble-attach" href={fileHref(m.attachment.url)} target="_blank" rel="noreferrer noopener">
            <Paperclip size={14} aria-hidden="true" /> Attachment
          </a>
        )}
        {m.message && <p>{m.message}</p>}
        <span className="bubble-meta">
          {formatTimeOfDay(m.createdAt)}
          {mine && (m.read ? <CheckCheck size={13} aria-label="Read" /> : <Check size={13} aria-label="Sent" />)}
        </span>
      </div>
    </div>
  );
}
