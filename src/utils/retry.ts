import logger from "./logger";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  label = "operation"
): Promise<T> => {
  let lastError: unknown;

  for (let i = 0; i < retries; i++) {
    const attempt = i + 1;

    try {
      logger.info({ label, attempt }, "Attempt started");

      const result = await fn();

      logger.info({ label, attempt }, "Attempt succeeded");
      return result;

    } catch (err) {
      lastError = err;

      logger.error(
        { label, attempt, err },
        "Attempt failed"
      );

      if (attempt === retries) {
        logger.error(
          { label, retries, err },
          "All retry attempts failed"
        );
        break;
      }

      const delay = 500 * Math.pow(2, i);

      logger.info(
        { label, attempt, nextDelay: delay },
        "Retrying after delay"
      );

      await sleep(delay);
    }
  }

  throw lastError;
};