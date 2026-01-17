'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';

interface Comment {
  id: string;
  userName: string | null;
  content: string;
  createdAt: number;
}

interface CommentsPanelProps {
  comments: Comment[];
  onAddComment?: (content: string) => void;
  className?: string;
}

export function CommentsPanel({ comments, onAddComment, className }: CommentsPanelProps) {
  const [newComment, setNewComment] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && onAddComment) {
      onAddComment(newComment);
      setNewComment('');
    }
  };

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageIcon className="h-4 w-4" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4 p-4">
          {comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No comments yet</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {comment.userName || 'Anonymous'}
                  </span>
                  <span>{new Date(comment.createdAt * 1000).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm">{comment.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </ScrollArea>
      {onAddComment && (
        <form onSubmit={handleSubmit} className="border-t p-4">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="mb-2 min-h-[80px]"
          />
          <Button type="submit" size="sm" disabled={!newComment.trim()}>
            <SendIcon className="mr-2 h-4 w-4" />
            Send
          </Button>
        </form>
      )}
    </Card>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}
