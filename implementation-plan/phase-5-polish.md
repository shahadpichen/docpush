# Phase 5: Error Handling & Polish

**Duration:** Week 5
**Goal:** Production-ready error handling, conflict resolution, and media uploads
**Prerequisites:** Phase 1-4 complete

**Key Features:** Retry logic, rate limiting, conflict detection, image uploads

---

## Task 5.1: GitHub API Retry Logic

**Create packages/docpush/src/core/github/retry.ts:**

```typescript
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

/**
 * Retry a GitHub API call with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry client errors (4xx) except 429 (rate limit)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw new GitHubAPIError(
          error.message || "GitHub API client error",
          error.status
        );
      }

      // Handle rate limiting (403 or 429)
      if (error.status === 403 || error.status === 429) {
        const resetTime = error.response?.headers["x-ratelimit-reset"];
        const remaining = error.response?.headers["x-ratelimit-remaining"];

        if (remaining === "0" && resetTime) {
          const waitTime = parseInt(resetTime) * 1000 - Date.now();

          if (waitTime > 0 && waitTime < 60000) {
            console.log(
              `Rate limited. Waiting ${Math.ceil(waitTime / 1000)}s...`
            );
            await sleep(waitTime);
            continue;
          } else {
            throw new GitHubAPIError(
              "GitHub API rate limit exceeded",
              error.status,
              waitTime
            );
          }
        }
      }

      // Retry on 5xx errors or network errors
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Update packages/docpush/src/core/github/client.ts to use retry:**

```typescript
import { retryWithBackoff, GitHubAPIError } from "./retry";

export class GitHubClient {
  // ... existing code ...

  async getFileContent(filePath: string, ref?: string): Promise<string> {
    return retryWithBackoff(async () => {
      const fullPath = `${this.config.docsPath}/${filePath}`;
      const { data } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fullPath,
        ref: ref || this.config.branch,
      });

      if ("content" in data) {
        return Buffer.from(data.content, "base64").toString("utf-8");
      }
      throw new Error("Not a file");
    });
  }

  async commitFile(
    branchName: string,
    filePath: string,
    content: string,
    message: string,
    expectedSHA?: string
  ): Promise<void> {
    return retryWithBackoff(async () => {
      const fullPath = `${this.config.docsPath}/${filePath}`;

      // Get current file SHA
      let currentSHA: string | undefined;
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path: fullPath,
          ref: branchName,
        });
        if ("sha" in data) currentSHA = data.sha;
      } catch (e: any) {
        if (e.status !== 404) throw e;
        // File doesn't exist yet - that's ok
      }

      // Conflict detection
      if (expectedSHA && currentSHA && currentSHA !== expectedSHA) {
        throw new GitHubAPIError(
          "CONFLICT: File was modified by someone else",
          409
        );
      }

      // Create or update file
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fullPath,
        message,
        content: Buffer.from(content).toString("base64"),
        branch: branchName,
        sha: currentSHA,
      });
    });
  }

  async createPullRequest(
    branchName: string,
    title: string,
    body: string
  ): Promise<number> {
    return retryWithBackoff(async () => {
      const { data } = await this.octokit.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        head: branchName,
        base: this.config.branch,
        title,
        body,
      });
      return data.number;
    });
  }

  async mergePullRequest(prNumber: number): Promise<void> {
    return retryWithBackoff(async () => {
      await this.octokit.pulls.merge({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber,
        merge_method: "squash",
      });
    });
  }

  async deleteBranch(branchName: string): Promise<void> {
    return retryWithBackoff(async () => {
      await this.octokit.git.deleteRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${branchName}`,
      });
    });
  }
}
```

---

## Task 5.2: Conflict Detection & Resolution

**Update draft update route to detect conflicts:**

```typescript
// packages/docpush/src/server/routes/drafts.ts

router.put("/:id", requireEdit, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, sha } = req.body; // ← Client sends current SHA

    if (!content) {
      return res.status(400).json({ error: "content required" });
    }

    const db = getDb();

    // Get draft
    const draft = db
      .prepare(
        `
      SELECT * FROM drafts WHERE id = ?
    `
      )
      .get(id) as any;

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    // In non-public modes, verify ownership
    const config = req.config;
    if (config.auth.mode !== "public") {
      if (draft.author_id !== req.user?.id) {
        return res.status(403).json({ error: "Not your draft" });
      }
    }

    // Initialize GitHub client
    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    try {
      // Commit to GitHub with conflict detection
      await github.commitFile(
        draft.branch_name,
        draft.doc_path,
        content,
        `Update: ${draft.doc_path}`,
        sha // ← Pass expected SHA
      );

      // Update timestamp in database
      db.prepare(
        `
        UPDATE drafts SET updated_at = ? WHERE id = ?
      `
      ).run(now(), id);

      res.json({ success: true, updated_at: now() });
    } catch (error: any) {
      if (error.status === 409) {
        // Conflict detected - return current content for merge
        const currentContent = await github.getFileContent(
          draft.doc_path,
          draft.branch_name
        );

        return res.status(409).json({
          error: "CONFLICT",
          message: "File was modified by someone else",
          currentContent,
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error updating draft:", error);
    next(error);
  }
});
```

**Frontend conflict handling:**

```tsx
// packages/docpush/src/web/components/MarkdownEditor.tsx

const saveMutation = useMutation({
  mutationFn: async (content: string) => {
    try {
      await draftsApi.update(draftId, content, currentSHA);
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Conflict - show dialog
        setConflictData({
          localContent: content,
          remoteContent: error.response.data.currentContent,
        });
      } else {
        throw error;
      }
    }
  },
});

// Conflict resolution dialog
{
  conflictData && (
    <ConflictDialog
      localContent={conflictData.localContent}
      remoteContent={conflictData.remoteContent}
      onResolve={(resolvedContent) => {
        setContent(resolvedContent);
        setConflictData(null);
        // Force save
        saveMutation.mutate(resolvedContent);
      }}
    />
  );
}
```

---

## Task 5.3: Media Upload System

**Install dependencies:**

```bash
cd packages/docpush
pnpm add multer sharp
pnpm add @aws-sdk/client-s3  # Optional: for S3
pnpm add @types/multer --save-dev
```

**Create packages/docpush/src/server/routes/media.ts:**

```typescript
import express from "express";
import multer from "multer";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireEdit } from "../middleware/auth";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images are allowed"));
    }
    cb(null, true);
  },
});

// Optional S3 client
const s3 = process.env.S3_BUCKET
  ? new S3Client({ region: process.env.AWS_REGION || "us-east-1" })
  : null;

/**
 * Upload image
 * POST /api/media/upload
 */
router.post(
  "/upload",
  requireEdit,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Generate unique filename
      const hash = crypto.randomBytes(8).toString("hex");
      const ext = path.extname(req.file.originalname);
      const filename = `${Date.now()}-${hash}.webp`;

      // Optimize image with sharp
      const optimized = await sharp(req.file.buffer)
        .resize(2000, 2000, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      // Upload to S3 or local filesystem
      if (s3 && process.env.S3_BUCKET) {
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: `docs/media/${filename}`,
            Body: optimized,
            ContentType: "image/webp",
            ACL: "public-read",
          })
        );

        const url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/docs/media/${filename}`;
        res.json({ url });
      } else {
        // Save locally
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        await fs.ensureDir(uploadsDir);
        await fs.writeFile(path.join(uploadsDir, filename), optimized);

        const url = `/uploads/${filename}`;
        res.json({ url });
      }
    } catch (error: any) {
      console.error("Error uploading media:", error);
      next(error);
    }
  }
);

export default router;
```

**Register media routes in server:**

```typescript
// packages/docpush/src/server/index.ts

import mediaRoutes from "./routes/media";

export async function createServer() {
  // ... existing code ...

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/drafts", draftsRoutes);
  app.use("/api/docs", docsRoutes);
  app.use("/api/media", mediaRoutes); // ← Add

  // ... rest of code ...
}
```

**Frontend media picker component:**

```tsx
// packages/docpush/src/web/components/MediaPicker.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import axios from "axios";

export function MediaPicker({ onInsert }: { onInsert: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axios.post("/api/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      onInsert(data.url);
      setOpen(false);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload size={16} className="mr-2" />
        Upload Image
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 size={32} className="animate-spin text-gray-400" />
                    <span className="text-sm text-gray-600">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Click to select an image
                    </span>
                    <span className="text-xs text-gray-500">
                      Max 10MB • Automatically optimized to WebP
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## Task 5.4: Error Boundaries

**Create packages/docpush/src/web/components/ErrorBoundary.tsx:**

```tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-600" />
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Wrap app in error boundary:**

```tsx
// packages/docpush/src/web/app/layout.tsx

import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

---

## Task 5.5: Loading States & Skeletons

**Create packages/docpush/src/web/components/Skeleton.tsx:**

```tsx
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  );
}

export function FileTreeSkeleton() {
  return (
    <div className="w-64 border-r p-4 bg-gray-50 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2 ml-4" />
      <Skeleton className="h-4 w-2/3 ml-4" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2 ml-4" />
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="h-screen flex flex-col">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-6 w-64" />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
      </div>
    </div>
  );
}
```

---

## Task 5.6: Toast Notifications

**Create packages/docpush/src/web/hooks/useToast.ts:**

```typescript
import { useState } from "react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({
    title,
    description,
    variant = "default",
  }: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, title, description, variant };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  return { toast, toasts };
}
```

**Use in mutations:**

```tsx
const saveMutation = useMutation({
  mutationFn: (content: string) => draftsApi.update(draftId, content),
  onSuccess: () => {
    toast({
      title: "Draft saved",
      variant: "success",
    });
  },
  onError: (error: any) => {
    toast({
      title: "Save failed",
      description: error.message,
      variant: "error",
    });
  },
});
```

---

## Task 5.7: Environment Variable Validation

**Create packages/docpush/src/core/env.ts:**

```typescript
import { z } from "zod";

const envSchema = z.object({
  // Required
  GITHUB_TOKEN: z.string().min(1, "GITHUB_TOKEN is required"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters"),

  // Database (optional - uses SQLite if not provided)
  DATABASE_URL: z.string().optional(),

  // Auth - Domain Restricted
  RESEND_API_KEY: z.string().optional(),

  // Auth - OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Media (optional)
  S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
});

export function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error("❌ Environment validation failed:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}
```

**Call on server startup:**

```typescript
// packages/docpush/src/server/index.ts

import { validateEnv } from "../core/env";

export async function createServer() {
  // Validate environment
  validateEnv();

  // ... rest of server setup ...
}
```

---

## Task 5.8: Algolia DocSearch Integration

**Install Algolia packages:**

```bash
cd packages/docpush
pnpm add @docsearch/react @docsearch/css
```

### Search Component

**Create packages/docpush/src/web/components/Search.tsx:**

```tsx
"use client";

import { DocSearch } from "@docsearch/react";
import "@docsearch/css";

export function Search() {
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;
  const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME;

  // If Algolia not configured, show simple search
  if (!appId || !apiKey || !indexName) {
    return <SimpleSearch />;
  }

  return (
    <DocSearch
      appId={appId}
      apiKey={apiKey}
      indexName={indexName}
      placeholder="Search docs..."
      translations={{
        button: {
          buttonText: "Search",
          buttonAriaLabel: "Search documentation",
        },
      }}
    />
  );
}

// Fallback for when Algolia is not configured
function SimpleSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data);
    setOpen(true);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSearch}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search docs..."
          className="w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-96 bg-white border rounded-lg shadow-xl z-50">
          {results.map((result) => (
            <a
              key={result.path}
              href={`/docs/${result.path}`}
              className="block px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
              onClick={() => setOpen(false)}
            >
              <div className="font-medium">{result.title}</div>
              <div className="text-sm text-gray-500 truncate">
                {result.excerpt}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Search API Endpoint (Fallback)

**Create packages/docpush/src/server/routes/search.ts:**

```typescript
import express from "express";
import { GitHubClient } from "../../core/github/client";

const router = express.Router();

/**
 * Simple text search across docs
 * GET /api/search?q=query
 */
router.get("/", async (req, res, next) => {
  try {
    const { q } = req.query;
    const config = req.config;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query parameter required" });
    }

    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    // Get all docs
    const files = await github.getDocsTree();
    const results: any[] = [];

    // Search through each file
    for (const file of files.filter(
      (f) => f.type === "file" && f.path.endsWith(".md")
    )) {
      try {
        const content = await github.getFileContent(file.path);
        const lowerContent = content.toLowerCase();
        const lowerQuery = q.toLowerCase();

        if (lowerContent.includes(lowerQuery)) {
          // Extract title from first heading
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : file.path;

          // Extract excerpt around match
          const index = lowerContent.indexOf(lowerQuery);
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + q.length + 100);
          const excerpt = content.slice(start, end).replace(/\n/g, " ").trim();

          results.push({
            path: file.path,
            title,
            excerpt:
              (start > 0 ? "..." : "") +
              excerpt +
              (end < content.length ? "..." : ""),
          });
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    res.json(results.slice(0, 20)); // Limit to 20 results
  } catch (error: any) {
    console.error("Search error:", error);
    next(error);
  }
});

export default router;
```

### Algolia Crawler Configuration

**Create packages/docpush/templates/algolia-crawler.json:**

```json
{
  "index_name": "docpush_docs",
  "start_urls": ["https://YOUR_DOCS_URL"],
  "selectors": {
    "lvl0": ".docs-sidebar h2",
    "lvl1": "article h1",
    "lvl2": "article h2",
    "lvl3": "article h3",
    "lvl4": "article h4",
    "content": "article p, article li, article code"
  },
  "custom_settings": {
    "attributesForFaceting": ["type", "lang"],
    "searchableAttributes": ["content", "lvl0", "lvl1", "lvl2", "lvl3", "lvl4"],
    "ranking": [
      "typo",
      "geo",
      "words",
      "filters",
      "proximity",
      "attribute",
      "exact",
      "custom"
    ]
  }
}
```

### Add Search to Header

**Update packages/docpush/src/web/components/Header.tsx:**

```tsx
import { Search } from "./Search";

export function Header() {
  return (
    <header className="border-b bg-white sticky top-0 z-40">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Documentation</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <Search />

          {/* User menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
```

### Environment Variables for Algolia

**Add to packages/docpush/templates/.env.example:**

```bash
# Search - Algolia (optional but recommended)
# Get free DocSearch at: https://docsearch.algolia.com/
# NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id
# NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=your_search_only_api_key
# NEXT_PUBLIC_ALGOLIA_INDEX_NAME=your_index_name
```

### How to Set Up Algolia DocSearch

**Add to packages/docpush/README.md:**

````markdown
### Search Setup (Optional)

DocPush includes a basic search that works without configuration.
For better search, add Algolia DocSearch:

1. **Apply for DocSearch** (free for open source):
   https://docsearch.algolia.com/apply/

2. **Or create Algolia account**:
   https://www.algolia.com/ (free tier: 10k searches/month)

3. **Add to .env**:
   ```bash
   NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id
   NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=your_search_key
   NEXT_PUBLIC_ALGOLIA_INDEX_NAME=docpush_docs
   ```
````

4. **Set up crawler** (Algolia crawls your site automatically)

````

---

## Verification

After Phase 5, test error handling and polish:

### 1. Test retry logic:

```bash
# Temporarily set invalid GitHub token
GITHUB_TOKEN=invalid npm run dev:server

# Try to access docs tree
curl http://localhost:3000/api/docs/tree

# ✅ Should retry and eventually fail with clear error
````

### 2. Test conflict detection:

- Open same draft in two browser tabs
- Edit in both tabs
- Save in first tab
- Save in second tab
- ✅ Should show conflict dialog with merge options

### 3. Test media upload:

```bash
# Upload an image
curl -X POST http://localhost:3000/api/media/upload \
  -F "file=@test-image.jpg"

# ✅ Should return optimized WebP URL
# ✅ Image should be < original size
```

### 4. Test rate limiting:

- Make 50+ GitHub API calls rapidly
- ✅ Should auto-wait when rate limited
- ✅ Should resume after reset time

### 5. Test error boundaries:

- Trigger a runtime error in React
- ✅ Should show error boundary UI
- ✅ "Reload Page" button works

---

## Next Steps

Phase 6 will cover package publishing, versioning, and distribution to npm.
