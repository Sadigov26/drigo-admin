import { useEffect, useState } from 'react';

export type Resource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T; loadedAt: Date }
  | { status: 'error'; message: string };

// Each panel can fail or retry independently. Cancel requests when the page unmounts or refreshes.
export function useDashboardResource<T>(load: (signal: AbortSignal) => Promise<T>, refreshKey: number) {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ status: 'ready', data, loadedAt: new Date() });
    }).catch(error => {
      if (!controller.signal.aborted) {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load dashboard data.' });
      }
    });
    return () => controller.abort();
  }, [load, refreshKey, attempt]);
  return { state, retry: () => setAttempt(value => value + 1) };
}
