'use client';

import * as React from 'react';
import { useDocPush } from '../context/docpush-provider';

interface Draft {
  id: string;
  docPath: string;
  branchName: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

export function useDrafts(status?: string) {
  const { fetcher } = useDocPush();
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fetchDrafts = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = status ? `/api/drafts?status=${status}` : '/api/drafts';
      const res = await fetcher<{ drafts: Draft[] }>(url);
      setDrafts(res.drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }, [status, fetcher]);

  React.useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const createDraft = async (data: { docPath: string; title: string; content?: string }) => {
    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn('Draft submission already in progress');
      return null;
    }

    setIsSubmitting(true);
    try {
      const res = await fetcher<{ draft: Draft }>('/api/drafts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchDrafts();
      return res.draft;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateDraft = async (id: string, content: string, message?: string) => {
    await fetcher(`/api/drafts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content, message }),
    });
    await fetchDrafts();
  };

  const approveDraft = async (id: string) => {
    await fetcher(`/api/drafts/${id}/approve`, { method: 'POST' });
    await fetchDrafts();
  };

  const rejectDraft = async (id: string, reason?: string) => {
    await fetcher(`/api/drafts/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    await fetchDrafts();
  };

  return {
    drafts,
    loading,
    error,
    isSubmitting,
    createDraft,
    updateDraft,
    approveDraft,
    rejectDraft,
    refetch: fetchDrafts,
  };
}
