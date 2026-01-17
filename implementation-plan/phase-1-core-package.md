# Phase 1: Core Package Setup

**Duration:** Week 1
**Goal:** Create installable npm package with CLI, config system, Express server, and GitHub client
**Prerequisites:** Node.js 18+, pnpm

**IMPORTANT:** This is a **true npm package** that users install in their projects. It creates a collaborative documentation system backed by Git.

---

## What Users Get

```bash
# In their project
npm install docpush
npx docpush init

# Creates:
my-project/
├── docs/              # Documentation folder (Git-tracked)
│   └── welcome.md     # Sample doc
├── docs.config.js     # Configuration
├── .env.example       # Environment variables template
└── package.json       # Updated with docs scripts
```

---

## Task 1.1: Monorepo Structure

Create the package monorepo:

```bash
mkdir docpush && cd docpush
pnpm init
```

**Structure:**
```
docpush/
├── packages/
│   └── docpush/              # Main package (published to npm)
│       ├── src/
│       │   ├── cli/          # CLI commands
│       │   │   ├── index.ts
│       │   │   └── init.ts
│       │   ├── server/       # Express backend
│       │   │   ├── index.ts
│       │   │   ├── routes/
│       │   │   ├── middleware/
│       │   │   └── db/
│       │   ├── web/          # Next.js frontend (embedded)
│       │   └── core/         # Shared utilities
│       │       ├── config/
│       │       └── github/
│       ├── templates/        # File templates for init
│       ├── package.json
│       └── tsconfig.json
├── examples/                 # Example projects
├── pnpm-workspace.yaml
└── package.json
```

**Root package.json:**
```json
{
  "name": "docpush-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev"
  },
  "devDependencies": {
    "turbo": "^1.11.0",
    "typescript": "^5.3.3"
  }
}
```

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
```

---

## Task 1.2: CLI - Init Command

**packages/docpush/src/cli/init.ts:**

```typescript
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const WELCOME_TEMPLATE = `# Welcome to Your Documentation

This is your first document! Edit it to get started.

## Getting Started

1. Edit files in the \`docs/\` folder
2. Changes are saved as drafts (Git branches)
3. Admins can approve drafts to publish

## Configuration

Edit \`docs.config.js\` to configure:
- GitHub repository
- Authentication mode
- Admin users
`;

const CONFIG_TEMPLATE = `module.exports = {
  // Your GitHub repository
  github: {
    owner: 'your-org',          // Your GitHub username or org
    repo: 'your-repo',           // Your repository name
    branch: 'main',              // Main branch
    docsPath: 'docs'             // Path to docs folder
  },

  // Authentication mode
  auth: {
    mode: 'public',              // 'public' | 'domain-restricted' | 'oauth'
    adminPassword: 'changeme'    // For public mode approval
  },

  // Admin users
  admins: {
    emails: ['admin@example.com']
  },

  // Optional: Branding
  branding: {
    name: 'Documentation',
    logo: '/logo.png'
  }
};
`;

const ENV_TEMPLATE = `# Required
GITHUB_TOKEN=ghp_your_token_here
APP_URL=http://localhost:3000
SESSION_SECRET=random-secret-change-in-production

# Database (PostgreSQL recommended, SQLite as fallback)
# DATABASE_URL=postgresql://user:password@localhost:5432/docpush

# Auth - Domain Restricted (if using)
# RESEND_API_KEY=re_your_key_here

# Auth - OAuth (if using)
# GITHUB_CLIENT_ID=your_client_id
# GITHUB_CLIENT_SECRET=your_client_secret
# GOOGLE_CLIENT_ID=your_client_id
# GOOGLE_CLIENT_SECRET=your_client_secret

# Media - S3 (optional)
# S3_BUCKET=your-bucket
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
`;

export async function initCommand() {
  console.log(chalk.blue('🚀 Initializing DocPush...\n'));

  // 1. Create docs folder
  await fs.ensureDir('./docs');
  await fs.writeFile('./docs/welcome.md', WELCOME_TEMPLATE);
  console.log(chalk.green('✓'), 'Created docs/ folder');

  // 2. Create config file
  if (!await fs.pathExists('./docs.config.js')) {
    await fs.writeFile('./docs.config.js', CONFIG_TEMPLATE);
    console.log(chalk.green('✓'), 'Created docs.config.js');
  } else {
    console.log(chalk.yellow('⚠'), 'docs.config.js already exists, skipping');
  }

  // 3. Create .env.example
  await fs.writeFile('./.env.example', ENV_TEMPLATE);
  console.log(chalk.green('✓'), 'Created .env.example');

  // 4. Update package.json scripts
  const pkgPath = './package.json';
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    pkg.scripts = {
      ...pkg.scripts,
      'docs:dev': 'docpush start',
      'docs:build': 'docpush build'
    };
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
    console.log(chalk.green('✓'), 'Updated package.json scripts');
  }

  console.log(chalk.blue('\n📝 Next steps:'));
  console.log('  1. Copy .env.example to .env');
  console.log('  2. Edit docs.config.js with your GitHub repo');
  console.log('  3. Add GITHUB_TOKEN to .env');
  console.log('  4. Run: npm run docs:dev\n');
}
```

**packages/docpush/src/cli/index.ts:**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './init';
import { startCommand } from './start';

const program = new Command();

program
  .name('docpush')
  .description('Git-backed documentation platform')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize DocPush in current project')
  .action(initCommand);

program
  .command('start')
  .description('Start DocPush server')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .action(startCommand);

program.parse();
```

---

## Task 1.3: Config Schema & Loader

**packages/docpush/src/core/config/schema.ts:**

```typescript
import { z } from 'zod';

export const configSchema = z.object({
  // GitHub repository
  github: z.object({
    owner: z.string().min(1, 'GitHub owner required'),
    repo: z.string().min(1, 'GitHub repo required'),
    branch: z.string().default('main'),
    docsPath: z.string().default('docs')
  }),

  // Authentication mode
  auth: z.discriminatedUnion('mode', [
    // Public mode - no login, password for approval
    z.object({
      mode: z.literal('public'),
      adminPassword: z.string().min(1, 'Admin password required for public mode')
    }),
    // Domain-restricted - magic link email verification
    z.object({
      mode: z.literal('domain-restricted'),
      allowedDomains: z.array(z.string()).min(1, 'At least one domain required'),
      emailFrom: z.string().email('Valid email required for sending magic links')
    }),
    // OAuth - GitHub/Google login
    z.object({
      mode: z.literal('oauth'),
      providers: z.array(z.enum(['github', 'google'])).min(1, 'At least one OAuth provider required'),
      allowedDomains: z.array(z.string()).optional()
    })
  ]),

  // Admin users
  admins: z.object({
    emails: z.array(z.string().email()).min(1, 'At least one admin email required')
  }),

  // Optional branding
  branding: z.object({
    name: z.string().default('Documentation'),
    logo: z.string().optional()
  }).optional()
});

export type DocsConfig = z.infer<typeof configSchema>;

// Helper to validate environment variables
export function validateEnv() {
  const required = ['GITHUB_TOKEN', 'APP_URL', 'SESSION_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

**packages/docpush/src/core/config/loader.ts:**

```typescript
import path from 'path';
import fs from 'fs';
import { configSchema, type DocsConfig } from './schema';

let cachedConfig: DocsConfig | null = null;

export async function loadConfig(configPath = './docs.config.js'): Promise<DocsConfig> {
  if (cachedConfig) return cachedConfig;

  const fullPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(
      'docs.config.js not found. Run: npx docpush init'
    );
  }

  try {
    // Dynamic require - works in Node.js
    const userConfig = require(fullPath);

    // Validate with Zod
    cachedConfig = configSchema.parse(userConfig);

    return cachedConfig;
  } catch (error: any) {
    if (error.name === 'ZodError') {
      console.error('Configuration validation failed:');
      error.errors.forEach((err: any) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration');
    }
    throw error;
  }
}

// Reset cache (useful for testing)
export function resetConfigCache() {
  cachedConfig = null;
}
```

---

## Task 1.4: Express Server Setup

**packages/docpush/src/server/index.ts:**

```typescript
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { loadConfig, validateEnv } from '../core/config/loader';
import { initDatabase } from './db';
import authRoutes from './routes/auth';
import draftsRoutes from './routes/drafts';
import docsRoutes from './routes/docs';
import mediaRoutes from './routes/media';

export async function createServer() {
  // Validate environment
  validateEnv();

  // Load config
  const config = await loadConfig();

  // Initialize database
  await initDatabase();

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.APP_URL,
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Session
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  }));

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Store config in request
  app.use((req, res, next) => {
    req.config = config;
    next();
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/drafts', draftsRoutes);
  app.use('/api/docs', docsRoutes);
  app.use('/api/media', mediaRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  });

  return app;
}

export async function startServer(port: number = 3000) {
  const app = await createServer();

  app.listen(port, () => {
    console.log(`🚀 DocPush server running on http://localhost:${port}`);
    console.log(`📝 API available at http://localhost:${port}/api`);
  });
}
```

---

## Task 1.5: Database Setup

**packages/docpush/src/server/db/schema.sql:**

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  provider TEXT, -- 'email', 'github', 'google'
  provider_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sessions table (for express-session)
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);

-- Drafts table
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  doc_path TEXT NOT NULL,
  branch_name TEXT NOT NULL UNIQUE,
  title TEXT,
  author_id TEXT REFERENCES users(id),
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_author ON drafts(author_id);
CREATE INDEX IF NOT EXISTS idx_drafts_created ON drafts(created_at DESC);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_draft ON comments(draft_id);

-- Magic links table (for domain-restricted auth)
CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links(expires_at);
```

**packages/docpush/src/server/db/index.ts:**

```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

let db: Database.Database;

export async function initDatabase() {
  const dbPath = process.env.DATABASE_PATH || './docpush.db';

  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run migrations
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  db.exec(schema);

  console.log('✓ Database initialized');
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first');
  }
  return db;
}

// Helper functions
export function generateId(): string {
  return randomUUID();
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}
```

---

## Task 1.6: GitHub API Client

**packages/docpush/src/core/github/client.ts:**

```typescript
import { Octokit } from '@octokit/rest';
import type { DocsConfig } from '../config/schema';

export class GitHubClient {
  private octokit: Octokit;
  private config: DocsConfig['github'];

  constructor(token: string, config: DocsConfig['github']) {
    this.octokit = new Octokit({ auth: token });
    this.config = config;
  }

  /**
   * Get documentation file tree
   */
  async getDocsTree(): Promise<Array<{ path: string; type: 'file' | 'dir' }>> {
    const { data } = await this.octokit.git.getTree({
      owner: this.config.owner,
      repo: this.config.repo,
      tree_sha: this.config.branch,
      recursive: '1'
    });

    return data.tree
      .filter(item => item.path?.startsWith(this.config.docsPath))
      .map(item => ({
        path: item.path!.replace(`${this.config.docsPath}/`, ''),
        type: item.type === 'tree' ? 'dir' : 'file'
      }));
  }

  /**
   * Get file content from repository
   */
  async getFileContent(filePath: string, ref?: string): Promise<string> {
    const fullPath = `${this.config.docsPath}/${filePath}`;

    const { data } = await this.octokit.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path: fullPath,
      ref: ref || this.config.branch
    });

    if ('content' in data) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    throw new Error('Path is not a file');
  }

  /**
   * Create a new branch for draft
   */
  async createDraftBranch(branchName: string): Promise<string> {
    // Get current main branch SHA
    const { data: ref } = await this.octokit.git.getRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${this.config.branch}`
    });

    const sha = ref.object.sha;

    // Create new branch
    await this.octokit.git.createRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `refs/heads/${branchName}`,
      sha
    });

    return sha;
  }

  /**
   * Commit file to branch
   */
  async commitFile(
    branchName: string,
    filePath: string,
    content: string,
    message: string
  ): Promise<void> {
    const fullPath = `${this.config.docsPath}/${filePath}`;

    // Try to get existing file SHA
    let sha: string | undefined;
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fullPath,
        ref: branchName
      });
      if ('sha' in data) sha = data.sha;
    } catch (e) {
      // File doesn't exist yet, that's ok
    }

    // Create or update file
    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path: fullPath,
      message,
      content: Buffer.from(content).toString('base64'),
      branch: branchName,
      sha
    });
  }

  /**
   * Create pull request
   */
  async createPullRequest(
    branchName: string,
    title: string,
    body: string
  ): Promise<number> {
    const { data } = await this.octokit.pulls.create({
      owner: this.config.owner,
      repo: this.config.repo,
      head: branchName,
      base: this.config.branch,
      title,
      body
    });

    return data.number;
  }

  /**
   * Merge pull request
   */
  async mergePullRequest(prNumber: number): Promise<void> {
    await this.octokit.pulls.merge({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: prNumber,
      merge_method: 'squash'
    });
  }

  /**
   * Delete branch
   */
  async deleteBranch(branchName: string): Promise<void> {
    await this.octokit.git.deleteRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${branchName}`
    });
  }

  /**
   * Get commit history for file
   */
  async getFileHistory(filePath: string): Promise<Array<{
    sha: string;
    message: string;
    date: string;
    author: string;
  }>> {
    const fullPath = `${this.config.docsPath}/${filePath}`;

    const { data } = await this.octokit.repos.listCommits({
      owner: this.config.owner,
      repo: this.config.repo,
      path: fullPath,
      per_page: 50
    });

    return data.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      date: commit.commit.author?.date || '',
      author: commit.commit.author?.name || 'Unknown'
    }));
  }
}
```

---

## Verification

After Phase 1, verify:

```bash
# 1. Package structure created
ls packages/docpush/src/{cli,server,core}

# 2. Can run init command
cd examples/test-project
npm install ../../packages/docpush
npx docpush init

# Should create: docs/, docs.config.js, .env.example

# 3. Config validation works
# Edit docs.config.js with valid config
node -e "require('./packages/docpush/src/core/config/loader').loadConfig()"

# 4. Database initializes
# Should create docpush.db with tables

# 5. GitHub client works
# Test with valid GITHUB_TOKEN
```

---

## Next Steps

Phase 2 will implement the three authentication modes on top of this foundation.
