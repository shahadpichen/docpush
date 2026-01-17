# Phase 3: Draft System

**Duration:** Week 3
**Goal:** Implement Git-based draft system with GitHub API
**Prerequisites:** Phase 1 & 2 complete

**Key Concept:** Every draft = a Git branch in user's repository. All changes commit directly to GitHub.

---

## Draft Workflow

```
1. User creates draft
   → Branch created in GitHub: draft/getting-started-1234567890

2. User edits content
   → Each save commits to the branch

3. Admin approves
   → Creates PR → Merges to main → Deletes branch

4. Changes appear in main branch
   → User's docs are updated
```

---

## Task 3.1: Draft API Routes

**packages/docpush/src/server/routes/drafts.ts:**

```typescript
import express from 'express';
import { requireEdit, requireAdmin } from '../middleware/auth';
import { GitHubClient } from '../../core/github/client';
import { getDb, generateId, now } from '../db';

const router = express.Router();

/**
 * Create a new draft
 * POST /api/drafts
 */
router.post('/', requireEdit, async (req, res, next) => {
  try {
    const { docPath, initialContent, title } = req.body;
    const config = req.config;

    if (!docPath) {
      return res.status(400).json({ error: 'docPath required' });
    }

    // Initialize GitHub client
    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    // Generate unique branch name
    const timestamp = Date.now();
    const branchName = `draft/${docPath.replace(/\//g, '-').replace(/\.md$/, '')}-${timestamp}`;

    // Create branch in GitHub
    await github.createDraftBranch(branchName);

    // Commit initial content if provided
    if (initialContent) {
      await github.commitFile(
        branchName,
        docPath,
        initialContent,
        `Draft: ${title || docPath}`
      );
    }

    // Save draft metadata to database
    const db = getDb();
    const draftId = generateId();

    db.prepare(`
      INSERT INTO drafts (id, doc_path, branch_name, title, author_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      draftId,
      docPath,
      branchName,
      title || extractTitle(initialContent) || docPath,
      req.user?.id || null,
      now(),
      now()
    );

    // Get created draft
    const draft = db.prepare(`
      SELECT * FROM drafts WHERE id = ?
    `).get(draftId);

    res.status(201).json(draft);
  } catch (error: any) {
    console.error('Error creating draft:', error);
    next(error);
  }
});

/**
 * Update draft content (autosave)
 * PUT /api/drafts/:id
 */
router.put('/:id', requireEdit, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const config = req.config;

    if (!content) {
      return res.status(400).json({ error: 'content required' });
    }

    const db = getDb();

    // Get draft
    const draft = db.prepare(`
      SELECT * FROM drafts WHERE id = ?
    `).get(id) as any;

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // In non-public modes, verify ownership
    if (config.auth.mode !== 'public') {
      if (draft.author_id !== req.user?.id) {
        return res.status(403).json({ error: 'Not your draft' });
      }
    }

    // Initialize GitHub client
    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    // Commit to GitHub
    await github.commitFile(
      draft.branch_name,
      draft.doc_path,
      content,
      `Update: ${draft.doc_path}`
    );

    // Update timestamp in database
    db.prepare(`
      UPDATE drafts SET updated_at = ? WHERE id = ?
    `).run(now(), id);

    res.json({ success: true, updated_at: now() });
  } catch (error: any) {
    console.error('Error updating draft:', error);
    next(error);
  }
});

/**
 * Get all drafts (with filters)
 * GET /api/drafts?status=pending
 */
router.get('/', async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const db = getDb();

    const drafts = db.prepare(`
      SELECT
        d.*,
        u.email as author_email,
        u.name as author_name
      FROM drafts d
      LEFT JOIN users u ON d.author_id = u.id
      WHERE d.status = ?
      ORDER BY d.created_at DESC
    `).all(status);

    res.json(drafts);
  } catch (error: any) {
    console.error('Error listing drafts:', error);
    next(error);
  }
});

/**
 * Get single draft with content
 * GET /api/drafts/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = req.config;
    const db = getDb();

    // Get draft metadata
    const draft = db.prepare(`
      SELECT
        d.*,
        u.email as author_email,
        u.name as author_name
      FROM drafts d
      LEFT JOIN users u ON d.author_id = u.id
      WHERE d.id = ?
    `).get(id) as any;

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Get content from GitHub
    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    const content = await github.getFileContent(
      draft.doc_path,
      draft.branch_name
    );

    res.json({
      ...draft,
      content
    });
  } catch (error: any) {
    console.error('Error getting draft:', error);
    next(error);
  }
});

/**
 * Approve draft (admin only)
 * POST /api/drafts/:id/approve
 */
router.post('/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = req.config;
    const db = getDb();

    // Get draft
    const draft = db.prepare(`
      SELECT * FROM drafts WHERE id = ?
    `).get(id) as any;

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draft.status !== 'pending') {
      return res.status(400).json({ error: `Draft already ${draft.status}` });
    }

    // Initialize GitHub client
    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    // Create pull request
    const prNumber = await github.createPullRequest(
      draft.branch_name,
      `Publish: ${draft.title}`,
      `Approved by ${req.user?.email || 'admin'}\n\nDocument: ${draft.doc_path}`
    );

    // Merge pull request
    await github.mergePullRequest(prNumber);

    // Delete branch
    await github.deleteBranch(draft.branch_name);

    // Update draft status
    db.prepare(`
      UPDATE drafts SET status = 'approved', updated_at = ? WHERE id = ?
    `).run(now(), id);

    res.json({
      success: true,
      message: 'Draft approved and merged',
      pr_number: prNumber
    });
  } catch (error: any) {
    console.error('Error approving draft:', error);
    next(error);
  }
});

/**
 * Reject draft (admin only)
 * POST /api/drafts/:id/reject
 */
router.post('/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const config = req.config;
    const db = getDb();

    // Get draft
    const draft = db.prepare(`
      SELECT * FROM drafts WHERE id = ?
    `).get(id) as any;

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draft.status !== 'pending') {
      return res.status(400).json({ error: `Draft already ${draft.status}` });
    }

    // Initialize GitHub client
    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    // Delete branch from GitHub
    await github.deleteBranch(draft.branch_name);

    // Update draft status
    db.prepare(`
      UPDATE drafts SET status = 'rejected', updated_at = ? WHERE id = ?
    `).run(now(), id);

    // Add rejection comment if provided
    if (reason) {
      db.prepare(`
        INSERT INTO comments (id, draft_id, user_id, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(generateId(), id, req.user?.id || null, reason, now());
    }

    res.json({
      success: true,
      message: 'Draft rejected and branch deleted'
    });
  } catch (error: any) {
    console.error('Error rejecting draft:', error);
    next(error);
  }
});

/**
 * Get comments for a draft
 * GET /api/drafts/:id/comments
 */
router.get('/:id/comments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const comments = db.prepare(`
      SELECT
        c.*,
        u.email as user_email,
        u.name as user_name
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.draft_id = ?
      ORDER BY c.created_at ASC
    `).all(id);

    res.json(comments);
  } catch (error: any) {
    console.error('Error getting comments:', error);
    next(error);
  }
});

/**
 * Add comment to draft
 * POST /api/drafts/:id/comments
 */
router.post('/:id/comments', requireEdit, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const db = getDb();

    if (!content) {
      return res.status(400).json({ error: 'content required' });
    }

    // Check draft exists
    const draft = db.prepare(`SELECT id FROM drafts WHERE id = ?`).get(id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Create comment
    const commentId = generateId();
    db.prepare(`
      INSERT INTO comments (id, draft_id, user_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(commentId, id, req.user?.id || null, content, now());

    const comment = db.prepare(`
      SELECT
        c.*,
        u.email as user_email,
        u.name as user_name
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Error adding comment:', error);
    next(error);
  }
});

// Helper function
function extractTitle(content: string): string | null {
  if (!content) return null;

  // Extract first # heading
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export default router;
```

---

## Task 3.2: Docs API (File Tree & Content)

**packages/docpush/src/server/routes/docs.ts:**

```typescript
import express from 'express';
import { GitHubClient } from '../../core/github/client';

const router = express.Router();

/**
 * Get documentation file tree
 * GET /api/docs/tree
 */
router.get('/tree', async (req, res, next) => {
  try {
    const config = req.config;
    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    // Get flat file list from GitHub
    const files = await github.getDocsTree();

    // Build hierarchical tree structure
    const tree = buildTreeHierarchy(files);

    res.json(tree);
  } catch (error: any) {
    console.error('Error getting docs tree:', error);
    next(error);
  }
});

/**
 * Get published document content
 * GET /api/docs/content?path=getting-started.md
 */
router.get('/content', async (req, res, next) => {
  try {
    const { path } = req.query;
    const config = req.config;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'path parameter required' });
    }

    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    const content = await github.getFileContent(path);

    res.json({ path, content });
  } catch (error: any) {
    console.error('Error getting doc content:', error);

    if (error.status === 404) {
      return res.status(404).json({ error: 'Document not found' });
    }

    next(error);
  }
});

/**
 * Get file history
 * GET /api/docs/history?path=getting-started.md
 */
router.get('/history', async (req, res, next) => {
  try {
    const { path } = req.query;
    const config = req.config;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'path parameter required' });
    }

    const github = new GitHubClient(process.env.GITHUB_TOKEN!, config.github);

    const history = await github.getFileHistory(path);

    res.json(history);
  } catch (error: any) {
    console.error('Error getting file history:', error);
    next(error);
  }
});

/**
 * Build hierarchical tree from flat file list
 */
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

function buildTreeHierarchy(files: Array<{ path: string; type: string }>): FileNode {
  const root: FileNode = { name: 'docs', path: '', type: 'dir', children: [] };

  files.forEach(file => {
    const parts = file.path.split('/').filter(p => p);
    let current = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;

      // Find existing child
      let child = current.children?.find(c => c.name === part);

      if (!child) {
        // Create new node
        child = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          type: isLast ? (file.type === 'file' ? 'file' : 'dir') : 'dir',
          children: isLast && file.type === 'file' ? undefined : []
        };

        if (!current.children) current.children = [];
        current.children.push(child);
      }

      if (!isLast) {
        current = child;
      }
    });
  });

  // Sort: directories first, then alphabetically
  sortTree(root);

  return root;
}

function sortTree(node: FileNode) {
  if (!node.children) return;

  node.children.sort((a, b) => {
    // Directories before files
    if (a.type !== b.type) {
      return a.type === 'dir' ? -1 : 1;
    }
    // Alphabetically
    return a.name.localeCompare(b.name);
  });

  // Recursively sort children
  node.children.forEach(sortTree);
}

export default router;
```

---

## Task 3.3: Register Routes in Server

**Update packages/docpush/src/server/index.ts:**

```typescript
import draftsRoutes from './routes/drafts';
import docsRoutes from './routes/docs';

export async function createServer() {
  // ... existing code ...

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/drafts', draftsRoutes);  // ← Add
  app.use('/api/docs', docsRoutes);      // ← Add
  app.use('/api/media', mediaRoutes);

  // ... rest of code ...
}
```

---

## Verification

After Phase 3, test the draft workflow:

### 1. Create Draft

```bash
curl -X POST http://localhost:3000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "docPath": "test.md",
    "title": "Test Document",
    "initialContent": "# Test\n\nThis is a test."
  }'

# Check GitHub - should see branch: draft/test-1234567890
```

### 2. Update Draft (Autosave)

```bash
curl -X PUT http://localhost:3000/api/drafts/DRAFT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Test\n\nUpdated content!"
  }'

# Check GitHub - should see new commit on draft branch
```

### 3. List Drafts

```bash
curl http://localhost:3000/api/drafts?status=pending
```

### 4. Approve Draft (as admin)

```bash
curl -X POST http://localhost:3000/api/drafts/DRAFT_ID/approve \
  -H "X-Admin-Password: test123"

# Check GitHub:
# - PR should be created
# - PR should be merged
# - Draft branch should be deleted
# - File should appear in main branch
```

### 5. Get File Tree

```bash
curl http://localhost:3000/api/docs/tree
```

### 6. Get Published Content

```bash
curl 'http://localhost:3000/api/docs/content?path=test.md'
```

---

## Next Steps

Phase 4 will build the Next.js frontend with Monaco editor and admin dashboard.
