/**
 * Observability infrastructure exports
 */

export { FrameworkLogger, logger } from './Logger.js';
export type { LogLevel, LoggerConfig, LogEntry } from './Logger.js';

export {
  NoOpMetrics,
  ConsoleMetrics,
  InMemoryMetrics,
  createMetricsCollector,
  metrics,
  setMetricsCollector,
} from './Metrics.js';
export type { MetricsCollector, MetricTags, MetricsCollectorType } from './Metrics.js';
