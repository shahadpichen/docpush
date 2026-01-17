# Phase 2: Authentication System

**Duration:** Week 2
**Goal:** Implement three authentication modes with Passport.js
**Prerequisites:** Phase 1 complete

**Key Principle:** Support three auth modes - users choose which fits their needs.

---

## Authentication Modes Overview

### Mode 1: Public
- **Who can edit:** Anyone (no login)
- **Admin approval:** Simple password check
- **Best for:** Open-source documentation, public wikis

### Mode 2: Domain-Restricted
- **Who can edit:** Users with verified email from allowed domains
- **Admin approval:** Verified admins from email list
- **Authentication:** Magic link (email verification)
- **Best for:** Company internal docs

### Mode 3: OAuth
- **Who can edit:** Users who login via GitHub/Google
- **Admin approval:** Verified admins from email list
- **Authentication:** OAuth providers
- **Best for:** Teams using GitHub/Google

---

## Task 2.1: Auth Middleware Foundation

**packages/docpush/src/server/middleware/auth.ts:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { loadConfig } from '../../core/config/loader';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      config?: any;
      user?: {
        id: string;
        email: string | null;
        name?: string;
        role?: string;
      };
    }
  }
}

/**
 * Check if user can edit documents
 */
export async function requireEdit(req: Request, res: Response, next: NextFunction) {
  const config = req.config || await loadConfig();

  // Public mode - anyone can edit
  if (config.auth.mode === 'public') {
    req.user = { id: 'anonymous', email: null, role: 'editor' };
    return next();
  }

  // Domain-restricted or OAuth - must be logged in
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

/**
 * Check if user is admin
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const config = req.config || await loadConfig();

  // Public mode - check password header
  if (config.auth.mode === 'public') {
    const password = req.headers['x-admin-password'] as string;

    if (!password || password !== config.auth.adminPassword) {
      return res.status(403).json({ error: 'Invalid admin password' });
    }

    req.user = { id: 'admin', email: null, role: 'admin' };
    return next();
  }

  // Domain-restricted or OAuth - check email against admin list
  if (!req.user?.email) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!config.admins.emails.includes(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}
```

---

## Task 2.2: Mode 1 - Public Auth (Password-Based)

**packages/docpush/src/server/auth/public.ts:**

```typescript
import passport from 'passport';
import { Strategy as CustomStrategy } from 'passport-custom';
import type { DocsConfig } from '../../core/config/schema';

/**
 * Setup public authentication
 * No login required for editing, password for admin approval
 */
export function setupPublicAuth(config: DocsConfig) {
  if (config.auth.mode !== 'public') return;

  // Admin password strategy
  passport.use('admin-password', new CustomStrategy(
    async (req, done) => {
      const { password } = req.body;

      if (password === config.auth.adminPassword) {
        return done(null, {
          id: 'admin',
          email: null,
          role: 'admin'
        });
      }

      done(null, false, { message: 'Invalid password' });
    }
  ));
}

/**
 * No serialization needed for public mode
 */
export function setupPublicSerialization() {
  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });
}
```

**packages/docpush/src/server/routes/auth.ts (Public mode endpoints):**

```typescript
import express from 'express';
import passport from 'passport';

const router = express.Router();

// Public mode - admin login with password
router.post('/admin/login', (req, res, next) => {
  const config = req.config;

  if (config.auth.mode !== 'public') {
    return res.status(400).json({ error: 'Not in public mode' });
  }

  passport.authenticate('admin-password', (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid password' });

    req.logIn(user, (err) => {
      if (err) return next(err);
      res.json({ message: 'Logged in as admin', user });
    });
  })(req, res, next);
});

export default router;
```

---

## Task 2.3: Mode 2 - Domain-Restricted (Magic Link)

**Install Resend:**

```bash
cd packages/docpush
pnpm add resend
```

**packages/docpush/src/server/auth/magic-link.ts:**

```typescript
import crypto from 'crypto';
import { Resend } from 'resend';
import { getDb, generateId, now } from '../db';
import type { DocsConfig } from '../../core/config/schema';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send magic link to user's email
 */
export async function sendMagicLink(email: string, config: DocsConfig): Promise<void> {
  if (config.auth.mode !== 'domain-restricted') {
    throw new Error('Magic links only available in domain-restricted mode');
  }

  // Check if email domain is allowed
  const domain = email.split('@')[1];
  if (!config.auth.allowedDomains.includes(domain)) {
    throw new Error(`Email domain @${domain} is not allowed`);
  }

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = now() + (15 * 60); // 15 minutes

  // Store in database
  const db = getDb();
  db.prepare(`
    INSERT INTO magic_links (token, email, expires_at)
    VALUES (?, ?, ?)
  `).run(token, email, expiresAt);

  // Send email
  await resend.emails.send({
    from: config.auth.emailFrom,
    to: email,
    subject: 'Verify your email - DocPush',
    html: `
      <h2>Verify your email</h2>
      <p>Click the link below to access the documentation:</p>
      <a href="${process.env.APP_URL}/auth/verify?token=${token}">
        Verify Email
      </a>
      <p>This link expires in 15 minutes.</p>
      <p><small>If you didn't request this, you can safely ignore this email.</small></p>
    `
  });
}

/**
 * Verify magic link token and return user
 */
export async function verifyMagicLink(token: string): Promise<{ id: string; email: string }> {
  const db = getDb();

  // Get magic link
  const link = db.prepare(`
    SELECT email, expires_at, used
    FROM magic_links
    WHERE token = ?
  `).get(token) as any;

  if (!link) {
    throw new Error('Invalid or expired link');
  }

  if (link.used) {
    throw new Error('Link already used');
  }

  if (now() > link.expires_at) {
    throw new Error('Link expired');
  }

  // Mark as used
  db.prepare(`
    UPDATE magic_links SET used = 1 WHERE token = ?
  `).run(token);

  // Get or create user
  let user = db.prepare(`
    SELECT id, email, name FROM users WHERE email = ?
  `).get(link.email) as any;

  if (!user) {
    const userId = generateId();
    db.prepare(`
      INSERT INTO users (id, email, provider)
      VALUES (?, ?, 'email')
    `).run(userId, link.email);

    user = { id: userId, email: link.email };
  }

  return user;
}
```

**Add routes to packages/docpush/src/server/routes/auth.ts:**

```typescript
// Domain-restricted - request magic link
router.post('/magic-link/request', async (req, res, next) => {
  const { email } = req.body;
  const config = req.config;

  if (config.auth.mode !== 'domain-restricted') {
    return res.status(400).json({ error: 'Not in domain-restricted mode' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    await sendMagicLink(email, config);
    res.json({ message: 'Magic link sent to your email' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Domain-restricted - verify magic link
router.get('/magic-link/verify', async (req, res, next) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const user = await verifyMagicLink(token);

    req.logIn(user, (err) => {
      if (err) return next(err);
      // Redirect to app
      res.redirect('/');
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
```

---

## Task 2.4: Mode 3 - OAuth (GitHub & Google)

**Install OAuth packages:**

```bash
cd packages/docpush
pnpm add passport-github2 passport-google-oauth20
```

**packages/docpush/src/server/auth/oauth.ts:**

```typescript
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getDb, generateId } from '../db';
import type { DocsConfig } from '../../core/config/schema';

/**
 * Setup OAuth authentication strategies
 */
export function setupOAuth(config: DocsConfig) {
  if (config.auth.mode !== 'oauth') return;

  const { providers, allowedDomains } = config.auth;

  // GitHub OAuth
  if (providers.includes('github')) {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw new Error('GitHub OAuth credentials missing in environment');
    }

    passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.APP_URL}/api/auth/github/callback`,
      scope: ['user:email']
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(null, false, { message: 'No email from GitHub' });
        }

        // Check domain restriction
        if (allowedDomains && allowedDomains.length > 0) {
          const domain = email.split('@')[1];
          if (!allowedDomains.includes(domain)) {
            return done(null, false, { message: `Domain @${domain} not allowed` });
          }
        }

        // Get or create user
        const db = getDb();
        let user = db.prepare(`
          SELECT id, email, name, avatar_url FROM users WHERE email = ?
        `).get(email) as any;

        if (!user) {
          const userId = generateId();
          db.prepare(`
            INSERT INTO users (id, email, name, avatar_url, provider, provider_id)
            VALUES (?, ?, ?, ?, 'github', ?)
          `).run(
            userId,
            email,
            profile.displayName,
            profile.photos?.[0]?.value,
            profile.id
          );

          user = { id: userId, email, name: profile.displayName };
        } else {
          // Update profile info
          db.prepare(`
            UPDATE users SET name = ?, avatar_url = ? WHERE id = ?
          `).run(profile.displayName, profile.photos?.[0]?.value, user.id);
        }

        done(null, user);
      } catch (error) {
        done(error);
      }
    }));
  }

  // Google OAuth
  if (providers.includes('google')) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials missing in environment');
    }

    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.APP_URL}/api/auth/google/callback`,
      scope: ['profile', 'email']
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(null, false, { message: 'No email from Google' });
        }

        // Check domain restriction
        if (allowedDomains && allowedDomains.length > 0) {
          const domain = email.split('@')[1];
          if (!allowedDomains.includes(domain)) {
            return done(null, false, { message: `Domain @${domain} not allowed` });
          }
        }

        // Get or create user
        const db = getDb();
        let user = db.prepare(`
          SELECT id, email, name, avatar_url FROM users WHERE email = ?
        `).get(email) as any;

        if (!user) {
          const userId = generateId();
          db.prepare(`
            INSERT INTO users (id, email, name, avatar_url, provider, provider_id)
            VALUES (?, ?, ?, ?, 'google', ?)
          `).run(
            userId,
            email,
            profile.displayName,
            profile.photos?.[0]?.value,
            profile.id
          );

          user = { id: userId, email, name: profile.displayName };
        } else {
          // Update profile info
          db.prepare(`
            UPDATE users SET name = ?, avatar_url = ? WHERE id = ?
          `).run(profile.displayName, profile.photos?.[0]?.value, user.id);
        }

        done(null, user);
      } catch (error) {
        done(error);
      }
    }));
  }

  // Passport serialization
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id: string, done) => {
    const db = getDb();
    const user = db.prepare(`
      SELECT id, email, name, avatar_url FROM users WHERE id = ?
    `).get(id);

    done(null, user || null);
  });
}
```

**Add OAuth routes to packages/docpush/src/server/routes/auth.ts:**

```typescript
// OAuth - GitHub
router.get('/github', passport.authenticate('github'));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login?error=github' }),
  (req, res) => {
    res.redirect('/');
  }
);

// OAuth - Google
router.get('/google', passport.authenticate('google'));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (req, res) => {
    res.redirect('/');
  }
);

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out' });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});
```

---

## Task 2.5: Initialize Auth in Server

**Update packages/docpush/src/server/index.ts:**

```typescript
import { setupPublicAuth, setupPublicSerialization } from './auth/public';
import { setupOAuth } from './auth/oauth';

export async function createServer() {
  // ... existing code ...

  // Load config
  const config = await loadConfig();

  // Initialize database
  await initDatabase();

  // Setup authentication based on mode
  if (config.auth.mode === 'public') {
    setupPublicAuth(config);
    setupPublicSerialization();
  } else if (config.auth.mode === 'oauth') {
    setupOAuth(config);
  }
  // Note: magic-link doesn't need passport strategies

  // ... rest of server setup ...
}
```

---

## Verification

After Phase 2, test each auth mode:

### Test Public Mode:

```javascript
// docs.config.js
module.exports = {
  auth: { mode: 'public', adminPassword: 'test123' },
  // ...
};
```

```bash
# Start server
npm run docs:dev

# Test admin login
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"test123"}'
```

### Test Domain-Restricted:

```javascript
// docs.config.js
module.exports = {
  auth: {
    mode: 'domain-restricted',
    allowedDomains: ['company.com'],
    emailFrom: 'noreply@company.com'
  },
  // ...
};
```

```bash
# Request magic link
curl -X POST http://localhost:3000/api/auth/magic-link/request \
  -H "Content-Type: application/json" \
  -d '{"email":"user@company.com"}'

# Check email, click link
```

### Test OAuth:

```javascript
// docs.config.js
module.exports = {
  auth: {
    mode: 'oauth',
    providers: ['github'],
    allowedDomains: ['company.com'] // optional
  },
  // ...
};
```

```bash
# Visit in browser
open http://localhost:3000/api/auth/github
```

---

## Next Steps

Phase 3 will implement the draft system using the authentication foundation.
