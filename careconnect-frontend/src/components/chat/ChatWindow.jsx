import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, WifiOff } from 'lucide-react';
import MessageBubble from './MessageBubble';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';
import { MessageSquare } from 'lucide-react';
import { initials, formatDay } from '../../utils/format';

/**
 * Presentational chat panel. State comes from hooks/useChatSocket.
 * `header`: { name, subtitle } · `chat`: return value of useChatSocket.
 */
export default function ChatWindow({ header, chat, myUserId, onBack, compact = false }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat.messages.length, chat.otherTyping]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError(null);
    const res = await chat.send(text);
    setSending(false);
    if (res.ok) setText('');
    else setSendError(res.error?.message || 'Message could not be sent.');
  };

  let lastDay = '';
  return (
    <section className={`chat ${compact ? 'chat-compact' : ''}`} aria-label="Conversation">
      {header && (
        <div className="chat-head">
          {onBack && <button type="button" className="icon-btn chat-back" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={18} /></button>}
          <span className="avatar">{initials(header.name)}</span>
          <div className="chat-title">
            <strong>{header.name}</strong>
            <span className="muted small">
              {chat.otherOnline === true && <><span className="live-dot live-connected" aria-hidden="true" /> Online · </>}
              {chat.otherOnline === false && <>Offline · </>}
              {header.subtitle}
            </span>
          </div>
        </div>
      )}
      {!chat.connected && (
        <div className="chat-banner" role="status"><WifiOff size={14} aria-hidden="true" /> Reconnecting to live chat — messages will be sent over the standard connection meanwhile.</div>
      )}
      <div className="chat-body">
        {chat.loading ? <LoadingSpinner label="Loading messages…" /> : chat.error && chat.messages.length === 0 ? (
          <ErrorState error={chat.error} onRetry={chat.reload} compact />
        ) : chat.messages.length === 0 ? (
          <EmptyState icon={MessageSquare} compact title="No messages yet" message="Say hello to start the conversation." />
        ) : (
          chat.messages.map((m) => {
            const day = formatDay(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m._id}>
                {showDay && <div className="day-sep"><span>{day}</span></div>}
                <MessageBubble message={m} mine={String(m.senderId) === String(myUserId)} />
              </div>
            );
          })
        )}
        {chat.otherTyping && <div className="typing" aria-live="polite"><span /><span /><span /> <em className="sr-only">Typing</em></div>}
        <div ref={endRef} />
      </div>
      {sendError && <div className="field-error chat-error" role="alert">{sendError}</div>}
      <form className="chat-input" onSubmit={submit}>
        <input
          className="input"
          value={text}
          onChange={(e) => { setText(e.target.value); chat.notifyTyping(); }}
          placeholder="Type a message"
          aria-label="Message"
          maxLength={2000}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || sending} aria-label="Send message"><Send size={16} /><span className="hide-sm"> Send</span></button>
      </form>
    </section>
  );
}
