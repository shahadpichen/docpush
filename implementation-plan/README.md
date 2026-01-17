# Documentation Platform - Implementation Plan

## Overview

This folder contains detailed implementation plans for building an **installable, open-source documentation platform** that users can add to any project.

**What You're Building:**
- **npm package** users install in their projects
- **Users configure** their own GitHub repo, auth mode, and admins
- **Works with any repo** - users bring their own credentials
- **Three auth modes** - public, domain-restricted, or OAuth (user's choice)

## Timeline

**Total Duration:** 4-5 weeks full-time (8-10 weeks part-time)

**Note:** Timeline includes additional tasks for proper Cloudflare setup, config loading, admin middleware, and package publishing.

## Key Architecture

### Installable Package Model

```bash
# Users install your package
npm install @yourorg/docs-platform

# They configure it for THEIR project
# docs.config.ts
export default {
  auth: { mode: 'public' },  // or 'domain-restricted' or 'oauth'
  admins: { emails: ['admin@their-company.com'] },
  storage: {
    type: 'github',
    owner: 'their-org',      // ← Their GitHub repo
    repo: 'their-docs'       // ← Not yours!
  }
}

# .dev.vars (they create their own)
GITHUB_TOKEN=ghp_their_token  # For their repo
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

### [Phase 1: Core Infrastructure](./phase-1-core-infrastructure.md) - Week 1
Set up monorepo and authentication system
- Turborepo setup
- Next.js + Cloudflare Worker
- **Three auth mode implementations**
- GitHub API client (uses user's token)
- Permission system (adapts to auth mode)

### [Phase 2: Draft System](./phase-2-draft-system.md) - Week 2
Implement Git branch-based draft creation
- D1 database schema
- Draft API endpoints (creates branches in user's repo)
- Monaco editor
- Autosave with debouncing
- Branch creation via GitHub API

### [Phase 3: Review & Approval](./phase-3-review-approval.md) - Week 3
Enable admins to review drafts and merge
- Admin dashboard
- Diff viewer (rendered + code)
- Approval/rejection workflow
- PR creation and merge (in user's repo)
- Comments system

### [Phase 4: Build & Deploy](./phase-4-build-deploy.md) - Week 3-4
Automated builds triggered by merges
- Docusaurus setup (in user's repo)
- GitHub Actions workflow (user adds to their repo)
- Cloudflare Pages deployment (user's account)
- Cache strategy
- Webhooks

### [Phase 5: Media & Polish](./phase-5-media-polish.md) - Week 4
Image uploads, UX improvements, admin tools
- R2 or GitHub for images (user's choice)
- Media picker
- Admin management UI
- Audit log
- Documentation & examples

## Critical Differences from SaaS

| SaaS Approach | Installable Package Approach |
|---------------|------------------------------|
| One centralized database | Each installation uses their own GitHub repo |
| You provide OAuth | Users create their own OAuth apps (if needed) |
| One auth system | Three auth modes (user chooses) |
| You host everything | Users deploy to their own Cloudflare |
| Monthly fees | Free (runs on Cloudflare free tier) |

## Tech Stack

**Frontend:** Next.js 14, React, Tailwind, shadcn/ui, Monaco Editor
**Backend:** Cloudflare Workers, Hono
**Storage:**
- User's GitHub repo (content)
- D1 (metadata - user's Cloudflare account)
- R2 or GitHub (media - user's choice)
- KV (sessions - user's Cloudflare account)
**Build:** GitHub Actions (in user's repo)
**Deploy:** Cloudflare Pages (user's account)

## Cost Estimate (For End Users)

- Cloudflare Workers: $0 (free tier)
- Cloudflare Pages: $0 (free tier)
- Cloudflare R2: ~$1/month (10GB) - optional
- GitHub Actions: $0 (2k min/month free)

**Total: $0-1/month per installation**

## Development Workflow

**For package developers (building the platform):**

### Local Development:
```bash
# Clone and setup
git clone https://github.com/yourorg/docs-platform
cd docs-platform
pnpm install

# Terminal 1: Run Worker
cd apps/worker
pnpm dev

# Terminal 2: Run Next.js
cd apps/web
pnpm dev
```

### Testing Locally:
```bash
# Build packages
turbo build

# Link for testing
cd packages/core
pnpm link --global

# Test in a separate project
cd /path/to/test-project
pnpm link --global @yourorg/docs-platform
```

### Publishing:
```bash
# Publish to npm (when ready)
pnpm changeset
turbo build
pnpm changeset publish
```

**Remember:** We build the package, users install it in their projects!

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
