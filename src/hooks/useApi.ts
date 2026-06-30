import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const getHeaders = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  ...extra,
});

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
      throw new Error('Session expirée');
    }
    const body = await res.json().catch(() => ({ message: `Erreur ${res.status}` }));
    throw new Error(body.message || `Erreur ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json();
};

export function useApi<T = unknown>(baseUrl?: string) {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: false, error: null });

  const request = useCallback(async <R = T>(
    urlOrPath: string,
    options: { method?: Method; body?: unknown; params?: Record<string, string>; headers?: Record<string, string> } = {}
  ): Promise<R> => {
    const url = baseUrl ? `${baseUrl}${urlOrPath}` : urlOrPath.startsWith('http') ? urlOrPath : `${API_BASE_URL}${urlOrPath}`;
    const { method = 'GET', body, params, headers } = options;
    const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(fullUrl, {
        method,
        headers: getHeaders(headers),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await handleResponse<R>(res);
      if (method === 'GET') setState({ data: data as unknown as T, loading: false, error: null });
      else setState(prev => ({ ...prev, loading: false }));
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur serveur';
      setState({ data: null, loading: false, error: message });
      throw err;
    }
  }, [baseUrl]);

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), []);

  return { ...state, request, reset };
}

export function useApiGet<T = unknown>(baseUrl?: string) {
  const { data, loading, error, request, reset } = useApi<T>(baseUrl);

  const get = useCallback(async (urlOrPath: string, params?: Record<string, string>) => {
    return request<T>(urlOrPath, { params });
  }, [request]);

  return { data, loading, error, get, reset };
}

export function useMutation<T = unknown>(baseUrl?: string) {
  const { request } = useApi<T>(baseUrl);

  const mutate = useCallback(async <R = T>(
    urlOrPath: string,
    options: { method?: Method; body?: unknown; params?: Record<string, string> } = {}
  ): Promise<R> => {
    return request<R>(urlOrPath, { method: options.method || 'POST', body: options.body, params: options.params });
  }, [request]);

  return { mutate };
}
