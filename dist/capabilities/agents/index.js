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
   * Unregister a specific hook function by reference.
   * Returns true if the hook was found and removed.
   */
  unregister(name, hook) {
    const hooks = this.hooks.get(name);
    if (!hooks) return false;
    const index = hooks.indexOf(hook);
    if (index === -1) return false;
    hooks.splice(index, 1);
    return true;
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

export { ExecutionContext, HookManager };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map