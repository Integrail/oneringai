# Persistent Sessions Design

## Overview

This document describes the design for opt-in persistent sessions that automatically store and restore full agent context, enabling users to resume conversations seamlessly.

## Goals

1. **Full context persistence** - Store conversation history, memory, plugins, tool state, permissions
2. **Automatic session recovery** - When enabled, load previous session on agent start
3. **Clean Architecture** - Storage interface abstraction supporting different backends
4. **Unified storage location** - Use consistent paths following existing patterns
5. **Backward compatibility** - Opt-in feature, existing agents work unchanged

## Storage Location

Following the existing `FilePersistentInstructionsStorage` pattern at `~/.oneringai/agents/<agentId>/`:

```
~/.oneringai/agents/<agentId>/
├── custom_instructions.md     (existing - PersistentInstructionsPlugin)
├── session.json               (NEW - full session state)
├── memory.json                (NEW - WorkingMemory entries)
└── plugins/                   (NEW - plugin-specific persistence)
    └── in_context_memory.json
```

**Windows:** `%APPDATA%/oneringai/agents/<agentId>/`

## Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application Layer                        │
│  Agent.create({ persistentSession: true, agentId: 'my-agent' }) │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Core Layer                             │
│  ┌─────────────────┐    ┌────────────────────────────────────┐  │
│  │    BaseAgent    │───▶│          AgentContext              │  │
│  │                 │    │  features: { persistentSession }   │  │
│  │  persistence?   │    │  _persistence: IAgentPersistence   │  │
│  └─────────────────┘    └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Domain Layer                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               IAgentPersistenceStorage                    │   │
│  │  save(state: FullAgentState): Promise<void>              │   │
│  │  load(): Promise<FullAgentState | null>                  │   │
│  │  exists(): Promise<boolean>                              │   │
│  │  delete(): Promise<void>                                 │   │
│  │  getPath(): string                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    IMemoryStorage                         │   │
│  │  (existing interface - no changes needed)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Infrastructure Layer                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              FileAgentPersistence                         │   │
│  │  - Orchestrates all file-based persistence               │   │
│  │  - Manages session.json, memory.json, plugins/           │   │
│  │  - Atomic writes (temp + rename)                         │   │
│  │  - Cross-platform paths                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              FileMemoryStorage                            │   │
│  │  - IMemoryStorage implementation                         │   │
│  │  - Stores WorkingMemory entries to memory.json           │   │
│  │  - Lazy loading, periodic flush                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## New Interfaces

### IAgentPersistenceStorage

```typescript
/**
 * Full agent state for persistence.
 * Contains everything needed to rebuild an agent session.
 */
export interface FullAgentState {
  /** Format version for migration support */
  version: number;

  /** Agent identifier */
  agentId: string;

  /** Agent type (for validation on load) */
  agentType: 'agent' | 'task-agent' | 'universal-agent' | string;

  /** Timestamps */
  createdAt: string;    // ISO string
  lastActiveAt: string; // ISO string

  /** Core context state (from AgentContext.getState()) */
  context: SerializedAgentContextState;

  /** WorkingMemory entries (if memory feature enabled) */
  memory?: SerializedMemoryState;

  /** Plugin-specific states */
  plugins: Record<string, unknown>;

  /** Session metadata */
  metadata: SessionMetadata;
}

/**
 * Serialized WorkingMemory state
 */
export interface SerializedMemoryState {
  version: number;
  entries: SerializedMemoryEntry[];
  stats: {
    totalEntries: number;
    totalSizeBytes: number;
  };
}

/**
 * Storage interface for full agent persistence
 */
export interface IAgentPersistenceStorage {
  /**
   * Save full agent state
   */
  save(state: FullAgentState): Promise<void>;

  /**
   * Load full agent state
   * @returns State if exists, null otherwise
   */
  load(): Promise<FullAgentState | null>;

  /**
   * Check if persisted state exists
   */
  exists(): Promise<boolean>;

  /**
   * Delete all persisted state
   */
  delete(): Promise<void>;

  /**
   * Get the storage path (for display/debugging)
   */
  getPath(): string;

  /**
   * Get last modified timestamp
   */
  getLastModified(): Promise<Date | null>;
}
```

## New Feature Flag

Add `persistentSession` to `AgentContextFeatures`:

```typescript
export interface AgentContextFeatures {
  memory?: boolean;                   // WorkingMemory + IdempotencyCache (default: true)
  inContextMemory?: boolean;          // InContextMemoryPlugin (default: false)
  persistentInstructions?: boolean;   // PersistentInstructionsPlugin (default: false)
  history?: boolean;                  // Conversation tracking (default: true)
  permissions?: boolean;              // ToolPermissionManager (default: true)

  // NEW
  persistentSession?: boolean;        // Full session persistence (default: false)
}
```

## Configuration

### AgentContext Configuration

```typescript
interface AgentContextConfig {
  // ... existing fields ...

  /**
   * Persistent session configuration (only used if features.persistentSession is true)
   */
  persistentSession?: {
    /** Custom storage backend (default: FileAgentPersistence) */
    storage?: IAgentPersistenceStorage;

    /** Auto-save interval in milliseconds (default: 30000, 0 = disabled) */
    autoSaveIntervalMs?: number;

    /** Save on destroy (default: true) */
    saveOnDestroy?: boolean;

    /** Load on create (default: true) */
    loadOnCreate?: boolean;
  };
}
```

### Agent Configuration (convenience)

```typescript
interface BaseAgentConfig {
  // ... existing fields ...

  /**
   * Enable persistent sessions with file-based storage.
   * Shorthand for setting features.persistentSession = true with defaults.
   *
   * When true:
   * - Uses FileAgentPersistence at ~/.oneringai/agents/<agentId>/
   * - Auto-loads previous session on create
   * - Auto-saves periodically and on destroy
   *
   * When object:
   * - Customize storage, intervals, behavior
   */
  persistentSession?: boolean | {
    autoSaveIntervalMs?: number;
    saveOnDestroy?: boolean;
    loadOnCreate?: boolean;
    storage?: IAgentPersistenceStorage;
  };
}
```

## Usage Examples

### Simple Usage

```typescript
// Enable persistent session with defaults
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  agentId: 'my-assistant',
  persistentSession: true,  // <-- That's it!
});

// First run: empty session
await agent.run('Hello!');
// Session auto-saved to ~/.oneringai/agents/my-assistant/session.json

// Second run (later): session restored automatically
const agent2 = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  agentId: 'my-assistant',
  persistentSession: true,
});
// agent2 has full context from previous session
await agent2.run('What did we talk about earlier?');
// Agent remembers previous conversation!
```

### Advanced Configuration

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  agentId: 'my-assistant',
  context: {
    features: {
      memory: true,
      inContextMemory: true,
      persistentSession: true,
    },
    persistentSession: {
      autoSaveIntervalMs: 60000,  // Save every minute
      saveOnDestroy: true,
      loadOnCreate: true,
    },
  },
});
```

### Custom Storage Backend

```typescript
// Use custom storage (e.g., S3, Redis)
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  agentId: 'my-assistant',
  context: {
    features: { persistentSession: true },
    persistentSession: {
      storage: new S3AgentPersistence({
        bucket: 'my-agents',
        prefix: 'sessions/',
      }),
    },
  },
});
```

### Manual Control

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  agentId: 'my-assistant',
  context: {
    features: { persistentSession: true },
    persistentSession: {
      autoSaveIntervalMs: 0,  // Disable auto-save
      loadOnCreate: false,    // Don't auto-load
    },
  },
});

// Manual control
await agent.context.loadPersistedSession();
await agent.run('Do something...');
await agent.context.savePersistedSession();
```

## Implementation Plan

### Phase 1: Domain Layer

1. Create `IAgentPersistenceStorage` interface
2. Define `FullAgentState` and related types
3. Export from domain interfaces

### Phase 2: Infrastructure Layer

1. Create `FileAgentPersistence` class
2. Create `FileMemoryStorage` class
3. Update storage index exports

### Phase 3: Core Layer Integration

1. Add `persistentSession` feature to `AgentContextFeatures`
2. Add persistence config to `AgentContextConfig`
3. Implement persistence in `AgentContext`:
   - `loadPersistedSession()`
   - `savePersistedSession()`
   - Auto-save timer
   - Destroy hook
4. Add convenience config to `BaseAgentConfig`
5. Wire up in `BaseAgent` constructor

### Phase 4: Testing & Documentation

1. Unit tests for `FileAgentPersistence`
2. Unit tests for `FileMemoryStorage`
3. Integration tests for full flow
4. Update CLAUDE.md with examples

## File Formats

### session.json

```json
{
  "version": 1,
  "agentId": "my-assistant",
  "agentType": "agent",
  "createdAt": "2026-01-31T10:00:00.000Z",
  "lastActiveAt": "2026-01-31T15:30:00.000Z",
  "context": {
    "version": 1,
    "core": {
      "systemPrompt": "You are a helpful assistant",
      "instructions": "",
      "history": [...],
      "toolCalls": [...]
    },
    "tools": {
      "enabled": {},
      "namespaces": {},
      "priorities": {}
    },
    "permissions": {
      "version": 1,
      "approvals": {},
      "blocklist": [],
      "allowlist": []
    },
    "plugins": {
      "in_context_memory": {
        "entries": [...],
        "config": {}
      }
    },
    "config": {
      "model": "gpt-4",
      "maxContextTokens": 128000,
      "strategy": "proactive"
    }
  },
  "metadata": {
    "title": "My Assistant Session",
    "tags": ["personal"]
  }
}
```

### memory.json

```json
{
  "version": 1,
  "entries": [
    {
      "key": "user_preferences",
      "description": "User prefers dark mode and concise responses",
      "value": { "theme": "dark", "verbosity": "concise" },
      "scope": "persistent",
      "sizeBytes": 128,
      "basePriority": "high",
      "pinned": false,
      "createdAt": 1706699400000,
      "lastAccessedAt": 1706699500000
    }
  ],
  "stats": {
    "totalEntries": 1,
    "totalSizeBytes": 128
  }
}
```

## Migration Support

Version numbers enable future migrations:

```typescript
const PERSISTENCE_FORMAT_VERSION = 1;

function migratePersistedState(state: unknown): FullAgentState {
  const version = (state as any).version ?? 0;

  if (version < 1) {
    // Migration from pre-versioned format
    return migrateFromV0(state);
  }

  if (version === 1) {
    return state as FullAgentState;
  }

  throw new Error(`Unknown persistence format version: ${version}`);
}
```

## Error Handling

- **Missing session**: Return null, agent starts fresh
- **Corrupted session**: Log warning, start fresh (don't crash)
- **Version mismatch**: Attempt migration, fallback to fresh
- **Storage errors**: Throw with clear message, let caller handle

## Considerations

### Performance
- Lazy loading: Only load memory entries when first accessed
- Debounced saves: Don't save on every change
- Async I/O: Never block the event loop

### Security
- Sanitize agentId for filesystem safety
- Don't store sensitive credentials in session
- Clear separation from connector auth storage

### Concurrency
- Single-writer assumed (one agent per agentId at a time)
- Consider file locking for multi-process scenarios (future)

## Related Files

- `src/domain/interfaces/IAgentPersistenceStorage.ts` (NEW)
- `src/infrastructure/storage/FileAgentPersistence.ts` (NEW)
- `src/infrastructure/storage/FileMemoryStorage.ts` (NEW)
- `src/core/AgentContext.ts` (MODIFY)
- `src/core/BaseAgent.ts` (MODIFY)
- `src/infrastructure/storage/index.ts` (MODIFY)
