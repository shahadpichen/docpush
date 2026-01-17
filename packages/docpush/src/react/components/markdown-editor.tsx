'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { MarkdownViewer } from './markdown-viewer';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

interface MarkdownEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  className?: string;
}

export function MarkdownEditor({ initialContent = '', onSave, className }: MarkdownEditorProps) {
  const [content, setContent] = React.useState(initialContent);
  const [showPreview, setShowPreview] = React.useState(false);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center gap-2 border-b p-2">
        <Button
          variant={showPreview ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => setShowPreview(false)}
        >
          <PencilIcon className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button
          variant={showPreview ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowPreview(true)}
        >
          <EyeIcon className="mr-2 h-4 w-4" />
          Preview
        </Button>
        {onSave && (
          <Button size="sm" className="ml-auto" onClick={() => onSave(content)}>
            <SaveIcon className="mr-2 h-4 w-4" />
            Save
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {showPreview ? (
          <MarkdownViewer content={content} className="h-full" />
        ) : (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-full min-h-[400px] resize-none rounded-none border-0 font-mono focus-visible:ring-0"
            placeholder="Write your markdown here..."
          />
        )}
      </div>
    </div>
  );
}

// Simple icons
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  );
}
