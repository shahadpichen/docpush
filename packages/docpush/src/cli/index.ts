#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './commands/add';
import { initCommand } from './commands/init';
import { startCommand } from './commands/start';

const program = new Command();

program
  .name('docpush')
  .description('Self-hosted, Git-backed collaborative documentation platform')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize DocPush in the current directory')
  .action(initCommand);

program
  .command('start')
  .description('Start the DocPush development server')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .action(startCommand);

program
  .command('add')
  .description('Add UI components to your project (shadcn/ui style)')
  .argument('<components...>', 'Components to add (e.g., button input textarea or "all")')
  .action(addCommand);

program.parse();
