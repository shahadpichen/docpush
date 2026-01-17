# Phase 4: Next.js Frontend

**Duration:** Week 4
**Goal:** Build the web UI with file tree, Monaco editor, and admin dashboard
**Prerequisites:** Phase 1, 2, & 3 complete

**Key Features:** Editor with live preview, file navigation, admin approval interface

---

## Task 4.1: Next.js App Setup

**Initialize Next.js in the package:**

```bash
cd packages/docpush/src/web
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
```

**Install dependencies:**

```bash
pnpm add @monaco-editor/react react-markdown gray-matter
pnpm add @tanstack/react-query axios
pnpm add lucide-react class-variance-authority clsx tailwind-merge
pnpm dlx shadcn-ui@latest init
```

**Add shadcn/ui components:**

```bash
pnpm dlx shadcn-ui@latest add button
pnpm dlx shadcn-ui@latest add input
pnpm dlx shadcn-ui@latest add card
pnpm dlx shadcn-ui@latest add dialog
pnpm dlx shadcn-ui@latest add dropdown-menu
pnpm dlx shadcn-ui@latest add toast
```

**Update packages/docpush/src/web/app/layout.tsx:**

```tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'DocPush - Collaborative Documentation',
  description: 'Git-backed documentation platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Create packages/docpush/src/web/app/providers.tsx:**

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
```

---

## Task 4.2: API Client Setup

**Create packages/docpush/src/web/lib/api.ts:**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  withCredentials: true, // Important for session cookies
});

// Auth
export const authApi = {
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  loginAdmin: (password: string) => api.post('/auth/admin/login', { password }),
  requestMagicLink: (email: string) => api.post('/auth/magic-link/request', { email }),
  loginGithub: () => window.location.href = `${api.defaults.baseURL}/auth/github`,
  loginGoogle: () => window.location.href = `${api.defaults.baseURL}/auth/google`,
};

// Drafts
export const draftsApi = {
  list: (status = 'pending') => api.get('/drafts', { params: { status } }),
  get: (id: string) => api.get(`/drafts/${id}`),
  create: (data: { docPath: string; initialContent?: string; title?: string }) =>
    api.post('/drafts', data),
  update: (id: string, content: string) => api.put(`/drafts/${id}`, { content }),
  approve: (id: string) => api.post(`/drafts/${id}/approve`),
  reject: (id: string, reason?: string) => api.post(`/drafts/${id}/reject`, { reason }),
  getComments: (id: string) => api.get(`/drafts/${id}/comments`),
  addComment: (id: string, content: string) => api.post(`/drafts/${id}/comments`, { content }),
};

// Docs
export const docsApi = {
  tree: () => api.get('/docs/tree'),
  content: (path: string) => api.get('/docs/content', { params: { path } }),
  history: (path: string) => api.get('/docs/history', { params: { path } }),
};

export default api;
```

---

## Task 4.3: File Tree Sidebar Component

**Create packages/docpush/src/web/components/FileTree.tsx:**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { docsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}

export function FileTree({
  onSelectFile,
  selectedPath,
}: {
  onSelectFile: (path: string) => void;
  selectedPath?: string;
}) {
  const { data: tree, isLoading } = useQuery({
    queryKey: ['docs-tree'],
    queryFn: async () => {
      const { data } = await docsApi.tree();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="w-64 border-r p-4 bg-gray-50">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r bg-gray-50 overflow-auto">
      <div className="p-4 border-b bg-white">
        <h2 className="font-semibold text-lg">Documentation</h2>
      </div>
      <div className="p-2">
        {tree && (
          <TreeNode
            node={tree}
            onSelect={onSelectFile}
            selectedPath={selectedPath}
          />
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  onSelect,
  selectedPath,
  level = 0,
}: {
  node: TreeNode;
  onSelect: (path: string) => void;
  selectedPath?: string;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(level === 0);
  const isSelected = selectedPath === node.path;

  if (node.type === 'file') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm',
          'hover:bg-gray-200 transition-colors',
          isSelected && 'bg-blue-100 hover:bg-blue-200'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node.path)}
      >
        <File size={16} className="text-gray-600 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm',
          'hover:bg-gray-200 transition-colors'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={16} className="text-gray-600 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
        )}
        {expanded ? (
          <FolderOpen size={16} className="text-blue-600 flex-shrink-0" />
        ) : (
          <Folder size={16} className="text-blue-600 flex-shrink-0" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </div>
      {expanded && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          onSelect={onSelect}
          selectedPath={selectedPath}
          level={level + 1}
        />
      ))}
    </div>
  );
}
```

---

## Task 4.4: Monaco Editor with Live Preview

**Create packages/docpush/src/web/components/MarkdownEditor.tsx:**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface MarkdownEditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  readOnly?: boolean;
}

export function MarkdownEditor({
  initialContent,
  onSave,
  readOnly = false,
}: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debouncedContent = useDebounce(content, 3000); // 3 second debounce

  // Auto-save on content change
  useEffect(() => {
    if (debouncedContent !== initialContent && !readOnly) {
      setSaving(true);
      onSave(debouncedContent)
        .then(() => {
          setLastSaved(new Date());
        })
        .finally(() => {
          setSaving(false);
        });
    }
  }, [debouncedContent, initialContent, onSave, readOnly]);

  // Update content when initialContent changes (e.g., new draft loaded)
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  return (
    <div className="h-full flex flex-col">
      {/* Save status */}
      <div className="border-b px-4 py-2 bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Saving...
            </span>
          ) : lastSaved ? (
            <span>Saved {formatRelativeTime(lastSaved)}</span>
          ) : (
            <span>Ready</span>
          )}
        </div>
        {readOnly && (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
            Read-only
          </span>
        )}
      </div>

      {/* Editor and Preview */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Monaco Editor */}
        <div className="border rounded overflow-hidden">
          <Editor
            language="markdown"
            value={content}
            onChange={(value) => setContent(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              readOnly,
              fontSize: 14,
              padding: { top: 16, bottom: 16 },
            }}
          />
        </div>

        {/* Markdown Preview */}
        <div className="border rounded bg-white overflow-auto">
          <div className="prose prose-sm max-w-none p-6">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}
```

**Create packages/docpush/src/web/hooks/useDebounce.ts:**

```typescript
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

---

## Task 4.5: Editor Page (Draft Editing)

**Create packages/docpush/src/web/app/editor/[id]/page.tsx:**

```tsx
'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { draftsApi } from '@/lib/api';
import { useState } from 'react';
import { CommentsPanel } from '@/components/CommentsPanel';

export default function EditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [showComments, setShowComments] = useState(false);

  // Fetch draft
  const { data: draft, isLoading } = useQuery({
    queryKey: ['draft', params.id],
    queryFn: async () => {
      const { data } = await draftsApi.get(params.id);
      return data;
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (content: string) => draftsApi.update(params.id, content),
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading draft...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div>Draft not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="font-semibold text-lg">{draft.title}</h1>
            <p className="text-xs text-gray-500">{draft.doc_path}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageSquare size={16} className="mr-2" />
            Comments
          </Button>

          {draft.status === 'pending' && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
              Pending Review
            </span>
          )}
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 flex overflow-hidden">
        <div className={showComments ? 'flex-1' : 'w-full'}>
          <MarkdownEditor
            initialContent={draft.content || ''}
            onSave={async (content) => {
              await saveMutation.mutateAsync(content);
            }}
            readOnly={draft.status !== 'pending'}
          />
        </div>

        {showComments && (
          <CommentsPanel draftId={params.id} />
        )}
      </div>
    </div>
  );
}
```

---

## Task 4.6: Comments Panel

**Create packages/docpush/src/web/components/CommentsPanel.tsx:**

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { draftsApi } from '@/lib/api';
import { useState } from 'react';
import { Send } from 'lucide-react';

export function CommentsPanel({ draftId }: { draftId: string }) {
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  const { data: comments } = useQuery({
    queryKey: ['comments', draftId],
    queryFn: async () => {
      const { data } = await draftsApi.getComments(draftId);
      return data;
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => draftsApi.addComment(draftId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', draftId] });
      setNewComment('');
    },
  });

  return (
    <div className="w-80 border-l bg-gray-50 flex flex-col">
      <div className="p-4 border-b bg-white">
        <h3 className="font-semibold">Comments</h3>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {comments?.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No comments yet
          </p>
        )}

        {comments?.map((comment: any) => (
          <div key={comment.id} className="bg-white rounded p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-medium text-gray-900">
                {comment.user_name || comment.user_email || 'Anonymous'}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(comment.created_at).toLocaleDateString()}
              </div>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
        ))}
      </div>

      {/* Add comment */}
      <div className="p-4 border-t bg-white">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="mb-2"
          rows={3}
        />
        <Button
          onClick={() => addCommentMutation.mutate(newComment)}
          disabled={!newComment.trim() || addCommentMutation.isPending}
          size="sm"
          className="w-full"
        >
          <Send size={14} className="mr-2" />
          {addCommentMutation.isPending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
```

---

## Task 4.7: Admin Dashboard

**Create packages/docpush/src/web/app/admin/page.tsx:**

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { draftsApi } from '@/lib/api';
import { useState } from 'react';
import { Check, X, Eye, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectingDraft, setRejectingDraft] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: drafts, isLoading } = useQuery({
    queryKey: ['drafts', 'pending'],
    queryFn: async () => {
      const { data } = await draftsApi.list('pending');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => draftsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      draftsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      setRejectingDraft(null);
      setRejectionReason('');
    },
  });

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Review and approve pending documentation drafts</p>
      </div>

      {drafts?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No pending drafts to review</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {drafts?.map((draft: any) => (
          <Card key={draft.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>{draft.title}</CardTitle>
                  <CardDescription className="mt-2">
                    <div className="space-y-1">
                      <div>Path: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{draft.doc_path}</code></div>
                      <div>Author: {draft.author_email || draft.author_name || 'Anonymous'}</div>
                      <div>Created: {new Date(draft.created_at).toLocaleString()}</div>
                      <div>Last updated: {new Date(draft.updated_at).toLocaleString()}</div>
                    </div>
                  </CardDescription>
                </div>

                <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
                  Pending
                </span>
              </div>
            </CardHeader>

            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/editor/${draft.id}`)}
                >
                  <Eye size={16} className="mr-2" />
                  View Draft
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => approveMutation.mutate(draft.id)}
                  disabled={approveMutation.isPending}
                >
                  <Check size={16} className="mr-2" />
                  {approveMutation.isPending ? 'Approving...' : 'Approve'}
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRejectingDraft(draft.id)}
                >
                  <X size={16} className="mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingDraft} onOpenChange={() => setRejectingDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Draft</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this draft (optional). The branch will be deleted.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectingDraft(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectingDraft) {
                  rejectMutation.mutate({
                    id: rejectingDraft,
                    reason: rejectionReason,
                  });
                }
              }}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## Task 4.8: Home Page (Documentation Browser)

**Create packages/docpush/src/web/app/page.tsx:**

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileTree } from '@/components/FileTree';
import { Button } from '@/components/ui/button';
import { docsApi } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { Plus, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const { data: content } = useQuery({
    queryKey: ['doc-content', selectedPath],
    queryFn: async () => {
      if (!selectedPath) return null;
      const { data } = await docsApi.content(selectedPath);
      return data;
    },
    enabled: !!selectedPath,
  });

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between bg-white">
        <h1 className="text-xl font-bold">DocPush</h1>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin')}
          >
            <Settings size={16} className="mr-2" />
            Admin
          </Button>

          <Button
            size="sm"
            onClick={() => {
              // TODO: Implement new draft creation
              router.push('/new');
            }}
          >
            <Plus size={16} className="mr-2" />
            New Draft
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File tree sidebar */}
        <FileTree
          onSelectFile={setSelectedPath}
          selectedPath={selectedPath || undefined}
        />

        {/* Content viewer */}
        <div className="flex-1 overflow-auto bg-white">
          {content ? (
            <div className="max-w-4xl mx-auto p-8">
              <div className="prose prose-lg max-w-none">
                <ReactMarkdown>{content.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a document to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 4.9: Authentication Pages

**Create packages/docpush/src/web/app/login/page.tsx:**

```tsx
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { authApi } from '@/lib/api';
import { Github, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Determine auth mode from query params or API
  const authMode = searchParams.get('mode') || 'public'; // TODO: Get from config

  const adminLoginMutation = useMutation({
    mutationFn: authApi.loginAdmin,
    onSuccess: () => router.push('/admin'),
  });

  const magicLinkMutation = useMutation({
    mutationFn: authApi.requestMagicLink,
  });

  // Public mode (password)
  if (authMode === 'public') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Enter admin password to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                adminLoginMutation.mutate(password);
              }}
              className="space-y-4"
            >
              <Input
                type="password"
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                className="w-full"
                disabled={adminLoginMutation.isPending}
              >
                {adminLoginMutation.isPending ? 'Logging in...' : 'Login'}
              </Button>
              {adminLoginMutation.isError && (
                <p className="text-sm text-red-600">Invalid password</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Domain-restricted mode (magic link)
  if (authMode === 'domain-restricted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>We'll send you a magic link to sign in</CardDescription>
          </CardHeader>
          <CardContent>
            {magicLinkMutation.isSuccess ? (
              <div className="text-center py-8">
                <Mail size={48} className="mx-auto mb-4 text-green-600" />
                <p className="text-lg font-medium mb-2">Check your email!</p>
                <p className="text-sm text-gray-600">
                  We sent a magic link to <strong>{email}</strong>
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  magicLinkMutation.mutate(email);
                }}
                className="space-y-4"
              >
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={magicLinkMutation.isPending}
                >
                  {magicLinkMutation.isPending ? 'Sending...' : 'Send Magic Link'}
                </Button>
                {magicLinkMutation.isError && (
                  <p className="text-sm text-red-600">
                    Error: Email domain not allowed
                  </p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // OAuth mode
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Choose a provider to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => authApi.loginGithub()}
          >
            <Github size={18} className="mr-2" />
            Continue with GitHub
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => authApi.loginGoogle()}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Verification

After Phase 4, test the frontend:

### 1. Start the development servers:

```bash
# Terminal 1: Start Express backend
cd packages/docpush
npm run dev:server

# Terminal 2: Start Next.js frontend
cd packages/docpush/src/web
npm run dev
```

### 2. Test file tree:
- Visit http://localhost:3000
- ✅ File tree loads from GitHub
- ✅ Click folder to expand/collapse
- ✅ Click file to view content
- ✅ Markdown renders correctly

### 3. Test draft editing:
- Create a draft via API
- Visit http://localhost:3000/editor/DRAFT_ID
- ✅ Monaco editor loads
- ✅ Content displays
- ✅ Live preview updates
- ✅ Autosave works (check "Saved" indicator)
- ✅ Comments panel works

### 4. Test admin dashboard:
- Visit http://localhost:3000/admin
- ✅ Pending drafts list
- ✅ "View Draft" opens editor
- ✅ "Approve" creates PR and merges
- ✅ "Reject" shows dialog and deletes branch

### 5. Test authentication:
- Visit http://localhost:3000/login
- ✅ Public mode: password input
- ✅ Domain-restricted: email input + magic link sent
- ✅ OAuth: GitHub/Google buttons

---

## Next Steps

Phase 5 will add error handling, retry logic, conflict detection, and media uploads.
