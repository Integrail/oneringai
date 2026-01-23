/**
 * Backoff strategies for retry logic
 */

/**
 * Backoff strategy type
 */
export type BackoffStrategyType = 'exponential' | 'linear' | 'constant';

/**
 * Backoff configuration
 */
export interface BackoffConfig {
  /** Strategy type */
  strategy: BackoffStrategyType;

  /** Initial delay in ms */
  initialDelayMs: number;

  /** Maximum delay in ms */
  maxDelayMs: number;

  /** Multiplier for exponential (default: 2) */
  multiplier?: number;

  /** Increment for linear (default: 1000ms) */
  incrementMs?: number;

  /** Add random jitter to prevent thundering herd */
  jitter?: boolean;

  /** Jitter factor (0-1, default: 0.1 = ±10%) */
  jitterFactor?: number;

  /** Classify errors - return true if error should be retried */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Default backoff configuration
 */
export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  strategy: 'exponential',
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  multiplier: 2,
  jitter: true,
  jitterFactor: 0.1,
};

/**
 * Calculate backoff delay for given attempt
 */
export function calculateBackoff(attempt: number, config: BackoffConfig = DEFAULT_BACKOFF_CONFIG): number {
  let delay: number;

  switch (config.strategy) {
    case 'exponential':
      delay = config.initialDelayMs * Math.pow(config.multiplier || 2, attempt - 1);
      break;

    case 'linear':
      delay = config.initialDelayMs + (config.incrementMs || 1000) * (attempt - 1);
      break;

    case 'constant':
      delay = config.initialDelayMs;
      break;

    default:
      delay = config.initialDelayMs;
  }

  // Cap at max delay
  delay = Math.min(delay, config.maxDelayMs);

  // Add jitter if enabled
  if (config.jitter) {
    delay = addJitter(delay, config.jitterFactor || 0.1);
  }

  return Math.floor(delay);
}

/**
 * Add random jitter to a delay
 *
 * @param delay - Base delay in ms
 * @param factor - Jitter factor (0-1), default 0.1 = ±10%
 * @returns delay with jitter applied
 */
export function addJitter(delay: number, factor: number = 0.1): number {
  // Calculate jitter range
  const jitterRange = delay * factor;

  // Add random value in range [-jitterRange, +jitterRange]
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  return delay + jitter;
}

/**
 * Wait for backoff delay
 */
export async function backoffWait(attempt: number, config: BackoffConfig = DEFAULT_BACKOFF_CONFIG): Promise<number> {
  const delay = calculateBackoff(attempt, config);

  await new Promise((resolve) => setTimeout(resolve, delay));

  return delay;
}

/**
 * Backoff iterator - generates delays for each attempt
 */
export function* backoffSequence(
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG,
  maxAttempts?: number
): Generator<number, void, unknown> {
  let attempt = 1;

  while (true) {
    if (maxAttempts && attempt > maxAttempts) {
      return;
    }

    yield calculateBackoff(attempt, config);
    attempt++;
  }
}

/**
 * Retry with backoff
 *
 * @param fn - Function to execute
 * @param config - Backoff configuration
 * @param maxAttempts - Max retry attempts (default: unlimited)
 * @returns Result of fn()
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG,
  maxAttempts?: number
): Promise<T> {
  let attempt = 0;
  let lastError: Error;

  while (true) {
    attempt++;

    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (config.isRetryable && !config.isRetryable(lastError)) {
        // Non-retryable error, throw immediately
        throw lastError;
      }

      // Check max attempts
      if (maxAttempts && attempt >= maxAttempts) {
        throw lastError;
      }

      // Wait before retrying
      await backoffWait(attempt, config);
    }
  }
}
