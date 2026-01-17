# Phase 3: Review & Approval

**Duration:** Week 3
**Goal:** Admin review and merge drafts in user's repository
**Prerequisites:** Phase 2 complete

**Key Point:** PRs created and merged in **user's repository**!

---

## Task 3.0: Admin Middleware (All Auth Modes)

**Create middleware that adapts to the configured auth mode:**

```ts
// apps/worker/src/middleware/admin.ts
import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getConfig } from '@yourorg/docs-platform/config';

export const requireAdmin = async (c: Context, next: Next) => {
  const config = await getConfig();
  const user = c.get('user');

  // Mode 1: Public - Check password header
  if (config.auth.mode === 'public') {
    const password = c.req.header('X-Admin-Password');
    if (!password || password !== config.admins.password) {
      throw new HTTPException(403, { message: 'Invalid admin password' });
    }
    await next();
    return;
  }

  // Mode 2 & 3: Domain-Restricted or OAuth - Check email
  if (!user?.email) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  if (!config.admins.emails.includes(user.email)) {
    throw new HTTPException(403, { message: 'Admin access required' });
  }

  await next();
};
```

**Usage in routes:**
```ts
// apps/worker/src/routes/drafts.ts
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

// Approve draft (admin only)
app.post('/:id/approve', requireAuth, requireAdmin, async (c) => {
  // Only admins reach here
  // ...
});
```

**How it works in each mode:**

### Mode 1: Public
- Anyone can edit (no login)
- **Admin approval:** Frontend sends `X-Admin-Password` header
- Simple password check against `config.admins.password`

```ts
// Frontend: Admin approval UI
fetch('/api/drafts/123/approve', {
  headers: {
    'X-Admin-Password': userEnteredPassword
  }
});
```

### Mode 2: Domain-Restricted
- Users verify via magic link (e.g., admin@company.com)
- **Admin approval:** Check if verified email is in `config.admins.emails`
- Admin must first verify their email, then approve

```ts
// Flow:
// 1. Admin enters email → sends magic link
// 2. Admin clicks link → gets session token
// 3. Admin clicks "Approve" → checks email in admins list
```

### Mode 3: OAuth
- Users login via GitHub/Google OAuth
- **Admin approval:** Check if OAuth email is in `config.admins.emails`
- Admin must first OAuth login, then approve

```ts
// Flow:
// 1. Admin clicks "Login with GitHub"
// 2. OAuth flow → gets user email
// 3. Admin clicks "Approve" → checks email in admins list
```

---

## Task 3.1: Admin Dashboard

```tsx
// apps/web/src/app/admin/page.tsx
export default async function AdminDashboard() {
  const drafts = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/drafts`)
    .then(r => r.json());

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Pending Drafts</h1>
      <DraftsTable drafts={drafts} />
    </div>
  );
}
```

---

## Task 3.2: Diff Viewer

```tsx
// apps/web/src/components/Review/DiffView.tsx
import ReactDiffViewer from 'react-diff-viewer-continued';
import { MarkdownPreview } from '../Editor/MarkdownPreview';

export function DiffView({ published, draft }: Props) {
  const [viewMode, setViewMode] = useState<'rendered' | 'code'>('rendered');

  return (
    <div>
      <Tabs value={viewMode} onValueChange={setViewMode}>
        <TabsList>
          <TabsTrigger value="rendered">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>

        {viewMode === 'rendered' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3>Published</h3>
              <MarkdownPreview content={published} />
            </div>
            <div>
              <h3>Proposed Changes</h3>
              <MarkdownPreview content={draft} />
            </div>
          </div>
        ) : (
          <ReactDiffViewer
            oldValue={published}
            newValue={draft}
            splitView
          />
        )}
      </Tabs>
    </div>
  );
}
```

---

## Task 3.3: Approval (Merges in User's Repo)

```ts
// apps/worker/src/routes/drafts.ts
app.post('/:id/approve', requireAuth, requireAdmin, async (c) => {
  const draftId = c.req.param('id');
  const user = c.get('user');
  const config = await loadConfig();

  // Get draft
  const draft = await c.env.DB.prepare(`
    SELECT * FROM drafts WHERE id = ?
  `).bind(draftId).first();

  if (!draft || draft.status !== 'pending') {
    throw new HTTPException(400);
  }

  // Initialize GitHub client for USER's repo
  const github = new GitHubClient(c.env.GITHUB_TOKEN, config.storage);

  // Create PR in USER's repository
  const pr = await github.createPullRequest({
    head: draft.branch,
    base: config.storage.branch,
    title: `Publish: ${draft.doc_path}`,
    body: `Approved by ${user.email}`
  });

  // Merge PR in USER's repository
  await github.mergePullRequest(pr.number, {
    merge_method: 'squash'
  });

  // Trigger build in USER's repository (if configured)
  if (config.build?.trigger === 'github-actions') {
    await github.triggerWorkflow(config.build.workflowFile || 'build-docs.yml');
  }

  // Update D1
  await c.env.DB.prepare(`
    UPDATE drafts SET status = 'approved', updated_at = ? WHERE id = ?
  `).bind(Date.now(), draftId).run();

  // Delete branch
  await github.deleteBranch(draft.branch);

  return c.json({ success: true });
});
```

**Result:**
- PR created in `user-org/user-docs-repo` ✓
- Merged to `user-org/user-docs-repo:main` ✓
- Build triggered in their repo ✓

---

## Task 3.4: Rejection

```ts
app.post('/:id/reject', requireAuth, requireAdmin, async (c) => {
  const draftId = c.req.param('id');
  const { comment } = await c.req.json();
  const config = await loadConfig();

  const draft = await c.env.DB.prepare(`
    SELECT * FROM drafts WHERE id = ?
  `).bind(draftId).first();

  // Update status
  await c.env.DB.prepare(`
    UPDATE drafts SET status = 'rejected', updated_at = ? WHERE id = ?
  `).bind(Date.now(), draftId).run();

  // Add comment
  if (comment) {
    await c.env.DB.prepare(`
      INSERT INTO review_comments (id, draft_id, reviewer_email, comment, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), draftId, c.get('user').email, comment, Date.now()).run();
  }

  // Delete branch from user's repo
  const github = new GitHubClient(c.env.GITHUB_TOKEN, config.storage);
  await github.deleteBranch(draft.branch);

  return c.json({ success: true });
});
```

---

## Verification

After Phase 3:
- [ ] Admin can view drafts ✓
- [ ] Diff viewer works ✓
- [ ] Approve creates PR in user's repo ✓
- [ ] Merge happens in user's repo ✓
- [ ] Rejection deletes branch ✓
