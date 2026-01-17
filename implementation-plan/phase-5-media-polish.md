# Phase 5: Media & Polish

**Duration:** Week 4
**Goal:** Image uploads, UX polish, documentation
**Prerequisites:** Phase 4 complete

**Key Point:** Media stored in **user's R2 bucket** or **user's GitHub repo**!

---

## Task 5.1: R2 Upload (To User's Bucket)

```ts
// apps/worker/src/routes/upload.ts
app.post('/upload', requireAuth, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const config = await loadConfig();

  // Validate
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new HTTPException(400, { message: 'Invalid file type' });
  }

  if (file.size > 10 * 1024 * 1024) {  // 10MB
    throw new HTTPException(400, { message: 'File too large' });
  }

  // Upload to USER's R2 or GitHub
  const key = `images/${crypto.randomUUID()}.${file.name.split('.').pop()}`;

  if (config.media?.provider === 'r2') {
    // Upload to user's R2 bucket
    await c.env.R2.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });

    return c.json({
      url: `${config.media.publicUrl}/${key}`
    });
  } else {
    // Upload to user's GitHub repo (default)
    const github = new GitHubClient(c.env.GITHUB_TOKEN, config.storage);
    await github.commitFile(
      'main',
      `${config.storage.path}/images/${key}`,
      Buffer.from(await file.arrayBuffer()).toString('base64'),
      `Upload image: ${file.name}`
    );

    return c.json({
      url: `https://raw.githubusercontent.com/${config.storage.owner}/${config.storage.repo}/main/${config.storage.path}/images/${key}`
    });
  }
});
```

**Result:** Images stored in user's infrastructure, not yours ✓

---

## Task 5.2: Editor Image Upload

```tsx
// apps/web/src/components/Editor/MarkdownEditor.tsx
export function MarkdownEditor({ content, onChange }: Props) {
  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/upload`, {
          method: 'POST',
          body: formData
        });

        const { url } = await res.json();

        // Insert at cursor position
        const markdownImage = `![Image](${url})`;
        onChange(content + '\n' + markdownImage);
      }
    }
  };

  return (
    <div onPaste={handlePaste}>
      <Editor {...props} />
    </div>
  );
}
```

---

## Task 5.3: Admin Management UI

```tsx
// apps/web/src/app/admin/settings/page.tsx
export default function AdminSettings() {
  const [config, setConfig] = useState<DocsConfig | null>(null);

  useEffect(() => {
    // Fetch current config
    fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/config`)
      .then(r => r.json())
      .then(setConfig);
  }, []);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Admins</h2>
          <ul>
            {config?.admins.emails.map(email => (
              <li key={email}>{email}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Repository</h2>
          <p>{config?.storage.owner}/{config?.storage.repo}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Auth Mode</h2>
          <p>{config?.auth.mode}</p>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 5.4: UX Polish

- [ ] Loading states
- [ ] Error boundaries
- [ ] Toast notifications (sonner)
- [ ] Keyboard shortcuts (Ctrl+S, Ctrl+B)
- [ ] Mobile responsive

```bash
pnpm add sonner
```

```tsx
import { toast } from 'sonner';

const handleApprove = async () => {
  try {
    await approveDraft(draftId);
    toast.success('Draft approved!');
  } catch (error) {
    toast.error('Failed to approve');
  }
};
```

---

## Task 5.5: Documentation & Examples

Create comprehensive documentation:

**README.md:**
```markdown
# Docs Platform

Self-hosted, Git-backed documentation platform.

## Installation

\`\`\`bash
npm install @yourorg/docs-platform
\`\`\`

## Quick Start

\`\`\`ts
// docs.config.ts
export default {
  auth: { mode: 'public' },
  admins: { emails: ['you@example.com'] },
  storage: {
    type: 'github',
    owner: 'your-org',
    repo: 'your-docs'
  }
}
\`\`\`

\`\`\`bash
# .dev.vars
GITHUB_TOKEN=ghp_yourtoken
\`\`\`

## Auth Modes

### Public Mode
Anyone can edit, admins approve.

### Domain-Restricted
Only @your-company.com can edit.

### OAuth
GitHub/Google login required.

## Examples

See `/examples` folder for complete setups.
\`\`\`

**Create example projects:**
- `examples/public-docs` - Open-source docs
- `examples/company-internal` - Domain-restricted
- `examples/enterprise-oauth` - Full OAuth

---

## Task 5.6: Package Publishing

**Prepare monorepo for npm publishing:**

### 1. Package.json Configuration

```json
// packages/core/package.json
{
  "name": "@yourorg/docs-platform",
  "version": "1.0.0",
  "description": "Self-hosted, Git-backed documentation platform",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./config": "./dist/config/index.js",
    "./auth": "./dist/auth/index.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "pnpm build"
  },
  "keywords": [
    "documentation",
    "cloudflare",
    "git",
    "markdown",
    "self-hosted"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourorg/docs-platform"
  }
}
```

### 2. What Gets Published vs What Doesn't

**Published to npm (users install):**
- `packages/core/` - Core logic, GitHub client
- `packages/config/` - Config schema and loader
- `packages/auth/` - Auth implementations
- `packages/ui/` - Shared UI components
- `apps/worker/` - Worker code (bundled)
- `apps/web/` - Next.js code (bundled)

**NOT published (stays in repo):**
- `examples/` - Example projects for documentation
- `.github/` - Our CI/CD workflows
- Development config files

### 3. Build Process

```bash
# Build all packages
turbo build

# Test locally before publishing
cd packages/core
pnpm link --global

# In a test project
pnpm link --global @yourorg/docs-platform
```

### 4. Publishing Workflow

```bash
# 1. Update version
pnpm changeset

# 2. Build
turbo build

# 3. Publish to npm
pnpm changeset publish
```

### 5. CI/CD Publishing (GitHub Actions)

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install
      - run: turbo build
      - run: pnpm publish -r --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 6. Versioning Strategy

**Semantic Versioning:**
- `1.0.0` - Initial release
- `1.0.x` - Bug fixes
- `1.x.0` - New features (backward compatible)
- `x.0.0` - Breaking changes

**Release Checklist:**
- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] Published to npm
- [ ] GitHub release created

### 7. Post-Publishing

**Users install with:**
```bash
pnpm add @yourorg/docs-platform
# or
npm install @yourorg/docs-platform
```

**Update documentation site with:**
- Installation instructions
- Migration guides (for breaking changes)
- API reference

---

## Verification

After Phase 5:
- [ ] Media uploads work ✓
- [ ] Images stored in user's infrastructure ✓
- [ ] Admin UI functional ✓
- [ ] UX polished ✓
- [ ] Documentation complete ✓
- [ ] Example projects created ✓

---

## Launch Checklist

- [ ] npm package published
- [ ] Documentation site live
- [ ] Example projects deployed
- [ ] GitHub repo public
- [ ] License added (MIT)
- [ ] Contributing guide written
- [ ] Demo video created
