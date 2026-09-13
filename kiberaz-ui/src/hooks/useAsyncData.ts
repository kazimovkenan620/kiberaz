import { useCallback, useEffect, useState } from 'react';

// ─── Asinxron məlumat yükləmə vəziyyəti ───────────────────────
// Komponentlərdə təkrarlanan "yüklənir / xəta / hazır" nümunəsini bir yerə yığır.
// `loader` stabil olmalıdır (useCallback) — dəyişəndə məlumat yenidən çəkilir.
// Sorğu ləğv edilə bilər: komponent söküləndə və ya loader dəyişəndə köhnə
// cavab vəziyyəti əzmir.

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export function useAsyncData<T>(loader: () => Promise<T>): { state: AsyncState<T>; reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Yüklənmə vəziyyəti effektin içində sinxron deyil, mikrotaskda qoyulur —
    // fetch cavabından həmişə əvvəl icra olunur.
    Promise.resolve().then(() => { if (!cancelled) setState(s => (s.status === 'loading' ? s : { status: 'loading' })); });
    loader().then(
      data => { if (!cancelled) setState({ status: 'ready', data }); },
      (err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error && err.message ? err.message : 'Serverlə əlaqə yaradıla bilmədi.';
        setState({ status: 'error', message });
      },
    );
    return () => { cancelled = true; };
  }, [loader, tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);

  return { state, reload };
}
