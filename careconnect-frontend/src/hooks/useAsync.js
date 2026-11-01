import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader and exposes { data, error, loading, reload, setData }.
 * `deps` re-run the loader; stale responses are ignored.
 */
export function useAsync(loader, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: immediate });
  const seq = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (id === seq.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (id === seq.current) setState((s) => ({ data: s.data, error, loading: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    return () => {
      seq.current += 1; // invalidate in-flight request on unmount / deps change
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);

  return { ...state, reload: run, setData };
}
