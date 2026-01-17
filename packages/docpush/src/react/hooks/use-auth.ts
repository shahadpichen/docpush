'use client';

import * as React from 'react';
import { useDocPush } from '../context/docpush-provider';

interface User {
  id: string;
  email: string | null;
  name?: string;
  role: 'editor' | 'admin';
}

export function useAuth() {
  const { fetcher } = useDocPush();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetcher<{ authenticated: boolean; user?: User }>('/api/auth/me')
      .then((res) => {
        if (res.authenticated && res.user) {
          setUser(res.user);
        }
      })
      .finally(() => setLoading(false));
  }, [fetcher]);

  const logout = async () => {
    await fetcher('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const requestMagicLink = async (email: string) => {
    await fetcher('/api/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    logout,
    requestMagicLink,
  };
}
