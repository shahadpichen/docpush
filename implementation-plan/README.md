# DocPush - Implementation Plan

## Overview

This folder contains detailed implementation plans for building **DocPush**: an installable, open-source collaborative documentation platform that runs on **Node.js + Express**.

**What You're Building:**

- **npm package** users install in their projects (`npm install docpush`)
- **CLI tool** for initialization (`npx docpush init`)
- **Users configure** their own GitHub repo, auth mode, and admins
- **Works with any repo** - users bring their own credentials
- **Three auth modes** - public, domain-restricted, or OAuth (user's choice)
- **Self-hosted** - runs anywhere Node.js runs (Vercel, Railway, Heroku, VPS)

## Timeline

**Total Duration:** 6 weeks full-time (12 weeks part-time)

**Note:** Timeline includes package setup, authentication (3 modes), draft system, frontend, error handling, and npm publishing.

## Key Architecture

### Installable Package Model

```bash
# Users install your package
npm install docpush

# Initialize in their project
npx docpush init

# Creates:
my-project/
├── docs/              # ← Documentation folder (tracked in git)
│   └── welcome.md
├── docs.config.js     # ← DocPush configuration
├── .env.example       # ← Environment variables template
└── package.json       # ← Updated with docs:dev script

# They configure for THEIR project
# docs.config.js
module.exports = {
  github: {
    owner: 'their-org',      // ← Their GitHub org
    repo: 'their-repo',      // ← Their repository
    branch: 'main',
    docsPath: 'docs'
  },
  auth: {
    mode: 'public',          // or 'domain-restricted' or 'oauth'
    adminPassword: 'secret'  // For public mode
  },
  admins: {
    emails: ['admin@their-company.com']
  }
}

# .env (they create from .env.example)
GITHUB_TOKEN=ghp_their_token  # For their repo
APP_URL=http://localhost:3000
SESSION_SECRET=random-secret
```

### Three Auth Modes

**Mode 1: Public** (Simplest)

- No login required to edit
- Admins approve with simple password
- Best for: Open-source docs

**Mode 2: Domain-Restricted** (Medium)

- Magic link email verification
- Only @company.com can edit
- Best for: Internal company docs

**Mode 3: OAuth** (Most Secure)

- Users create their OWN OAuth apps
- Provide credentials in .dev.vars
- Best for: Enterprise

## Phases

### [Phase 1: Core Package Setup](./phase-1-core-package.md) - Week 1

Set up npm package structure and core infrastructure

- Monorepo setup with packages/
- CLI commands (init, start, build)
- Config schema with Zod validation
- Express server setup
- JSON file storage (.docpush/ folder)
- GitHub API client (Octokit)
- Session management

### [Phase 2: Authentication System](./phase-2-authentication.md) - Week 2

Implement three authentication modes

- **Mode 1: Public** - password-based admin approval
- **Mode 2: Domain-Restricted** - magic link email verification
- **Mode 3: OAuth** - GitHub/Google login
- Passport.js strategies for each mode
- Auth middleware (requireEdit, requireAdmin)
- Session serialization

### [Phase 3: Draft System](./phase-3-draft-system.md) - Week 3

Implement Git branch-based draft workflow

- Draft API endpoints (CRUD)
- Create draft → creates GitHub branch
- Update draft → commits to branch
- Approve draft → creates PR, merges, deletes branch
- Reject draft → deletes branch
- Comments system
- File tree API
- Published docs content API

### [Phase 4: Next.js Frontend](./phase-4-frontend.md) - Week 4

Build web UI with editor and admin dashboard

- Next.js 14 app setup
- File tree sidebar component
- Monaco editor with live markdown preview
- Autosave with 3-second debounce
- Admin dashboard for draft approval
- Comments panel
- Authentication pages for all modes
- TanStack Query for data fetching

### [Phase 5: Error Handling & Polish](./phase-5-polish.md) - Week 5

Production-ready error handling and features

- GitHub API retry logic with exponential backoff
- Rate limit handling
- Conflict detection for concurrent edits
- Media upload system (S3 or local)
- Image optimization with sharp
- **Algolia DocSearch integration** (with fallback search)
- Error boundaries
- Loading states & skeletons
- Toast notifications
- Environment variable validation

### [Phase 6: Package Publishing](./phase-6-publishing.md) - Week 6

Publish to npm and distribute

- TypeScript build configuration
- Next.js standalone build
- CLI entry points
- Template files (config, .env, welcome.md)
- Versioning with changesets
- npm publishing workflow
- GitHub Actions CI/CD
- Installation guide & README
- Distribution checklist

## Critical Differences from SaaS

| SaaS Approach            | Installable Package Approach                  |
| ------------------------ | --------------------------------------------- |
| One centralized database | Each installation uses their own database     |
| You provide OAuth        | Users create their own OAuth apps (if needed) |
| One auth system          | Three auth modes (user chooses)               |
| You host everything      | Users deploy to their own hosting             |
| Monthly fees             | Free (runs on any Node.js platform)           |
| You control updates      | Users update via npm                          |

## Tech Stack

**Frontend:**

- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- shadcn/ui components
- Monaco Editor
- React Markdown
- TanStack Query

**Backend:**

- Express.js (REST API)
- Passport.js (authentication)
- Octokit (GitHub API client)
- Resend (email for magic links)

**Data Storage:**

- JSON files in `.docpush/` folder (no database required!)
- Data includes: draft metadata, sessions, comments

**Storage:**

- GitHub (markdown files via API)
- Local filesystem or S3 (media uploads)
- Database (draft metadata, sessions, users)

**Development:**

- TypeScript
- Zod (validation)
- tsx (dev server)

## Cost Estimate (For End Users)

**Free Options:**

- Vercel Free Tier (recommended)
- Railway Free Tier ($5 credit/month)
- Heroku Eco Dynos ($5/month)
- Self-hosted VPS (varies)

**Optional Paid Services:**

- Resend (email): $0 (100 emails/day free)
- AWS S3 (media): ~$1/month (10GB)

**Total: $0-10/month per installation** (can be $0 on free tiers)

## Development Workflow

**For package developers (building DocPush):**

### Local Development:

```bash
# Clone and setup
git clone https://github.com/yourorg/docpush
cd docpush
pnpm install

# Terminal 1: Run Express backend
cd packages/docpush
pnpm dev:server

# Terminal 2: Run Next.js frontend
cd packages/docpush/src/web
pnpm dev
```

### Testing Locally:

```bash
# Build package
cd packages/docpush
npm run build

# Link for testing
npm link

# Test in a separate project
cd /tmp/test-project
npm init -y
npm link docpush
npx docpush init

# Configure and start
# Edit docs.config.js and .env
npm run docs:dev
```

### Publishing:

```bash
# Create changeset
npx changeset
# Select version bump type and describe changes

# Build
npm run build

# Version bump
npx changeset version

# Publish to npm
npx changeset publish

# Push tags
git push --follow-tags
```

**Remember:** We build the package, users install it with `npm install docpush`!

---

## Getting Started

1. Read through all phase documents
2. Start with Phase 1, Task 1.1
3. Follow tasks sequentially - **do not skip ahead**
4. Check off tasks as you complete them
5. Verify each phase before moving to the next

## Success Metrics

After launch:

- Draft creation success rate > 95%
- Approval latency < 24h median
- Build success rate > 98%
- Editor load time < 2s
- GitHub API error rate < 1%

## Questions?

Refer to the full analysis document at `/Users/shahad/.claude/plans/inherited-beaming-bee.md` for:

- Detailed research findings
- Security considerations
- Workflow diagrams
- Config schema examples
