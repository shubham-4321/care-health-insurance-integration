import { logger } from "../config/logger";
import { AxiosError } from "axios";

// ─── Sleep helper ──────────────────────────────────────────
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Should we retry this error? ──────────────────────────
// Only retry network errors and server errors (5xx)
// Never retry client errors (4xx) — those won't fix themselves
const isRetryable = (err: unknown): boolean => {
  try {
    const axiosErr = err as AxiosError;

    // Network error — no response at all
    if (!axiosErr.response) return true;

    const status = axiosErr.response.status;

    // 5xx → server error → retry
    if (status >= 500) return true;

    // 408 → request timeout → retry
    if (status === 408) return true;

    // 429 → rate limited → retry
    if (status === 429) return true;

    // 4xx → bad request, wrong data etc → don't retry
    return false;
  } catch {
    // If we can't determine — retry to be safe
    return true;
  }
};

// ─── Main retry function ───────────────────────────────────
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    label?: string;
    baseDelayMs?: number;
  } = {}
): Promise<T> => {
  const {
    retries = 3,
    label = "operation",
    baseDelayMs = 500,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug(`[RETRY] ${label} — attempt ${attempt}/${retries}`);

      const result = await fn();

      if (attempt > 1) {
        logger.info(
          `[RETRY] ${label} succeeded on attempt ${attempt}/${retries}`
        );
      }

      return result;
    } catch (err) {
      lastError = err;

      logger.warn(`[RETRY] ${label} — attempt ${attempt} failed`, {
        error: err instanceof Error ? err.message : String(err),
      });

      // Don't retry if it's a client error (4xx)
      if (!isRetryable(err)) {
        logger.error(
          `[RETRY] ${label} — non-retryable error, stopping immediately`,
          {
            error: err instanceof Error ? err.message : String(err),
          }
        );
        throw err;
      }

      // Don't wait after the last attempt
      if (attempt === retries) break;

      // Exponential backoff — 500ms, 1000ms, 2000ms...
      // Capped at 10 seconds max
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 10000);

      logger.debug(
        `[RETRY] ${label} — waiting ${delay}ms before attempt ${attempt + 1}`
      );

      await sleep(delay);
    }
  }

  logger.error(`[RETRY] ${label} — all ${retries} attempts failed`);
  throw lastError;
};