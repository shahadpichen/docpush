import chalk from 'chalk';
import { config } from 'dotenv';

export async function startCommand(options: { port: string }): Promise<void> {
  // Load .env file from current working directory
  config();

  const port = Number.parseInt(options.port);

  console.log(chalk.blue('🚀 Starting DocPush...\n'));

  // Dynamically import and start the server
  try {
    const { startServer } = await import('../../server');
    await startServer(port);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red('❌ Failed to start server:'), message);
    process.exit(1);
  }
}
