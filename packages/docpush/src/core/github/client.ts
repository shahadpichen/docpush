import { Octokit } from '@octokit/rest';
import type { DocsConfig } from '../config';
import { retryWithBackoff } from './retry';

export class GitHubClient {
  private octokit: Octokit;
  private config: DocsConfig['github'];

  constructor(token: string, config: DocsConfig['github']) {
    this.octokit = new Octokit({ auth: token });
    this.config = config;
  }

  /**
   * Get documentation file tree
   */
  async getDocsTree(): Promise<Array<{ path: string; type: 'file' | 'dir' }>> {
    return retryWithBackoff(async () => {
      const { data } = await this.octokit.git.getTree({
        owner: this.config.owner,
        repo: this.config.repo,
        tree_sha: this.config.branch,
        recursive: '1',
      });

      return data.tree
        .filter(
          (item): item is typeof item & { path: string } =>
            typeof item.path === 'string' && item.path.startsWith(this.config.docsPath)
        )
        .map((item) => ({
          path: item.path.replace(`${this.config.docsPath}/`, ''),
          type: item.type === 'tree' ? ('dir' as const) : ('file' as const),
        }));
    });
  }

  /**
   * Get file content from repository
   */
  async getFileContent(filePath: string, ref?: string): Promise<string> {
    return retryWithBackoff(async () => {
      const fullPath = `${this.config.docsPath}/${filePath}`;

      const { data } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fullPath,
        ref: ref || this.config.branch,
      });

      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      throw new Error('Path is not a file');
    });
  }

  /**
   * Create a new branch for draft
   */
  async createDraftBranch(branchName: string): Promise<string> {
    return retryWithBackoff(async () => {
      // Get current main branch SHA
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${this.config.branch}`,
      });

      const sha = ref.object.sha;

      // Create new branch
      await this.octokit.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${branchName}`,
        sha,
      });

      return sha;
    });
  }

  /**
   * Commit file to branch
   */
  async commitFile(
    branchName: string,
    filePath: string,
    content: string,
    message: string
  ): Promise<void> {
    const fullPath = `${this.config.docsPath}/${filePath}`;

    // Try to get existing file SHA
    let sha: string | undefined;
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fullPath,
        ref: branchName,
      });
      if ('sha' in data) sha = data.sha;
    } catch (e: unknown) {
      const error = e as { status?: number };
      if (error.status !== 404) throw e;
      // File doesn't exist yet, that's ok
    }

    // Create or update file
    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path: fullPath,
      message,
      content: Buffer.from(content).toString('base64'),
      branch: branchName,
      sha,
    });
  }

  /**
   * Create pull request
   */
  async createPullRequest(branchName: string, title: string, body: string): Promise<number> {
    const { data } = await this.octokit.pulls.create({
      owner: this.config.owner,
      repo: this.config.repo,
      head: branchName,
      base: this.config.branch,
      title,
      body,
    });

    return data.number;
  }

  /**
   * Merge pull request
   */
  async mergePullRequest(prNumber: number): Promise<void> {
    await this.octokit.pulls.merge({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: prNumber,
      merge_method: 'squash',
    });
  }

  /**
   * Delete branch
   */
  async deleteBranch(branchName: string): Promise<void> {
    await this.octokit.git.deleteRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${branchName}`,
    });
  }

  /**
   * Get commit history for file
   */
  async getFileHistory(filePath: string): Promise<
    Array<{
      sha: string;
      message: string;
      date: string;
      author: string;
    }>
  > {
    const fullPath = `${this.config.docsPath}/${filePath}`;

    const { data } = await this.octokit.repos.listCommits({
      owner: this.config.owner,
      repo: this.config.repo,
      path: fullPath,
      per_page: 50,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      date: commit.commit.author?.date || '',
      author: commit.commit.author?.name || 'Unknown',
    }));
  }

  /**
   * Upload media file (image, etc.) to repository
   */
  async uploadMedia(
    filePath: string,
    content: Buffer,
    message: string,
    branch?: string
  ): Promise<string> {
    const fullPath = `${this.config.docsPath}/${filePath}`;
    const targetBranch = branch || this.config.branch;

    // Try to get existing file SHA
    let sha: string | undefined;
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fullPath,
        ref: targetBranch,
      });
      if ('sha' in data) sha = data.sha;
    } catch (e: unknown) {
      const error = e as { status?: number };
      if (error.status !== 404) throw e;
      // File doesn't exist yet, that's ok
    }

    // Create or update file
    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path: fullPath,
      message,
      content: content.toString('base64'),
      branch: targetBranch,
      sha,
    });

    return filePath;
  }

  /**
   * Get media file content (raw binary)
   */
  async getMediaContent(filePath: string, ref?: string): Promise<Buffer> {
    const fullPath = `${this.config.docsPath}/${filePath}`;

    const { data } = await this.octokit.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path: fullPath,
      ref: ref || this.config.branch,
    });

    if ('content' in data) {
      return Buffer.from(data.content, 'base64');
    }

    throw new Error('Path is not a file');
  }
}
