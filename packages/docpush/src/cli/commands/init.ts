import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';

const WELCOME_TEMPLATE = `# Welcome to Your Documentation

This is your first document! Edit it to get started.

## Getting Started

1. Edit files in the \`docs/\` folder
2. Changes are saved as drafts (Git branches)
3. Admins can approve drafts to publish

## Configuration

Edit \`docs.config.js\` to configure:
- GitHub repository
- Authentication mode
- Admin users
`;

const CONFIG_TEMPLATE = `module.exports = {
  // Your GitHub repository
  github: {
    owner: 'your-org',          // TODO: Change to your GitHub org/username
    repo: 'your-repo',           // TODO: Change to your repository name
    branch: 'main',              // Main branch
    docsPath: 'docs'             // Path to docs folder
  },

  // Authentication mode
  auth: {
    mode: 'public',              // Options: 'public' | 'domain-restricted' | 'oauth'
    adminPassword: 'changeme'    // TODO: Change this password! (for public mode)
  },

  // Admin users (for domain-restricted and oauth modes)
  admins: {
    emails: ['admin@example.com'] // TODO: Add your admin emails
  },

  // Optional: Branding
  branding: {
    name: 'Documentation',
    // logo: '/logo.png'
  }
};
`;

const ENV_TEMPLATE = `# Required
GITHUB_TOKEN=ghp_your_token_here
APP_URL=http://localhost:3000
SESSION_SECRET=generate-random-string-here-change-in-production

# Database (optional - uses SQLite if not provided)
# DATABASE_PATH=./docpush.db

# Auth - Domain Restricted (only if using this mode)
# RESEND_API_KEY=re_your_key_here

# Auth - OAuth (only if using this mode)
# GITHUB_CLIENT_ID=your_client_id
# GITHUB_CLIENT_SECRET=your_client_secret
# GOOGLE_CLIENT_ID=your_client_id
# GOOGLE_CLIENT_SECRET=your_client_secret

# Media - S3 (optional)
# S3_BUCKET=your-bucket
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret

# Search - Algolia (optional but recommended)
# NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id
# NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=your_search_only_api_key
# NEXT_PUBLIC_ALGOLIA_INDEX_NAME=your_index_name
`;

export async function initCommand(): Promise<void> {
  console.log(chalk.blue('🚀 Initializing DocPush...\n'));

  // 1. Create docs folder
  await fs.ensureDir('./docs');
  await fs.writeFile('./docs/welcome.md', WELCOME_TEMPLATE);
  console.log(chalk.green('✓'), 'Created docs/ folder with welcome.md');

  // 2. Create config file
  if (!(await fs.pathExists('./docs.config.js'))) {
    await fs.writeFile('./docs.config.js', CONFIG_TEMPLATE);
    console.log(chalk.green('✓'), 'Created docs.config.js');
  } else {
    console.log(chalk.yellow('⚠'), 'docs.config.js already exists, skipping');
  }

  // 3. Create .env.example
  await fs.writeFile('./.env.example', ENV_TEMPLATE);
  console.log(chalk.green('✓'), 'Created .env.example');

  // 4. Update package.json scripts
  const pkgPath = './package.json';
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    pkg.scripts = {
      ...pkg.scripts,
      'docs:dev': 'docpush start',
      'docs:build': 'docpush build',
    };
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
    console.log(chalk.green('✓'), 'Updated package.json scripts');
  }

  console.log(chalk.blue('\n📝 Next steps:'));
  console.log('  1. Copy .env.example to .env and fill in values');
  console.log('  2. Edit docs.config.js with your GitHub repo');
  console.log('  3. Create a GitHub Personal Access Token with "repo" scope');
  console.log('  4. Run: npm run docs:dev\n');
}
