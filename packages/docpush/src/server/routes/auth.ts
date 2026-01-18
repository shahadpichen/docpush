import express from 'express';
import passport from 'passport';
import type { DocsConfig } from '../../core/config';
import { deleteSession, getSession } from '../storage';

const router = express.Router();

/**
 * Get redirect URL after OAuth - uses FRONTEND_URL if set, otherwise APP_URL
 */
function getRedirectUrl(): string {
  return process.env.FRONTEND_URL || process.env.APP_URL || '/';
}

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', (req, res) => {
  if (req.user) {
    return res.json({
      authenticated: true,
      user: req.user,
    });
  }

  // Check if public mode - everyone is effectively logged in
  const config = req.config as DocsConfig;
  if (config.auth.mode === 'public') {
    return res.json({
      authenticated: true,
      user: {
        id: 'anonymous',
        email: null,
        name: 'Anonymous Editor',
        role: 'editor',
      },
    });
  }

  res.json({ authenticated: false });
});

/**
 * POST /api/auth/logout
 * Log out current user
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

/**
 * GET /api/auth/github
 * Start GitHub OAuth flow
 */
router.get('/github', passport.authenticate('github'));

/**
 * GET /api/auth/github/callback
 * GitHub OAuth callback
 */
router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/login?error=github' }),
  (req, res) => {
    res.redirect(getRedirectUrl());
  }
);

/**
 * GET /api/auth/google
 * Start Google OAuth flow
 */
router.get('/google', passport.authenticate('google'));

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (req, res) => {
    res.redirect(getRedirectUrl());
  }
);

export default router;
