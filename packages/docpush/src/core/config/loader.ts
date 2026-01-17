import fs from 'node:fs';
import path from 'node:path';
import { type DocsConfig, configSchema } from './schema';

let cachedConfig: DocsConfig | null = null;

export async function loadConfig(configPath = './docs.config.js'): Promise<DocsConfig> {
  if (cachedConfig) return cachedConfig;

  const fullPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error('docs.config.js not found. Run: npx docpush init');
  }

  try {
    // Clear require cache to pick up changes
    delete require.cache[require.resolve(fullPath)];

    // Dynamic require - works in Node.js
    const userConfig = require(fullPath);

    // Validate with Zod
    cachedConfig = configSchema.parse(userConfig);

    return cachedConfig;
  } catch (error: any) {
    if (error.name === 'ZodError') {
      console.error('Configuration validation failed:');
      error.errors.forEach((err: any) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration');
    }
    throw error;
  }
}

// Reset cache (useful for testing)
export function resetConfigCache(): void {
  cachedConfig = null;
}

// Re-export schema and types
export { configSchema, type DocsConfig } from './schema';
export { validateEnv } from './schema';
