# Phase 2: Draft System

**Duration:** Week 2
**Goal:** Implement Git branch-based draft creation in user's repository
**Prerequisites:** Phase 1 complete

**Key Point:** All branches created in the **user's configured repository**, not yours!

---

## Task 2.0: Config Loading Implementation

**Create config loader that reads user's configuration:**

```ts
// packages/config/src/loader.ts
import { configSchema, type DocsConfig } from './schema';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function loadConfig(configPath?: string): Promise<DocsConfig> {
  // Default: look for docs.config.ts in user's project root
  const defaultPath = path.join(process.cwd(), 'docs.config.ts');
  const finalPath = configPath || defaultPath;

  try {
    // Dynamic import of user's config file
    const configModule = await import(finalPath);
    const config = configModule.default || configModule;

    // Validate against schema
    return configSchema.parse(config);
  } catch (error) {
    throw new Error(`Failed to load config from ${finalPath}: ${error.message}`);
  }
}

// Export singleton for caching
let cachedConfig: DocsConfig | null = null;

export async function getConfig(): Promise<DocsConfig> {
  if (!cachedConfig) {
    cachedConfig = await loadConfig();
  }
  return cachedConfig;
}

// Reset cache (useful for testing)
export function resetConfigCache() {
  cachedConfig = null;
}
```

**Usage in Worker:**
```ts
// apps/worker/src/index.ts
import { getConfig } from '@yourorg/docs-platform/config';

app.use('*', async (c, next) => {
  // Load config once per request (uses cache)
  const config = await getConfig();
  c.set('config', config);
  await next();
});
```

**User's Config File** (they create this):
```ts
// docs.config.ts (in user's project)
export default {
  auth: { mode: 'public' },
  admins: { emails: ['admin@company.com'], password: 'secret123' },
  storage: {
    type: 'github',
    owner: 'their-org',
    repo: 'their-docs',
    branch: 'main',
    path: 'content'
  }
};
```

---

## Task 2.1: D1 Database Schema

User creates D1 database in **their Cloudflare account**.

```sql
-- migrations/0001_create_drafts.sql
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  branch TEXT NOT NULL UNIQUE,     -- Branch in user's repo
  doc_path TEXT NOT NULL,
  title TEXT,
  author_id TEXT,                   -- May be null in public mode
  author_email TEXT,                -- May be null in public mode
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_drafts_status ON drafts(status);
CREATE INDEX idx_drafts_created ON drafts(created_at DESC);

CREATE TABLE review_comments (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
);
```

```bash
# User runs in their project
wrangler d1 execute docs-platform --file=migrations/0001_create_drafts.sql
```

---

## Task 2.2: Draft Creation (Creates Branch in User's Repo)

```ts
// apps/worker/src/routes/drafts.ts
app.post('/', requireAuth, async (c) => {
  const user = c.get('user');  // May be anonymous in public mode
  const { docPath, initialContent } = await c.req.json();
  const config = await loadConfig();

  // Check permissions
  if (!(await canEdit(user, config))) {
    throw new HTTPException(403);
  }

  // Initialize GitHub client with USER's token and USER's repo
  const github = new GitHubClient(c.env.GITHUB_TOKEN, config.storage);

  // Generate IDs
  const draftId = crypto.randomUUID();
  const branchName = `draft/${docPath.replace(/\//g, '-')}-${Date.now()}`;

  // Get SHA from user's main branch
  const mainBranch = await github.getBranch(config.storage.branch);

  // Create branch in USER's repo
  await github.createBranch(branchName, mainBranch.sha);

  // Commit to USER's repo
  if (initialContent) {
    await github.commitFile(
      branchName,
      `${config.storage.path}/${docPath}`,
      initialContent,
      `Draft: ${docPath}`
    );
  }

  // Save metadata in user's D1
  await c.env.DB.prepare(`
    INSERT INTO drafts (id, branch, doc_path, title, author_id, author_email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    draftId,
    branchName,
    docPath,
    extractTitle(initialContent),
    user?.id || 'anonymous',
    user?.email || null,
    Date.now(),
    Date.now()
  ).run();

  return c.json({ draftId, branch: branchName });
});
```

**Result:** Branch `draft/getting-started-123456789` created in `user-org/user-docs-repo` ✓

---

## Task 2.3: Draft Save (Commits to User's Branch)

```ts
app.put('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const draftId = c.req.param('id');
  const { content } = await c.req.json();
  const config = await loadConfig();

  // Get draft
  const draft = await c.env.DB.prepare(`
    SELECT * FROM drafts WHERE id = ?
  `).bind(draftId).first();

  if (!draft) throw new HTTPException(404);

  // In public mode, anyone can edit any draft
  // In other modes, verify ownership
  if (config.auth.mode !== 'public') {
    if (draft.author_email !== user?.email) {
      throw new HTTPException(403);
    }
  }

  // Initialize GitHub client
  const github = new GitHubClient(c.env.GITHUB_TOKEN, config.storage);

  // Commit to user's branch
  await github.commitFile(
    draft.branch,
    `${config.storage.path}/${draft.doc_path}`,
    content,
    `Update: ${draft.doc_path}`
  );

  // Update timestamp
  await c.env.DB.prepare(`
    UPDATE drafts SET updated_at = ? WHERE id = ?
  `).bind(Date.now(), draftId).run();

  return c.json({ success: true });
});
```

---

## Task 2.4: Frontend Editor

```tsx
// apps/web/src/components/Editor/MarkdownEditor.tsx
'use client';
import Editor from '@monaco-editor/react';
import { MarkdownPreview } from './MarkdownPreview';

export function MarkdownEditor({ content, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      <Editor
        language="markdown"
        value={content}
        onChange={onChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          lineNumbers: 'on'
        }}
      />
      <MarkdownPreview content={content} />
    </div>
  );
}
```

---

## Task 2.5: Autosave Hook

```tsx
// apps/web/src/lib/hooks/useAutosave.ts
import { useEffect, useRef } from 'react';

export function useAutosave(
  content: string,
  onSave: (content: string) => Promise<void>,
  delay = 3000
) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      onSave(content);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, delay, onSave]);
}
```

---

## Task 2.6: Editor Page

```tsx
// apps/web/src/app/editor/[id]/page.tsx
'use client';

export default function EditorPage({ params }: { params: { id: string } }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch draft
    fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/drafts/${params.id}`)
      .then(r => r.json())
      .then(draft => {
        setDraft(draft);
        setContent(draft.content);
      });
  }, [params.id]);

  const saveDraft = async (content: string) => {
    setSaving(true);
    await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/drafts/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    setSaving(false);
  };

  useAutosave(content, saveDraft);

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4">
        <h1>{draft?.doc_path}</h1>
        {saving && <span className="text-sm text-gray-500">Saving...</span>}
      </div>
      <MarkdownEditor content={content} onChange={setContent} />
    </div>
  );
}
```

---

## Verification

After Phase 2:
- [ ] User can create draft (branch in their repo) ✓
- [ ] Autosave commits to their branch ✓
- [ ] Monaco editor works ✓
- [ ] Metadata stored in their D1 ✓
- [ ] Works in all three auth modes ✓
