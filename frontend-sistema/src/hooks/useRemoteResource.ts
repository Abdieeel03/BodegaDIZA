import { useCallback, useEffect, useState } from 'react';

export type RemoteStatus = 'idle' | 'loading' | 'success' | 'error';

export type RemoteResource<T> = {
  data: T | null;
  status: RemoteStatus;
  error: string | null;
  reload: () => void;
};

type Loader<T> = (signal: AbortSignal) => Promise<T>;

/**
 * Hook reutilizable para peticiones de lectura (Dashboard, Inventario, etc.).
 * - No realiza ninguna llamada si enabled=false.
 * - Cancela peticiones al desmontar la vista y antes de volver a consultar.
 * - Expone recarga, estado y error para manejar la interfaz.
 */
export function useRemoteResource<T>(loader: Loader<T>, enabled: boolean): RemoteResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<RemoteStatus>(enabled ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    setData(null);
    setStatus('loading');
    setError(null);

    const cargar = async () => {
      try {
        const resultado = await loader(controller.signal);
        if (controller.signal.aborted) return;
        setData(resultado);
        setStatus('success');
      } catch (cause: unknown) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo completar la consulta.');
        setStatus('error');
      }
    };

    void cargar();
    return () => controller.abort();
  }, [enabled, loader, revision]);

  return { data, status, error, reload };
}
