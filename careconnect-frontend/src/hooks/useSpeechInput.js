import { useCallback, useEffect, useRef, useState } from 'react';

/** Optional microphone dictation via the browser's Web Speech API. `supported` is false where unavailable. */
export function useSpeechInput(onText) {
  const Rec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const cb = useRef(onText);
  cb.current = onText;

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Rec) return;
    setError(null);
    const rec = new Rec();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => cb.current?.(e.results[0][0].transcript);
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Voice input failed. Please type instead.');
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [Rec]);

  useEffect(() => () => recRef.current?.abort?.(), []);

  return { supported: !!Rec, listening, error, start, stop };
}
