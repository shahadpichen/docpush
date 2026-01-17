import passport from 'passport';
import { Strategy as CustomStrategy } from 'passport-custom';
import type { DocsConfig } from '../../core/config';

/**
 * Public mode authentication
 * Anyone can edit, but admin actions require password
 */
export function setupPublicAuth(config: DocsConfig) {
  if (config.auth.mode !== 'public') return;

  // Public mode: everyone gets editor access, no login needed
  passport.use(
    'public-editor',
    new CustomStrategy((req, done) => {
      // Everyone is an editor in public mode
      done(null, {
        id: 'anonymous',
        email: null,
        name: 'Anonymous Editor',
        role: 'editor',
      });
    })
  );

  // Admin check via password header
  passport.use(
    'public-admin',
    new CustomStrategy((req, done) => {
      const password = req.headers['x-admin-password'] as string;

      if (!password) {
        return done(null, false);
      }

      if (config.auth.mode === 'public' && password === config.auth.adminPassword) {
        return done(null, {
          id: 'admin',
          email: null,
          name: 'Admin',
          role: 'admin',
        });
      }

      return done(null, false);
    })
  );
}
