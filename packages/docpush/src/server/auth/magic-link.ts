import passport from 'passport';
import { Strategy as CustomStrategy } from 'passport-custom';
import { Resend } from 'resend';
import type { DocsConfig } from '../../core/config';
import { createMagicLink, createSession, verifyMagicLink } from '../storage';

let resend: Resend | null = null;

/**
 * Domain-restricted authentication via magic link emails
 */
export function setupMagicLinkAuth(config: DocsConfig) {
  if (config.auth.mode !== 'domain-restricted') return;

  // Initialize Resend
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }

  // Magic link verification strategy
  passport.use(
    'magic-link',
    new CustomStrategy(async (req, done) => {
      const { token } = req.body;

      if (!token) {
        return done(null, false);
      }

      const email = await verifyMagicLink(token);

      if (!email) {
        return done(null, false);
      }

      // Check if email domain is allowed
      if (config.auth.mode === 'domain-restricted') {
        const domain = email.split('@')[1];
        if (!config.auth.allowedDomains.includes(domain)) {
          return done(null, false);
        }
      }

      // Create user session
      const sessionToken = await createSession(email, email);

      return done(null, {
        id: email,
        email,
        name: email.split('@')[0],
        role: config.admins.emails.includes(email) ? 'admin' : 'editor',
        sessionToken,
      });
    })
  );
}

/**
 * Send magic link email
 */
export async function sendMagicLink(email: string, config: DocsConfig): Promise<boolean> {
  if (config.auth.mode !== 'domain-restricted') {
    throw new Error('Magic link only available in domain-restricted mode');
  }

  // Check domain
  const domain = email.split('@')[1];
  if (!config.auth.allowedDomains.includes(domain)) {
    throw new Error(`Email domain @${domain} is not allowed`);
  }

  // Create magic link token
  const token = await createMagicLink(email);
  const loginUrl = `${process.env.APP_URL}/auth/verify?token=${token}`;

  // Send email via Resend
  if (!resend) {
    console.log('[DEV] Magic link for', email, ':', loginUrl);
    return true;
  }

  try {
    await resend.emails.send({
      from: config.auth.emailFrom,
      to: email,
      subject: 'Sign in to Documentation',
      html: `
        <h2>Sign in to Documentation</h2>
        <p>Click the link below to sign in. This link expires in 15 minutes.</p>
        <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #0070f3; color: white; text-decoration: none; border-radius: 6px;">
          Sign In
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          If you didn't request this email, you can safely ignore it.
        </p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send magic link email:', error);
    throw new Error('Failed to send email');
  }
}
