# Phase 4: Build & Deploy

**Duration:** Week 3-4
**Goal:** Automated builds in user's repository
**Prerequisites:** Phase 3 complete

**Key Point:** GitHub Actions workflow runs in **user's repository**, deploys to **user's Cloudflare account**!

---

## GitHub Token Permissions Required

**User must create a GitHub Personal Access Token with these scopes:**

### Required Scopes:
- `repo` - Full repository access
  - Create/delete branches
  - Create/merge pull requests
  - Read/write file contents
  - Trigger workflows (workflow dispatch)

### How User Creates Token:
1. Go to https://github.com/settings/tokens/new
2. Name: "Docs Platform Token"
3. Select scopes: **repo** (check the box)
4. Generate token
5. Copy to `.dev.vars`:
   ```bash
   GITHUB_TOKEN=ghp_xxxxxxxxxxxx
   ```

### Token Permissions Table:

| Action | Permission | Why |
|--------|-----------|-----|
| Create draft branch | `repo` | Creates `draft/doc-name-123` in user's repo |
| Commit changes | `repo` | Writes to branch in user's repo |
| Create PR | `repo` | Creates pull request when admin approves |
| Merge PR | `repo` | Merges approved changes to main |
| Delete branch | `repo` | Cleanup after merge/rejection |
| Trigger workflow | `repo` | Triggers build after merge |

**Security Note:** Token has full access to user's repository. Store in `.dev.vars` (never commit!).

---

## Task 4.1: Docusaurus Setup (In User's Repo)

User adds Docusaurus to **their own repository**:

```bash
# User runs in their repo
cd their-docs-repo
npx create-docusaurus@latest content classic
```

```js
// content/docusaurus.config.js (in user's repo)
module.exports = {
  title: 'User\'s Docs',
  url: 'https://docs.their-company.com',
  baseUrl: '/',
  organizationName: 'their-org',
  projectName: 'their-docs',
  // ...
};
```

---

## Task 4.2: GitHub Actions (User Adds to Their Repo)

User creates workflow in **their repository**:

```yaml
# .github/workflows/build-docs.yml (in user's repo)
name: Build and Deploy Docs

on:
  workflow_dispatch:  # Triggered by your package
  push:
    branches: [main]
    paths: ['content/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: content/package-lock.json

      - name: Install dependencies
        working-directory: content
        run: npm ci

      - name: Build Docusaurus
        working-directory: content
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}  # User's token
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}  # User's account
          projectName: their-docs-project
          directory: content/build
```

**User adds secrets to THEIR repository:**
- `CLOUDFLARE_API_TOKEN` (from their Cloudflare account)
- `CLOUDFLARE_ACCOUNT_ID` (from their Cloudflare account)

---

## Task 4.3: Trigger Workflow (From Your Package)

```ts
// packages/core/src/github/client.ts
export class GitHubClient {
  // ... existing methods

  async triggerWorkflow(workflowFile: string, ref: string = 'main') {
    // Trigger workflow in USER's repository
    await this.octokit.actions.createWorkflowDispatch({
      owner: this.config.owner,  // User's org
      repo: this.config.repo,    // User's repo
      workflow_id: workflowFile,
      ref
    });
  }
}
```

Called after approval:
```ts
// After merging PR
await github.triggerWorkflow('build-docs.yml');
```

**Result:** Build runs in user's repository → deploys to user's Cloudflare account ✓

---

## Task 4.4: Cloudflare Pages Setup (User's Account)

User creates Pages project in **their Cloudflare account**:

1. Go to Cloudflare dashboard
2. Create Pages project
3. Configure:
   - Project name: `their-docs`
   - Build command: `npm run build`
   - Output directory: `build`
   - Root directory: `content`

---

## Task 4.5: Cache Strategy (User's KV)

```ts
// Cache in user's KV namespace
async function getDocsTree(KV: KVNamespace, github: GitHubClient) {
  const cached = await KV.get('docs-tree-cache', { type: 'json' });
  if (cached) return cached;

  const tree = await github.getTree('main', { recursive: true });

  await KV.put('docs-tree-cache', JSON.stringify(tree), {
    expirationTtl: 300  // 5 min
  });

  return tree;
}
```

---

## Verification

After Phase 4:
- [ ] User has Docusaurus in their repo ✓
- [ ] User has GitHub Actions in their repo ✓
- [ ] Workflow triggers from your package ✓
- [ ] Build runs in user's repo ✓
- [ ] Deploys to user's Cloudflare ✓
