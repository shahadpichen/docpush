'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Draft {
  id: string;
  docPath: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

interface DraftsListProps {
  drafts: Draft[];
  onSelect?: (draft: Draft) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  showActions?: boolean;
  className?: string;
}

const statusVariants = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
} as const;

export function DraftsList({
  drafts,
  onSelect,
  onApprove,
  onReject,
  showActions = false,
  className,
}: DraftsListProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileIcon className="h-5 w-5" />
          Drafts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {drafts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No drafts found</p>
        ) : (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : undefined}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 transition-colors',
                  onSelect && 'cursor-pointer hover:bg-muted/50'
                )}
                onClick={() => onSelect?.(draft)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(draft);
                  }
                }}
              >
                <div className="space-y-1">
                  <p className="font-medium">{draft.title}</p>
                  <p className="text-xs text-muted-foreground">{draft.docPath}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariants[draft.status]}>{draft.status}</Badge>
                  {showActions && draft.status === 'pending' && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApprove?.(draft.id);
                        }}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject?.(draft.id);
                        }}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
