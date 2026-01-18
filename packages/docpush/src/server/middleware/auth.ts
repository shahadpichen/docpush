import type { NextFunction, Request, Response } from 'express';
import { loadConfig } from '../../core/config';

// Extend Express Request type
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string | null;
      name?: string;
      role?: string;
    }
  }
}

/**
 * Check if user can edit documents
 */
export async function requireEdit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const config = req.config || (await loadConfig());

  // Public mode - anyone can edit
  if (config.auth.mode === 'public') {
    req.user = { id: 'anonymous', email: null, role: 'editor' };
    return next();
  }

  // Domain-restricted - must be logged in
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // For domain-restricted mode, check if user's email domain is allowed
  if (config.auth.mode === 'domain-restricted') {
    const userEmail = req.user.email;
    if (!userEmail) {
      res.status(403).json({ error: 'Email required for editing' });
      return;
    }

    const domain = userEmail.split('@')[1];
    if (!config.auth.allowedDomains.includes(domain)) {
      res.status(403).json({ error: `Your email domain @${domain} is not allowed to edit` });
      return;
    }
  }

  next();
}

/**
 * Check if user is admin
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const config = req.config || (await loadConfig());

  // Public mode - check password header
  if (config.auth.mode === 'public') {
    const password = req.headers['x-admin-password'] as string;

    if (!password || password !== config.auth.adminPassword) {
      res.status(403).json({ error: 'Invalid admin password' });
      return;
    }

    req.user = { id: 'admin', email: null, role: 'admin' };
    return next();
  }

  // Domain-restricted or OAuth - check email against admin list
  if (!req.user?.email) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!config.admins.emails.includes(req.user.email)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
