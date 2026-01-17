import { z } from 'zod';

// Auth mode schemas
const publicAuthSchema = z.object({
  mode: z.literal('public'),
  adminPassword: z.string().min(1, 'Admin password required for public mode'),
});

const domainRestrictedAuthSchema = z.object({
  mode: z.literal('domain-restricted'),
  allowedDomains: z.array(z.string()).min(1, 'At least one domain required'),
  emailFrom: z.string().email('Valid email required for sending magic links'),
});

const oauthAuthSchema = z.object({
  mode: z.literal('oauth'),
  providers: z.array(z.enum(['github', 'google'])).min(1, 'At least one OAuth provider required'),
  allowedDomains: z.array(z.string()).optional(),
});

export const configSchema = z.object({
  // GitHub repository configuration
  github: z.object({
    owner: z.string().min(1, 'GitHub owner required'),
    repo: z.string().min(1, 'GitHub repo required'),
    branch: z.string().default('main'),
    docsPath: z.string().default('docs'),
  }),

  // Authentication mode (discriminated union)
  auth: z.discriminatedUnion('mode', [
    publicAuthSchema,
    domainRestrictedAuthSchema,
    oauthAuthSchema,
  ]),

  // Admin users
  admins: z.object({
    emails: z.array(z.string().email()).min(1, 'At least one admin email required'),
  }),

  // Optional branding
  branding: z
    .object({
      name: z.string().default('Documentation'),
      logo: z.string().optional(),
    })
    .optional(),
});

export type DocsConfig = z.infer<typeof configSchema>;

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate environment variables with detailed feedback
 */
export function validateEnv(config?: DocsConfig): EnvValidationResult {
  const result: EnvValidationResult = {
    valid: true,
    missing: [],
    warnings: [],
  };

  // Always required
  const required = ['GITHUB_TOKEN', 'APP_URL', 'SESSION_SECRET'];

  for (const key of required) {
    if (!process.env[key]) {
      result.missing.push(key);
    }
  }

  // Conditionally required based on auth mode
  if (config) {
    switch (config.auth.mode) {
      case 'domain-restricted':
        if (!process.env.RESEND_API_KEY) {
          result.missing.push('RESEND_API_KEY');
        }
        break;

      case 'oauth':
        if (config.auth.providers.includes('github')) {
          if (!process.env.GITHUB_CLIENT_ID) result.missing.push('GITHUB_CLIENT_ID');
          if (!process.env.GITHUB_CLIENT_SECRET) result.missing.push('GITHUB_CLIENT_SECRET');
        }
        if (config.auth.providers.includes('google')) {
          if (!process.env.GOOGLE_CLIENT_ID) result.missing.push('GOOGLE_CLIENT_ID');
          if (!process.env.GOOGLE_CLIENT_SECRET) result.missing.push('GOOGLE_CLIENT_SECRET');
        }
        break;
    }
  }

  // Warnings for dev environment
  if (process.env.SESSION_SECRET === 'fallback-secret-change-me') {
    result.warnings.push('SESSION_SECRET is using fallback value - change in production!');
  }

  if (process.env.NODE_ENV === 'production' && !process.env.APP_URL?.startsWith('https://')) {
    result.warnings.push('APP_URL should use HTTPS in production');
  }

  result.valid = result.missing.length === 0;

  // Throw if critical vars missing
  if (!result.valid) {
    throw new Error(
      `Missing required environment variables:\n${result.missing.map((k) => `  - ${k}`).join('\n')}`
    );
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('Environment warnings:');
    result.warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
  }

  return result;
}
