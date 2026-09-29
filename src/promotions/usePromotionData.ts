import { useEffect, useState } from 'react';
export function usePromotionData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null); setData(null);
    load(controller.signal).then(value => { if (!controller.signal.aborted) { setData(value); setLoading(false); } }).catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Unable to load data.'); setLoading(false); } });
    return () => controller.abort();
  }, [load, version]);
  return { data, loading, error, refresh: () => setVersion(value => value + 1) };
}
