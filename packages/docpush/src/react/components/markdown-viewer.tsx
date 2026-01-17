'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  // Basic markdown rendering - users can override with react-markdown
  const html = React.useMemo(() => {
    return content
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-10 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(
        /```(\w+)?\n([\s\S]*?)```/gim,
        '<pre class="bg-muted p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>'
      )
      .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\n\n/gim, '</p><p class="my-4">')
      .replace(/\n/gim, '<br>');
  }, [content]);

  return (
    <article
      className={cn('prose prose-neutral dark:prose-invert max-w-none p-6', className)}
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
    />
  );
}
