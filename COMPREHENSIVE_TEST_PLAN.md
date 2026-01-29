# Comprehensive Test Plan for TaskAgent & Context Management

## Current Test Coverage (As of 2026-01-29)

### Unit Tests (TaskAgent)
✅ CheckpointManager - State persistence
✅ ExternalDependencyHandler - Webhooks, polling, manual input
✅ IdempotencyCache - Tool result caching
✅ Memory.test - Memory entity logic
✅ PlanningAgent - AI-driven planning
✅ Task.test - Task entity and dependencies
✅ WorkingMemory - Memory operations
✅ contextTools - Context inspection tools
✅ memoryTools - Memory management tools

### Integration Tests (TaskAgent)
⚠️ ComponentIntegration - Basic component wiring (superficial)
⚠️ TaskAgent - Integration test with **mocked executePlan()** (not real execution)

### Context Tests
✅ ContextCompactors - Truncate, Summarize, MemoryEviction compactors
✅ TaskAgentContextProvider - Component assembly
✅ Core ContextManager - Budget, strategies, events
✅ Strategies - Proactive, Aggressive, Lazy, Rolling Window, Adaptive

---

## Critical Gaps

### ❌ Gap 1: Real End-to-End Task Execution
**Problem**: Current TaskAgent tests mock `executePlan()`, so we never test the actual execution flow.

**What's Missing**:
- Realistic LLM response simulation
- Tool execution verification
- Task completion detection
- Error propagation through layers

### ❌ Gap 2: LLM Self-Reflection / Task Validation
**Problem**: **COMPLETELY UNTESTED** despite being a core feature!

**What's Missing**:
- TaskValidation with completion criteria
- LLM self-reflection prompts
- Validation scoring (0-100)
- Required memory keys validation
- Custom validators via hooks
- Uncertain validation with user approval

### ❌ Gap 3: Context Management Under Real Load
**Problem**: Context tests are unit-level; no integration with real task execution.

**What's Missing**:
- Context compaction during multi-task execution
- Priority-based eviction (plan > memory > history)
- Memory eviction callbacks actually working
- Strategy switching mid-execution
- Budget enforcement with real token counts

### ❌ Gap 4: Complex Task Dependency Scenarios
**Problem**: No tests for intricate dependency graphs with failures.

**What's Missing**:
- Parallel tasks with dependencies
- Cascading failures
- Retry logic with dependencies
- Conditional task execution
- Dynamic task addition during execution

### ❌ Gap 5: Metrics & Cost Tracking
**Problem**: No verification that metrics accumulate correctly.

**What's Missing**:
- Token usage tracking across tasks
- Cost calculation verification
- LLM call counting
- Tool call counting

---

## Test Plan

### Phase 1: Critical Missing Tests (Priority 1)

#### Test 1: End-to-End Task Execution with Realistic LLM Simulation
**File**: `tests/integration/taskAgent/PlanExecutor.integration.test.ts`

**Test Cases**:
1. ✅ Execute single task with tool call
2. ✅ Execute multiple tasks in sequence
3. ✅ Execute tasks with dependencies
4. ✅ Handle tool execution failures with retry
5. ✅ Verify metrics accumulation (tokens, cost, calls)
6. ✅ Verify conversation history is populated
7. ✅ Verify memory updates during execution

**LLM Mock Requirements**:
- Simulate realistic multi-turn conversations
- Make appropriate tool calls based on task description
- Verify tool results
- Respond with task completion confirmation

#### Test 2: Task Validation & LLM Self-Reflection
**File**: `tests/integration/taskAgent/TaskValidation.integration.test.ts`

**Test Cases**:
1. ✅ Task with completion criteria - LLM validates success
2. ✅ Task with completion criteria - LLM validates failure
3. ✅ Task with uncertain validation (score 60-75) - requires user approval
4. ✅ Task with required memory keys - validates presence
5. ✅ Task with custom validator hook - calls custom validation
6. ✅ Task validation retry on failure
7. ✅ Task validation in 'warn' mode vs 'strict' mode
8. ✅ Skip reflection flag bypasses LLM validation

**LLM Mock Requirements**:
- Return structured validation responses
- Score completion (0-100)
- Provide per-criterion evaluation
- Handle edge cases (ambiguous completion)

#### Test 3: Context Management Integration with TaskAgent
**File**: `tests/integration/context/ContextWithTaskAgent.integration.test.ts`

**Test Cases**:
1. ✅ Context compaction triggered during task execution
2. ✅ Memory eviction under pressure (memory_index component)
3. ✅ History truncation when over limit (conversation_history component)
4. ✅ Priority-based compaction (plan untouched, memory evicted first)
5. ✅ Strategy switching mid-execution (proactive → aggressive)
6. ✅ Budget warnings and critical events
7. ✅ Context components correctly assembled by TaskAgentContextProvider
8. ✅ Tool outputs component management

**Requirements**:
- Real ContextManager with real compactors
- Actual memory eviction callbacks
- Budget enforcement
- Event verification

### Phase 2: Complex Scenarios (Priority 2)

#### Test 4: Complex Dependency Graphs
**File**: `tests/integration/taskAgent/ComplexDependencies.integration.test.ts`

**Test Cases**:
1. ✅ Diamond dependency pattern (A→B,C; B,C→D)
2. ✅ Parallel execution with failure in one branch
3. ✅ Cascading failures (if A fails, B and C skip)
4. ✅ Conditional tasks (execute only if condition met)
5. ✅ Dynamic task addition during execution
6. ✅ Retry with dependencies (if A fails and retries, B waits)

#### Test 5: External Dependencies
**File**: `tests/integration/taskAgent/ExternalDependencies.integration.test.ts`

**Test Cases**:
1. ✅ Webhook wait and completion
2. ✅ Polling with timeout
3. ✅ Manual approval task
4. ✅ Multiple external dependencies in parallel
5. ✅ External dependency timeout handling

#### Test 6: Long-Running Agent Persistence
**File**: `tests/integration/taskAgent/Persistence.integration.test.ts`

**Test Cases**:
1. ✅ Save state mid-execution
2. ✅ Resume from saved state
3. ✅ Resume with failed task (retry)
4. ✅ Checkpoint after each task
5. ✅ Session persistence with context
6. ✅ Tool manager state persistence

### Phase 3: Stress Tests (Priority 3)

#### Test 7: Context Stress Tests
**File**: `tests/integration/context/ContextStress.integration.test.ts`

**Test Cases**:
1. ✅ 100 tasks with memory filling up
2. ✅ Conversation history with 1000 messages
3. ✅ Multiple compaction cycles in one execution
4. ✅ All strategies tested under same load
5. ✅ Memory eviction with 100+ entries

#### Test 8: Performance & Metrics
**File**: `tests/integration/taskAgent/Performance.integration.test.ts`

**Test Cases**:
1. ✅ Verify token usage matches expected
2. ✅ Cost calculation accuracy
3. ✅ Metrics accumulation across checkpoints
4. ✅ Rate limiting behavior
5. ✅ Idempotency cache effectiveness

---

## Implementation Strategy

### Week 1: Critical Tests
- **Day 1-2**: Test 1 (PlanExecutor.integration.test.ts)
- **Day 3-4**: Test 2 (TaskValidation.integration.test.ts)
- **Day 5**: Test 3 (ContextWithTaskAgent.integration.test.ts)

### Week 2: Complex Scenarios
- **Day 1-2**: Test 4 (ComplexDependencies)
- **Day 3**: Test 5 (ExternalDependencies)
- **Day 4-5**: Test 6 (Persistence)

### Week 3: Stress Tests
- **Day 1-2**: Test 7 (ContextStress)
- **Day 3-4**: Test 8 (Performance)
- **Day 5**: Documentation & CI integration

---

## Success Criteria

### Must Have (Phase 1)
- [ ] All PlanExecutor integration tests passing
- [ ] All TaskValidation tests passing (especially self-reflection!)
- [ ] All Context integration tests passing
- [ ] 90%+ code coverage for PlanExecutor, TaskAgent, ContextManager

### Should Have (Phase 2)
- [ ] All complex dependency tests passing
- [ ] All external dependency tests passing
- [ ] All persistence tests passing
- [ ] 85%+ code coverage for supporting components

### Nice to Have (Phase 3)
- [ ] All stress tests passing
- [ ] Performance benchmarks established
- [ ] Load test results documented

---

## LLM Mock Design

### Realistic LLM Mock Features

```typescript
class RealisticLLMMock {
  // Understands task context and makes appropriate tool calls
  async processTask(messages: any[]): Promise<LLMResponse>;

  // Simulates self-reflection with validation scoring
  async validateTaskCompletion(
    task: Task,
    conversationHistory: any[]
  ): Promise<TaskValidationResult>;

  // Tracks state across calls
  recordToolResult(toolName: string, result: any): void;

  // Configurable behavior
  setFailureMode(mode: 'never' | 'sometimes' | 'always'): void;
  setValidationScore(score: number): void;
}
```

### Mock Behaviors
1. **Smart Tool Selection**: Analyzes task description and calls relevant tools
2. **Result Verification**: Checks tool results and confirms success/failure
3. **Multi-Turn Conversations**: Supports multiple LLM calls per task
4. **Validation Scoring**: Returns realistic validation scores with explanations
5. **Error Simulation**: Can simulate various failure scenarios

---

## Notes

- All tests should use the REAL implementations (no mocking of core logic)
- LLM responses are mocked, but everything else is real
- Tests should verify events, metrics, state changes
- Each test should be runnable independently
- Tests should clean up after themselves (no side effects)

---

## References

- **TaskAgent**: `src/capabilities/taskAgent/TaskAgent.ts`
- **PlanExecutor**: `src/capabilities/taskAgent/PlanExecutor.ts`
- **ContextManager**: `src/core/context/ContextManager.ts`
- **TaskAgentContextProvider**: `src/infrastructure/context/providers/TaskAgentContextProvider.ts`
- **Task Validation**: `src/domain/entities/Task.ts` (lines 142-216)
