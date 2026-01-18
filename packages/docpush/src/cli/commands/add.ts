import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';

// Component registry - maps component names to their source files
const COMPONENTS: Record<string, { files: string[]; dependencies?: string[] }> = {
  // UI primitives
  button: { files: ['button.tsx'], dependencies: ['utils'] },
  input: { files: ['input.tsx'], dependencies: ['utils'] },
  textarea: { files: ['textarea.tsx'], dependencies: ['utils'] },
  badge: { files: ['badge.tsx'], dependencies: ['utils'] },
  card: { files: ['card.tsx'], dependencies: ['utils'] },
  'scroll-area': { files: ['scroll-area.tsx'], dependencies: ['utils'] },

  // Feature components
  'docs-sidebar': { files: ['docs-sidebar.tsx'], dependencies: ['utils', 'button', 'scroll-area'] },
  'markdown-viewer': { files: ['markdown-viewer.tsx'], dependencies: ['utils'] },
  'markdown-editor': {
    files: ['markdown-editor.tsx'],
    dependencies: ['utils', 'button', 'textarea', 'markdown-viewer'],
  },
  'comments-panel': {
    files: ['comments-panel.tsx'],
    dependencies: ['utils', 'button', 'card', 'scroll-area', 'textarea'],
  },
  'drafts-list': { files: ['drafts-list.tsx'], dependencies: ['utils', 'badge', 'button', 'card'] },
  'search-bar': { files: ['search-bar.tsx'], dependencies: ['utils', 'input'] },

  // Utilities
  utils: { files: ['utils.ts'] },
};

// All available components
const ALL_COMPONENTS = Object.keys(COMPONENTS).filter((c) => c !== 'utils');

/**
 * Add components to user's project
 */
export async function addCommand(components: string[]): Promise<void> {
  console.log(chalk.blue('📦 Adding DocPush components...\n'));

  // Resolve all components including dependencies
  const toInstall = new Set<string>();

  for (const comp of components) {
    if (comp === 'all') {
      ALL_COMPONENTS.forEach((c) => toInstall.add(c));
    } else if (COMPONENTS[comp]) {
      toInstall.add(comp);
    } else {
      console.log(chalk.yellow(`⚠ Unknown component: ${comp}`));
    }
  }

  // Add dependencies
  function addDeps(compName: string) {
    const comp = COMPONENTS[compName];
    if (comp?.dependencies) {
      for (const dep of comp.dependencies) {
        if (!toInstall.has(dep)) {
          toInstall.add(dep);
          addDeps(dep);
        }
      }
    }
  }

  toInstall.forEach((c) => addDeps(c));

  if (toInstall.size === 0) {
    console.log(chalk.yellow('No valid components specified.'));
    console.log('Available components:', ALL_COMPONENTS.join(', '));
    return;
  }

  // Load config to get custom paths (if docs.config.js exists)
  let uiDir = './src/components/ui';
  let libDir = './src/lib';

  try {
    const configPath = path.resolve('./docs.config.js');
    if (await fs.pathExists(configPath)) {
      // biome-ignore lint/security/noGlobalEval: config file loading
      const config = eval(`require('${configPath}')`);
      if (config.components?.uiPath) {
        uiDir = config.components.uiPath;
      }
      if (config.components?.libPath) {
        libDir = config.components.libPath;
      }
    }
  } catch {
    // Config doesn't exist or has errors, use defaults
  }

  console.log(chalk.gray(`📁 UI components: ${uiDir}`));
  console.log(chalk.gray(`📁 Utilities: ${libDir}\n`));

  await fs.ensureDir(uiDir);
  await fs.ensureDir(libDir);

  // Find package location for templates
  const packageDir = path.dirname(require.resolve('@shahadpichen/docpush/package.json'));
  const templatesDir = path.join(packageDir, 'templates', 'components');

  // Copy components
  for (const compName of toInstall) {
    const comp = COMPONENTS[compName];

    for (const file of comp.files) {
      let destPath: string;

      if (compName === 'utils') {
        // Utils go to src/lib
        destPath = path.join(libDir, file);
        const content = getUtilsTemplate();
        await fs.writeFile(destPath, content);
      } else {
        // Try to read from templates directory first
        const templatePath = path.join(templatesDir, file);
        destPath = path.join(uiDir, file);

        if (await fs.pathExists(templatePath)) {
          await fs.copy(templatePath, destPath);
        } else {
          // Fallback to inline template
          const template = getComponentTemplate(compName);
          await fs.writeFile(destPath, template);
        }
      }
      console.log(chalk.green('✓'), `Created ${destPath}`);
    }
  }

  console.log(chalk.blue('\n✨ Components added successfully!'));
  console.log(chalk.gray('\nImport from:'));
  console.log(chalk.gray("  import { Button } from '@/components/ui/button';"));
  console.log(chalk.gray("  import { cn } from '@/lib/utils';"));

  // Check for required dependencies
  console.log(chalk.blue('\n📋 Required dependencies:'));
  console.log('  npm install clsx tailwind-merge class-variance-authority');
  console.log('  npm install @radix-ui/react-scroll-area @radix-ui/react-slot');
}

function getUtilsTemplate(): string {
  return `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}

/**
 * Get component TypeScript template (inline fallback)
 */
function getComponentTemplate(name: string): string {
  // Basic templates - users can customize after copying
  const templates: Record<string, string> = {
    button: `'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
`,

    input: `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
`,

    textarea: `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
`,

    badge: `'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        warning: 'border-transparent bg-yellow-100 text-yellow-800',
        success: 'border-transparent bg-green-100 text-green-800',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
`,

    card: `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
`,

    'scroll-area': `'use client';

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/utils';

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation="vertical"
      className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
`,

    'docs-sidebar': `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DocTreeItem { path: string; type: 'file' | 'dir'; }
interface DocsSidebarProps { tree: DocTreeItem[]; activePath?: string; onSelect?: (path: string) => void; className?: string; }

export function DocsSidebar({ tree, activePath, onSelect, className }: DocsSidebarProps) {
  return (
    <ScrollArea className={cn('h-full w-64 border-r', className)}>
      <div className="space-y-1 py-4 px-3">
        {tree.filter(item => item.type === 'file').map((item) => {
          const isActive = item.path === activePath;
          const fileName = item.path.split('/').pop()?.replace('.md', '') || item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('w-full justify-start', isActive && 'bg-muted font-medium')}
              onClick={() => onSelect?.(item.path)}
            >
              {fileName}
            </Button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
`,

    'markdown-viewer': `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps { content: string; className?: string; }

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const html = React.useMemo(() => {
    return content
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-10 mb-4">$1</h1>')
      .replace(/\\*\\*(.*?)\\*\\*/gim, '<strong>$1</strong>')
      .replace(/\\*(.*?)\\*/gim, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\\n\\n/gim, '</p><p class="my-4">')
      .replace(/\\n/gim, '<br>');
  }, [content]);

  return <article className={cn('prose max-w-none p-6', className)} dangerouslySetInnerHTML={{ __html: '<p>' + html + '</p>' }} />;
}
`,

    'markdown-editor': `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MarkdownEditorProps { initialContent?: string; onSave?: (content: string) => void; className?: string; }

export function MarkdownEditor({ initialContent = '', onSave, className }: MarkdownEditorProps) {
  const [content, setContent] = React.useState(initialContent);
  const [showPreview, setShowPreview] = React.useState(false);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center gap-2 border-b p-2">
        <Button variant={showPreview ? 'ghost' : 'secondary'} size="sm" onClick={() => setShowPreview(false)}>Edit</Button>
        <Button variant={showPreview ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowPreview(true)}>Preview</Button>
        {onSave && <Button size="sm" className="ml-auto" onClick={() => onSave(content)}>Save</Button>}
      </div>
      <div className="flex-1 overflow-auto">
        {showPreview ? <MarkdownViewer content={content} /> : (
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[400px] resize-none border-0 font-mono" placeholder="Write markdown..." />
        )}
      </div>
    </div>
  );
}
`,

    'comments-panel': `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

interface Comment { id: string; userName: string | null; content: string; createdAt: number; }
interface CommentsPanelProps { comments: Comment[]; onAddComment?: (content: string) => void; className?: string; }

export function CommentsPanel({ comments, onAddComment, className }: CommentsPanelProps) {
  const [newComment, setNewComment] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && onAddComment) { onAddComment(newComment); setNewComment(''); }
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="border-b py-3"><CardTitle className="text-base">Comments ({comments.length})</CardTitle></CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4 p-4">
          {comments.length === 0 ? <p className="text-center text-muted-foreground py-8">No comments yet</p> : (
            comments.map((c) => (
              <div key={c.id} className="rounded-lg border p-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{c.userName || 'Anonymous'}</span>
                  <span>{new Date(c.createdAt * 1000).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm">{c.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </ScrollArea>
      {onAddComment && (
        <form onSubmit={handleSubmit} className="border-t p-4">
          <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="mb-2" />
          <Button type="submit" size="sm" disabled={!newComment.trim()}>Send</Button>
        </form>
      )}
    </Card>
  );
}
`,

    'drafts-list': `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Draft { id: string; docPath: string; title: string; status: 'pending' | 'approved' | 'rejected'; createdAt: number; }
interface DraftsListProps { drafts: Draft[]; onSelect?: (draft: Draft) => void; onApprove?: (id: string) => void; onReject?: (id: string) => void; showActions?: boolean; className?: string; }

const statusVariants = { pending: 'warning', approved: 'success', rejected: 'destructive' } as const;

export function DraftsList({ drafts, onSelect, onApprove, onReject, showActions = false, className }: DraftsListProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader><CardTitle>Drafts</CardTitle></CardHeader>
      <CardContent>
        {drafts.length === 0 ? <p className="text-center text-muted-foreground py-8">No drafts found</p> : (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div key={draft.id} className={cn('flex items-center justify-between rounded-lg border p-3', onSelect && 'cursor-pointer hover:bg-muted/50')} onClick={() => onSelect?.(draft)}>
                <div><p className="font-medium">{draft.title}</p><p className="text-xs text-muted-foreground">{draft.docPath}</p></div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariants[draft.status]}>{draft.status}</Badge>
                  {showActions && draft.status === 'pending' && (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={(e) => { e.stopPropagation(); onApprove?.(draft.id); }}>✓</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={(e) => { e.stopPropagation(); onReject?.(draft.id); }}>✕</Button>
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
`,

    'search-bar': `'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface SearchResult { path: string; title: string; excerpt: string; }
interface SearchBarProps { onSearch?: (query: string) => Promise<SearchResult[]>; onSelect?: (path: string) => void; placeholder?: string; className?: string; }

export function SearchBar({ onSearch, onSelect, placeholder = 'Search docs...', className }: SearchBarProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.length < 2 || !onSearch) { setResults([]); return; }
    setLoading(true);
    try { const res = await onSearch(value); setResults(res); } catch { setResults([]); } finally { setLoading(false); }
  };

  return (
    <div className={cn('relative', className)}>
      <Input value={query} onChange={(e) => handleSearch(e.target.value)} placeholder={placeholder} />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-lg max-h-[300px] overflow-auto">
          {results.map((r) => (
            <button key={r.path} type="button" onClick={() => { onSelect?.(r.path); setQuery(''); setResults([]); }} className="flex w-full flex-col p-3 text-left hover:bg-muted border-b last:border-0">
              <span className="font-medium">{r.title}</span>
              <span className="text-xs text-muted-foreground">{r.excerpt}</span>
            </button>
          ))}
        </div>
      )}
      {loading && <div className="absolute top-full left-0 right-0 mt-1 p-4 text-center text-sm text-muted-foreground border rounded-md bg-popover">Searching...</div>}
    </div>
  );
}
`,
  };

  return (
    templates[name] ||
    `// Component template not found: ${name}\n// Please install from: npx @shahadpichen/docpush add ${name}`
  );
}
