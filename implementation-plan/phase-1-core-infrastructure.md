# Phase 1: Core Infrastructure

**Duration:** Week 1
**Goal:** Set up monorepo and flexible authentication system
**Prerequisites:** Node.js, pnpm

**IMPORTANT:** This is an **installable package**. Users configure their own repos, auth, and credentials.

---

## Architecture: Package vs User Project

### What We Build (Our npm Package):
```
docs-platform/                    ← Published to npm as @org/docs-platform
├── apps/
│   ├── web/                      ← Next.js app (source code)
│   └── worker/                   ← Hono worker (source code)
├── packages/
│   ├── ui/                       ← Shared components
│   ├── core/                     ← GitHub client, utilities
│   ├── auth/                     ← Auth mode implementations
│   └── config/                   ← Config schema
├── package.json
├── turbo.json
└── README.md                     ← Installation instructions
```
**NO SECRETS IN OUR PACKAGE! This is open-source code.**

### What Users Create (After Installing):
```
my-company-docs/                  ← User's repository
├── content/                      ← Their documentation files
│   ├── getting-started.md
│   └── api-reference.md
├── docs.config.ts                ← USER creates (their config)
├── .dev.vars                     ← USER creates (their secrets)
├── wrangler.toml                 ← USER creates (their Cloudflare settings)
├── package.json
│   └── dependencies:
│       └── "@org/docs-platform": "^1.0.0"  ← Our package installed
└── node_modules/
    └── @org/docs-platform/       ← Our code runs from here
```

### When User Runs:
```bash
# In my-company-docs/ (user's project)
wrangler dev
# Executes: OUR worker code from node_modules
# Using: THEIR .dev.vars (their GitHub token, their OAuth credentials)
# Operating on: THEIR GitHub repo (owner: 'their-org', repo: 'their-docs')
```

**Critical:** Our code reads THEIR environment variables to access THEIR infrastructure.

---

## Task 1.1: Project Initialization

Create the package monorepo structure.

```bash
# Initialize
git init docs-platform
cd docs-platform
pnpm init

# Create structure
mkdir -p apps/{web,worker} packages/{ui,core,auth,config}
```

**Monorepo Structure:**
```
docs-platform/
├── apps/
│   ├── web/              # Next.js UI (user adds to their project)
│   └── worker/           # Cloudflare Worker API
├── packages/
│   ├── ui/               # shadcn/ui components
│   ├── core/             # GitHub client, permissions
│   ├── auth/             # Auth adapters (3 modes)
│   └── config/           # Config schema
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Files Created:**
- `turbo.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`

---

## Task 1.2: Config Schema (User-Facing)

Define what users configure when they install your package.

```ts
// packages/config/src/schema.ts
import { z } from 'zod';

export const configSchema = z.object({
  // Auth mode (user chooses)
  auth: z.object({
    mode: z.enum(['public', 'domain-restricted', 'oauth']),

    // For domain-restricted mode
    allowedDomains: z.array(z.string()).optional(),
    verification: z.enum(['magic-link', 'simple-password']).optional(),

    // For OAuth mode
    providers: z.array(z.enum(['github', 'google'])).optional(),
  }),

  // Who can approve (user defines)
  admins: z.object({
    emails: z.array(z.string()),
    password: z.string().optional()  // For simple approval UI
  }),

  // User's GitHub repo (CRITICAL - this is THEIR repo)
  storage: z.object({
    type: z.literal('github'),
    owner: z.string(),      // User's GitHub org/username
    repo: z.string(),       // User's repository
    branch: z.string().default('main'),
    path: z.string().default('content')
  }),

  // Optional media config
  media: z.object({
    provider: z.enum(['r2', 'github']).default('github'),
    bucket: z.string().optional(),
    publicUrl: z.string().optional()
  }).optional(),

  // Editor settings
  editor: z.object({
    syntax: z.enum(['markdown', 'mdx']).default('mdx'),
    autosave: z.boolean().default(true),
    debounceMs: z.number().default(3000)
  }).optional()
});

export type DocsConfig = z.infer<typeof configSchema>;
```

**Environment Variables (User Creates):**
```bash
# .dev.vars - User creates these themselves

# REQUIRED for all modes
GITHUB_TOKEN=ghp_xxxxx
# User creates at: https://github.com/settings/tokens
# Needs "repo" scope for their repository

# REQUIRED only if auth.mode = 'oauth'
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx
# User creates OAuth app at: https://github.com/settings/developers
# Callback URL: https://their-domain.com/auth/callback

GOOGLE_CLIENT_ID=xxxxx
GOOGLE_CLIENT_SECRET=xxxxx
# User creates at: https://console.cloud.google.com/

# OPTIONAL
ADMIN_PASSWORD=xxxxx  # Simple password for approval UI
```

---

## Task 1.3: Next.js App Setup (Cloudflare-Optimized)

**Use Cloudflare's official Next.js template:**

```bash
# Create Next.js app optimized for Cloudflare Workers
pnpm create cloudflare@latest apps/web --framework=next
```

This automatically:
- Sets up `@cloudflare/next-on-pages` adapter
- Configures wrangler.toml for deployment
- Optimizes for Cloudflare Workers runtime
- Includes TypeScript and Tailwind CSS

**Add additional dependencies:**
```bash
cd apps/web
pnpm add @monaco-editor/react react-markdown gray-matter
pnpm dlx shadcn-ui@latest init
```

**Environment Variables (Next.js):**
```bash
# apps/web/.env.local
# ONLY public values (no secrets!)
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

**Files Auto-Created by Template:**
- `apps/web/app/layout.tsx`
- `apps/web/tailwind.config.js`
- `apps/web/wrangler.toml` (for deployment)
- `apps/web/next.config.mjs` (with Cloudflare adapter)

**Manual Files to Create:**
- `apps/web/lib/api-client.ts`

**Reference:** [Cloudflare Next.js Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

---

## Task 1.4: Cloudflare Worker Setup (Hono Template)

**Use official Hono template for Cloudflare Workers:**

```bash
# Create Hono worker with Cloudflare template
pnpm create hono@latest apps/worker
# When prompted, select: "cloudflare-workers"
```

This automatically:
- Sets up Hono with TypeScript
- Includes wrangler.toml pre-configured
- Adds @cloudflare/workers-types
- Configures build tools

**Update wrangler.toml (add bindings):**
```toml
name = "docs-platform-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# KV for sessions (user creates their own)
[[kv_namespaces]]
binding = "KV"
id = "preview_id"  # User replaces with their KV ID

# D1 for draft metadata (user creates their own)
[[d1_databases]]
binding = "DB"
database_name = "docs-platform"
database_id = "preview_id"  # User replaces with their D1 ID

# R2 for media (optional - user creates if needed)
[[r2_buckets]]
binding = "R2"
bucket_name = "docs-assets"  # User creates if using R2
```

**Update Basic Worker:**
```ts
// apps/worker/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  KV: KVNamespace;
  DB: D1Database;
  R2: R2Bucket;
  GITHUB_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
```

**Reference:** [Hono Cloudflare Workers Guide](https://hono.dev/docs/getting-started/cloudflare-workers)

---

## Task 1.4.5: Configure Service Bindings (Optional)

**If you want Next.js to call the Worker directly (instead of HTTP):**

```toml
# apps/web/wrangler.toml
name = "docs-platform-web"
compatibility_date = "2024-01-01"

[[services]]
binding = "API"
service = "docs-platform-api"
environment = "production"
```

```ts
// apps/web/lib/api-client.ts
export async function callAPI(endpoint: string, options?: RequestInit) {
  // In development: HTTP
  if (process.env.NODE_ENV === 'development') {
    return fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}${endpoint}`, options);
  }

  // In production: Service binding (faster, no HTTP overhead)
  // @ts-ignore - Cloudflare binding
  return env.API.fetch(new Request(`https://api${endpoint}`, options));
}
```

**Note:** Most users will use HTTP (simpler setup). Service bindings are optional for advanced users.

---

## Task 1.5: GitHub API Client (Uses User's Token)

```ts
// packages/core/src/github/client.ts
import { Octokit } from '@octokit/rest';

export class GitHubClient {
  private octokit: Octokit;
  private config: {
    owner: string;   // From user's config
    repo: string;    // From user's config
    branch: string;
  };

  constructor(token: string, config: DocsConfig['storage']) {
    this.octokit = new Octokit({ auth: token });
    this.config = {
      owner: config.owner,   // User's org/username
      repo: config.repo,     // User's repo
      branch: config.branch || 'main'
    };
  }

  // Create branch in USER's repo
  async createBranch(branchName: string, fromSHA: string) {
    await this.octokit.git.createRef({
      owner: this.config.owner,  // ← User's repo
      repo: this.config.repo,     // ← User's repo
      ref: `refs/heads/${branchName}`,
      sha: fromSHA
    });
  }

  // Commit to USER's repo
  async commitFile(branch: string, path: string, content: string, message: string) {
    const { data: ref } = await this.octokit.git.getRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${branch}`
    });

    const { data: file } = await this.octokit.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha: ref.object.sha
    });

    return file;
  }

  // Get branch details
  async getBranch(branchName: string) {
    const { data } = await this.octokit.repos.getBranch({
      owner: this.config.owner,
      repo: this.config.repo,
      branch: branchName
    });
    return { name: branchName, sha: data.commit.sha };
  }

  // Get file content
  async getFileContent(path: string, ref?: string) {
    const { data } = await this.octokit.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path,
      ref: ref || this.config.branch
    });

    if ('content' in data) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    throw new Error('Path is not a file');
  }

  // Create pull request
  async createPullRequest(params: {
    head: string;
    base: string;
    title: string;
    body: string;
  }) {
    const { data } = await this.octokit.pulls.create({
      owner: this.config.owner,
      repo: this.config.repo,
      ...params
    });
    return { number: data.number, url: data.html_url };
  }

  // Merge pull request
  async mergePullRequest(prNumber: number, options?: { merge_method?: 'merge' | 'squash' | 'rebase' }) {
    const { data } = await this.octokit.pulls.merge({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: prNumber,
      merge_method: options?.merge_method || 'squash'
    });
    return { merged: data.merged, sha: data.sha };
  }

  // Delete branch
  async deleteBranch(branchName: string) {
    await this.octokit.git.deleteRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${branchName}`
    });
  }

  // Get repository tree
  async getTree(ref: string, options?: { recursive?: boolean }) {
    const { data } = await this.octokit.git.getTree({
      owner: this.config.owner,
      repo: this.config.repo,
      tree_sha: ref,
      recursive: options?.recursive ? '1' : undefined
    });
    return data.tree;
  }

  // Trigger GitHub Actions workflow
  async triggerWorkflow(workflowFile: string, ref: string = 'main') {
    await this.octokit.actions.createWorkflowDispatch({
      owner: this.config.owner,
      repo: this.config.repo,
      workflow_id: workflowFile,
      ref
    });
  }
}
```

**Key Point:** Client operates on **user's repo**, not yours!

---

## Task 1.6: Auth Mode 1 - Public (No Login)

```ts
// packages/auth/src/public.ts

// No authentication - anyone can edit
export async function publicAuthMiddleware(c: Context, next: Next) {
  // Create anonymous session
  c.set('user', {
    id: 'anonymous',
    email: null,
    mode: 'public'
  });

  await next();
}

export async function canEdit(user: User, config: DocsConfig): Promise<boolean> {
  if (config.auth.mode === 'public') {
    return true;  // Anyone can edit
  }
  return false;
}
```

**Admin Approval (Public Mode):**
```ts
// Simple password check
export async function isAdmin(password: string, config: DocsConfig): Promise<boolean> {
  return password === config.admins.password;
}
```

---

## Task 1.7: Auth Mode 2 - Domain-Restricted (Magic Link)

```ts
// packages/auth/src/domain-restricted.ts

export async function sendMagicLink(email: string, config: DocsConfig) {
  // Check domain
  const domain = email.split('@')[1];
  if (!config.auth.allowedDomains?.includes(domain)) {
    throw new Error('Email domain not allowed');
  }

  // Generate token
  const token = crypto.randomUUID();

  // Store in KV with 15min expiration
  await KV.put(`magic-link:${token}`, email, { expirationTtl: 900 });

  // Send email (user configures email service)
  await sendEmail(email, {
    subject: 'Verify your email',
    body: `Click to verify: https://their-domain.com/auth/verify?token=${token}`
  });
}

export async function verifyMagicLink(token: string, KV: KVNamespace) {
  const email = await KV.get(`magic-link:${token}`);
  if (!email) throw new Error('Invalid or expired token');

  // Create session
  const sessionToken = crypto.randomUUID();
  await KV.put(`session:${sessionToken}`, JSON.stringify({ email }), {
    expirationTtl: 86400  // 24h
  });

  return { email, sessionToken };
}
```

---

## Task 1.8: Auth Mode 3 - OAuth (User's OAuth Apps)

**CRITICAL:** User creates their OWN OAuth apps, not you!

```ts
// packages/auth/src/oauth.ts

export async function handleGitHubOAuth(c: Context) {
  const code = c.req.query('code');

  // Use USER's OAuth credentials (from their .dev.vars)
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,      // ← User's
      client_secret: c.env.GITHUB_CLIENT_SECRET,  // ← User's
      code
    })
  });

  const { access_token } = await tokenRes.json();

  // Get user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${access_token}` }
  });
  const user = await userRes.json();

  // Optional: Check domain restriction
  const config = await loadConfig();
  if (config.auth.allowedDomains) {
    const domain = user.email.split('@')[1];
    if (!config.auth.allowedDomains.includes(domain)) {
      throw new Error('Domain not allowed');
    }
  }

  // Create session
  const sessionToken = crypto.randomUUID();
  await c.env.KV.put(`session:${sessionToken}`, JSON.stringify(user), {
    expirationTtl: 86400  // 24h
  });

  return c.json({ token: sessionToken });
}
```

**User Setup Instructions (for OAuth mode):**
1. Create GitHub OAuth App at https://github.com/settings/developers
2. Set callback URL: `https://their-domain.com/auth/callback`
3. Add to .dev.vars:
   ```
   GITHUB_CLIENT_ID=abc123
   GITHUB_CLIENT_SECRET=secret456
   ```

---

## Task 1.9: Permission System (Adapts to Auth Mode)

```ts
// packages/core/src/permissions.ts

export async function canEdit(user: User | null, config: DocsConfig): Promise<boolean> {
  switch (config.auth.mode) {
    case 'public':
      return true;  // Anyone can edit

    case 'domain-restricted':
      if (!user?.email) return false;
      const domain = user.email.split('@')[1];
      return config.auth.allowedDomains?.includes(domain) ?? false;

    case 'oauth':
      return !!user?.email;  // Must be logged in

    default:
      return false;
  }
}

export async function isAdmin(user: User | null, config: DocsConfig): Promise<boolean> {
  if (!user?.email) return false;
  return config.admins.emails.includes(user.email);
}
```

**Middleware:**
```ts
// apps/worker/src/middleware/auth.ts

export const requireAuth = async (c: Context, next: Next) => {
  const config = await loadConfig();

  // Public mode - no auth required
  if (config.auth.mode === 'public') {
    c.set('user', { id: 'anonymous', email: null });
    return await next();
  }

  // Get session token
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) throw new HTTPException(401);

  const session = await c.env.KV.get(`session:${token}`, { type: 'json' });
  if (!session) throw new HTTPException(401);

  c.set('user', session);
  await next();
};
```

---

## Task 1.10: Documentation for Users

Create setup guide for users installing your package.

```markdown
# Installation Guide

## 1. Install Package

\`\`\`bash
npm install @yourorg/docs-platform
\`\`\`

## 2. Create Configuration

\`\`\`ts
// docs.config.ts
export default {
  auth: {
    mode: 'public'  // Choose: 'public', 'domain-restricted', 'oauth'
  },
  admins: {
    emails: ['admin@your-company.com']
  },
  storage: {
    type: 'github',
    owner: 'your-org',      // YOUR GitHub org
    repo: 'your-docs-repo'  // YOUR repository
  }
}
\`\`\`

## 3. Create Environment Variables

\`\`\`bash
# .dev.vars
GITHUB_TOKEN=ghp_xxxxx  # Create at: https://github.com/settings/tokens
\`\`\`

## 4. (Optional) OAuth Setup

If using OAuth mode:
1. Create GitHub OAuth App: https://github.com/settings/developers
2. Add credentials to .dev.vars
\`\`\`

---

## Task 1.10.5: Development Workflow

**For package developers (us):**

### Local Development:
```bash
# In monorepo root
pnpm install

# Terminal 1: Run Worker
cd apps/worker
pnpm dev  # or: wrangler dev

# Terminal 2: Run Next.js
cd apps/web
pnpm dev
```

### Testing Package Locally:
```bash
# Build all packages
pnpm build

# Create local npm link
cd packages/core
pnpm link --global

# In a test project
cd ../test-project
pnpm link --global @yourorg/docs-platform
```

### Build for Publishing:
```bash
# Build all packages
turbo build

# Publish to npm (when ready)
cd packages/core
pnpm publish --access public
```

### User Installation (after publishing):
```bash
# Users run this in THEIR project
pnpm add @yourorg/docs-platform

# Then create docs.config.ts and .dev.vars
# Then run: wrangler dev
```

**Key Difference:**
- **We develop** in the monorepo (`docs-platform/`)
- **Users install** from npm into their project (`my-company-docs/`)
- Our code runs in their environment using their credentials

---

## Verification

After Phase 1:
- [ ] Package structure created ✓
- [ ] Config schema defined ✓
- [ ] All three auth modes implemented ✓
- [ ] GitHub client works with user's repo ✓
- [ ] Permissions adapt to auth mode ✓
- [ ] User documentation written ✓
