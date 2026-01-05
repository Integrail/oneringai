# Clean Architecture LLM Abstraction - Responses API Standard

## Overview

Design a production-grade, vendor-agnostic LLM abstraction in `/imports/business/ai/` using **OpenAI Responses API format** as the internal standard. Support text/image inputs, sophisticated tool calling with blocking/non-blocking execution, and structured outputs across all major vendors.

## Key Design Decisions (User-Approved)

✅ **Standard Format**: OpenAI Responses API (not Chat Completions)
✅ **Auth Integration**: Use existing Provider system for OAuth/tokens
✅ **Streaming**: Not in initial version (add later)
✅ **Tool Execution**: Smart agentic loop with blocking/non-blocking tools (server-side only)
✅ **Blocking Mode**: Tool definition flag (`blocking: boolean`)
✅ **Non-blocking Results**: Trigger immediate LLM call when result arrives
✅ **State Tracking**: Full tracking (pending, completed, failed) for all tool calls
✅ **Client Tools**: Omitted for now (extend later)
✅ **Clean Architecture**: Strict DDD with domain/application/infrastructure layers

## OpenAI Responses API Format (Standard)

### Request Format

```typescript
{
  model: "gpt-4.1",
  input: string | InputItem[],      // NEW: Not "messages"
  instructions?: string | any[],    // NEW: Not role="system"
  tools?: Tool[],
  tool_choice?: "auto" | "required" | { type: "function", function: { name: string } },
  text?: {
    format?: { type: "text" | "json_object" | "json_schema", json_schema?: {...} }
  },
  temperature?: number,
  max_output_tokens?: number,
  parallel_tool_calls?: boolean,
  previous_response_id?: string,   // NEW: For multi-turn
  store?: boolean,                  // NEW: Persist in OpenAI
  metadata?: Record<string, string>
}
```

### Input Item Format (Key Difference from Chat Completions)

```typescript
type InputItem = MessageItem | CompactionItem;

interface MessageItem {
  type: "message";
  id?: string;                     // Optional for input
  role: "user" | "assistant" | "developer";  // NOTE: "developer" not "system"
  content: Content[];              // Always an array!
}

type Content =
  | { type: "input_text", text: string }
  | { type: "input_image_url", image_url: { url: string } }
  | { type: "input_file", file_id: string }
  | { type: "output_text", text: string, annotations?: any[] }
  | { type: "tool_use", id: string, name: string, arguments: string }
  | { type: "tool_result", tool_use_id: string, content: string | any[] };
```

### Response Format

```typescript
{
  id: "resp_xxx",
  object: "response",
  created_at: number,
  status: "completed" | "failed" | "in_progress" | "cancelled" | "queued" | "incomplete",
  model: string,
  output: OutputItem[],            // Array of items
  output_text?: string,            // SDK convenience (aggregated text)
  usage: {
    input_tokens: number,
    output_tokens: number,
    total_tokens: number,
    output_tokens_details?: { reasoning_tokens: number }
  },
  error?: { type: string, message: string },
  // ... other fields
}

type OutputItem = MessageItem | CompactionItem | ReasoningItem;
```

## Architecture Design

```
/imports/business/ai/
├── domain/                          # Core business logic
│   ├── entities/
│   │   ├── Message.ts               # Message entity (Responses API format)
│   │   ├── Content.ts               # Content types (text, image, tool_use, etc.)
│   │   ├── Tool.ts                  # Tool definition entity
│   │   └── Response.ts              # LLM response entity
│   ├── interfaces/
│   │   ├── ILLMProvider.ts          # Provider interface
│   │   └── IToolExecutor.ts         # Tool execution interface
│   ├── types/
│   │   ├── LLMTypes.ts              # Core types and enums
│   │   ├── ResponsesAPITypes.ts     # Responses API type definitions
│   │   └── VendorTypes.ts           # Vendor-specific types
│   └── errors/
│       └── LLMErrors.ts             # Domain errors (use standard Error)
├── application/                     # Use cases & services
│   ├── services/
│   │   ├── LLMManager.ts            # Main orchestrator
│   │   ├── MessageBuilder.ts        # Helper for building messages
│   │   ├── AgenticLoop.ts           # Tool execution + multi-turn loop
│   │   └── ContentNormalizer.ts     # Normalize vendor content → standard
│   └── usecases/
│       ├── GenerateTextUseCase.ts   # Simple text generation
│       ├── GenerateJSONUseCase.ts   # Structured output
│       └── AgenticExecutionUseCase.ts # With tool calling
├── infrastructure/                  # Vendor implementations
│   ├── providers/
│   │   ├── BaseLLMProvider.ts       # Abstract base with common logic
│   │   ├── OpenAIProvider.ts        # OpenAI Responses API
│   │   ├── AnthropicProvider.ts     # Anthropic Messages API
│   │   ├── GoogleProvider.ts        # Google Gemini API
│   │   ├── GrokProvider.ts          # xAI Grok
│   │   └── LlamaProvider.ts         # Meta Llama (via specific provider)
│   ├── factories/
│   │   └── LLMProviderFactory.ts    # Provider factory
│   ├── converters/
│   │   ├── BaseConverter.ts         # Base converter utilities
│   │   ├── AnthropicConverter.ts    # Responses API ↔ Anthropic
│   │   ├── GoogleConverter.ts       # Responses API ↔ Google
│   │   └── GrokConverter.ts         # Responses API ↔ Grok
│   └── clients/
│       ├── OpenAIClient.ts          # openai SDK wrapper
│       ├── AnthropicClient.ts       # @anthropic-ai/sdk wrapper
│       └── GoogleClient.ts          # @google/generative-ai wrapper
├── methods.ts                       # Meteor methods (public API)
└── README.md                        # Documentation
```

## Domain Layer Design

### 1. Message Entity (`domain/entities/Message.ts`)

Based on Responses API format:

```typescript
export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant',
    DEVELOPER = 'developer',  // Responses API uses "developer" not "system"
}

export enum ContentType {
    INPUT_TEXT = 'input_text',
    INPUT_IMAGE_URL = 'input_image_url',
    INPUT_FILE = 'input_file',
    OUTPUT_TEXT = 'output_text',
    TOOL_USE = 'tool_use',
    TOOL_RESULT = 'tool_result',
}

export interface BaseContent {
    type: ContentType;
}

export interface InputTextContent extends BaseContent {
    type: ContentType.INPUT_TEXT;
    text: string;
}

export interface InputImageContent extends BaseContent {
    type: ContentType.INPUT_IMAGE_URL;
    image_url: {
        url: string;        // HTTP URL or data URI
        detail?: 'auto' | 'low' | 'high';
    };
}

export interface OutputTextContent extends BaseContent {
    type: ContentType.OUTPUT_TEXT;
    text: string;
    annotations?: any[];
}

export interface ToolUseContent extends BaseContent {
    type: ContentType.TOOL_USE;
    id: string;
    name: string;
    arguments: string;  // JSON string
}

export interface ToolResultContent extends BaseContent {
    type: ContentType.TOOL_RESULT;
    tool_use_id: string;
    content: string | any;
}

export type Content =
    | InputTextContent
    | InputImageContent
    | OutputTextContent
    | ToolUseContent
    | ToolResultContent;

export interface Message {
    type: 'message';
    id?: string;
    role: MessageRole;
    content: Content[];  // Always an array in Responses API
}

export interface CompactionItem {
    type: 'compaction';
    id: string;
    encrypted_content: string;
}

export type InputItem = Message | CompactionItem;
```

### 2. Tool Entity (`domain/entities/Tool.ts`)

**Enhanced with blocking/non-blocking support and state tracking:**

```typescript
export interface FunctionTool {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, any>;  // JSON Schema
        strict?: boolean;  // Enforce schema
    };
    // NEW: Execution behavior
    blocking?: boolean;  // Default: true (wait for result before continuing)
    timeout?: number;    // Timeout in ms (default: 30000)
}

export interface BuiltInTool {
    type: 'web_search' | 'file_search' | 'computer_use' | 'code_interpreter';
    blocking?: boolean;  // Built-in tools can also be non-blocking
}

export type Tool = FunctionTool | BuiltInTool;

export enum ToolCallState {
    PENDING = 'pending',       // Tool call identified, not yet executed
    EXECUTING = 'executing',   // Currently executing
    COMPLETED = 'completed',   // Successfully completed
    FAILED = 'failed',         // Execution failed
    TIMEOUT = 'timeout',       // Execution timed out
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;  // JSON string
    };
    // NEW: Execution metadata
    blocking: boolean;         // Copied from tool definition
    state: ToolCallState;
    startTime?: Date;
    endTime?: Date;
    error?: string;
}

export interface ToolResult {
    tool_use_id: string;
    content: any;
    error?: string;
    // NEW: Execution metadata
    executionTime?: number;    // ms
    state: ToolCallState;
}

/**
 * Tool execution context - tracks all tool calls in a generation
 */
export interface ToolExecutionContext {
    executionId: string;       // Unique ID for this LLM generation
    toolCalls: Map<string, ToolCall>;  // tool_use_id → ToolCall
    pendingNonBlocking: Set<string>;   // IDs of pending non-blocking calls
    completedResults: Map<string, ToolResult>;  // tool_use_id → ToolResult
}
```

### 3. Response Entity (`domain/entities/Response.ts`)

```typescript
export interface LLMResponse {
    id: string;
    object: 'response';
    created_at: number;
    status: 'completed' | 'failed' | 'in_progress' | 'cancelled' | 'queued' | 'incomplete';
    model: string;
    output: OutputItem[];
    output_text?: string;  // Aggregated text output
    usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        output_tokens_details?: {
            reasoning_tokens: number;
        };
    };
    error?: {
        type: string;
        message: string;
    };
}

export type OutputItem = Message | CompactionItem | ReasoningItem;

export interface ReasoningItem {
    type: 'reasoning';
    id: string;
    effort?: 'low' | 'medium' | 'high';
    summary?: string;
    encrypted_content?: string;  // For o-series models
}
```

### 4. Provider Interface (`domain/interfaces/ILLMProvider.ts`)

```typescript
export interface GenerateOptions {
    model: string;
    input: string | InputItem[];
    instructions?: string;
    tools?: Tool[];
    tool_choice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };
    temperature?: number;
    max_output_tokens?: number;
    response_format?: {
        type: 'text' | 'json_object' | 'json_schema';
        json_schema?: any;
    };
    parallel_tool_calls?: boolean;
    previous_response_id?: string;
}

export interface ILLMProvider {
    /**
     * Get provider name
     */
    getProviderName(): string;

    /**
     * Generate response (non-streaming)
     */
    generate(
        userId: string,
        options: GenerateOptions
    ): Promise<LLMResponse>;

    /**
     * Validate provider access
     */
    validateAccess(userId: string): Promise<{ valid: boolean; error?: string }>;

    /**
     * Get model capabilities
     */
    getCapabilities(model: string): {
        supportsTools: boolean;
        supportsVision: boolean;
        supportsJSON: boolean;
        supportsJSONSchema: boolean;
        maxTokens: number;
    };
}
```

## Application Layer Design

### LLMManager (`application/services/LLMManager.ts`)

```typescript
export interface LLMManagerConfig {
    provider: ILLMProvider;
    toolExecutor?: IToolExecutor;  // Optional for agentic loop
}

export class LLMManager {
    private provider: ILLMProvider;
    private toolExecutor?: IToolExecutor;
    private agenticLoop: AgenticLoop;

    constructor(config: LLMManagerConfig) {
        this.provider = config.provider;
        this.toolExecutor = config.toolExecutor;
        this.agenticLoop = new AgenticLoop(config.provider, config.toolExecutor);
    }

    /**
     * Simple text generation (no tools)
     */
    async generateText(
        userId: string,
        input: string | InputItem[],
        options?: Partial<GenerateOptions>
    ): Promise<string> {
        const response = await this.provider.generate(userId, {
            model: options?.model || 'gpt-4.1',
            input,
            instructions: options?.instructions,
            temperature: options?.temperature,
            max_output_tokens: options?.max_output_tokens,
        });

        return response.output_text || this.extractTextFromOutput(response.output);
    }

    /**
     * Generate structured JSON output
     */
    async generateJSON<T>(
        userId: string,
        input: string | InputItem[],
        schema: any,
        options?: Partial<GenerateOptions>
    ): Promise<T> {
        const response = await this.provider.generate(userId, {
            model: options?.model || 'gpt-4.1',
            input,
            instructions: options?.instructions,
            response_format: {
                type: 'json_schema',
                json_schema: schema,
            },
            temperature: options?.temperature,
        });

        const text = response.output_text || this.extractTextFromOutput(response.output);
        return JSON.parse(text) as T;
    }

    /**
     * Generate with tool calling (agentic loop)
     */
    async generateWithTools(
        userId: string,
        input: string | InputItem[],
        tools: Tool[],
        options?: Partial<GenerateOptions> & { maxIterations?: number }
    ): Promise<LLMResponse> {
        if (!this.toolExecutor) {
            throw new Error('Tool executor not configured');
        }

        return await this.agenticLoop.execute(userId, {
            input,
            tools,
            instructions: options?.instructions,
            model: options?.model || 'gpt-4.1',
            maxIterations: options?.maxIterations || 10,
            temperature: options?.temperature,
        });
    }

    /**
     * Single generation (no agentic loop)
     */
    async generate(
        userId: string,
        options: GenerateOptions
    ): Promise<LLMResponse> {
        return await this.provider.generate(userId, options);
    }
}
```

### AgenticLoop (`application/services/AgenticLoop.ts`)

**Sophisticated tool processor with blocking/non-blocking execution:**

```typescript
import EventEmitter from 'events';

export interface AgenticLoopConfig {
    provider: ILLMProvider;
    toolExecutor?: IToolExecutor;
    maxIterations?: number;
    defaultToolTimeout?: number;
}

export class AgenticLoop extends EventEmitter {
    private provider: ILLMProvider;
    private toolExecutor?: IToolExecutor;
    private maxIterations: number;
    private defaultToolTimeout: number;

    // Execution context
    private executionContext?: ToolExecutionContext;

    constructor(config: AgenticLoopConfig) {
        super();
        this.provider = config.provider;
        this.toolExecutor = config.toolExecutor;
        this.maxIterations = config.maxIterations || 10;
        this.defaultToolTimeout = config.defaultToolTimeout || 30000;
    }

    async execute(
        userId: string,
        options: {
            input: string | InputItem[];
            tools: Tool[];
            instructions?: string;
            model: string;
            temperature?: number;
        }
    ): Promise<LLMResponse> {
        // Initialize execution context
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.executionContext = {
            executionId,
            toolCalls: new Map(),
            pendingNonBlocking: new Set(),
            completedResults: new Map(),
        };

        let currentInput = options.input;
        let iteration = 0;
        let lastResponse: LLMResponse;

        while (iteration < this.maxIterations) {
            // Emit iteration start event
            this.emit('iteration:start', { iteration, executionId });

            // Generate response
            const response = await this.provider.generate(userId, {
                model: options.model,
                input: currentInput,
                instructions: options.instructions,
                tools: options.tools,
                tool_choice: 'auto',
                temperature: options.temperature,
            });

            lastResponse = response;
            this.emit('llm:response', { response, iteration, executionId });

            // Extract and categorize tool calls
            const { blockingCalls, nonBlockingCalls } = this.categorizeTool calls(
                response.output,
                options.tools
            );

            // If no tool calls, check for pending non-blocking results
            if (blockingCalls.length === 0 && nonBlockingCalls.length === 0) {
                if (this.executionContext.pendingNonBlocking.size > 0) {
                    // Still waiting for non-blocking results
                    // Wait a bit and check again
                    await this.waitForNonBlockingResults(500);

                    if (this.hasNewResults()) {
                        // New results arrived, continue loop
                        currentInput = this.buildInputWithCompletedResults(response.output);
                        iteration++;
                        continue;
                    }
                }

                // No more tool calls and no pending results, we're done
                return response;
            }

            // Execute blocking tools (wait for all)
            const blockingResults = await this.executeBlockingTools(blockingCalls);

            // Execute non-blocking tools (fire and forget, with callback)
            this.executeNonBlockingTools(nonBlockingCalls, async (result) => {
                // Callback when non-blocking tool completes
                this.handleNonBlockingResult(result);

                // Trigger immediate LLM call with new result
                await this.triggerLLMWithResult(userId, options, response.output, result);
            });

            // Build next input with blocking tool results
            currentInput = this.buildInputWithToolResults(
                response.output,
                blockingResults
            );

            iteration++;
        }

        throw new Error(`Max iterations (${this.maxIterations}) reached`);
    }

    /**
     * Categorize tool calls into blocking and non-blocking
     */
    private categorizeToolCalls(
        output: OutputItem[],
        toolDefinitions: Tool[]
    ): { blockingCalls: ToolCall[]; nonBlockingCalls: ToolCall[] } {
        const blockingCalls: ToolCall[] = [];
        const nonBlockingCalls: ToolCall[] = [];

        // Create tool definition map
        const toolMap = new Map<string, Tool>();
        for (const tool of toolDefinitions) {
            if (tool.type === 'function') {
                toolMap.set(tool.function.name, tool);
            }
        }

        // Extract tool calls from output
        for (const item of output) {
            if (item.type === 'message' && item.role === 'assistant') {
                for (const content of item.content) {
                    if (content.type === 'tool_use') {
                        const toolDef = toolMap.get(content.name);
                        const isBlocking = toolDef?.blocking !== false;  // Default: true

                        const toolCall: ToolCall = {
                            id: content.id,
                            type: 'function',
                            function: {
                                name: content.name,
                                arguments: content.arguments,
                            },
                            blocking: isBlocking,
                            state: ToolCallState.PENDING,
                        };

                        // Track in execution context
                        this.executionContext!.toolCalls.set(content.id, toolCall);

                        if (isBlocking) {
                            blockingCalls.push(toolCall);
                        } else {
                            nonBlockingCalls.push(toolCall);
                            this.executionContext!.pendingNonBlocking.add(content.id);
                        }
                    }
                }
            }
        }

        return { blockingCalls, nonBlockingCalls };
    }

    /**
     * Execute blocking tools (wait for all)
     */
    private async executeBlockingTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
        if (!this.toolExecutor) {
            throw new Error('Tool executor not configured');
        }

        const results: ToolResult[] = [];

        for (const toolCall of toolCalls) {
            // Update state to executing
            toolCall.state = ToolCallState.EXECUTING;
            toolCall.startTime = new Date();
            this.emit('tool:executing', { toolCall });

            try {
                // Execute with timeout
                const result = await this.executeWithTimeout(
                    () => this.toolExecutor!.execute(
                        toolCall.function.name,
                        JSON.parse(toolCall.function.arguments)
                    ),
                    this.defaultToolTimeout
                );

                toolCall.state = ToolCallState.COMPLETED;
                toolCall.endTime = new Date();

                const toolResult: ToolResult = {
                    tool_use_id: toolCall.id,
                    content: result,
                    state: ToolCallState.COMPLETED,
                    executionTime: toolCall.endTime.getTime() - toolCall.startTime!.getTime(),
                };

                results.push(toolResult);
                this.executionContext!.completedResults.set(toolCall.id, toolResult);
                this.emit('tool:completed', { toolCall, result: toolResult });
            } catch (error) {
                toolCall.state = ToolCallState.FAILED;
                toolCall.endTime = new Date();
                toolCall.error = (error as Error).message;

                const toolResult: ToolResult = {
                    tool_use_id: toolCall.id,
                    content: '',
                    error: (error as Error).message,
                    state: ToolCallState.FAILED,
                };

                results.push(toolResult);
                this.executionContext!.completedResults.set(toolCall.id, toolResult);
                this.emit('tool:failed', { toolCall, error });
            }
        }

        return results;
    }

    /**
     * Execute non-blocking tools (fire and forget with callback)
     */
    private executeNonBlockingTools(
        toolCalls: ToolCall[],
        onResult: (result: ToolResult) => Promise<void>
    ): void {
        if (!this.toolExecutor) {
            return;
        }

        for (const toolCall of toolCalls) {
            // Execute asynchronously
            this.executeNonBlockingTool(toolCall, onResult).catch(error => {
                console.error(`Non-blocking tool ${toolCall.id} failed:`, error);
            });
        }
    }

    /**
     * Execute single non-blocking tool
     */
    private async executeNonBlockingTool(
        toolCall: ToolCall,
        onResult: (result: ToolResult) => Promise<void>
    ): Promise<void> {
        toolCall.state = ToolCallState.EXECUTING;
        toolCall.startTime = new Date();
        this.emit('tool:executing', { toolCall, blocking: false });

        try {
            const result = await this.executeWithTimeout(
                () => this.toolExecutor!.execute(
                    toolCall.function.name,
                    JSON.parse(toolCall.function.arguments)
                ),
                this.defaultToolTimeout
            );

            toolCall.state = ToolCallState.COMPLETED;
            toolCall.endTime = new Date();

            const toolResult: ToolResult = {
                tool_use_id: toolCall.id,
                content: result,
                state: ToolCallState.COMPLETED,
                executionTime: toolCall.endTime.getTime() - toolCall.startTime!.getTime(),
            };

            this.executionContext!.completedResults.set(toolCall.id, toolResult);
            this.executionContext!.pendingNonBlocking.delete(toolCall.id);

            this.emit('tool:completed', { toolCall, result: toolResult, blocking: false });

            // Trigger callback to make new LLM call
            await onResult(toolResult);
        } catch (error) {
            toolCall.state = ToolCallState.FAILED;
            toolCall.endTime = new Date();
            toolCall.error = (error as Error).message;

            const toolResult: ToolResult = {
                tool_use_id: toolCall.id,
                content: '',
                error: (error as Error).message,
                state: ToolCallState.FAILED,
            };

            this.executionContext!.completedResults.set(toolCall.id, toolResult);
            this.executionContext!.pendingNonBlocking.delete(toolCall.id);

            this.emit('tool:failed', { toolCall, error, blocking: false });

            // Still trigger callback even on failure
            await onResult(toolResult);
        }
    }

    /**
     * Trigger new LLM call when non-blocking result arrives
     */
    private async triggerLLMWithResult(
        userId: string,
        originalOptions: any,
        previousOutput: OutputItem[],
        newResult: ToolResult
    ): Promise<void> {
        this.emit('nonblocking:result', { result: newResult });

        // Build input with the new result
        const input = this.buildInputWithToolResults(previousOutput, [newResult]);

        // Make new LLM call
        try {
            const response = await this.provider.generate(userId, {
                model: originalOptions.model,
                input,
                instructions: originalOptions.instructions,
                tools: originalOptions.tools,
                tool_choice: 'auto',
                temperature: originalOptions.temperature,
            });

            this.emit('nonblocking:llm_response', { response, triggeredBy: newResult.tool_use_id });

            // Check for more tool calls in this response
            const { blockingCalls, nonBlockingCalls } = this.categorizeToolCalls(
                response.output,
                originalOptions.tools
            );

            // Continue the cycle if there are more tool calls
            if (blockingCalls.length > 0) {
                const results = await this.executeBlockingTools(blockingCalls);
                // Would need to continue recursively or queue next iteration
            }

            if (nonBlockingCalls.length > 0) {
                this.executeNonBlockingTools(nonBlockingCalls, (result) =>
                    this.triggerLLMWithResult(userId, originalOptions, response.output, result)
                );
            }
        } catch (error) {
            this.emit('nonblocking:error', { error, triggeredBy: newResult.tool_use_id });
        }
    }

    /**
     * Execute function with timeout
     */
    private async executeWithTimeout<T>(
        fn: () => Promise<T>,
        timeoutMs: number
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Tool execution timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            fn()
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Wait for non-blocking results (short poll)
     */
    private async waitForNonBlockingResults(durationMs: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, durationMs));
    }

    /**
     * Check if new results have arrived
     */
    private hasNewResults(): boolean {
        // Check if any pending non-blocking calls have completed
        // This is a simplified check - in real implementation would track timestamps
        return this.executionContext!.pendingNonBlocking.size === 0;
    }

    /**
     * Build input with completed non-blocking results
     */
    private buildInputWithCompletedResults(previousOutput: OutputItem[]): InputItem[] {
        const newResults: ToolResult[] = [];

        // Get recently completed results (not yet sent to LLM)
        for (const [id, result] of this.executionContext!.completedResults) {
            // Check if this result was already sent (simple check)
            // In production, would track which results have been sent
            newResults.push(result);
        }

        return this.buildInputWithToolResults(previousOutput, newResults);
    }

    /**
     * Handle non-blocking result arrival
     */
    private handleNonBlockingResult(result: ToolResult): void {
        this.executionContext!.completedResults.set(result.tool_use_id, result);
        this.executionContext!.pendingNonBlocking.delete(result.tool_use_id);

        this.emit('result:arrived', {
            toolId: result.tool_use_id,
            state: result.state,
            executionId: this.executionContext!.executionId,
        });
    }

    /**
     * Build input with tool results
     */
    private buildInputWithToolResults(
        previousOutput: OutputItem[],
        toolResults: ToolResult[]
    ): InputItem[] {
        const input: InputItem[] = [];

        // Add assistant's previous response as input
        for (const item of previousOutput) {
            if (item.type === 'message') {
                input.push(item as Message);
            }
        }

        // Add tool results as user message
        const toolResultContents: ToolResultContent[] = toolResults.map(result => ({
            type: ContentType.TOOL_RESULT,
            tool_use_id: result.tool_use_id,
            content: result.content,
        }));

        if (toolResultContents.length > 0) {
            input.push({
                type: 'message',
                role: MessageRole.USER,
                content: toolResultContents,
            });
        }

        return input;
    }

    /**
     * Get execution context (for monitoring/debugging)
     */
    getExecutionContext(): ToolExecutionContext | undefined {
        return this.executionContext;
    }

    /**
     * Get tool call statistics
     */
    getToolStatistics(): {
        total: number;
        pending: number;
        executing: number;
        completed: number;
        failed: number;
        blocking: number;
        nonBlocking: number;
    } {
        if (!this.executionContext) {
            return {
                total: 0,
                pending: 0,
                executing: 0,
                completed: 0,
                failed: 0,
                blocking: 0,
                nonBlocking: 0,
            };
        }

        const stats = {
            total: this.executionContext.toolCalls.size,
            pending: 0,
            executing: 0,
            completed: 0,
            failed: 0,
            blocking: 0,
            nonBlocking: 0,
        };

        for (const toolCall of this.executionContext.toolCalls.values()) {
            if (toolCall.state === ToolCallState.PENDING) stats.pending++;
            if (toolCall.state === ToolCallState.EXECUTING) stats.executing++;
            if (toolCall.state === ToolCallState.COMPLETED) stats.completed++;
            if (toolCall.state === ToolCallState.FAILED) stats.failed++;

            if (toolCall.blocking) {
                stats.blocking++;
            } else {
                stats.nonBlocking++;
            }
        }

        return stats;
    }
}
```

### Tool Executor Interface (`domain/interfaces/IToolExecutor.ts`)

```typescript
export interface IToolExecutor {
    /**
     * Execute a tool function
     * @param toolName - Name of the tool to execute
     * @param args - Parsed arguments object
     * @returns Tool execution result
     */
    execute(toolName: string, args: any): Promise<any>;

    /**
     * Check if tool is available
     */
    hasToolfunction(toolName: string): boolean;

    /**
     * Get tool definition
     */
    getToolDefinition(toolName: string): Tool | undefined;
}
```

### Tool Processor Service (`application/services/ToolProcessor.ts`)

**NEW: Dedicated service for tool processing logic:**

```typescript
export class ToolProcessor {
    private toolExecutor: IToolExecutor;
    private eventEmitter: EventEmitter;

    // State tracking
    private toolStates: Map<string, ToolCallState> = new Map();
    private pendingCallbacks: Map<string, (result: ToolResult) => void> = new Map();

    constructor(toolExecutor: IToolExecutor, eventEmitter: EventEmitter) {
        this.toolExecutor = toolExecutor;
        this.eventEmitter = eventEmitter;
    }

    /**
     * Process tool calls - separates blocking and non-blocking
     */
    async processToolCalls(
        toolCalls: ToolCall[],
        onNonBlockingResult?: (result: ToolResult) => Promise<void>
    ): Promise<{
        blockingResults: ToolResult[];
        nonBlockingStarted: number;
    }> {
        const blockingCalls = toolCalls.filter(tc => tc.blocking);
        const nonBlockingCalls = toolCalls.filter(tc => !tc.blocking);

        // Execute blocking tools in parallel (but wait for all)
        const blockingResults = await Promise.all(
            blockingCalls.map(tc => this.executeTool(tc))
        );

        // Start non-blocking tools (don't wait)
        for (const toolCall of nonBlockingCalls) {
            this.executeToolAsync(toolCall, onNonBlockingResult);
        }

        return {
            blockingResults,
            nonBlockingStarted: nonBlockingCalls.length,
        };
    }

    /**
     * Execute single tool (blocking)
     */
    private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
        this.toolStates.set(toolCall.id, ToolCallState.EXECUTING);
        toolCall.state = ToolCallState.EXECUTING;
        toolCall.startTime = new Date();

        try {
            const result = await this.toolExecutor.execute(
                toolCall.function.name,
                JSON.parse(toolCall.function.arguments)
            );

            toolCall.state = ToolCallState.COMPLETED;
            toolCall.endTime = new Date();
            this.toolStates.set(toolCall.id, ToolCallState.COMPLETED);

            return {
                tool_use_id: toolCall.id,
                content: result,
                state: ToolCallState.COMPLETED,
                executionTime: toolCall.endTime.getTime() - toolCall.startTime!.getTime(),
            };
        } catch (error) {
            toolCall.state = ToolCallState.FAILED;
            toolCall.endTime = new Date();
            toolCall.error = (error as Error).message;
            this.toolStates.set(toolCall.id, ToolCallState.FAILED);

            return {
                tool_use_id: toolCall.id,
                content: '',
                error: (error as Error).message,
                state: ToolCallState.FAILED,
            };
        }
    }

    /**
     * Execute tool asynchronously (non-blocking)
     */
    private async executeToolAsync(
        toolCall: ToolCall,
        onResult?: (result: ToolResult) => Promise<void>
    ): Promise<void> {
        const result = await this.executeTool(toolCall);

        // Trigger callback when result arrives
        if (onResult) {
            await onResult(result);
        }
    }

    /**
     * Get current state of all tools
     */
    getToolStates(): Map<string, ToolCallState> {
        return new Map(this.toolStates);
    }
}
```

## Infrastructure Layer Design

### OpenAI Provider (`infrastructure/providers/OpenAIProvider.ts`)

**Uses OpenAI SDK with Responses API:**

```typescript
import OpenAI from 'openai';
import { BaseLLMProvider } from './BaseLLMProvider';

export class OpenAIProvider extends BaseLLMProvider {
    private client: OpenAI;

    constructor(providerId: string, apiKey: string) {
        super(providerId, 'openai');
        this.client = new OpenAI({ apiKey });
    }

    async generate(userId: string, options: GenerateOptions): Promise<LLMResponse> {
        const accessToken = await this.getAccessToken(userId);

        // Create client with user's token (if using oauth_user)
        const client = new OpenAI({ apiKey: accessToken });

        // Call Responses API directly
        const response = await client.responses.create({
            model: options.model,
            input: options.input,
            instructions: options.instructions,
            tools: options.tools,
            tool_choice: options.tool_choice,
            text: options.response_format,
            temperature: options.temperature,
            max_output_tokens: options.max_output_tokens,
            parallel_tool_calls: options.parallel_tool_calls,
            previous_response_id: options.previous_response_id,
            store: false,  // Don't store in OpenAI by default
        });

        // Response is already in Responses API format!
        return response as LLMResponse;
    }

    getCapabilities(model: string) {
        return {
            supportsTools: true,
            supportsVision: model.includes('gpt-4'),
            supportsJSON: true,
            supportsJSONSchema: true,
            maxTokens: this.getModelMaxTokens(model),
        };
    }
}
```

### Anthropic Provider (`infrastructure/providers/AnthropicProvider.ts`)

**Uses Anthropic SDK + Converter:**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from './BaseLLMProvider';
import { AnthropicConverter } from '../converters/AnthropicConverter';

export class AnthropicProvider extends BaseLLMProvider {
    private client: Anthropic;
    private converter: AnthropicConverter;

    constructor(providerId: string, apiKey: string) {
        super(providerId, 'anthropic');
        this.client = new Anthropic({ apiKey });
        this.converter = new AnthropicConverter();
    }

    async generate(userId: string, options: GenerateOptions): Promise<LLMResponse> {
        const accessToken = await this.getAccessToken(userId);

        // Create client with user's token
        const client = new Anthropic({ apiKey: accessToken });

        // Convert Responses API format → Anthropic Messages format
        const anthropicRequest = this.converter.convertRequest(options);

        // Call Anthropic Messages API
        const anthropicResponse = await client.messages.create(anthropicRequest);

        // Convert Anthropic response → Responses API format
        return this.converter.convertResponse(anthropicResponse);
    }

    getCapabilities(model: string) {
        return {
            supportsTools: true,
            supportsVision: true,
            supportsJSON: true,
            supportsJSONSchema: false,  // Anthropic doesn't have native JSON schema
            maxTokens: 200000,  // Claude has 200k context
        };
    }
}
```

### Converter Design (`infrastructure/converters/AnthropicConverter.ts`)

```typescript
export class AnthropicConverter {
    /**
     * Convert Responses API request → Anthropic Messages API request
     */
    convertRequest(options: GenerateOptions): Anthropic.MessageCreateParams {
        // Extract system message from instructions
        const system = typeof options.instructions === 'string'
            ? options.instructions
            : undefined;

        // Convert input items to Anthropic messages
        const messages = this.convertInputToMessages(options.input);

        // Convert tools
        const tools = this.convertTools(options.tools);

        return {
            model: this.mapModel(options.model),
            system,
            messages,
            tools,
            temperature: options.temperature,
            max_tokens: options.max_output_tokens || 4096,
            // Anthropic doesn't support JSON schema directly
            // Would need to add schema to system prompt
        };
    }

    /**
     * Convert Responses API input → Anthropic messages
     */
    private convertInputToMessages(
        input: string | InputItem[]
    ): Anthropic.Message[] {
        if (typeof input === 'string') {
            return [{ role: 'user', content: input }];
        }

        const messages: Anthropic.Message[] = [];

        for (const item of input) {
            if (item.type === 'message') {
                messages.push({
                    role: item.role === 'developer' ? 'user' : item.role,
                    content: this.convertContent(item.content),
                });
            }
        }

        return messages;
    }

    /**
     * Convert Responses API content → Anthropic content blocks
     */
    private convertContent(content: Content[]): Anthropic.ContentBlock[] {
        return content.map(c => {
            switch (c.type) {
                case ContentType.INPUT_TEXT:
                    return { type: 'text', text: c.text };

                case ContentType.INPUT_IMAGE_URL:
                    // Anthropic requires base64, not URLs
                    // Would need to fetch and convert
                    return {
                        type: 'image',
                        source: {
                            type: 'url',  // Or base64
                            url: c.image_url.url,
                        },
                    };

                case ContentType.TOOL_RESULT:
                    return {
                        type: 'tool_result',
                        tool_use_id: c.tool_use_id,
                        content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
                    };

                default:
                    throw new Error(`Unsupported content type: ${c.type}`);
            }
        });
    }

    /**
     * Convert Anthropic response → Responses API format
     */
    convertResponse(anthropicResponse: Anthropic.Message): LLMResponse {
        const output: OutputItem[] = [{
            type: 'message',
            id: anthropicResponse.id,
            role: MessageRole.ASSISTANT,
            content: this.convertAnthropicContent(anthropicResponse.content),
        }];

        return {
            id: `resp_anthropic_${anthropicResponse.id}`,
            object: 'response',
            created_at: Math.floor(Date.now() / 1000),
            status: anthropicResponse.stop_reason === 'end_turn' ? 'completed' : 'incomplete',
            model: anthropicResponse.model,
            output,
            output_text: this.extractOutputText(anthropicResponse.content),
            usage: {
                input_tokens: anthropicResponse.usage.input_tokens,
                output_tokens: anthropicResponse.usage.output_tokens,
                total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens,
            },
        };
    }

    /**
     * Convert Anthropic content blocks → Responses API content
     */
    private convertAnthropicContent(blocks: Anthropic.ContentBlock[]): Content[] {
        return blocks.map(block => {
            if (block.type === 'text') {
                return {
                    type: ContentType.OUTPUT_TEXT,
                    text: block.text,
                    annotations: [],
                };
            }

            if (block.type === 'tool_use') {
                return {
                    type: ContentType.TOOL_USE,
                    id: block.id,
                    name: block.name,
                    arguments: JSON.stringify(block.input),
                };
            }

            throw new Error(`Unknown Anthropic content type: ${block.type}`);
        });
    }
}
```

## SDK vs REST API - Performance/Size Analysis

### Option 1: Official SDKs (Recommended)

**Dependencies to Add:**
```json
{
  "openai": "^5.22.0",              // Already installed - 2.1 MB
  "@anthropic-ai/sdk": "^0.30.0",   // ~1.8 MB
  "@google/generative-ai": "^0.21.0", // ~500 KB
  "groq-sdk": "^0.7.0"              // ~800 KB
}
```

**Total Additional Size:** ~3.1 MB (gzipped: ~800 KB)

**Advantages:**
✅ Official vendor support - stays up to date automatically
✅ Built-in retry logic with exponential backoff
✅ Automatic error handling and type safety
✅ Streaming support built-in (for future)
✅ Better TypeScript types from vendors
✅ Less code to maintain (~50% reduction in converter code)
✅ Handles edge cases (token refresh, rate limits, API changes)
✅ Better debugging with vendor-specific error messages

**Disadvantages:**
❌ Larger bundle size (~3 MB additional)
❌ More dependencies to manage
❌ Potential version conflicts
❌ Some SDKs may have unused features

### Option 2: Raw REST API Calls

**Dependencies:**
```json
{
  "node-fetch": "^3.3.2"  // Already installed
}
```

**Total Additional Size:** 0 MB

**Advantages:**
✅ Minimal bundle size
✅ Complete control over HTTP requests
✅ No SDK dependencies
✅ Faster cold starts (no SDK initialization)

**Disadvantages:**
❌ Must implement retry logic manually
❌ Must handle all error types manually
❌ Must write/maintain all type definitions
❌ No streaming support without custom SSE parsing
❌ ~2-3x more code to maintain
❌ Slower to adopt new API features
❌ More brittle (API changes break code)
❌ Must handle authentication edge cases
❌ No vendor-specific optimizations

### Performance Comparison

| Metric | SDKs | Raw REST |
|--------|------|----------|
| **Request latency** | ~10-20ms overhead (SDK init) | ~0ms overhead |
| **Memory usage** | +5-10 MB (SDK objects) | +1-2 MB (fetch only) |
| **Bundle size** | +3 MB uncompressed (+800 KB gzipped) | 0 MB |
| **Development time** | 50% faster | Baseline |
| **Maintenance burden** | Low (vendor updates) | High (manual updates) |
| **Error handling** | Automatic | Manual |
| **Type safety** | Excellent (vendor types) | Good (custom types) |

### Recommendation: **USE OFFICIAL SDKs**

**Rationale:**
- 800 KB gzipped is negligible for server-side application
- Reduced maintenance burden is worth the size trade-off
- Better error handling and retry logic out-of-the-box
- Future streaming support essentially free
- Type safety from vendors reduces bugs
- Faster to market with new features

**Exception:** For vendors without good SDKs (SambaNova, DeepSeek), use raw REST.

## Initial Implementation Scope

### Phase 1: Core Infrastructure (MVP)
1. Domain entities for Responses API format
2. Base provider with auth integration
3. LLMManager with simple text generation
4. OpenAI provider using Responses API SDK
5. Anthropic provider using Messages SDK + converter
6. Factory pattern for provider selection

### Phase 2: Tool Calling
1. Tool executor interface
2. Agentic loop implementation
3. Tool result handling
4. Multi-turn conversation support

### Phase 3: Additional Vendors
1. Google Gemini provider
2. Grok provider
3. Llama provider (via specific hosting)

### Phase 4: Advanced Features (Future)
1. Streaming support
2. Conversation state management
3. Response caching
4. Background processing
5. Compaction support

## Critical Implementation Details

### Input Normalization

User provides either:
- Simple string: `"Hello"`
- Mixed array: `[{ role: 'user', content: 'text' }, { role: 'assistant', content: '...' }]`

System normalizes to Responses API format:
```typescript
// String input
input: "Hello"

// OR array of InputItem
input: [
  {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: "Hello" }]
  }
]
```

### Tool Format Mapping

**Responses API → Anthropic:**
- `tool_use` content → `tool_use` block ✓ (native support)
- `tool_result` content → `tool_result` block ✓ (native support)

**Responses API → Google:**
- `tool_use` → `functionCall` in parts array
- `tool_result` → `functionResponse` in parts array

**Responses API → Grok:**
- Similar to OpenAI (compatible with Chat Completions format)

### Error Handling Strategy

```typescript
try {
    const response = await provider.generate(userId, options);
} catch (error) {
    if (error.status === 401) {
        throw new Meteor.Error('auth-failed', 'API key invalid or expired');
    }
    if (error.status === 429) {
        throw new Meteor.Error('rate-limited', 'Rate limit exceeded');
    }
    if (error.status === 413 || error.code === 'context_length_exceeded') {
        throw new Meteor.Error('context-too-long', 'Input exceeds model context length');
    }
    throw error;
}
```

## Meteor Methods API

```typescript
Meteor.methods({
    /**
     * Generate text response
     */
    async 'ai.llm.generateText'(
        providerId: string,
        input: string | InputItem[],
        options?: {
            model?: string;
            instructions?: string;
            temperature?: number;
        }
    ): Promise<string>

    /**
     * Generate structured JSON
     */
    async 'ai.llm.generateJSON'(
        providerId: string,
        input: string | InputItem[],
        schema: any,
        options?: { model?: string; instructions?: string }
    ): Promise<any>

    /**
     * Generate with tool calling
     */
    async 'ai.llm.generateWithTools'(
        providerId: string,
        input: string | InputItem[],
        tools: Tool[],
        options?: {
            model?: string;
            instructions?: string;
            maxIterations?: number;
        }
    ): Promise<LLMResponse>
});
```

## Tool Execution Flow

### Blocking Tools

```
LLM Call → Tool Calls Detected → Categorize (Blocking)
   ↓
Execute Tool (wait) → Get Result → Add to Context
   ↓
New LLM Call with Result → ...
```

### Non-Blocking Tools

```
LLM Call → Tool Calls Detected → Categorize (Non-Blocking)
   ↓
Start Tool Execution (async) → Continue Loop
   ↓                              ↓
Get Result (later)           New LLM Call (may happen first)
   ↓
Trigger Immediate LLM Call with Result
```

### Mixed (Blocking + Non-Blocking)

```
LLM Call → Detects 2 blocking + 3 non-blocking tools
   ↓
Execute 2 blocking (wait) → Get Results
Start 3 non-blocking (fire & forget)
   ↓
New LLM Call with blocking results
   ↓
(Meanwhile, non-blocking complete)
   ↓
Trigger New LLM Call with non-blocking result #1
   ↓
(Another non-blocking completes)
   ↓
Trigger New LLM Call with non-blocking result #2
...
```

### State Machine

```
PENDING → EXECUTING → COMPLETED
                  ↓
                FAILED
                  ↓
               TIMEOUT
```

### Event System

Events emitted by AgenticLoop:
- `iteration:start` - New iteration begins
- `llm:response` - LLM response received
- `tool:executing` - Tool execution started
- `tool:completed` - Tool execution completed
- `tool:failed` - Tool execution failed
- `result:arrived` - Non-blocking result arrived
- `nonblocking:result` - Processing non-blocking result
- `nonblocking:llm_response` - LLM response from non-blocking trigger
- `nonblocking:error` - Error in non-blocking flow

## Files to Create (~25 files)

### Domain Layer (8 files)
- `domain/entities/Message.ts`
- `domain/entities/Content.ts`
- `domain/entities/Tool.ts`
- `domain/entities/Response.ts`
- `domain/interfaces/ILLMProvider.ts`
- `domain/interfaces/IToolExecutor.ts`
- `domain/types/LLMTypes.ts`
- `domain/types/ResponsesAPITypes.ts`

### Application Layer (5 files)
- `application/services/LLMManager.ts`
- `application/services/AgenticLoop.ts`
- `application/services/MessageBuilder.ts`
- `application/usecases/GenerateTextUseCase.ts`
- `application/usecases/GenerateJSONUseCase.ts`

### Infrastructure Layer (10 files)
- `infrastructure/providers/BaseLLMProvider.ts`
- `infrastructure/providers/OpenAIProvider.ts`
- `infrastructure/providers/AnthropicProvider.ts`
- `infrastructure/providers/GoogleProvider.ts`
- `infrastructure/factories/LLMProviderFactory.ts`
- `infrastructure/converters/BaseConverter.ts`
- `infrastructure/converters/AnthropicConverter.ts`
- `infrastructure/converters/GoogleConverter.ts`
- `infrastructure/clients/OpenAIClient.ts` (wrapper)
- `infrastructure/clients/AnthropicClient.ts` (wrapper)

### Public API (2 files)
- `methods.ts`
- `README.md`

## Package Dependencies to Add

```bash
npm install @anthropic-ai/sdk @google/generative-ai groq-sdk
```

Estimated impact:
- Size: +3.1 MB uncompressed (+800 KB gzipped)
- Deps: +3 new packages
- Performance: Negligible (<20ms per request overhead)

## Implementation Summary

### What Makes This Design Superior

1. **Responses API Standard** - Future-proof with OpenAI's latest API
2. **Sophisticated Tool Processor**:
   - Blocking tools: Synchronous execution, wait for results
   - Non-blocking tools: Async execution, trigger LLM when done
   - Full state tracking: pending → executing → completed/failed/timeout
   - Event-driven: Rich events for monitoring and debugging
3. **Vendor SDKs** - Leverage official libraries for reliability
4. **Clean Architecture** - Easy to extend, test, and maintain
5. **OAuth Integration** - Reuse existing Provider system
6. **Type-Safe** - Full TypeScript with vendor types

### MVP Scope (Phase 1)

**Focus on essentials:**
- Domain entities (Message, Content, Tool, Response)
- OpenAI provider with Responses API
- Simple LLMManager (generateText, generateJSON)
- Basic tool calling with blocking tools only
- Factory pattern

**Defer for later:**
- Anthropic, Google, Grok providers
- Non-blocking tool execution (complex, needs thorough testing)
- Streaming
- Advanced agentic loop features

### Development Order

1. Domain layer (types, entities, interfaces)
2. Base infrastructure (BaseLLMProvider with OAuth)
3. OpenAI provider (simplest - native Responses API format)
4. LLMManager (text generation first)
5. Basic tool calling (blocking only for MVP)
6. Meteor methods
7. Test with real OpenAI calls

Then expand with Anthropic, non-blocking tools, etc.

## Sources

- [OpenAI Responses API Reference](https://platform.openai.com/docs/api-reference/responses)
- [Migrate to Responses API Guide](https://platform.openai.com/docs/guides/migrate-to-responses)
- [OpenAI for Developers 2025](https://developers.openai.com/blog/openai-for-developers-2025/)

---

This design provides a clean, extensible, performant LLM abstraction using modern OpenAI Responses API as the standard with sophisticated tool processing and proper Clean Architecture separation.
