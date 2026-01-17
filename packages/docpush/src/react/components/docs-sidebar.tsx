'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';

interface DocTreeItem {
  path: string;
  type: 'file' | 'dir';
}

interface DocsSidebarProps {
  tree: DocTreeItem[];
  activePath?: string;
  onSelect?: (path: string) => void;
  className?: string;
}

export function DocsSidebar({ tree, activePath, onSelect, className }: DocsSidebarProps) {
  // Group by directory
  const grouped = React.useMemo(() => {
    return tree.reduce(
      (acc, item) => {
        const parts = item.path.split('/');
        const dir = parts.length > 1 ? parts[0] : '';
        if (!acc[dir]) acc[dir] = [];
        acc[dir].push(item);
        return acc;
      },
      {} as Record<string, DocTreeItem[]>
    );
  }, [tree]);

  return (
    <ScrollArea className={cn('h-full w-64 border-r', className)}>
      <div className="space-y-4 py-4">
        {Object.entries(grouped).map(([dir, items]) => (
          <div key={dir || 'root'} className="px-3 py-2">
            {dir && (
              <h4 className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold tracking-tight">
                <FolderIcon className="h-4 w-4" />
                {dir}
              </h4>
            )}
            <div className="space-y-1">
              {items
                .filter((item) => item.type === 'file')
                .map((item) => {
                  const isActive = item.path === activePath;
                  const fileName = item.path.split('/').pop()?.replace('.md', '') || item.path;

                  return (
                    <Button
                      key={item.path}
                      variant={isActive ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        'w-full justify-start gap-2',
                        isActive && 'bg-muted font-medium'
                      )}
                      onClick={() => onSelect?.(item.path)}
                    >
                      <FileIcon className="h-4 w-4" />
                      {fileName}
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

// Simple icons to avoid lucide-react dependency in core
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
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
