import express from 'express';
import type { DocsConfig } from '../../core/config';
import { GitHubClient } from '../../core/github';

const router = express.Router();

/**
 * GET /api/docs/tree
 * Get file tree of published docs from main branch
 */
router.get('/tree', async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);

    const tree = await github.getDocsTree();
    res.json({ tree });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/docs/*
 * Get content of a specific doc file
 * Also supports /api/docs/path/to/file.md/history for commit history
 */
router.get('/:path(*)', async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const fullPath = req.params.path;

    // Check if requesting history
    if (fullPath.endsWith('/history')) {
      const docPath = fullPath.replace(/\/history$/, '');
      const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);
      const history = await github.getFileHistory(docPath);
      return res.json({ history });
    }

    // Get file content
    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);
    const content = await github.getFileContent(fullPath);

    // Parse frontmatter if needed (using gray-matter would be added here)
    res.json({
      path: fullPath,
      content,
    });
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status === 404) {
      return res.status(404).json({ error: 'Document not found' });
    }
    next(error);
  }
});

export default router;
