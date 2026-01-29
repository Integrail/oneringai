# TaskAgent Test Categorization Plan

## Objective
Clearly separate tests that require REAL LLMs from tests that should use MOCK LLMs to ensure:
1. Real LLM tests validate actual LLM behavior (self-reflection, decision-making, validation)
2. Mock tests validate deterministic system behavior (orchestration, dependencies, metrics)

---

## Test Categories

### Category A: MUST Use Real LLMs (Integration Tests)
**These test LLM intelligence, decision-making, and validation capabilities**

#### 1. TaskValidation.integration.test.ts ✅ KEEP REAL LLM
- **Purpose**: Test LLM's ability to self-reflect and validate task completion
- **Why Real**: Testing LLM intelligence - "did the LLM check the result of execution?"
- **Tests**:
  - LLM validates required memory keys exist
  - LLM validates expected output format
  - LLM validates data quality
  - Custom validators via hooks
- **Status**: Keep as integration test with real LLM

#### 2. PlanExecutor.integration.test.ts (PARTIAL) ✅ KEEP SOME TESTS
- **Purpose**: Verify LLM completes tasks correctly and makes smart decisions
- **Why Real**: Testing LLM's ability to use tools correctly and complete tasks
- **Tests to KEEP with Real LLM**:
  - "should execute single task with tool call and verify completion" - verifies LLM uses tools
  - "should use memory tools to store and retrieve data across tasks" - verifies LLM chooses correct tools
- **Tests to CONVERT to Mock** (moved to .mock.test.ts):
  - Basic execution flow (already done)
  - Metrics tracking (already done)
  - Error handling mechanics (can simulate failures deterministically)

#### 3. ComplexDependencies.integration.test.ts (PARTIAL) ✅ KEEP SOME TESTS
- **Purpose**: Verify LLM handles complex scenarios intelligently
- **Why Real**: Testing LLM's decision-making in complex scenarios
- **Tests to KEEP with Real LLM**:
  - Conditional task execution - LLM must evaluate conditions
  - Dynamic task addition - LLM must decide when to add tasks
- **Tests to CONVERT to Mock**:
  - Diamond dependency execution order (deterministic orchestration)
  - Parallel failure handling (deterministic dependency graph)
  - Cascading failures (deterministic graph traversal)
  - Retry logic (deterministic retry mechanism)

---

### Category B: SHOULD Use Mocks (Deterministic Tests)
**These test our orchestration logic, not LLM intelligence**

#### 4. PlanExecutor.mock.test.ts ✅ ALREADY DONE
- **Purpose**: Test deterministic task execution, metrics, memory operations
- **Current Tests**:
  - ✅ Execute task with memory_store tool call
  - ✅ Execute multiple tasks with dependencies
  - ✅ Track metrics accurately
- **Status**: Complete and passing

#### 5. ComplexDependencies.mock.test.ts ⚠️ NEEDS FIXES
- **Purpose**: Test dependency graph execution order (deterministic)
- **Current Tests**:
  - ✅ Diamond dependency pattern execution order
  - ⚠️ Parallel failure handling (needs proper failure simulation)
  - ⚠️ Cascading failures (needs proper failure simulation)
- **Status**: Needs fixes for failure simulation
- **TODO**: Use hooks or tool failures to simulate task failures deterministically

#### 6. Performance.integration.test.ts → Performance.mock.test.ts
- **Purpose**: Test metrics tracking, token counting, cost calculation
- **Why Mock**: These are deterministic calculations, not LLM behavior
- **Tests to Mock**:
  - Memory operation performance
  - Token counting accuracy
  - Cost calculation accuracy
  - Execution time tracking
- **Status**: Should be converted to mock tests

#### 7. Context Management Tests → NEW: ContextManagement.mock.test.ts
- **Purpose**: Test context compaction strategies, token estimation
- **Why Mock**: Testing our algorithms, not LLM behavior
- **Tests**:
  - Proactive strategy compaction
  - Aggressive strategy compaction
  - Lazy strategy compaction
  - Memory eviction on compaction
  - Token estimation accuracy
- **Status**: Should create new mock test file

---

### Category C: Keep as Integration Tests (System Tests)
**These test the full system working together**

#### 8. ComponentIntegration.test.ts ✅ KEEP AS IS
- **Purpose**: Test all components work together
- **Why**: System integration test
- **Status**: Keep as is (probably not using real LLM, just testing component wiring)

#### 9. Persistence.integration.test.ts ✅ KEEP AS IS
- **Purpose**: Test state persistence and recovery
- **Why**: Tests checkpoint/resume mechanism
- **Status**: Keep as is

#### 10. TaskAgent.test.ts ✅ KEEP AS IS
- **Purpose**: Basic TaskAgent functionality tests
- **Status**: Review and keep as is

#### 11. ExternalDependencies.integration.test.ts ⚠️ CURRENTLY SKIPPED
- **Purpose**: Test webhooks, polling, manual approval
- **Status**: Features not implemented yet, tests skipped
- **Action**: Keep skipped until features are implemented

---

## Implementation Plan

### Phase 1: Review and Fix (CURRENT)
1. ✅ Fix MockLLMProvider (DONE)
2. ✅ Fix memory tool methods (DONE)
3. ✅ Fix TaskAgent context passing (DONE)
4. ✅ Create PlanExecutor.mock.test.ts (DONE)
5. ⚠️ Fix ComplexDependencies.mock.test.ts failure simulation

### Phase 2: Convert Appropriate Tests to Mocks
1. Create Performance.mock.test.ts
   - Move deterministic metrics tests from Performance.integration.test.ts
2. Create ContextManagement.mock.test.ts
   - Add comprehensive context strategy tests
3. Update ComplexDependencies.mock.test.ts
   - Fix failure simulation using hooks/validators
   - Add retry logic tests

### Phase 3: Clean Up Integration Tests
1. Review TaskValidation.integration.test.ts
   - Ensure all tests require real LLM validation
   - Keep focused on LLM self-reflection
2. Review PlanExecutor.integration.test.ts
   - Keep only tests that require real LLM decision-making
   - Move orchestration tests to .mock.test.ts
3. Review ComplexDependencies.integration.test.ts
   - Keep only conditional execution and dynamic tasks
   - Move dependency graph tests to .mock.test.ts

### Phase 4: Documentation
1. Add comments to each test file explaining why it uses real LLM or mock
2. Update test README explaining the distinction
3. Create naming convention: `*.integration.test.ts` = real LLM, `*.mock.test.ts` = mock

---

## Decision Criteria

### Use REAL LLM when testing:
- ✅ LLM self-reflection and validation
- ✅ LLM decision-making (which tool to use, when to stop)
- ✅ LLM understanding of task requirements
- ✅ LLM ability to evaluate conditions
- ✅ LLM response quality and correctness

### Use MOCK when testing:
- ✅ Task dependency execution order
- ✅ Task failure cascading
- ✅ Metrics tracking and calculation
- ✅ Memory operations (store/retrieve/delete)
- ✅ Context management strategies
- ✅ Retry mechanisms
- ✅ State persistence
- ✅ Tool call mechanics (that tool was called with correct args)

---

## Current Status

### Passing Tests (Mock)
- ✅ PlanExecutor.mock.test.ts (3/3 passing)

### Failing Tests (Mock)
- ⚠️ ComplexDependencies.mock.test.ts (1/3 passing, 2 need proper failure simulation)

### Failing Tests (Real LLM)
- ⚠️ ComplexDependencies.integration.test.ts (multiple failures - LLM behavior issues)
- ⚠️ PlanExecutor.integration.test.ts (failures - LLM not calling tools)
- ⚠️ Performance.integration.test.ts (should be converted to mock)
- ⚠️ TaskValidation.integration.test.ts (1 failure - validator hooks)

### Tests to Create
- [ ] Performance.mock.test.ts
- [ ] ContextManagement.mock.test.ts

---

## Next Steps

1. **IMMEDIATE**: Fix ComplexDependencies.mock.test.ts failure simulation
2. **SHORT TERM**: Convert Performance tests to mock
3. **SHORT TERM**: Create ContextManagement.mock.test.ts
4. **MEDIUM TERM**: Review and fix real LLM integration tests
5. **LONG TERM**: Add documentation and naming conventions
