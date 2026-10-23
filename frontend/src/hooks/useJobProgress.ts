import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api/client';

interface JobProgressState {
  status: 'queued' | 'processing' | 'completed' | 'failed' | null;
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
}

interface UseJobProgressOptions {
  onCompleted?: (result: Record<string, unknown> | null) => void;
  onFailed?: (error: string | null) => void;
}

export function useJobProgress(jobId: string | null, options?: UseJobProgressOptions) {
  const [state, setState] = useState<JobProgressState>({
    status: null,
    progress: 0,
    result: null,
    error: null,
  });
  const eventSourceRef = useRef<EventSource | null>(null);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setState({ status: null, progress: 0, result: null, error: null });
      return;
    }

    cleanup();

    const url = api.jobs.streamUrl(jobId);
    const token = api.getToken();
    if (!token) return;

    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          status: 'queued' | 'processing' | 'completed' | 'failed';
          progress: number;
          result?: Record<string, unknown>;
          error?: string;
        };

        setState({
          status: data.status,
          progress: data.progress ?? 0,
          result: data.result ?? null,
          error: data.error ?? null,
        });

        if (data.status === 'completed') {
          callbacksRef.current?.onCompleted?.(data.result ?? null);
          cleanup();
        } else if (data.status === 'failed') {
          callbacksRef.current?.onFailed?.(data.error ?? null);
          cleanup();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      cleanup();
    };

    return cleanup;
  }, [jobId, cleanup]);

  return state;
}
