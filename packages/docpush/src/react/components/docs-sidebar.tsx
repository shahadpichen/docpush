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
  icons?: {
    file?: React.ComponentType<{ className?: string }>;
    folder?: React.ComponentType<{ className?: string }>;
    chevron?: React.ComponentType<{ className?: string }>;
  };
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: TreeNode[];
}

export function DocsSidebar({ tree, activePath, onSelect, className, icons }: DocsSidebarProps) {
  // Build nested tree structure
  const treeStructure = React.useMemo(() => {
    const root: TreeNode[] = [];

    tree.forEach((item) => {
      const parts = item.path.split('/');
      let currentLevel = root;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const fullPath = parts.slice(0, index + 1).join('/');

        let existingNode = currentLevel.find((node) => node.name === part);

        if (!existingNode) {
          existingNode = {
            name: part,
            path: fullPath,
            type: isLast ? item.type : 'dir',
            children: [],
          };
          currentLevel.push(existingNode);
        }

        if (!isLast) {
          currentLevel = existingNode.children;
        }
      });
    });

    return root;
  }, [tree]);

  const iconComponents = {
    file: icons?.file || FileIcon,
    folder: icons?.folder || FolderIcon,
    chevron: icons?.chevron || ChevronIcon,
  };

  return (
    <ScrollArea className={cn('h-full w-64 border-r', className)}>
      <div className="space-y-1 py-4 px-3">
        {treeStructure.map((node) => (
          <TreeNodeComponent
            key={node.path}
            node={node}
            activePath={activePath}
            onSelect={onSelect}
            level={0}
            icons={iconComponents}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface TreeNodeComponentProps {
  node: TreeNode;
  activePath?: string;
  onSelect?: (path: string) => void;
  level: number;
  icons: {
    file: React.ComponentType<{ className?: string }>;
    folder: React.ComponentType<{ className?: string }>;
    chevron: React.ComponentType<{ className?: string }>;
  };
}

function TreeNodeComponent({ node, activePath, onSelect, level, icons }: TreeNodeComponentProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const FileIconComponent = icons.file;
  const FolderIconComponent = icons.folder;
  const ChevronIconComponent = icons.chevron;

  if (node.type === 'file') {
    const isActive = node.path === activePath;
    const fileName = node.name.replace('.md', '');

    return (
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="sm"
        className={cn(
          'w-full justify-start gap-2',
          isActive && 'bg-muted font-medium'
        )}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={() => onSelect?.(node.path)}
      >
        <FileIconComponent className="h-4 w-4 shrink-0" />
        <span className="truncate">{fileName}</span>
      </Button>
    );
  }

  // Directory node
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 font-semibold"
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronIconComponent className={cn('h-4 w-4 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
        <FolderIconComponent className="h-4 w-4 shrink-0" />
        <span className="truncate">{node.name}</span>
      </Button>
      {isExpanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              activePath={activePath}
              onSelect={onSelect}
              level={level + 1}
              icons={icons}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Simple icons to avoid lucide-react dependency in core
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
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
    <svg
      className={className}
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
