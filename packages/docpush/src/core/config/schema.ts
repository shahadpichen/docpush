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

// Helper to validate environment variables
export function validateEnv(): void {
  const required = ['GITHUB_TOKEN', 'APP_URL', 'SESSION_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
