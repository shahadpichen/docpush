import chalk from 'chalk';

export async function startCommand(options: { port: string }): Promise<void> {
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
