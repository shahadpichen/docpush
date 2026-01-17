// Main package exports
export { loadConfig, configSchema, validateEnv, resetConfigCache } from './core/config';
export type { DocsConfig } from './core/config';
export { GitHubClient } from './core/github';
export { createServer, startServer } from './server';
export {
  generateId,
  now,
  getDrafts,
  getDraft,
  createDraft,
  updateDraft,
  deleteDraft,
  getComments,
  addComment,
  createSession,
  getSession,
  deleteSession,
  createMagicLink,
  verifyMagicLink,
} from './server/storage';
export type { Draft, DraftComment } from './server/storage';
