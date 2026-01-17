import { randomUUID } from 'node:crypto';
import express from 'express';
import type { DocsConfig } from '../../core/config';
import { GitHubClient } from '../../core/github';
import { requireAdmin, requireEdit } from '../middleware/auth';
import {
  addComment,
  createDraft,
  deleteDraft,
  getComments,
  getDraft,
  getDrafts,
  updateDraft,
} from '../storage';

const router = express.Router();

/**
 * GET /api/drafts
 * List all drafts (optionally filtered by status)
 */
router.get('/', requireEdit, async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const drafts = await getDrafts(status);
    res.json({ drafts });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/drafts
 * Create a new draft (creates Git branch)
 */
router.post('/', requireEdit, async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const { docPath, title, content } = req.body;

    if (!docPath || !title) {
      return res.status(400).json({ error: 'docPath and title are required' });
    }

    // Generate branch name
    const branchName = `draft/${randomUUID().slice(0, 8)}-${docPath.replace(/[^a-z0-9]/gi, '-')}`;

    // Create GitHub client
    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);

    // Create branch on GitHub
    await github.createDraftBranch(branchName);

    // If content provided, commit it
    if (content) {
      await github.commitFile(branchName, docPath, content, `Draft: ${title}`);
    }

    // Get user info from session
    const user = req.user as { id?: string; email?: string } | undefined;

    // Save draft to storage
    const draft = await createDraft({
      docPath,
      branchName,
      title,
      authorId: user?.id || null,
      authorEmail: user?.email || null,
      status: 'pending',
    });

    res.status(201).json({ draft });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/drafts/:id
 * Get draft details including content from Git branch
 */
router.get('/:id', requireEdit, async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const draft = await getDraft(req.params.id);

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Get content from Git branch
    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);
    let content = '';
    try {
      content = await github.getFileContent(draft.docPath, draft.branchName);
    } catch {
      // File might not exist yet in draft
    }

    // Get comments
    const comments = await getComments(draft.id);

    res.json({ draft, content, comments });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/drafts/:id
 * Update draft content (commits to Git branch)
 */
router.put('/:id', requireEdit, async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const { content, message } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const draft = await getDraft(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draft.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot edit non-pending draft' });
    }

    // Commit to Git branch
    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);
    await github.commitFile(
      draft.branchName,
      draft.docPath,
      content,
      message || `Update: ${draft.title}`
    );

    // Update timestamp
    const updatedDraft = await updateDraft(draft.id, {});

    res.json({ draft: updatedDraft });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/drafts/:id
 * Delete a draft (deletes Git branch)
 */
router.delete('/:id', requireEdit, async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const draft = await getDraft(req.params.id);

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Delete Git branch
    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);
    try {
      await github.deleteBranch(draft.branchName);
    } catch {
      // Branch might already be deleted
    }

    // Delete from storage
    await deleteDraft(draft.id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/drafts/:id/approve
 * Approve draft (creates PR, merges, deletes branch)
 */
router.post('/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const draft = await getDraft(req.params.id);

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draft.status !== 'pending') {
      return res.status(400).json({ error: 'Draft is not pending' });
    }

    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);

    // Create and merge PR
    const prNumber = await github.createPullRequest(
      draft.branchName,
      `Docs: ${draft.title}`,
      `Approved documentation update for \`${draft.docPath}\``
    );
    await github.mergePullRequest(prNumber);

    // Delete branch
    await github.deleteBranch(draft.branchName);

    // Update status
    const updatedDraft = await updateDraft(draft.id, { status: 'approved' });

    res.json({ draft: updatedDraft, prNumber });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/drafts/:id/reject
 * Reject draft (deletes branch)
 */
router.post('/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const { reason } = req.body;
    const draft = await getDraft(req.params.id);

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draft.status !== 'pending') {
      return res.status(400).json({ error: 'Draft is not pending' });
    }

    // Delete Git branch
    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);
    try {
      await github.deleteBranch(draft.branchName);
    } catch {
      // Branch might already be deleted
    }

    // Add rejection comment if reason provided
    if (reason) {
      const user = req.user as { id?: string; email?: string; name?: string } | undefined;
      await addComment({
        draftId: draft.id,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userName: user?.name || 'Admin',
        content: `Rejected: ${reason}`,
      });
    }

    // Update status
    const updatedDraft = await updateDraft(draft.id, { status: 'rejected' });

    res.json({ draft: updatedDraft });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/drafts/:id/comments
 * Get comments for a draft
 */
router.get('/:id/comments', requireEdit, async (req, res, next) => {
  try {
    const draft = await getDraft(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const comments = await getComments(draft.id);
    res.json({ comments });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/drafts/:id/comments
 * Add a comment to a draft
 */
router.post('/:id/comments', requireEdit, async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const draft = await getDraft(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const user = req.user as { id?: string; email?: string; name?: string } | undefined;

    const comment = await addComment({
      draftId: draft.id,
      userId: user?.id || null,
      userEmail: user?.email || null,
      userName: user?.name || 'Anonymous',
      content,
    });

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

export default router;
