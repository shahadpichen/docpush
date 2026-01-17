'use client';

import * as React from 'react';
import { useDocPush } from '../context/docpush-provider';

interface DocTreeItem {
  path: string;
  type: 'file' | 'dir';
}

export function useDocs(path?: string) {
  const { fetcher } = useDocPush();
  const [tree, setTree] = React.useState<DocTreeItem[]>([]);
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const treeRes = await fetcher<{ tree: DocTreeItem[] }>('/api/docs/tree');
      setTree(treeRes.tree);

      if (path) {
        const contentRes = await fetcher<{ content: string }>(`/api/docs/${path}`);
        setContent(contentRes.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load docs');
    } finally {
      setLoading(false);
    }
  }, [path, fetcher]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { tree, content, loading, error, refetch: fetchData };
}
