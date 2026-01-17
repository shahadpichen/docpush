# Phase 4: React Components & Hooks (Headless)

**Duration:** Week 4
**Goal:** Build exportable React components and hooks for users to integrate in their own apps
**Prerequisites:** Phase 1, 2, & 3 complete

**Architecture:** Headless API + Component Library (shadcn/ui patterns)

---

## Overview

DocPush provides a **headless API** (built in Phases 1-3) plus **React components and hooks** that users can import into their own Next.js/React apps. Components follow **shadcn/ui patterns** with Tailwind CSS.

```tsx
// User's app
import { DocsSidebar, MarkdownViewer, useDocs } from "docpush/react";

export default function DocsPage() {
  const { tree, content } = useDocs("getting-started");
  return (
    <div className="flex">
      <DocsSidebar tree={tree} />
      <MarkdownViewer content={content} />
    </div>
  );
}
```

---

## Package Structure

```
packages/docpush/
├── src/
│   ├── server/           # API (done ✅)
│   ├── react/            # Components + Hooks
│   │   ├── components/
│   │   │   ├── ui/       # Base shadcn components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── textarea.tsx
│   │   │   │   └── scroll-area.tsx
│   │   │   ├── docs-sidebar.tsx
│   │   │   ├── markdown-viewer.tsx
│   │   │   ├── markdown-editor.tsx
│   │   │   ├── comments-panel.tsx
│   │   │   ├── drafts-list.tsx
│   │   │   └── search-bar.tsx
│   │   ├── hooks/
│   │   │   ├── use-docs.ts
│   │   │   ├── use-drafts.ts
│   │   │   ├── use-comments.ts
│   │   │   └── use-auth.ts
│   │   ├── lib/
│   │   │   └── utils.ts  # cn() helper
│   │   ├── context/
│   │   │   └── docpush-provider.tsx
│   │   └── index.ts
│   └── index.ts
└── package.json
```

---

## Task 4.1: Setup & Utilities

**Install peer dependencies (users install these):**

```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add @radix-ui/react-scroll-area @radix-ui/react-slot
```

**packages/docpush/src/react/lib/utils.ts:**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Task 4.2: Base UI Components (shadcn/ui)

**packages/docpush/src/react/components/ui/button.tsx:**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

**packages/docpush/src/react/components/ui/input.tsx:**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

**packages/docpush/src/react/components/ui/textarea.tsx:**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
```

**packages/docpush/src/react/components/ui/badge.tsx:**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-green-500 text-white",
        warning: "border-transparent bg-yellow-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
```

**packages/docpush/src/react/components/ui/card.tsx:**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
```

**packages/docpush/src/react/components/ui/scroll-area.tsx:**

```tsx
"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "../../lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
```

---

## Task 4.3: DocPush Provider (Context)

**packages/docpush/src/react/context/docpush-provider.tsx:**

```tsx
"use client";

import * as React from "react";

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
    const apiUrl = config.apiUrl.replace(/\/$/, "");
    const basePath = config.basePath || "/docs";

    const fetcher = async <T,>(
      endpoint: string,
      options?: RequestInit
    ): Promise<T> => {
      const res = await fetch(`${apiUrl}${endpoint}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        ...options,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Request failed");
      }
      return res.json();
    };

    return { apiUrl, basePath, fetcher };
  }, [config.apiUrl, config.basePath]);

  return (
    <DocPushContext.Provider value={value}>{children}</DocPushContext.Provider>
  );
}

export function useDocPush() {
  const context = React.useContext(DocPushContext);
  if (!context) {
    throw new Error("useDocPush must be used within DocPushProvider");
  }
  return context;
}
```

---

## Task 4.4: Hooks

**packages/docpush/src/react/hooks/use-docs.ts:**

```tsx
"use client";

import * as React from "react";
import { useDocPush } from "../context/docpush-provider";

interface DocTreeItem {
  path: string;
  type: "file" | "dir";
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
      const treeRes = await fetcher<{ tree: DocTreeItem[] }>("/api/docs/tree");
      setTree(treeRes.tree);

      if (path) {
        const contentRes = await fetcher<{ content: string }>(
          `/api/docs/${path}`
        );
        setContent(contentRes.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load docs");
    } finally {
      setLoading(false);
    }
  }, [path, fetcher]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { tree, content, loading, error, refetch: fetchData };
}
```

**packages/docpush/src/react/hooks/use-drafts.ts:**

```tsx
"use client";

import * as React from "react";
import { useDocPush } from "../context/docpush-provider";

interface Draft {
  id: string;
  docPath: string;
  branchName: string;
  title: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  updatedAt: number;
}

export function useDrafts(status?: string) {
  const { fetcher } = useDocPush();
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchDrafts = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = status ? `/api/drafts?status=${status}` : "/api/drafts";
      const res = await fetcher<{ drafts: Draft[] }>(url);
      setDrafts(res.drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, [status, fetcher]);

  React.useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const createDraft = async (data: {
    docPath: string;
    title: string;
    content?: string;
  }) => {
    const res = await fetcher<{ draft: Draft }>("/api/drafts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await fetchDrafts();
    return res.draft;
  };

  const updateDraft = async (id: string, content: string, message?: string) => {
    await fetcher(`/api/drafts/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content, message }),
    });
    await fetchDrafts();
  };

  const approveDraft = async (id: string) => {
    await fetcher(`/api/drafts/${id}/approve`, { method: "POST" });
    await fetchDrafts();
  };

  const rejectDraft = async (id: string, reason?: string) => {
    await fetcher(`/api/drafts/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    await fetchDrafts();
  };

  return {
    drafts,
    loading,
    error,
    createDraft,
    updateDraft,
    approveDraft,
    rejectDraft,
    refetch: fetchDrafts,
  };
}
```

**packages/docpush/src/react/hooks/use-comments.ts:**

```tsx
"use client";

import * as React from "react";
import { useDocPush } from "../context/docpush-provider";

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
      const res = await fetcher<{ comments: Comment[] }>(
        `/api/drafts/${draftId}/comments`
      );
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
      method: "POST",
      body: JSON.stringify({ content }),
    });
    await fetchComments();
  };

  return { comments, loading, addComment, refetch: fetchComments };
}
```

**packages/docpush/src/react/hooks/use-auth.ts:**

```tsx
"use client";

import * as React from "react";
import { useDocPush } from "../context/docpush-provider";

interface User {
  id: string;
  email: string | null;
  name?: string;
  role: "editor" | "admin";
}

export function useAuth() {
  const { fetcher } = useDocPush();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetcher<{ authenticated: boolean; user?: User }>("/api/auth/me")
      .then((res) => {
        if (res.authenticated && res.user) {
          setUser(res.user);
        }
      })
      .finally(() => setLoading(false));
  }, [fetcher]);

  const logout = async () => {
    await fetcher("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  const requestMagicLink = async (email: string) => {
    await fetcher("/api/auth/magic-link", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    logout,
    requestMagicLink,
  };
}
```

---

## Task 4.5: DocPush Components (shadcn/ui style)

**packages/docpush/src/react/components/docs-sidebar.tsx:**

```tsx
"use client";

import * as React from "react";
import { ChevronRight, FileText, Folder } from "lucide-react";
import { cn } from "../lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";

interface DocTreeItem {
  path: string;
  type: "file" | "dir";
}

interface DocsSidebarProps {
  tree: DocTreeItem[];
  activePath?: string;
  onSelect?: (path: string) => void;
  className?: string;
}

export function DocsSidebar({
  tree,
  activePath,
  onSelect,
  className,
}: DocsSidebarProps) {
  // Group by directory
  const grouped = React.useMemo(() => {
    return tree.reduce((acc, item) => {
      const parts = item.path.split("/");
      const dir = parts.length > 1 ? parts[0] : "";
      if (!acc[dir]) acc[dir] = [];
      acc[dir].push(item);
      return acc;
    }, {} as Record<string, DocTreeItem[]>);
  }, [tree]);

  return (
    <ScrollArea className={cn("h-full w-64 border-r", className)}>
      <div className="space-y-4 py-4">
        {Object.entries(grouped).map(([dir, items]) => (
          <div key={dir || "root"} className="px-3 py-2">
            {dir && (
              <h4 className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold tracking-tight">
                <Folder className="h-4 w-4" />
                {dir}
              </h4>
            )}
            <div className="space-y-1">
              {items
                .filter((item) => item.type === "file")
                .map((item) => {
                  const isActive = item.path === activePath;
                  const fileName =
                    item.path.split("/").pop()?.replace(".md", "") || item.path;

                  return (
                    <Button
                      key={item.path}
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "w-full justify-start gap-2",
                        isActive && "bg-muted font-medium"
                      )}
                      onClick={() => onSelect?.(item.path)}
                    >
                      <FileText className="h-4 w-4" />
                      {fileName}
                      {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                    </Button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
```

**packages/docpush/src/react/components/markdown-viewer.tsx:**

````tsx
"use client";

import * as React from "react";
import { cn } from "../lib/utils";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  // Basic markdown rendering - users can override with react-markdown
  const html = React.useMemo(() => {
    return content
      .replace(
        /^### (.*$)/gim,
        '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>'
      )
      .replace(
        /^## (.*$)/gim,
        '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>'
      )
      .replace(
        /^# (.*$)/gim,
        '<h1 class="text-2xl font-bold mt-10 mb-4">$1</h1>'
      )
      .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/gim, "<em>$1</em>")
      .replace(
        /```(\w+)?\n([\s\S]*?)```/gim,
        '<pre class="bg-muted p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>'
      )
      .replace(
        /`([^`]+)`/gim,
        '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>'
      )
      .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\n\n/gim, '</p><p class="my-4">')
      .replace(/\n/gim, "<br>");
  }, [content]);

  return (
    <article
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none p-6",
        className
      )}
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
    />
  );
}
````

**packages/docpush/src/react/components/markdown-editor.tsx:**

```tsx
"use client";

import * as React from "react";
import { Eye, Pencil, Save } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { MarkdownViewer } from "./markdown-viewer";

interface MarkdownEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  className?: string;
}

export function MarkdownEditor({
  initialContent = "",
  onSave,
  className,
}: MarkdownEditorProps) {
  const [content, setContent] = React.useState(initialContent);
  const [showPreview, setShowPreview] = React.useState(false);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-2 border-b p-2">
        <Button
          variant={showPreview ? "ghost" : "secondary"}
          size="sm"
          onClick={() => setShowPreview(false)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button
          variant={showPreview ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowPreview(true)}
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
        {onSave && (
          <Button size="sm" className="ml-auto" onClick={() => onSave(content)}>
            <Save className="mr-2 h-4 w-4" />
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
```

**packages/docpush/src/react/components/comments-panel.tsx:**

```tsx
"use client";

import * as React from "react";
import { Send, MessageSquare } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

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

export function CommentsPanel({
  comments,
  onAddComment,
  className,
}: CommentsPanelProps) {
  const [newComment, setNewComment] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && onAddComment) {
      onAddComment(newComment);
      setNewComment("");
    }
  };

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4 p-4">
          {comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No comments yet
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg border bg-muted/50 p-3"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {comment.userName || "Anonymous"}
                  </span>
                  <span>
                    {new Date(comment.createdAt * 1000).toLocaleDateString()}
                  </span>
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
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </form>
      )}
    </Card>
  );
}
```

**packages/docpush/src/react/components/drafts-list.tsx:**

```tsx
"use client";

import * as React from "react";
import { Check, X, FileText } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface Draft {
  id: string;
  docPath: string;
  title: string;
  status: "pending" | "approved" | "rejected";
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
  pending: "warning",
  approved: "success",
  rejected: "destructive",
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
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Drafts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {drafts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No drafts found
          </p>
        ) : (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-colors",
                  onSelect && "cursor-pointer hover:bg-muted/50"
                )}
                onClick={() => onSelect?.(draft)}
              >
                <div className="space-y-1">
                  <p className="font-medium">{draft.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {draft.docPath}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariants[draft.status]}>
                    {draft.status}
                  </Badge>
                  {showActions && draft.status === "pending" && (
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
                        <Check className="h-4 w-4" />
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
                        <X className="h-4 w-4" />
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
```

**packages/docpush/src/react/components/search-bar.tsx:**

```tsx
"use client";

import * as React from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Input } from "./ui/input";

interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
}

interface SearchBarProps {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (path: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  onSearch,
  onSelect,
  placeholder = "Search docs...",
  className,
}: SearchBarProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.length < 2 || !onSearch) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    try {
      const res = await onSearch(value);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : (
            <div className="max-h-[300px] overflow-auto">
              {results.map((result) => (
                <button
                  key={result.path}
                  onClick={() => {
                    onSelect?.(result.path);
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start gap-1 border-b p-3 text-left transition-colors last:border-0 hover:bg-muted"
                >
                  <span className="font-medium">{result.title}</span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {result.excerpt}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Task 4.6: Export All

**packages/docpush/src/react/index.ts:**

```typescript
// UI Components (shadcn/ui)
export { Button, buttonVariants } from "./components/ui/button";
export { Input } from "./components/ui/input";
export { Textarea } from "./components/ui/textarea";
export { Badge, badgeVariants } from "./components/ui/badge";
export { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
export { ScrollArea, ScrollBar } from "./components/ui/scroll-area";

// DocPush Components
export { DocsSidebar } from "./components/docs-sidebar";
export { MarkdownViewer } from "./components/markdown-viewer";
export { MarkdownEditor } from "./components/markdown-editor";
export { CommentsPanel } from "./components/comments-panel";
export { DraftsList } from "./components/drafts-list";
export { SearchBar } from "./components/search-bar";

// Hooks
export { useDocs } from "./hooks/use-docs";
export { useDrafts } from "./hooks/use-drafts";
export { useComments } from "./hooks/use-comments";
export { useAuth } from "./hooks/use-auth";

// Context
export { DocPushProvider, useDocPush } from "./context/docpush-provider";

// Utils
export { cn } from "./lib/utils";
```

---

## Task 4.7: Update Package Exports

**Update packages/docpush/package.json:**

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "default": "./dist/react/index.js"
    }
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.300.0",
    "@radix-ui/react-scroll-area": "^1.0.0",
    "@radix-ui/react-slot": "^1.0.0"
  }
}
```

---

## Usage Example

```tsx
// app/layout.tsx
import { DocPushProvider } from "docpush/react";
import "./globals.css"; // Must include Tailwind + CSS variables

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DocPushProvider config={{ apiUrl: "http://localhost:3000" }}>
          {children}
        </DocPushProvider>
      </body>
    </html>
  );
}

// app/docs/[[...slug]]/page.tsx
("use client");

import { DocsSidebar, MarkdownViewer, useDocs } from "docpush/react";

export default function DocsPage({ params }: { params: { slug?: string[] } }) {
  const path = params.slug?.join("/") || "index.md";
  const { tree, content, loading, error } = useDocs(path);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="flex min-h-screen">
      <DocsSidebar
        tree={tree}
        activePath={path}
        onSelect={(p) => (window.location.href = `/docs/${p}`)}
      />
      <main className="flex-1">
        <MarkdownViewer content={content || ""} />
      </main>
    </div>
  );
}
```

---

## CSS Variables Required

Users need these CSS variables in their `globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode variables */
  }
}
```

---

## Verification

- [ ] All components use shadcn/ui patterns
- [ ] Tailwind CSS classes used throughout
- [ ] `cn()` utility for merging classes
- [ ] Components are customizable via className prop
- [ ] Hooks work with DocPushProvider
- [ ] Build passes
- [ ] Can be imported as `docpush/react`
