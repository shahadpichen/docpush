import { randomUUID } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import type { DocsConfig } from '../../core/config';
import { GitHubClient } from '../../core/github';
import { requireEdit } from '../middleware/auth';

const router = express.Router();

// Allowed image extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/media
 * Upload an image file to the repository
 * Body should be raw binary image data (Content-Type: image/*)
 */
router.post(
  '/',
  express.raw({ type: '*/*', limit: MAX_FILE_SIZE }),
  requireEdit,
  async (req, res, next) => {
    try {
      const config = req.config as DocsConfig;

      // Ensure we have a Buffer
      let buffer: Buffer;
      if (Buffer.isBuffer(req.body)) {
        buffer = req.body;
      } else if (typeof req.body === 'string') {
        buffer = Buffer.from(req.body, 'binary');
      } else {
        return res.status(400).json({
          error: 'No image data received. Send raw binary data with Content-Type: image/*',
        });
      }

      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Empty image data' });
      }

      // Get filename from header or generate one
      const contentType = req.headers['content-type'] || 'image/png';
      const originalName = req.headers['x-filename'] as string;

      let ext = '.png';
      if (originalName) {
        ext = path.extname(originalName).toLowerCase();
      } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        ext = '.jpg';
      } else if (contentType.includes('gif')) {
        ext = '.gif';
      } else if (contentType.includes('webp')) {
        ext = '.webp';
      } else if (contentType.includes('svg')) {
        ext = '.svg';
      }

      // Validate extension
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({ error: `File type ${ext} not allowed` });
      }

      // Generate unique filename
      const filename = `${randomUUID().slice(0, 8)}${ext}`;
      const filePath = `assets/${filename}`;

      // Upload to GitHub
      const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);
      await github.uploadMedia(filePath, buffer, `Upload image: ${filename}`);

      // Return the URL to access the image
      res.status(201).json({
        success: true,
        path: filePath,
        url: `/api/media/${filePath}`,
        markdown: `![${originalName || filename}](./assets/${filename})`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/media/:path*
 * Serve an image from the repository
 */
router.get('/*', async (req, res, next) => {
  try {
    const config = req.config as DocsConfig;
    const filePath = (req.params as Record<string, string>)[0];

    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }

    // Get file extension for content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Get file from GitHub
    const github = new GitHubClient(process.env.GITHUB_TOKEN || '', config.github);
    const content = await github.getMediaContent(filePath);

    // Set caching headers
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    res.send(content);
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status === 404) {
      return res.status(404).json({ error: 'Image not found' });
    }
    next(error);
  }
});

export default router;
