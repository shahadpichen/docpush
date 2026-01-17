'use client';

import * as React from 'react';
import { useDocPush } from '../context/docpush-provider';

interface Comment {
  id: string;
  draftId: string;
  userName: string | null;
  content: string;
  createdAt: number;
}

export function useComments(draftId: string) {
  const { fetcher } = useDocPush();
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchComments = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher<{ comments: Comment[] }>(`/api/drafts/${draftId}/comments`);
      setComments(res.comments);
    } finally {
      setLoading(false);
    }
  }, [draftId, fetcher]);

  React.useEffect(() => {
    if (draftId) fetchComments();
  }, [draftId, fetchComments]);

  const addComment = async (content: string) => {
    await fetcher(`/api/drafts/${draftId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    await fetchComments();
  };

  return { comments, loading, addComment, refetch: fetchComments };
}
