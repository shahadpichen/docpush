import passport from 'passport';
import type { DocsConfig } from '../../core/config';
import { setupOAuth } from './oauth';
import { setupPublicAuth } from './public';

export interface AuthUser {
  id: string;
  email: string | null;
  name?: string;
  avatar?: string;
  role: 'editor' | 'admin';
  provider?: string;
  sessionToken?: string;
}

/**
 * Set up authentication based on config mode
 */
export function setupAuth(config: DocsConfig) {
  // Session serialization
  passport.serializeUser((user: Express.User, done) => {
    const authUser = user as AuthUser;
    done(null, {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      role: authUser.role,
      avatar: authUser.avatar,
    });
  });

  passport.deserializeUser((user: AuthUser, done) => {
    done(null, user);
  });

  // Set up strategy based on auth mode
  switch (config.auth.mode) {
    case 'public':
      setupPublicAuth(config);
      break;
    case 'domain-restricted':
      setupOAuth(config);
      break;
  }
}

export { setupPublicAuth } from './public';
export { setupOAuth } from './oauth';
