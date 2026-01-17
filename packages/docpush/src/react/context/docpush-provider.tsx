'use client';

import * as React from 'react';

interface DocPushConfig {
  apiUrl: string;
  basePath?: string;
}

interface DocPushContextValue {
  apiUrl: string;
  basePath: string;
  fetcher: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
}

const DocPushContext = React.createContext<DocPushContextValue | null>(null);

export function DocPushProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config: DocPushConfig;
}) {
  const value = React.useMemo(() => {
    const apiUrl = config.apiUrl.replace(/\/$/, '');
    const basePath = config.basePath || '/docs';

    const fetcher = async <T,>(endpoint: string, options?: RequestInit): Promise<T> => {
      const res = await fetch(`${apiUrl}${endpoint}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Request failed');
      }
      return res.json();
    };

    return { apiUrl, basePath, fetcher };
  }, [config.apiUrl, config.basePath]);

  return <DocPushContext.Provider value={value}>{children}</DocPushContext.Provider>;
}

export function useDocPush() {
  const context = React.useContext(DocPushContext);
  if (!context) {
    throw new Error('useDocPush must be used within DocPushProvider');
  }
  return context;
}
