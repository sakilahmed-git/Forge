export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries) {
        throw error;
      }

      const retryAttempt = attempt + 1;
      const isRateLimit =
        (error as any)?.status === 429 ||
        (error as any)?.statusCode === 429 ||
        String((error as any)?.message ?? '').includes('429');
      const delayMs = isRateLimit ? 60000 : 2 ** retryAttempt * 1000;

      console.log(
        `Retry attempt ${retryAttempt}, waiting ${delayMs}ms due to error:`,
        error
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
