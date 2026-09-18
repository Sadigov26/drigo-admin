import { useEffect, useState } from 'react';

// Poll only after the previous request settles. Cleanup cancels requests and the next timer.
export function useVehicleResource<T>(load: (signal: AbortSignal) => Promise<T>, poll = false) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string; updatedAt: Date | null }>({ data: null, loading: true, error: '', updatedAt: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setState({ data: null, loading: true, error: '', updatedAt: null });
    async function run() {
      if (poll && document.visibilityState === 'hidden') { timer = setTimeout(run, 10000); return; }
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted) setState({ data, loading: false, error: '', updatedAt: new Date() });
      } catch (cause) {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: cause instanceof Error ? cause.message : 'Unable to load vehicle data.' }));
      } finally {
        if (poll && !controller.signal.aborted) timer = setTimeout(run, 10000);
      }
    }
    void run();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load, attempt, poll]);
  return { ...state, refresh: () => setAttempt(value => value + 1) };
}
