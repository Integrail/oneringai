import EventEmitter$1, { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// src/domain/errors/AIErrors.ts
var AIError = class _AIError extends Error {
  constructor(message, code, statusCode, originalError) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.name = "AIError";
    Object.setPrototypeOf(this, _AIError.prototype);
  }
};
var ToolExecutionError = class _ToolExecutionError extends AIError {
  constructor(toolName, message, originalError) {
    super(
      `Tool '${toolName}' execution failed: ${message}`,
      "TOOL_EXECUTION_ERROR",
      500,
      originalError
    );
    this.originalError = originalError;
    this.name = "ToolExecutionError";
    Object.setPrototypeOf(this, _ToolExecutionError.prototype);
  }
};
var ToolTimeoutError = class _ToolTimeoutError extends AIError {
  constructor(toolName, timeoutMs) {
    super(
      `Tool '${toolName}' execution timed out after ${timeoutMs}ms`,
      "TOOL_TIMEOUT",
      408
    );
    this.timeoutMs = timeoutMs;
    this.name = "ToolTimeoutError";
    Object.setPrototypeOf(this, _ToolTimeoutError.prototype);
  }
};
var ToolNotFoundError = class _ToolNotFoundError extends AIError {
  constructor(toolName) {
    super(
      `Tool '${toolName}' not found. Did you register it with the agent?`,
      "TOOL_NOT_FOUND",
      404
    );
    this.name = "ToolNotFoundError";
    Object.setPrototypeOf(this, _ToolNotFoundError.prototype);
  }
};
var DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeoutMs: 3e4,
  // 30 seconds
  windowMs: 6e4,
  // 1 minute
  isRetryable: () => true
  // All errors count by default
};
var CircuitOpenError = class extends Error {
  constructor(breakerName, nextRetryTime, failureCount, lastError) {
    const retryInSeconds = Math.ceil((nextRetryTime - Date.now()) / 1e3);
    super(
      `Circuit breaker '${breakerName}' is OPEN. Retry in ${retryInSeconds}s. (${failureCount} recent failures, last: ${lastError})`
    );
    this.breakerName = breakerName;
    this.nextRetryTime = nextRetryTime;
    this.failureCount = failureCount;
    this.lastError = lastError;
    this.name = "CircuitOpenError";
  }
};
var CircuitBreaker = class extends EventEmitter$1 {
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.lastStateChange = Date.now();
  }
  state = "closed";
  config;
  // Failure tracking
  failures = [];
  lastError = "";
  // Success tracking
  consecutiveSuccesses = 0;
  // Timing
  openedAt;
  lastStateChange;
  // Metrics
  totalRequests = 0;
  successCount = 0;
  failureCount = 0;
  rejectedCount = 0;
  lastFailureTime;
  lastSuccessTime;
  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn) {
    this.totalRequests++;
    const now = Date.now();
    switch (this.state) {
      case "open":
        if (this.openedAt && now - this.openedAt >= this.config.resetTimeoutMs) {
          this.transitionTo("half-open");
        } else {
          this.rejectedCount++;
          const nextRetry = (this.openedAt || now) + this.config.resetTimeoutMs;
          throw new CircuitOpenError(this.name, nextRetry, this.failures.length, this.lastError);
        }
        break;
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }
  /**
   * Record successful execution
   */
  recordSuccess() {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.consecutiveSuccesses++;
    if (this.state === "half-open") {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo("closed");
      }
    } else if (this.state === "closed") {
      this.pruneOldFailures();
    }
  }
  /**
   * Record failed execution
   */
  recordFailure(error) {
    if (this.config.isRetryable && !this.config.isRetryable(error)) {
      return;
    }
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.lastError = error.message;
    this.consecutiveSuccesses = 0;
    this.failures.push({
      timestamp: Date.now(),
      error: error.message
    });
    this.pruneOldFailures();
    if (this.state === "half-open") {
      this.transitionTo("open");
    } else if (this.state === "closed") {
      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo("open");
      }
    }
  }
  /**
   * Transition to new state
   */
  transitionTo(newState) {
    this.state = newState;
    this.lastStateChange = Date.now();
    switch (newState) {
      case "open":
        this.openedAt = Date.now();
        this.emit("opened", {
          name: this.name,
          failureCount: this.failures.length,
          lastError: this.lastError,
          nextRetryTime: this.openedAt + this.config.resetTimeoutMs
        });
        break;
      case "half-open":
        this.emit("half-open", {
          name: this.name,
          timestamp: Date.now()
        });
        break;
      case "closed":
        this.failures = [];
        this.consecutiveSuccesses = 0;
        this.openedAt = void 0;
        this.emit("closed", {
          name: this.name,
          successCount: this.consecutiveSuccesses,
          timestamp: Date.now()
        });
        break;
    }
  }
  /**
   * Remove failures outside the time window
   */
  pruneOldFailures() {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    this.pruneOldFailures();
    const total = this.successCount + this.failureCount;
    const failureRate = total > 0 ? this.failureCount / total : 0;
    const successRate = total > 0 ? this.successCount / total : 0;
    return {
      name: this.name,
      state: this.state,
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      failureCount: this.failureCount,
      rejectedCount: this.rejectedCount,
      recentFailures: this.failures.length,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange,
      nextRetryTime: this.openedAt ? this.openedAt + this.config.resetTimeoutMs : void 0,
      failureRate,
      successRate
    };
  }
  /**
   * Manually reset circuit breaker (force close)
   */
  reset() {
    this.transitionTo("closed");
    this.totalRequests = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.rejectedCount = 0;
    this.lastFailureTime = void 0;
    this.lastSuccessTime = void 0;
  }
  /**
   * Check if circuit is allowing requests
   */
  isOpen() {
    if (this.state === "open" && this.openedAt) {
      const now = Date.now();
      if (now - this.openedAt >= this.config.resetTimeoutMs) {
        this.transitionTo("half-open");
        return false;
      }
      return true;
    }
    return false;
  }
  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
};
var LOG_LEVEL_VALUES = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 100
};
var FrameworkLogger = class _FrameworkLogger {
  config;
  context;
  levelValue;
  fileStream;
  constructor(config = {}) {
    this.config = {
      level: config.level || process.env.LOG_LEVEL || "info",
      pretty: config.pretty ?? (process.env.LOG_PRETTY === "true" || process.env.NODE_ENV === "development"),
      destination: config.destination || "console",
      context: config.context || {},
      filePath: config.filePath || process.env.LOG_FILE
    };
    this.context = this.config.context || {};
    this.levelValue = LOG_LEVEL_VALUES[this.config.level || "info"];
    if (this.config.filePath) {
      this.initFileStream(this.config.filePath);
    }
  }
  /**
   * Initialize file stream for logging
   */
  initFileStream(filePath) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.fileStream = fs.createWriteStream(filePath, {
        flags: "a",
        // append mode
        encoding: "utf8"
      });
      this.fileStream.on("error", (err) => {
        console.error(`[Logger] File stream error: ${err.message}`);
        this.fileStream = void 0;
      });
    } catch (err) {
      console.error(`[Logger] Failed to initialize log file: ${err instanceof Error ? err.message : err}`);
    }
  }
  /**
   * Create child logger with additional context
   */
  child(context) {
    return new _FrameworkLogger({
      ...this.config,
      context: { ...this.context, ...context }
    });
  }
  /**
   * Trace log
   */
  trace(obj, msg) {
    this.log("trace", obj, msg);
  }
  /**
   * Debug log
   */
  debug(obj, msg) {
    this.log("debug", obj, msg);
  }
  /**
   * Info log
   */
  info(obj, msg) {
    this.log("info", obj, msg);
  }
  /**
   * Warn log
   */
  warn(obj, msg) {
    this.log("warn", obj, msg);
  }
  /**
   * Error log
   */
  error(obj, msg) {
    this.log("error", obj, msg);
  }
  /**
   * Internal log method
   */
  log(level, obj, msg) {
    if (LOG_LEVEL_VALUES[level] < this.levelValue) {
      return;
    }
    let data;
    let message;
    if (typeof obj === "string") {
      message = obj;
      data = {};
    } else {
      message = msg || "";
      data = obj;
    }
    const entry = {
      level,
      time: Date.now(),
      ...this.context,
      ...data,
      msg: message
    };
    this.output(entry);
  }
  /**
   * Output log entry
   */
  output(entry) {
    if (this.config.pretty) {
      this.prettyPrint(entry);
    } else {
      this.jsonPrint(entry);
    }
  }
  /**
   * Pretty print for development
   */
  prettyPrint(entry) {
    const levelColors = {
      trace: "\x1B[90m",
      // Gray
      debug: "\x1B[36m",
      // Cyan
      info: "\x1B[32m",
      // Green
      warn: "\x1B[33m",
      // Yellow
      error: "\x1B[31m",
      // Red
      silent: ""
    };
    const reset = "\x1B[0m";
    const color = this.fileStream ? "" : levelColors[entry.level] || "";
    const time = new Date(entry.time).toISOString().substring(11, 23);
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const contextParts = [];
    for (const [key, value] of Object.entries(entry)) {
      if (key !== "level" && key !== "time" && key !== "msg") {
        contextParts.push(`${key}=${JSON.stringify(value)}`);
      }
    }
    const context = contextParts.length > 0 ? ` ${contextParts.join(" ")}` : "";
    const output = `${color}[${time}] ${levelStr}${reset} ${entry.msg}${context}`;
    if (this.fileStream) {
      const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, "");
      this.fileStream.write(cleanOutput + "\n");
      return;
    }
    switch (entry.level) {
      case "error":
      case "warn":
        console.error(output);
        break;
      default:
        console.log(output);
    }
  }
  /**
   * JSON print for production
   */
  jsonPrint(entry) {
    const json = JSON.stringify(entry);
    if (this.fileStream) {
      this.fileStream.write(json + "\n");
      return;
    }
    switch (this.config.destination) {
      case "stderr":
        console.error(json);
        break;
      default:
        console.log(json);
    }
  }
  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    if (config.level) {
      this.levelValue = LOG_LEVEL_VALUES[config.level];
    }
    if (config.context) {
      this.context = { ...this.context, ...config.context };
    }
    if (config.filePath !== void 0) {
      this.closeFileStream();
      if (config.filePath) {
        this.initFileStream(config.filePath);
      }
    }
  }
  /**
   * Close file stream
   */
  closeFileStream() {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = void 0;
    }
  }
  /**
   * Cleanup resources (call before process exit)
   */
  close() {
    this.closeFileStream();
  }
  /**
   * Get current log level
   */
  getLevel() {
    return this.config.level || "info";
  }
  /**
   * Check if level is enabled
   */
  isLevelEnabled(level) {
    return LOG_LEVEL_VALUES[level] >= this.levelValue;
  }
};
var logger = new FrameworkLogger({
  level: process.env.LOG_LEVEL || "info",
  pretty: process.env.LOG_PRETTY === "true" || process.env.NODE_ENV === "development",
  filePath: process.env.LOG_FILE
});
process.on("exit", () => {
  logger.close();
});
process.on("SIGINT", () => {
  logger.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  logger.close();
  process.exit(0);
});

// src/infrastructure/observability/Metrics.ts
var NoOpMetrics = class {
  increment() {
  }
  gauge() {
  }
  timing() {
  }
  histogram() {
  }
};
var ConsoleMetrics = class {
  prefix;
  constructor(prefix = "oneringai") {
    this.prefix = prefix;
  }
  increment(metric, value = 1, tags) {
    this.log("COUNTER", metric, value, tags);
  }
  gauge(metric, value, tags) {
    this.log("GAUGE", metric, value, tags);
  }
  timing(metric, duration, tags) {
    this.log("TIMING", metric, `${duration}ms`, tags);
  }
  histogram(metric, value, tags) {
    this.log("HISTOGRAM", metric, value, tags);
  }
  log(type, metric, value, tags) {
    const fullMetric = `${this.prefix}.${metric}`;
    const tagsStr = tags ? ` ${JSON.stringify(tags)}` : "";
    console.log(`[METRIC:${type}] ${fullMetric}=${value}${tagsStr}`);
  }
};
var InMemoryMetrics = class {
  counters = /* @__PURE__ */ new Map();
  gauges = /* @__PURE__ */ new Map();
  timings = /* @__PURE__ */ new Map();
  histograms = /* @__PURE__ */ new Map();
  increment(metric, value = 1, tags) {
    const key = this.makeKey(metric, tags);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }
  gauge(metric, value, tags) {
    const key = this.makeKey(metric, tags);
    this.gauges.set(key, value);
  }
  timing(metric, duration, tags) {
    const key = this.makeKey(metric, tags);
    const timings = this.timings.get(key) || [];
    timings.push(duration);
    this.timings.set(key, timings);
  }
  histogram(metric, value, tags) {
    const key = this.makeKey(metric, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }
  makeKey(metric, tags) {
    if (!tags) return metric;
    const tagStr = Object.entries(tags).map(([k, v]) => `${k}:${v}`).sort().join(",");
    return `${metric}{${tagStr}}`;
  }
  /**
   * Get all metrics (for testing)
   */
  getMetrics() {
    return {
      counters: new Map(this.counters),
      gauges: new Map(this.gauges),
      timings: new Map(this.timings),
      histograms: new Map(this.histograms)
    };
  }
  /**
   * Clear all metrics
   */
  clear() {
    this.counters.clear();
    this.gauges.clear();
    this.timings.clear();
    this.histograms.clear();
  }
  /**
   * Get summary statistics for timings
   */
  getTimingStats(metric, tags) {
    const key = this.makeKey(metric, tags);
    const timings = this.timings.get(key);
    if (!timings || timings.length === 0) {
      return null;
    }
    const sorted = [...timings].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      count,
      min: sorted[0] ?? 0,
      max: sorted[count - 1] ?? 0,
      mean: sum / count,
      p50: sorted[Math.floor(count * 0.5)] ?? 0,
      p95: sorted[Math.floor(count * 0.95)] ?? 0,
      p99: sorted[Math.floor(count * 0.99)] ?? 0
    };
  }
};
function createMetricsCollector(type, prefix) {
  const collectorType = process.env.METRICS_COLLECTOR || "noop";
  switch (collectorType) {
    case "console":
      return new ConsoleMetrics(prefix);
    case "inmemory":
      return new InMemoryMetrics();
    default:
      return new NoOpMetrics();
  }
}
var metrics = createMetricsCollector(
  void 0,
  process.env.METRICS_PREFIX || "oneringai"
);

// src/capabilities/agents/ToolRegistry.ts
var ToolRegistry = class {
  tools = /* @__PURE__ */ new Map();
  circuitBreakers = /* @__PURE__ */ new Map();
  logger;
  constructor() {
    this.logger = logger.child({ component: "ToolRegistry" });
  }
  /**
   * Register a new tool
   */
  registerTool(tool) {
    this.tools.set(tool.definition.function.name, tool);
  }
  /**
   * Unregister a tool
   */
  unregisterTool(toolName) {
    this.tools.delete(toolName);
  }
  /**
   * Get or create circuit breaker for a tool
   */
  getCircuitBreaker(toolName, tool) {
    let breaker = this.circuitBreakers.get(toolName);
    if (!breaker) {
      const config = tool.circuitBreaker || {
        failureThreshold: 3,
        successThreshold: 2,
        resetTimeoutMs: 6e4,
        // 1 minute
        windowMs: 3e5
        // 5 minutes
      };
      breaker = new CircuitBreaker(`tool:${toolName}`, config);
      breaker.on("opened", (data) => {
        this.logger.warn(data, `Circuit breaker opened for tool: ${toolName}`);
        metrics.increment("circuit_breaker.opened", 1, {
          breaker: data.name,
          tool: toolName
        });
      });
      breaker.on("closed", (data) => {
        this.logger.info(data, `Circuit breaker closed for tool: ${toolName}`);
        metrics.increment("circuit_breaker.closed", 1, {
          breaker: data.name,
          tool: toolName
        });
      });
      this.circuitBreakers.set(toolName, breaker);
    }
    return breaker;
  }
  /**
   * Execute a tool function
   */
  async execute(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }
    const breaker = this.getCircuitBreaker(toolName, tool);
    this.logger.debug({ toolName, args }, "Tool execution started");
    const startTime = Date.now();
    metrics.increment("tool.executed", 1, { tool: toolName });
    try {
      const result = await breaker.execute(async () => {
        return await tool.execute(args);
      });
      const duration = Date.now() - startTime;
      this.logger.debug({ toolName, duration }, "Tool execution completed");
      metrics.timing("tool.duration", duration, { tool: toolName });
      metrics.increment("tool.success", 1, { tool: toolName });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        toolName,
        error: error.message,
        duration
      }, "Tool execution failed");
      metrics.increment("tool.failed", 1, {
        tool: toolName,
        error: error.name
      });
      throw new ToolExecutionError(
        toolName,
        error.message,
        error
      );
    }
  }
  /**
   * Check if tool is available
   */
  hasToolFunction(toolName) {
    return this.tools.has(toolName);
  }
  /**
   * Get tool definition
   */
  getToolDefinition(toolName) {
    const tool = this.tools.get(toolName);
    return tool?.definition;
  }
  /**
   * List all registered tools
   */
  listTools() {
    return Array.from(this.tools.keys());
  }
  /**
   * Clear all registered tools
   */
  clear() {
    this.tools.clear();
    this.circuitBreakers.clear();
  }
  /**
   * Get circuit breaker states for all tools
   */
  getCircuitBreakerStates() {
    const states = /* @__PURE__ */ new Map();
    for (const [toolName, breaker] of this.circuitBreakers.entries()) {
      states.set(toolName, breaker.getState());
    }
    return states;
  }
  /**
   * Get circuit breaker metrics for a specific tool
   */
  getToolCircuitBreakerMetrics(toolName) {
    const breaker = this.circuitBreakers.get(toolName);
    return breaker?.getMetrics();
  }
  /**
   * Manually reset a tool's circuit breaker
   */
  resetToolCircuitBreaker(toolName) {
    const breaker = this.circuitBreakers.get(toolName);
    if (breaker) {
      breaker.reset();
      this.logger.info({ toolName }, "Tool circuit breaker manually reset");
    }
  }
};

// src/capabilities/agents/ExecutionContext.ts
var ExecutionContext = class {
  // Execution metadata
  executionId;
  startTime;
  iteration = 0;
  // Tool tracking
  toolCalls = /* @__PURE__ */ new Map();
  toolResults = /* @__PURE__ */ new Map();
  // Control state
  paused = false;
  pauseReason;
  cancelled = false;
  cancelReason;
  // User data (for hooks to share state)
  metadata = /* @__PURE__ */ new Map();
  // History storage (memory-safe)
  config;
  iterations = [];
  iterationSummaries = [];
  // Metrics
  metrics = {
    totalDuration: 0,
    llmDuration: 0,
    toolDuration: 0,
    hookDuration: 0,
    iterationCount: 0,
    toolCallCount: 0,
    toolSuccessCount: 0,
    toolFailureCount: 0,
    toolTimeoutCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    errors: []
  };
  // Audit trail
  auditTrail = [];
  constructor(executionId, config = {}) {
    this.executionId = executionId;
    this.startTime = /* @__PURE__ */ new Date();
    this.config = {
      maxHistorySize: config.maxHistorySize || 10,
      historyMode: config.historyMode || "summary",
      maxAuditTrailSize: config.maxAuditTrailSize || 1e3
    };
  }
  /**
   * Add iteration to history (memory-safe)
   */
  addIteration(record) {
    switch (this.config.historyMode) {
      case "none":
        break;
      case "summary":
        this.iterationSummaries.push({
          iteration: record.iteration,
          tokens: record.response.usage.total_tokens,
          toolCount: record.toolCalls.length,
          duration: record.endTime.getTime() - record.startTime.getTime(),
          timestamp: record.startTime
        });
        if (this.iterationSummaries.length > this.config.maxHistorySize) {
          this.iterationSummaries.shift();
        }
        break;
      case "full":
        this.iterations.push(record);
        if (this.iterations.length > this.config.maxHistorySize) {
          this.iterations.shift();
        }
        break;
    }
  }
  /**
   * Get iteration history
   */
  getHistory() {
    return this.config.historyMode === "full" ? this.iterations : this.iterationSummaries;
  }
  /**
   * Add audit entry
   */
  audit(type, details, hookName, toolName) {
    this.auditTrail.push({
      timestamp: /* @__PURE__ */ new Date(),
      type,
      hookName,
      toolName,
      details
    });
    if (this.auditTrail.length > this.config.maxAuditTrailSize) {
      this.auditTrail.shift();
    }
  }
  /**
   * Get audit trail
   */
  getAuditTrail() {
    return this.auditTrail;
  }
  /**
   * Update metrics
   */
  updateMetrics(update) {
    Object.assign(this.metrics, update);
  }
  /**
   * Add tool call to tracking
   */
  addToolCall(toolCall) {
    this.toolCalls.set(toolCall.id, toolCall);
    this.metrics.toolCallCount++;
  }
  /**
   * Add tool result to tracking
   */
  addToolResult(result) {
    this.toolResults.set(result.tool_use_id, result);
    if (result.state === "completed" /* COMPLETED */) {
      this.metrics.toolSuccessCount++;
    } else if (result.state === "failed" /* FAILED */) {
      this.metrics.toolFailureCount++;
    } else if (result.state === "timeout" /* TIMEOUT */) {
      this.metrics.toolTimeoutCount++;
    }
  }
  /**
   * Check resource limits
   */
  checkLimits(limits) {
    if (!limits) return;
    if (limits.maxExecutionTime) {
      const elapsed = Date.now() - this.startTime.getTime();
      if (elapsed > limits.maxExecutionTime) {
        throw new Error(
          `Execution time limit exceeded: ${elapsed}ms > ${limits.maxExecutionTime}ms`
        );
      }
    }
    if (limits.maxToolCalls && this.toolCalls.size > limits.maxToolCalls) {
      throw new Error(
        `Tool call limit exceeded: ${this.toolCalls.size} > ${limits.maxToolCalls}`
      );
    }
    if (limits.maxContextSize) {
      const size = this.estimateSize();
      if (size > limits.maxContextSize) {
        throw new Error(
          `Context size limit exceeded: ${size} bytes > ${limits.maxContextSize} bytes`
        );
      }
    }
  }
  /**
   * Estimate memory usage (rough approximation)
   */
  estimateSize() {
    try {
      const data = {
        toolCalls: Array.from(this.toolCalls.values()),
        toolResults: Array.from(this.toolResults.values()),
        iterations: this.config.historyMode === "full" ? this.iterations : this.iterationSummaries,
        auditTrail: this.auditTrail
      };
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
  /**
   * Cleanup resources and release memory
   * Clears all internal arrays and maps to allow garbage collection
   */
  cleanup() {
    const summary = {
      executionId: this.executionId,
      totalIterations: this.iteration,
      totalToolCalls: this.metrics.toolCallCount,
      totalDuration: Date.now() - this.startTime.getTime(),
      success: !this.cancelled && this.metrics.errors.length === 0
    };
    this.toolCalls.clear();
    this.toolResults.clear();
    this.metadata.clear();
    this.iterations.length = 0;
    this.iterationSummaries.length = 0;
    this.auditTrail.length = 0;
    this.metrics.errors.length = 0;
    this.metadata.set("execution_summary", summary);
  }
  /**
   * Get execution summary
   */
  getSummary() {
    return {
      executionId: this.executionId,
      startTime: this.startTime,
      currentIteration: this.iteration,
      paused: this.paused,
      cancelled: this.cancelled,
      metrics: { ...this.metrics },
      totalDuration: Date.now() - this.startTime.getTime()
    };
  }
};

// src/capabilities/agents/HookManager.ts
var HookManager = class {
  hooks = /* @__PURE__ */ new Map();
  timeout;
  parallel;
  // Per-hook error tracking: hookKey -> consecutive error count
  hookErrorCounts = /* @__PURE__ */ new Map();
  // Disabled hooks that exceeded error threshold
  disabledHooks = /* @__PURE__ */ new Set();
  maxConsecutiveErrors = 3;
  emitter;
  constructor(config = {}, emitter, errorHandling) {
    this.timeout = config.hookTimeout || 5e3;
    this.parallel = config.parallelHooks || false;
    this.emitter = emitter;
    this.maxConsecutiveErrors = errorHandling?.maxConsecutiveErrors || 3;
    this.registerFromConfig(config);
  }
  /**
   * Register hooks from configuration
   */
  registerFromConfig(config) {
    const hookNames = [
      "before:execution",
      "after:execution",
      "before:llm",
      "after:llm",
      "before:tool",
      "after:tool",
      "approve:tool",
      "pause:check"
    ];
    for (const name of hookNames) {
      const hook = config[name];
      if (hook) {
        this.register(name, hook);
      }
    }
  }
  /**
   * Register a hook
   */
  register(name, hook) {
    if (typeof hook !== "function") {
      throw new Error(`Hook must be a function, got: ${typeof hook}`);
    }
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    const existing = this.hooks.get(name);
    if (existing.length >= 10) {
      throw new Error(`Too many hooks for ${name} (max: 10)`);
    }
    existing.push(hook);
  }
  /**
   * Execute hooks for a given name
   */
  async executeHooks(name, context, defaultResult) {
    const hooks = this.hooks.get(name);
    if (!hooks || hooks.length === 0) {
      return defaultResult;
    }
    if (this.parallel && hooks.length > 1) {
      return this.executeHooksParallel(hooks, context, defaultResult);
    }
    return this.executeHooksSequential(hooks, context, defaultResult);
  }
  /**
   * Execute hooks sequentially
   */
  async executeHooksSequential(hooks, context, defaultResult) {
    let result = defaultResult;
    for (let i = 0; i < hooks.length; i++) {
      const hook = hooks[i];
      const hookKey = this.getHookKey(hook, i);
      const hookResult = await this.executeHookSafely(hook, context, hookKey);
      if (hookResult === null) {
        continue;
      }
      result = { ...result, ...hookResult };
      if (hookResult.skip === true) {
        break;
      }
    }
    return result;
  }
  /**
   * Execute hooks in parallel
   */
  async executeHooksParallel(hooks, context, defaultResult) {
    const results = await Promise.all(
      hooks.map((hook, i) => {
        const hookKey = this.getHookKey(hook, i);
        return this.executeHookSafely(hook, context, hookKey);
      })
    );
    const validResults = results.filter((r) => r !== null);
    return validResults.reduce(
      (acc, hookResult) => ({ ...acc, ...hookResult }),
      defaultResult
    );
  }
  /**
   * Generate unique key for a hook
   */
  getHookKey(hook, index) {
    return `${hook.name || "anonymous"}_${index}`;
  }
  /**
   * Execute single hook with error isolation and timeout (with per-hook error tracking)
   */
  async executeHookSafely(hook, context, hookKey) {
    const key = hookKey || hook.name || "anonymous";
    if (this.disabledHooks.has(key)) {
      return null;
    }
    const startTime = Date.now();
    try {
      const result = await Promise.race([
        hook(context),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Hook timeout")), this.timeout)
        )
      ]);
      this.hookErrorCounts.delete(key);
      const duration = Date.now() - startTime;
      if (context.context?.updateMetrics) {
        context.context.updateMetrics({
          hookDuration: (context.context.metrics.hookDuration || 0) + duration
        });
      }
      return result;
    } catch (error) {
      const errorCount = (this.hookErrorCounts.get(key) || 0) + 1;
      this.hookErrorCounts.set(key, errorCount);
      this.emitter.emit("hook:error", {
        executionId: context.executionId,
        hookName: hook.name || "anonymous",
        error,
        consecutiveErrors: errorCount,
        timestamp: /* @__PURE__ */ new Date()
      });
      if (errorCount >= this.maxConsecutiveErrors) {
        this.disabledHooks.add(key);
        console.warn(
          `Hook "${key}" disabled after ${errorCount} consecutive failures. Last error: ${error.message}`
        );
      } else {
        console.warn(
          `Hook execution failed (${key}): ${error.message} (${errorCount}/${this.maxConsecutiveErrors} errors)`
        );
      }
      return null;
    }
  }
  /**
   * Check if there are any hooks registered
   */
  hasHooks(name) {
    const hooks = this.hooks.get(name);
    return !!hooks && hooks.length > 0;
  }
  /**
   * Get hook count
   */
  getHookCount(name) {
    if (name) {
      return this.hooks.get(name)?.length || 0;
    }
    return Array.from(this.hooks.values()).reduce((sum, arr) => sum + arr.length, 0);
  }
  /**
   * Clear all hooks and reset error tracking
   */
  clear() {
    this.hooks.clear();
    this.hookErrorCounts.clear();
    this.disabledHooks.clear();
  }
  /**
   * Re-enable a disabled hook
   */
  enableHook(hookKey) {
    this.disabledHooks.delete(hookKey);
    this.hookErrorCounts.delete(hookKey);
  }
  /**
   * Get list of disabled hooks
   */
  getDisabledHooks() {
    return Array.from(this.disabledHooks);
  }
};

// src/domain/entities/StreamEvent.ts
function isToolCallArgumentsDone(event) {
  return event.type === "response.tool_call_arguments.done" /* TOOL_CALL_ARGUMENTS_DONE */;
}

// src/domain/entities/StreamState.ts
var StreamState = class {
  // Core identifiers
  responseId;
  model;
  createdAt;
  // Text accumulation: item_id -> text chunks
  textBuffers;
  // Tool call accumulation: tool_call_id -> buffer
  toolCallBuffers;
  // Completed tool calls
  completedToolCalls;
  // Tool execution results
  toolResults;
  // Metadata
  currentIteration;
  usage;
  status;
  startTime;
  endTime;
  // Statistics
  totalChunks;
  totalTextDeltas;
  totalToolCalls;
  constructor(responseId, model, createdAt) {
    this.responseId = responseId;
    this.model = model;
    this.createdAt = createdAt || Date.now();
    this.textBuffers = /* @__PURE__ */ new Map();
    this.toolCallBuffers = /* @__PURE__ */ new Map();
    this.completedToolCalls = [];
    this.toolResults = /* @__PURE__ */ new Map();
    this.currentIteration = 0;
    this.usage = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0
    };
    this.status = "in_progress";
    this.startTime = /* @__PURE__ */ new Date();
    this.totalChunks = 0;
    this.totalTextDeltas = 0;
    this.totalToolCalls = 0;
  }
  /**
   * Accumulate text delta for a specific item
   */
  accumulateTextDelta(itemId, delta) {
    if (!this.textBuffers.has(itemId)) {
      this.textBuffers.set(itemId, []);
    }
    this.textBuffers.get(itemId).push(delta);
    this.totalTextDeltas++;
    this.totalChunks++;
  }
  /**
   * Get complete accumulated text for an item
   */
  getCompleteText(itemId) {
    const chunks = this.textBuffers.get(itemId);
    return chunks ? chunks.join("") : "";
  }
  /**
   * Get all accumulated text (all items concatenated)
   */
  getAllText() {
    const allText = [];
    for (const chunks of this.textBuffers.values()) {
      allText.push(chunks.join(""));
    }
    return allText.join("");
  }
  /**
   * Start accumulating tool call arguments
   */
  startToolCall(toolCallId, toolName) {
    this.toolCallBuffers.set(toolCallId, {
      toolName,
      argumentChunks: [],
      isComplete: false,
      startTime: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Accumulate tool argument delta
   */
  accumulateToolArguments(toolCallId, delta) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    if (!buffer) {
      throw new Error(`Tool call buffer not found for id: ${toolCallId}`);
    }
    buffer.argumentChunks.push(delta);
    this.totalChunks++;
  }
  /**
   * Mark tool call arguments as complete
   */
  completeToolCall(toolCallId) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    if (!buffer) {
      throw new Error(`Tool call buffer not found for id: ${toolCallId}`);
    }
    buffer.isComplete = true;
    this.totalToolCalls++;
  }
  /**
   * Get complete tool arguments (joined chunks)
   */
  getCompleteToolArguments(toolCallId) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    if (!buffer) {
      throw new Error(`Tool call buffer not found for id: ${toolCallId}`);
    }
    return buffer.argumentChunks.join("");
  }
  /**
   * Check if tool call is complete
   */
  isToolCallComplete(toolCallId) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    return buffer ? buffer.isComplete : false;
  }
  /**
   * Get tool name for a tool call
   */
  getToolName(toolCallId) {
    return this.toolCallBuffers.get(toolCallId)?.toolName;
  }
  /**
   * Add completed tool call
   */
  addCompletedToolCall(toolCall) {
    this.completedToolCalls.push(toolCall);
  }
  /**
   * Get all completed tool calls
   */
  getCompletedToolCalls() {
    return [...this.completedToolCalls];
  }
  /**
   * Store tool execution result
   */
  setToolResult(toolCallId, result) {
    this.toolResults.set(toolCallId, result);
  }
  /**
   * Get tool execution result
   */
  getToolResult(toolCallId) {
    return this.toolResults.get(toolCallId);
  }
  /**
   * Update token usage (replaces values, doesn't accumulate)
   */
  updateUsage(usage) {
    if (usage.input_tokens !== void 0) {
      this.usage.input_tokens = usage.input_tokens;
    }
    if (usage.output_tokens !== void 0) {
      this.usage.output_tokens = usage.output_tokens;
    }
    if (usage.total_tokens !== void 0) {
      this.usage.total_tokens = usage.total_tokens;
    } else {
      this.usage.total_tokens = this.usage.input_tokens + this.usage.output_tokens;
    }
  }
  /**
   * Accumulate token usage (adds to existing values)
   */
  accumulateUsage(usage) {
    if (usage.input_tokens !== void 0) {
      this.usage.input_tokens += usage.input_tokens;
    }
    if (usage.output_tokens !== void 0) {
      this.usage.output_tokens += usage.output_tokens;
    }
    if (usage.total_tokens !== void 0) {
      this.usage.total_tokens += usage.total_tokens;
    } else {
      this.usage.total_tokens = this.usage.input_tokens + this.usage.output_tokens;
    }
  }
  /**
   * Mark stream as complete
   */
  markComplete(status = "completed") {
    this.status = status;
    this.endTime = /* @__PURE__ */ new Date();
  }
  /**
   * Get duration in milliseconds
   */
  getDuration() {
    const end = this.endTime || /* @__PURE__ */ new Date();
    return end.getTime() - this.startTime.getTime();
  }
  /**
   * Increment iteration counter
   */
  incrementIteration() {
    this.currentIteration++;
  }
  /**
   * Get summary statistics
   */
  getStatistics() {
    return {
      responseId: this.responseId,
      model: this.model,
      status: this.status,
      iterations: this.currentIteration,
      totalChunks: this.totalChunks,
      totalTextDeltas: this.totalTextDeltas,
      totalToolCalls: this.totalToolCalls,
      textItemsCount: this.textBuffers.size,
      toolCallBuffersCount: this.toolCallBuffers.size,
      completedToolCallsCount: this.completedToolCalls.length,
      durationMs: this.getDuration(),
      usage: { ...this.usage }
    };
  }
  /**
   * Check if stream has any accumulated text
   */
  hasText() {
    return this.textBuffers.size > 0;
  }
  /**
   * Check if stream has any tool calls
   */
  hasToolCalls() {
    return this.toolCallBuffers.size > 0;
  }
  /**
   * Clear all buffers (for memory management)
   */
  clear() {
    this.textBuffers.clear();
    this.toolCallBuffers.clear();
    this.completedToolCalls = [];
    this.toolResults.clear();
  }
  /**
   * Create a snapshot for checkpointing (error recovery)
   */
  createSnapshot() {
    return {
      responseId: this.responseId,
      model: this.model,
      createdAt: this.createdAt,
      textBuffers: new Map(this.textBuffers),
      toolCallBuffers: new Map(this.toolCallBuffers),
      completedToolCalls: [...this.completedToolCalls],
      toolResults: new Map(this.toolResults),
      currentIteration: this.currentIteration,
      usage: { ...this.usage },
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime
    };
  }
};

// src/capabilities/agents/AgenticLoop.ts
var AgenticLoop = class extends EventEmitter {
  constructor(provider, toolExecutor, hookConfig, errorHandling) {
    super();
    this.provider = provider;
    this.toolExecutor = toolExecutor;
    this.hookManager = new HookManager(
      hookConfig || {},
      this,
      errorHandling
    );
  }
  hookManager;
  context = null;
  // Pause/resume state
  paused = false;
  pausePromise = null;
  resumeCallback = null;
  cancelled = false;
  // Mutex to prevent race conditions in pause/resume
  pauseResumeMutex = Promise.resolve();
  /**
   * Execute agentic loop with tool calling
   */
  async execute(config) {
    const executionId = `exec_${randomUUID()}`;
    this.context = new ExecutionContext(executionId, {
      maxHistorySize: 10,
      historyMode: config.historyMode || "summary",
      maxAuditTrailSize: 1e3
    });
    this.paused = false;
    this.cancelled = false;
    this.emit("execution:start", {
      executionId,
      config,
      timestamp: /* @__PURE__ */ new Date()
    });
    await this.hookManager.executeHooks("before:execution", {
      executionId,
      config,
      timestamp: /* @__PURE__ */ new Date()
    }, void 0);
    let currentInput = config.input;
    let iteration = 0;
    let finalResponse;
    try {
      while (iteration < config.maxIterations) {
        await this.checkPause();
        if (this.cancelled) {
          throw new Error("Execution cancelled");
        }
        this.context.checkLimits(config.limits);
        const pauseCheck = await this.hookManager.executeHooks("pause:check", {
          executionId,
          iteration,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, { shouldPause: false });
        if (pauseCheck.shouldPause) {
          this.pause(pauseCheck.reason || "Hook requested pause");
          await this.checkPause();
        }
        this.context.iteration = iteration;
        this.emit("iteration:start", {
          executionId,
          iteration,
          timestamp: /* @__PURE__ */ new Date()
        });
        const iterationStartTime = Date.now();
        const response = await this.generateWithHooks(config, currentInput, iteration, executionId);
        const toolCalls = this.extractToolCalls(response.output, config.tools);
        if (toolCalls.length > 0) {
          this.emit("tool:detected", {
            executionId,
            iteration,
            toolCalls,
            timestamp: /* @__PURE__ */ new Date()
          });
        }
        if (toolCalls.length === 0) {
          this.emit("iteration:complete", {
            executionId,
            iteration,
            response,
            timestamp: /* @__PURE__ */ new Date(),
            duration: Date.now() - iterationStartTime
          });
          finalResponse = response;
          break;
        }
        const toolResults = await this.executeToolsWithHooks(toolCalls, iteration, executionId, config);
        this.context.addIteration({
          iteration,
          request: {
            model: config.model,
            input: currentInput,
            instructions: config.instructions,
            tools: config.tools,
            temperature: config.temperature
          },
          response,
          toolCalls,
          toolResults,
          startTime: new Date(iterationStartTime),
          endTime: /* @__PURE__ */ new Date()
        });
        this.context.updateMetrics({
          iterationCount: iteration + 1,
          inputTokens: this.context.metrics.inputTokens + (response.usage?.input_tokens || 0),
          outputTokens: this.context.metrics.outputTokens + (response.usage?.output_tokens || 0),
          totalTokens: this.context.metrics.totalTokens + (response.usage?.total_tokens || 0)
        });
        this.emit("iteration:complete", {
          executionId,
          iteration,
          response,
          timestamp: /* @__PURE__ */ new Date(),
          duration: Date.now() - iterationStartTime
        });
        const newMessages = this.buildNewMessages(response.output, toolResults);
        currentInput = this.appendToContext(currentInput, newMessages);
        const maxInputMessages = config.limits?.maxInputMessages ?? 50;
        currentInput = this.applySlidingWindow(currentInput, maxInputMessages);
        iteration++;
      }
      if (iteration >= config.maxIterations) {
        throw new Error(`Max iterations (${config.maxIterations}) reached without completion`);
      }
      const totalDuration = Date.now() - this.context.startTime.getTime();
      this.context.updateMetrics({ totalDuration });
      await this.hookManager.executeHooks("after:execution", {
        executionId,
        response: finalResponse,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date(),
        duration: totalDuration
      }, void 0);
      this.emit("execution:complete", {
        executionId,
        response: finalResponse,
        timestamp: /* @__PURE__ */ new Date(),
        duration: totalDuration
      });
      return finalResponse;
    } catch (error) {
      this.emit("execution:error", {
        executionId,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      this.context?.metrics.errors.push({
        type: "execution_error",
        message: error.message,
        timestamp: /* @__PURE__ */ new Date()
      });
      throw error;
    } finally {
      this.context?.cleanup();
      this.hookManager.clear();
    }
  }
  /**
   * Execute agentic loop with streaming and tool calling
   */
  async *executeStreaming(config) {
    const executionId = `exec_${randomUUID()}`;
    this.context = new ExecutionContext(executionId, {
      maxHistorySize: 10,
      historyMode: config.historyMode || "summary",
      maxAuditTrailSize: 1e3
    });
    this.paused = false;
    this.cancelled = false;
    this.pausePromise = null;
    this.resumeCallback = null;
    const startTime = Date.now();
    let iteration = 0;
    let currentInput = config.input;
    const globalStreamState = new StreamState(executionId, config.model);
    try {
      this.emit("execution:start", {
        executionId,
        model: config.model,
        timestamp: /* @__PURE__ */ new Date()
      });
      await this.hookManager.executeHooks("before:execution", {
        executionId,
        config,
        timestamp: /* @__PURE__ */ new Date()
      }, void 0);
      while (iteration < config.maxIterations) {
        iteration++;
        await this.checkPause();
        if (this.cancelled) {
          this.emit("execution:cancelled", { executionId, iteration, timestamp: /* @__PURE__ */ new Date() });
          break;
        }
        if (this.context) {
          this.context.checkLimits(config.limits);
        }
        const pauseCheck = await this.hookManager.executeHooks("pause:check", {
          executionId,
          iteration,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, { shouldPause: false });
        if (pauseCheck.shouldPause) {
          this.pause();
        }
        this.emit("iteration:start", {
          executionId,
          iteration,
          timestamp: /* @__PURE__ */ new Date()
        });
        const iterationStreamState = new StreamState(executionId, config.model);
        const toolCallsMap = /* @__PURE__ */ new Map();
        yield* this.streamGenerateWithHooks(config, currentInput, iteration, executionId, iterationStreamState, toolCallsMap);
        globalStreamState.accumulateUsage(iterationStreamState.usage);
        const toolCalls = [];
        for (const [toolCallId, buffer] of toolCallsMap) {
          toolCalls.push({
            id: toolCallId,
            type: "function",
            function: {
              name: buffer.name,
              arguments: buffer.args
            },
            blocking: true,
            state: "pending" /* PENDING */
          });
        }
        if (toolCalls.length === 0) {
          yield {
            type: "response.iteration.complete" /* ITERATION_COMPLETE */,
            response_id: executionId,
            iteration,
            tool_calls_count: 0,
            has_more_iterations: false
          };
          yield {
            type: "response.complete" /* RESPONSE_COMPLETE */,
            response_id: executionId,
            status: "completed",
            usage: globalStreamState.usage,
            iterations: iteration,
            duration_ms: Date.now() - startTime
          };
          break;
        }
        const toolResults = [];
        for (const toolCall of toolCalls) {
          let parsedArgs;
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            yield {
              type: "response.tool_execution.done" /* TOOL_EXECUTION_DONE */,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: null,
              execution_time_ms: 0,
              error: `Invalid tool arguments JSON: ${error.message}`
            };
            continue;
          }
          yield {
            type: "response.tool_execution.start" /* TOOL_EXECUTION_START */,
            response_id: executionId,
            tool_call_id: toolCall.id,
            tool_name: toolCall.function.name,
            arguments: parsedArgs
          };
          const toolStartTime = Date.now();
          try {
            const result = await this.executeToolWithHooks(toolCall, iteration, executionId, config);
            toolResults.push(result);
            yield {
              type: "response.tool_execution.done" /* TOOL_EXECUTION_DONE */,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: result.content,
              execution_time_ms: Date.now() - toolStartTime
            };
          } catch (error) {
            yield {
              type: "response.tool_execution.done" /* TOOL_EXECUTION_DONE */,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: null,
              execution_time_ms: Date.now() - toolStartTime,
              error: error.message
            };
            const failureMode = config.errorHandling?.toolFailureMode || "continue";
            if (failureMode === "fail") {
              throw error;
            }
            toolResults.push({
              tool_use_id: toolCall.id,
              content: "",
              error: error.message,
              state: "failed" /* FAILED */
            });
          }
        }
        const assistantMessage = {
          type: "message",
          role: "assistant" /* ASSISTANT */,
          content: [
            {
              type: "output_text" /* OUTPUT_TEXT */,
              text: iterationStreamState.getAllText()
            },
            ...toolCalls.map((tc) => ({
              type: "tool_use" /* TOOL_USE */,
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments
            }))
          ]
        };
        const toolResultsMessage = {
          type: "message",
          role: "user" /* USER */,
          content: toolResults.map((tr) => ({
            type: "tool_result" /* TOOL_RESULT */,
            tool_use_id: tr.tool_use_id,
            content: tr.content,
            error: tr.error
          }))
        };
        const newMessages = [assistantMessage, toolResultsMessage];
        currentInput = this.appendToContext(currentInput, newMessages);
        const maxInputMessages = config.limits?.maxInputMessages ?? 50;
        currentInput = this.applySlidingWindow(currentInput, maxInputMessages);
        yield {
          type: "response.iteration.complete" /* ITERATION_COMPLETE */,
          response_id: executionId,
          iteration,
          tool_calls_count: toolCalls.length,
          has_more_iterations: true
        };
        if (this.context) {
          globalStreamState.incrementIteration();
        }
        iterationStreamState.clear();
        toolCallsMap.clear();
      }
      if (iteration >= config.maxIterations) {
        yield {
          type: "response.complete" /* RESPONSE_COMPLETE */,
          response_id: executionId,
          status: "incomplete",
          // Incomplete because we hit max iterations
          usage: globalStreamState.usage,
          iterations: iteration,
          duration_ms: Date.now() - startTime
        };
      }
      await this.hookManager.executeHooks("after:execution", {
        executionId,
        response: null,
        // We don't have a complete response in streaming
        context: this.context,
        timestamp: /* @__PURE__ */ new Date(),
        duration: Date.now() - startTime
      }, void 0);
      this.emit("execution:complete", {
        executionId,
        iterations: iteration,
        duration: Date.now() - startTime,
        timestamp: /* @__PURE__ */ new Date()
      });
    } catch (error) {
      this.emit("execution:error", {
        executionId,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      yield {
        type: "response.error" /* ERROR */,
        response_id: executionId,
        error: {
          type: "execution_error",
          message: error.message
        },
        recoverable: false
      };
      throw error;
    } finally {
      globalStreamState.clear();
      this.context?.cleanup();
      this.hookManager.clear();
    }
  }
  /**
   * Stream LLM response with hooks
   * @private
   */
  async *streamGenerateWithHooks(config, input, iteration, executionId, streamState, toolCallsMap) {
    const llmStartTime = Date.now();
    let generateOptions = {
      model: config.model,
      input,
      instructions: config.instructions,
      tools: config.tools,
      tool_choice: "auto",
      temperature: config.temperature,
      vendorOptions: config.vendorOptions
    };
    await this.hookManager.executeHooks("before:llm", {
      executionId,
      iteration,
      options: generateOptions,
      context: this.context,
      timestamp: /* @__PURE__ */ new Date()
    }, {});
    this.emit("llm:request", {
      executionId,
      iteration,
      model: config.model,
      timestamp: /* @__PURE__ */ new Date()
    });
    try {
      for await (const event of this.provider.streamGenerate(generateOptions)) {
        if (event.type === "response.output_text.delta" /* OUTPUT_TEXT_DELTA */) {
          streamState.accumulateTextDelta(event.item_id, event.delta);
        } else if (event.type === "response.tool_call.start" /* TOOL_CALL_START */) {
          streamState.startToolCall(event.tool_call_id, event.tool_name);
          toolCallsMap.set(event.tool_call_id, { name: event.tool_name, args: "" });
        } else if (event.type === "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */) {
          streamState.accumulateToolArguments(event.tool_call_id, event.delta);
          const buffer = toolCallsMap.get(event.tool_call_id);
          if (buffer) {
            buffer.args += event.delta;
          }
        } else if (isToolCallArgumentsDone(event)) {
          streamState.completeToolCall(event.tool_call_id);
          const buffer = toolCallsMap.get(event.tool_call_id);
          if (buffer) {
            buffer.args = event.arguments;
          }
        } else if (event.type === "response.complete" /* RESPONSE_COMPLETE */) {
          streamState.updateUsage(event.usage);
          if (process.env.DEBUG_STREAMING) {
            console.error("[DEBUG] Captured usage from provider:", event.usage);
            console.error("[DEBUG] StreamState usage after update:", streamState.usage);
          }
          continue;
        }
        yield event;
      }
      if (this.context) {
        this.context.metrics.llmDuration += Date.now() - llmStartTime;
        this.context.metrics.inputTokens += streamState.usage.input_tokens;
        this.context.metrics.outputTokens += streamState.usage.output_tokens;
        this.context.metrics.totalTokens += streamState.usage.total_tokens;
      }
      if (process.env.DEBUG_STREAMING) {
        console.error("[DEBUG] Stream iteration complete, usage:", streamState.usage);
      }
      await this.hookManager.executeHooks("after:llm", {
        executionId,
        iteration,
        response: null,
        // Streaming doesn't have complete response yet
        context: this.context,
        timestamp: /* @__PURE__ */ new Date(),
        duration: Date.now() - llmStartTime
      }, {});
      this.emit("llm:response", {
        executionId,
        iteration,
        timestamp: /* @__PURE__ */ new Date()
      });
    } catch (error) {
      this.emit("llm:error", {
        executionId,
        iteration,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      throw error;
    }
  }
  /**
   * Check tool permission before execution
   * Returns true if approved, throws if blocked/rejected
   * @private
   */
  async checkToolPermission(toolCall, iteration, executionId, config) {
    const permissionManager = config.permissionManager;
    if (!permissionManager) {
      return true;
    }
    const toolName = toolCall.function.name;
    if (permissionManager.isBlocked(toolName)) {
      this.context?.audit("tool_blocked", { reason: "Tool is blocklisted" }, void 0, toolName);
      throw new Error(`Tool "${toolName}" is blocked and cannot be executed`);
    }
    if (permissionManager.isApproved(toolName)) {
      return true;
    }
    const checkResult = permissionManager.checkPermission(toolName);
    if (!checkResult.needsApproval) {
      return true;
    }
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
    }
    const context = {
      toolCall,
      parsedArgs,
      config: checkResult.config || {},
      executionId,
      iteration,
      agentType: config.agentType || "agent",
      taskName: config.taskName
    };
    const decision = await permissionManager.requestApproval(context);
    if (decision.approved) {
      this.context?.audit("tool_permission_approved", {
        scope: decision.scope,
        approvedBy: decision.approvedBy
      }, void 0, toolName);
      return true;
    }
    return false;
  }
  /**
   * Execute single tool with hooks
   * @private
   */
  async executeToolWithHooks(toolCall, iteration, executionId, config) {
    const toolStartTime = Date.now();
    toolCall.state = "executing" /* EXECUTING */;
    toolCall.startTime = /* @__PURE__ */ new Date();
    await this.hookManager.executeHooks("before:tool", {
      executionId,
      iteration,
      toolCall,
      context: this.context,
      timestamp: /* @__PURE__ */ new Date()
    }, {});
    const permissionApproved = await this.checkToolPermission(toolCall, iteration, executionId, config);
    if (!permissionApproved || this.hookManager.hasHooks("approve:tool")) {
      const approval = await this.hookManager.executeHooks("approve:tool", {
        executionId,
        iteration,
        toolCall,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date()
      }, { approved: permissionApproved });
      if (!approval.approved) {
        throw new Error(`Tool execution rejected: ${approval.reason || "No reason provided"}`);
      }
    }
    this.emit("tool:start", {
      executionId,
      iteration,
      toolCall,
      timestamp: /* @__PURE__ */ new Date()
    });
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await this.executeWithTimeout(
        () => this.toolExecutor.execute(toolCall.function.name, args),
        config.toolTimeout ?? 3e4
      );
      const toolResult = {
        tool_use_id: toolCall.id,
        content: result,
        executionTime: Date.now() - toolStartTime,
        state: "completed" /* COMPLETED */
      };
      toolCall.state = "completed" /* COMPLETED */;
      toolCall.endTime = /* @__PURE__ */ new Date();
      await this.hookManager.executeHooks("after:tool", {
        executionId,
        iteration,
        toolCall,
        result: toolResult,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date()
      }, {});
      if (this.context) {
        this.context.metrics.toolCallCount++;
        this.context.metrics.toolSuccessCount++;
        this.context.metrics.toolDuration += toolResult.executionTime || 0;
      }
      this.emit("tool:complete", {
        executionId,
        iteration,
        toolCall,
        result: toolResult,
        timestamp: /* @__PURE__ */ new Date()
      });
      return toolResult;
    } catch (error) {
      toolCall.state = "failed" /* FAILED */;
      toolCall.endTime = /* @__PURE__ */ new Date();
      toolCall.error = error.message;
      if (this.context) {
        this.context.metrics.toolFailureCount++;
      }
      this.emit("tool:error", {
        executionId,
        iteration,
        toolCall,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      throw error;
    }
  }
  /**
   * Generate LLM response with hooks
   */
  async generateWithHooks(config, input, iteration, executionId) {
    const llmStartTime = Date.now();
    let generateOptions = {
      model: config.model,
      input,
      instructions: config.instructions,
      tools: config.tools,
      tool_choice: "auto",
      temperature: config.temperature,
      vendorOptions: config.vendorOptions
    };
    const beforeLLM = await this.hookManager.executeHooks("before:llm", {
      executionId,
      iteration,
      options: generateOptions,
      context: this.context,
      timestamp: /* @__PURE__ */ new Date()
    }, {});
    if (beforeLLM.modified) {
      generateOptions = { ...generateOptions, ...beforeLLM.modified };
    }
    if (beforeLLM.skip) {
      throw new Error("LLM call skipped by hook");
    }
    this.emit("llm:request", {
      executionId,
      iteration,
      options: generateOptions,
      timestamp: /* @__PURE__ */ new Date()
    });
    try {
      const response = await this.provider.generate(generateOptions);
      const llmDuration = Date.now() - llmStartTime;
      this.context?.updateMetrics({
        llmDuration: (this.context.metrics.llmDuration || 0) + llmDuration
      });
      this.emit("llm:response", {
        executionId,
        iteration,
        response,
        timestamp: /* @__PURE__ */ new Date(),
        duration: llmDuration
      });
      await this.hookManager.executeHooks("after:llm", {
        executionId,
        iteration,
        response,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date(),
        duration: llmDuration
      }, {});
      return response;
    } catch (error) {
      this.emit("llm:error", {
        executionId,
        iteration,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      throw error;
    }
  }
  /**
   * Execute tools with hooks
   */
  async executeToolsWithHooks(toolCalls, iteration, executionId, config) {
    const results = [];
    for (const toolCall of toolCalls) {
      this.context?.addToolCall(toolCall);
      await this.checkPause();
      const beforeTool = await this.hookManager.executeHooks("before:tool", {
        executionId,
        iteration,
        toolCall,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date()
      }, {});
      if (beforeTool.skip) {
        this.context?.audit("tool_skipped", { toolCall }, void 0, toolCall.function.name);
        const mockResult = {
          tool_use_id: toolCall.id,
          content: beforeTool.mockResult || "",
          state: "completed" /* COMPLETED */,
          executionTime: 0
        };
        results.push(mockResult);
        this.context?.addToolResult(mockResult);
        continue;
      }
      if (beforeTool.modified) {
        Object.assign(toolCall, beforeTool.modified);
        this.context?.audit("tool_modified", { modifications: beforeTool.modified }, void 0, toolCall.function.name);
      }
      let permissionApproved = true;
      try {
        permissionApproved = await this.checkToolPermission(toolCall, iteration, executionId, config);
      } catch (error) {
        this.context?.audit("tool_blocked", { reason: error.message }, void 0, toolCall.function.name);
        const blockedResult = {
          tool_use_id: toolCall.id,
          content: "",
          error: error.message,
          state: "failed" /* FAILED */
        };
        results.push(blockedResult);
        this.context?.addToolResult(blockedResult);
        continue;
      }
      if (!permissionApproved || this.hookManager.hasHooks("approve:tool")) {
        const approval = await this.hookManager.executeHooks("approve:tool", {
          executionId,
          iteration,
          toolCall,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, { approved: permissionApproved });
        if (!approval.approved) {
          this.context?.audit("tool_rejected", { reason: approval.reason }, void 0, toolCall.function.name);
          const rejectedResult = {
            tool_use_id: toolCall.id,
            content: "",
            error: `Tool rejected: ${approval.reason || "Not approved"}`,
            state: "failed" /* FAILED */
          };
          results.push(rejectedResult);
          this.context?.addToolResult(rejectedResult);
          continue;
        }
        this.context?.audit("tool_approved", { reason: approval.reason }, void 0, toolCall.function.name);
      }
      toolCall.state = "executing" /* EXECUTING */;
      toolCall.startTime = /* @__PURE__ */ new Date();
      this.emit("tool:start", {
        executionId,
        iteration,
        toolCall,
        timestamp: /* @__PURE__ */ new Date()
      });
      const toolStartTime = Date.now();
      try {
        const timeout = config.toolTimeout ?? 3e4;
        const result = await this.executeWithTimeout(
          () => this.toolExecutor.execute(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          ),
          timeout
        );
        toolCall.state = "completed" /* COMPLETED */;
        toolCall.endTime = /* @__PURE__ */ new Date();
        let toolResult = {
          tool_use_id: toolCall.id,
          content: result,
          state: "completed" /* COMPLETED */,
          executionTime: Date.now() - toolStartTime
        };
        const afterTool = await this.hookManager.executeHooks("after:tool", {
          executionId,
          iteration,
          toolCall,
          result: toolResult,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, {});
        if (afterTool.modified) {
          toolResult = { ...toolResult, ...afterTool.modified };
        }
        results.push(toolResult);
        this.context?.addToolResult(toolResult);
        this.context?.updateMetrics({
          toolDuration: (this.context.metrics.toolDuration || 0) + toolResult.executionTime
        });
        this.emit("tool:complete", {
          executionId,
          iteration,
          toolCall,
          result: toolResult,
          timestamp: /* @__PURE__ */ new Date()
        });
      } catch (error) {
        toolCall.state = "failed" /* FAILED */;
        toolCall.endTime = /* @__PURE__ */ new Date();
        toolCall.error = error.message;
        const toolResult = {
          tool_use_id: toolCall.id,
          content: "",
          error: error.message,
          state: "failed" /* FAILED */
        };
        results.push(toolResult);
        this.context?.addToolResult(toolResult);
        this.context?.metrics.errors.push({
          type: "tool_error",
          message: error.message,
          timestamp: /* @__PURE__ */ new Date()
        });
        if (error instanceof ToolTimeoutError) {
          this.emit("tool:timeout", {
            executionId,
            iteration,
            toolCall,
            timeout: config.toolTimeout ?? 3e4,
            timestamp: /* @__PURE__ */ new Date()
          });
        } else {
          this.emit("tool:error", {
            executionId,
            iteration,
            toolCall,
            error,
            timestamp: /* @__PURE__ */ new Date()
          });
        }
        const failureMode = config.errorHandling?.toolFailureMode || "continue";
        if (failureMode === "fail") {
          throw error;
        }
      }
    }
    return results;
  }
  /**
   * Extract tool calls from response output
   */
  extractToolCalls(output, toolDefinitions) {
    const toolCalls = [];
    const toolMap = /* @__PURE__ */ new Map();
    for (const tool of toolDefinitions) {
      if (tool.type === "function") {
        toolMap.set(tool.function.name, tool);
      }
    }
    for (const item of output) {
      if (item.type === "message" && item.role === "assistant" /* ASSISTANT */) {
        for (const content of item.content) {
          if (content.type === "tool_use" /* TOOL_USE */) {
            const toolDef = toolMap.get(content.name);
            const isBlocking = toolDef?.blocking !== false;
            const toolCall = {
              id: content.id,
              type: "function",
              function: {
                name: content.name,
                arguments: content.arguments
              },
              blocking: isBlocking,
              state: "pending" /* PENDING */
            };
            toolCalls.push(toolCall);
          }
        }
      }
    }
    return toolCalls;
  }
  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError("tool", timeoutMs));
      }, timeoutMs);
      fn().then((result) => {
        clearTimeout(timer);
        resolve(result);
      }).catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  // ============ Shared Helper Methods ============
  // These methods provide unified logic for both execute() and executeStreaming()
  /**
   * Build new messages from tool results (assistant response + tool results)
   */
  buildNewMessages(previousOutput, toolResults) {
    const messages = [];
    for (const item of previousOutput) {
      if (item.type === "message") {
        messages.push(item);
      }
    }
    const toolResultContents = toolResults.map((result) => ({
      type: "tool_result" /* TOOL_RESULT */,
      tool_use_id: result.tool_use_id,
      content: result.content,
      error: result.error
    }));
    if (toolResultContents.length > 0) {
      messages.push({
        type: "message",
        role: "user" /* USER */,
        content: toolResultContents
      });
    }
    return messages;
  }
  /**
   * Append new messages to current context, preserving history
   * Unified logic for both execute() and executeStreaming()
   */
  appendToContext(currentInput, newMessages) {
    if (Array.isArray(currentInput)) {
      return [...currentInput, ...newMessages];
    }
    return [
      {
        type: "message",
        role: "user" /* USER */,
        content: [{ type: "input_text" /* INPUT_TEXT */, text: currentInput }]
      },
      ...newMessages
    ];
  }
  /**
   * Apply sliding window to prevent unbounded input growth
   * Preserves system/developer message at the start if present
   * IMPORTANT: Ensures tool_use and tool_result pairs are never broken
   */
  applySlidingWindow(input, maxMessages = 50) {
    if (input.length <= maxMessages) {
      return input;
    }
    const firstMessage = input[0];
    const isSystemMessage = firstMessage?.type === "message" && firstMessage.role === "developer" /* DEVELOPER */;
    const maxToKeep = isSystemMessage ? maxMessages - 1 : maxMessages;
    const safeCutIndex = this.findSafeToolBoundary(input, input.length - maxToKeep);
    const recentMessages = input.slice(safeCutIndex);
    if (isSystemMessage) {
      return [firstMessage, ...recentMessages];
    }
    return recentMessages;
  }
  /**
   * Find a safe index to cut the message array without breaking tool call/result pairs
   * A safe boundary is one where all tool_use IDs have matching tool_result IDs
   */
  findSafeToolBoundary(input, targetIndex) {
    let cutIndex = Math.max(0, Math.min(targetIndex, input.length - 1));
    while (cutIndex < input.length - 1) {
      if (this.isToolBoundarySafe(input, cutIndex)) {
        return cutIndex;
      }
      cutIndex++;
    }
    cutIndex = Math.max(0, targetIndex);
    while (cutIndex > 0) {
      if (this.isToolBoundarySafe(input, cutIndex)) {
        return cutIndex;
      }
      cutIndex--;
    }
    return Math.max(0, targetIndex);
  }
  /**
   * Check if cutting at this index would leave tool calls/results balanced
   * Returns true if all tool_use IDs in the slice have matching tool_result IDs
   */
  isToolBoundarySafe(input, startIndex) {
    const slicedMessages = input.slice(startIndex);
    const toolUseIds = /* @__PURE__ */ new Set();
    const toolResultIds = /* @__PURE__ */ new Set();
    for (const item of slicedMessages) {
      if (item.type !== "message") continue;
      for (const content of item.content) {
        if (content.type === "tool_use" /* TOOL_USE */) {
          toolUseIds.add(content.id);
        } else if (content.type === "tool_result" /* TOOL_RESULT */) {
          toolResultIds.add(content.tool_use_id);
        }
      }
    }
    for (const resultId of toolResultIds) {
      if (!toolUseIds.has(resultId)) {
        return false;
      }
    }
    for (const useId of toolUseIds) {
      if (!toolResultIds.has(useId)) {
        const lastMessage = slicedMessages[slicedMessages.length - 1];
        const isLastMessageWithThisToolUse = lastMessage?.type === "message" && lastMessage.role === "assistant" /* ASSISTANT */ && lastMessage.content.some(
          (c) => c.type === "tool_use" /* TOOL_USE */ && c.id === useId
        );
        if (!isLastMessageWithThisToolUse) {
          return false;
        }
      }
    }
    return true;
  }
  /**
   * Pause execution (thread-safe with mutex)
   */
  pause(reason) {
    this.pauseResumeMutex = this.pauseResumeMutex.then(() => {
      this._doPause(reason);
    });
  }
  /**
   * Internal pause implementation
   */
  _doPause(reason) {
    if (this.paused) return;
    this.paused = true;
    this.pausePromise = new Promise((resolve) => {
      this.resumeCallback = resolve;
    });
    if (this.context) {
      this.context.paused = true;
      this.context.pauseReason = reason;
      this.context.audit("execution_paused", { reason });
    }
    this.emit("execution:paused", {
      executionId: this.context?.executionId || "unknown",
      reason: reason || "Manual pause",
      timestamp: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Resume execution (thread-safe with mutex)
   */
  resume() {
    this.pauseResumeMutex = this.pauseResumeMutex.then(() => {
      this._doResume();
    });
  }
  /**
   * Internal resume implementation
   */
  _doResume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.context) {
      this.context.paused = false;
      this.context.pauseReason = void 0;
      this.context.audit("execution_resumed", {});
    }
    if (this.resumeCallback) {
      this.resumeCallback();
      this.resumeCallback = null;
    }
    this.pausePromise = null;
    this.emit("execution:resumed", {
      executionId: this.context?.executionId || "unknown",
      timestamp: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Cancel execution
   */
  cancel(reason) {
    this.cancelled = true;
    if (this.context) {
      this.context.cancelled = true;
      this.context.cancelReason = reason;
    }
    if (this.paused) {
      this._doResume();
    }
    this.emit("execution:cancelled", {
      executionId: this.context?.executionId || "unknown",
      reason: reason || "Manual cancellation",
      timestamp: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Check if paused and wait
   */
  async checkPause() {
    if (this.paused && this.pausePromise) {
      await this.pausePromise;
    }
  }
  /**
   * Get current execution context
   */
  getContext() {
    return this.context;
  }
  /**
   * Check if currently executing
   */
  isRunning() {
    return this.context !== null && !this.cancelled;
  }
  /**
   * Check if paused
   */
  isPaused() {
    return this.paused;
  }
  /**
   * Check if cancelled
   */
  isCancelled() {
    return this.cancelled;
  }
};

export { AgenticLoop, ExecutionContext, HookManager, ToolRegistry };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map