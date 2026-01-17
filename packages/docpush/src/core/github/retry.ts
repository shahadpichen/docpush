export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a GitHub API call with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as {
        status?: number;
        message?: string;
        response?: { headers?: Record<string, string> };
      };
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry client errors (4xx) except 429 (rate limit)
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw new GitHubAPIError(err.message || 'GitHub API client error', err.status);
      }

      // Handle rate limiting (403 or 429)
      if (err.status === 403 || err.status === 429) {
        const resetTime = err.response?.headers?.['x-ratelimit-reset'];
        const remaining = err.response?.headers?.['x-ratelimit-remaining'];

        if (remaining === '0' && resetTime) {
          const waitTime = Number.parseInt(resetTime) * 1000 - Date.now();

          if (waitTime > 0 && waitTime < 60000) {
            console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)}s...`);
            await sleep(waitTime);
            continue;
          }
          throw new GitHubAPIError('GitHub API rate limit exceeded', err.status, waitTime);
        }
      }

      // Retry on 5xx errors or network errors
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
        console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retries failed');
}
