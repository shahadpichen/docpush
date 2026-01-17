import express from 'express';
import passport from 'passport';
import type { DocsConfig } from '../../core/config';
import { sendMagicLink } from '../auth/magic-link';
import { deleteSession, getSession } from '../storage';

const router = express.Router();

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
 * POST /api/auth/magic-link
 * Send magic link email (domain-restricted mode)
 */
router.post('/magic-link', async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    if (config.auth.mode !== 'domain-restricted') {
      return res.status(400).json({ error: 'Magic link not available in this mode' });
    }

    await sendMagicLink(email, config);
    res.json({ success: true, message: 'Check your email for the login link' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/auth/verify
 * Verify magic link token
 */
router.post('/verify', passport.authenticate('magic-link'), (req, res) => {
  res.json({
    success: true,
    user: req.user,
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
    res.redirect('/');
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
    res.redirect('/');
  }
);

export default router;
