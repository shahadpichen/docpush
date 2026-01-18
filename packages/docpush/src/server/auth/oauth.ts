import passport from 'passport';
import { type Profile as GitHubProfile, Strategy as GitHubStrategy } from 'passport-github2';
import { type Profile as GoogleProfile, Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { DocsConfig } from '../../core/config';

interface OAuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  role: 'editor' | 'admin';
}

/**
 * OAuth authentication (GitHub, Google)
 */
export function setupOAuth(config: DocsConfig) {
  if (config.auth.mode !== 'domain-restricted') return;

  // Get allowed domains from config (required for domain-restricted)
  const allowedDomains = config.auth.allowedDomains;

  // GitHub OAuth
  if (
    config.auth.providers.includes('github') &&
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET
  ) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: `${process.env.APP_URL}/api/auth/github/callback`,
          scope: ['user:email'],
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: GitHubProfile,
          done: (err: Error | null, user?: OAuthUser | false) => void
        ) => {
          try {
            const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;

            // Check domain restriction if configured
            if (allowedDomains.length > 0) {
              const domain = email.split('@')[1];
              if (!allowedDomains.includes(domain)) {
                return done(null, false);
              }
            }

            const user: OAuthUser = {
              id: `github:${profile.id}`,
              email,
              name: profile.displayName || profile.username || 'GitHub User',
              avatar: profile.photos?.[0]?.value,
              provider: 'github',
              role: config.admins.emails.includes(email) ? 'admin' : 'editor',
            };

            return done(null, user);
          } catch (error) {
            return done(error instanceof Error ? error : new Error('Unknown error'));
          }
        }
      )
    );
  }

  // Google OAuth
  if (
    config.auth.providers.includes('google') &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  ) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.APP_URL}/api/auth/google/callback`,
          scope: ['profile', 'email'],
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: GoogleProfile,
          done: (err: Error | null, user?: OAuthUser | false) => void
        ) => {
          try {
            const email = profile.emails?.[0]?.value;

            if (!email) {
              return done(null, false);
            }

            // Check domain restriction if configured
            if (allowedDomains.length > 0) {
              const domain = email.split('@')[1];
              if (!allowedDomains.includes(domain)) {
                return done(null, false);
              }
            }

            const user: OAuthUser = {
              id: `google:${profile.id}`,
              email,
              name: profile.displayName || 'Google User',
              avatar: profile.photos?.[0]?.value,
              provider: 'google',
              role: config.admins.emails.includes(email) ? 'admin' : 'editor',
            };

            return done(null, user);
          } catch (error) {
            return done(error instanceof Error ? error : new Error('Unknown error'));
          }
        }
      )
    );
  }
}
