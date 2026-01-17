# Phase 6: Package Publishing

**Duration:** Week 6
**Goal:** Publish DocPush to npm as an installable package
**Prerequisites:** Phase 1-5 complete

**Key Features:** Build process, versioning, npm distribution

---

## Task 6.1: Package Configuration

**Update packages/docpush/package.json:**

```json
{
  "name": "docpush",
  "version": "1.0.0",
  "description": "Self-hosted, Git-backed collaborative documentation platform",
  "keywords": [
    "documentation",
    "markdown",
    "git",
    "collaborative",
    "cms",
    "self-hosted"
  ],
  "homepage": "https://github.com/yourusername/docpush",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/docpush.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/docpush/issues"
  },
  "license": "MIT",
  "author": "Your Name <you@example.com>",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "docpush": "./dist/cli/index.js"
  },
  "files": ["dist", "templates", "README.md", "LICENSE"],
  "scripts": {
    "dev:server": "tsx src/server/index.ts",
    "dev:web": "cd src/web && next dev",
    "build": "npm run build:server && npm run build:web",
    "build:server": "tsc",
    "build:web": "cd src/web && next build",
    "clean": "rm -rf dist .next src/web/.next",
    "prepublishOnly": "npm run clean && npm run build",
    "test": "jest",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@octokit/rest": "^20.0.2",
    "axios": "^1.6.2",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "fs-extra": "^11.2.0",
    "gray-matter": "^4.0.3",
    "next": "^14.0.4",
    "passport": "^0.7.0",
    "passport-custom": "^1.1.1",
    "passport-github2": "^0.1.12",
    "passport-google-oauth20": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "resend": "^3.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.10",
    "@types/fs-extra": "^11.0.4",
    "@types/node": "^20.10.6",
    "@types/passport": "^1.0.16",
    "@types/passport-github2": "^1.2.9",
    "@types/passport-google-oauth20": "^2.0.14",
    "@types/react": "^18.2.46",
    "@types/react-dom": "^18.2.18",
    "eslint": "^8.56.0",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

---

## Task 6.2: TypeScript Configuration

**Create packages/docpush/tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/web", "**/*.test.ts"]
}
```

**Create packages/docpush/src/web/tsconfig.json (for Next.js):**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## Task 6.3: Build Scripts

**Create packages/docpush/scripts/build.sh:**

```bash
#!/bin/bash
set -e

echo "🧹 Cleaning previous builds..."
rm -rf dist .next src/web/.next

echo "📦 Building TypeScript (server)..."
tsc

echo "🌐 Building Next.js (frontend)..."
cd src/web
next build
cd ../..

echo "📂 Copying Next.js build to dist..."
mkdir -p dist/web
cp -r src/web/.next/standalone/* dist/web/ 2>/dev/null || true
cp -r src/web/.next/static dist/web/.next/static 2>/dev/null || true
cp -r src/web/public dist/web/public 2>/dev/null || true

echo "✅ Build complete!"
echo "   - Server: dist/"
echo "   - Web: dist/web/"
```

**Make it executable:**

```bash
chmod +x packages/docpush/scripts/build.sh
```

**Update packages/docpush/src/web/next.config.js for standalone build:**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  distDir: ".next",
  // Disable image optimization for standalone builds
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
```

---

## Task 6.4: CLI Entry Point

**Create packages/docpush/src/cli/index.ts:**

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { startCommand } from "./commands/start";
import { buildCommand } from "./commands/build";

const program = new Command();

program
  .name("docpush")
  .description("Self-hosted documentation platform")
  .version(require("../../package.json").version);

program
  .command("init")
  .description("Initialize DocPush in the current directory")
  .action(initCommand);

program
  .command("start")
  .description("Start the development server")
  .option("-p, --port <port>", "Port to run on", "3000")
  .action(startCommand);

program
  .command("build")
  .description("Build for production")
  .action(buildCommand);

program.parse();
```

**Create packages/docpush/src/cli/commands/start.ts:**

```typescript
import { spawn } from "child_process";
import path from "path";

export async function startCommand(options: { port: string }) {
  console.log("🚀 Starting DocPush...\n");

  const port = parseInt(options.port);

  // Start Express server
  const serverPath = path.join(__dirname, "../../server/index.js");
  const server = spawn("node", [serverPath], {
    env: {
      ...process.env,
      PORT: port.toString(),
      NODE_ENV: "development",
    },
    stdio: "inherit",
  });

  server.on("error", (error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    server.kill();
    process.exit(0);
  });
}
```

**Create packages/docpush/src/cli/commands/build.ts:**

```typescript
import { execSync } from "child_process";

export async function buildCommand() {
  console.log("📦 Building DocPush for production...\n");

  try {
    execSync("npm run build", {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    console.log("\n✅ Build complete!");
    console.log("   Run with: npm start");
  } catch (error) {
    console.error("❌ Build failed");
    process.exit(1);
  }
}
```

---

## Task 6.5: Templates

**Create packages/docpush/templates/docs.config.js:**

```javascript
module.exports = {
  // GitHub repository configuration
  github: {
    owner: "your-org", // TODO: Change to your GitHub org/username
    repo: "your-repo", // TODO: Change to your repository name
    branch: "main",
    docsPath: "docs", // Path where docs are stored in repo
  },

  // Authentication mode
  auth: {
    mode: "public", // Options: 'public' | 'domain-restricted' | 'oauth'

    // If mode is 'public':
    adminPassword: "changeme", // TODO: Change this password!

    // If mode is 'domain-restricted':
    // allowedDomains: ['company.com'],
    // emailFrom: 'noreply@company.com',

    // If mode is 'oauth':
    // providers: ['github', 'google'],
    // allowedDomains: ['company.com'],  // Optional
  },

  // Admin users (for domain-restricted and oauth modes)
  admins: {
    emails: [
      "admin@example.com", // TODO: Add admin emails
    ],
  },

  // Optional: Custom branding
  branding: {
    name: "Documentation",
    // logo: '/logo.png',
  },
};
```

**Create packages/docpush/templates/.env.example:**

```bash
# Required
GITHUB_TOKEN=ghp_your_token_here
APP_URL=http://localhost:3000
SESSION_SECRET=generate-random-string-here

# Auth - Domain Restricted (only if using this mode)
# RESEND_API_KEY=re_your_key_here

# Auth - OAuth (only if using this mode)
# GITHUB_CLIENT_ID=your_client_id
# GITHUB_CLIENT_SECRET=your_client_secret
# GOOGLE_CLIENT_ID=your_client_id
# GOOGLE_CLIENT_SECRET=your_client_secret

# Media Upload (optional)
# S3_BUCKET=my-bucket
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
```

**Create packages/docpush/templates/docs/welcome.md:**

```markdown
# Welcome to DocPush

This is your documentation homepage. Start editing to create great docs!

## Getting Started

1. Edit this file to customize your homepage
2. Create new documentation pages in the `docs/` folder
3. Organize with subdirectories like `docs/guides/`, `docs/api/`, etc.

## Features

- **Git-backed**: All changes tracked in your repository
- **Draft system**: Collaborate with approval workflow
- **Markdown editor**: Live preview as you type
- **Media uploads**: Drag and drop images

## Next Steps

- Configure authentication in `docs.config.js`
- Set up your GitHub token in `.env`
- Invite collaborators

Happy documenting! 🚀
```

---

## Task 6.6: Versioning with Changesets

**Install changesets:**

```bash
cd packages/docpush
pnpm add -D @changesets/cli
npx changeset init
```

**Configure changesets:**

```json
// .changeset/config.json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**Workflow for version bumps:**

```bash
# 1. Make changes to code

# 2. Create changeset
npx changeset
# Select: patch, minor, or major
# Write summary of changes

# 3. Build
npm run build

# 4. Version bump
npx changeset version

# 5. Publish to npm
npx changeset publish

# 6. Push tags
git push --follow-tags
```

---

## Task 6.7: npm Publishing

**Create packages/docpush/.npmignore:**

```
# Source files
src/
*.ts
!*.d.ts
tsconfig.json

# Dev files
.changeset/
scripts/
jest.config.js
.eslintrc.js

# Tests
**/*.test.ts
**/*.test.tsx
__tests__/

# Build artifacts
.next/
node_modules/
.env
.env.local

# Git
.git/
.github/
```

**Publishing steps:**

```bash
# 1. Login to npm
npm login

# 2. Test build
npm run build

# 3. Check package contents
npm pack --dry-run

# 4. Publish
npm publish

# Or use changesets
npx changeset publish
```

---

## Task 6.8: Installation Guide

**Create packages/docpush/README.md:**

````markdown
# DocPush

Self-hosted, Git-backed collaborative documentation platform.

## Features

- 📝 Markdown editor with live preview
- 🔀 Git-based draft workflow
- ✅ Admin approval system
- 🔐 Three authentication modes (public, domain-restricted, OAuth)
- 📸 Image uploads
- 💾 All changes tracked in your GitHub repository

## Installation

```bash
# Install in your project
npm install docpush

# Initialize
npx docpush init

# Configure
# 1. Edit docs.config.js
# 2. Copy .env.example to .env and fill in values
# 3. Create GitHub personal access token

# Start development server
npm run docs:dev
```
````

## Configuration

### 1. GitHub Setup

Create a personal access token:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token with `repo` scope
3. Add to `.env` as `GITHUB_TOKEN`

### 2. Choose Authentication Mode

**Option A: Public Mode** (simplest)

```javascript
// docs.config.js
module.exports = {
  auth: {
    mode: "public",
    adminPassword: "your-secure-password",
  },
  // ...
};
```

**Option B: Domain-Restricted**

```javascript
// docs.config.js
module.exports = {
  auth: {
    mode: "domain-restricted",
    allowedDomains: ["company.com"],
    emailFrom: "noreply@company.com",
  },
  // ...
};
```

Requires: `RESEND_API_KEY` in `.env`

**Option C: OAuth**

```javascript
// docs.config.js
module.exports = {
  auth: {
    mode: "oauth",
    providers: ["github", "google"],
  },
  // ...
};
```

Requires OAuth credentials in `.env`:

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

### 3. Start Server

```bash
npm run docs:dev
```

Visit http://localhost:3000

## How It Works

1. **Create Draft**: User creates a new draft → branch created in GitHub
2. **Edit**: User edits in Monaco editor → autosave commits to branch
3. **Review**: Admin reviews in dashboard
4. **Approve**: Admin approves → PR created and merged → branch deleted
5. **Published**: Changes appear in main branch

## Commands

```bash
npx docpush init      # Initialize in current directory
npx docpush start     # Start development server
npx docpush build     # Build for production
npm run docs:dev      # Development mode (added to your package.json)
```

## Deployment

DocPush runs anywhere Node.js runs:

- **Vercel**: `vercel deploy`
- **Railway**: `railway up`
- **Heroku**: `git push heroku main`
- **VPS**: `npm start`

## Environment Variables

See `.env.example` for all available options.

## License

MIT

## Support

- [Documentation](https://github.com/yourusername/docpush)
- [Issues](https://github.com/yourusername/docpush/issues)

````

---

## Task 6.9: GitHub Actions CI/CD

**Create .github/workflows/publish.yml:**

```yaml
name: Publish to npm

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  publish:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          registry-url: https://registry.npmjs.org/
      - run: npm install
      - run: npm run build
      - run: npx changeset publish
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
````

---

## Verification

After Phase 6, test the published package:

### 1. Test local build:

```bash
cd packages/docpush
npm run build

# Check dist/ folder
ls -la dist/

# ✅ dist/index.js exists
# ✅ dist/cli/index.js exists
# ✅ dist/web/ exists
```

### 2. Test local installation:

```bash
# Link package locally
cd packages/docpush
npm link

# Create test project
cd /tmp
mkdir test-docpush
cd test-docpush
npm init -y
npm link docpush

# Initialize
npx docpush init

# ✅ docs/ folder created
# ✅ docs.config.js created
# ✅ .env.example created
# ✅ package.json has docs:dev script
```

### 3. Test from npm (after publishing):

```bash
mkdir my-docs-project
cd my-docs-project
npm init -y
npm install docpush
npx docpush init
npm run docs:dev

# ✅ Server starts
# ✅ Can access http://localhost:3000
```

### 4. Test version bumping:

```bash
npx changeset
# Select: patch
# Summary: "Fix autosave bug"

npx changeset version
# ✅ package.json version bumped
# ✅ CHANGELOG.md updated

npx changeset publish
# ✅ Published to npm
# ✅ Git tags created
```

---

## Distribution Checklist

Before publishing v1.0.0:

- [ ] All tests passing
- [ ] README complete with examples
- [ ] LICENSE file added (MIT)
- [ ] CHANGELOG.md initialized
- [ ] Environment validation working
- [ ] CLI commands tested
- [ ] Build scripts working
- [ ] Templates in place
- [ ] npm account configured
- [ ] GitHub repository public
- [ ] Documentation website (optional)

---

## Post-Publishing

After publishing to npm:

1. **Announce**:

   - Create GitHub release
   - Share on Twitter, Reddit r/selfhosted
   - Post on Hacker News

2. **Monitor**:

   - Watch GitHub issues
   - Check npm download stats
   - Respond to community feedback

3. **Iterate**:
   - Fix bugs quickly
   - Add requested features
   - Keep dependencies updated

---

## Success Metrics

Track these after launch:

- npm downloads per week
- GitHub stars
- Issues closed vs opened
- Time to first install
- Community contributions

## Next Steps

You now have a complete, publishable npm package! 🎉

Users can install with:

```bash
npm install docpush
```

And start documenting with your Git-backed collaborative platform.
