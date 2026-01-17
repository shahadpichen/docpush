'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Input } from './ui/input';

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
  placeholder = 'Search docs...',
  className,
}: SearchBarProps) {
  const [query, setQuery] = React.useState('');
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
    <div className={cn('relative', className)}>
      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
              <LoaderIcon className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : (
            <div className="max-h-[300px] overflow-auto">
              {results.map((result) => (
                <button
                  type="button"
                  key={result.path}
                  onClick={() => {
                    onSelect?.(result.path);
                    setQuery('');
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
