/**
 * BaseAgent - Abstract base class for all agent types
 *
 * Provides shared functionality for:
 * - Connector resolution
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 *
 * This is an INTERNAL class - not exported in the public API.
 * Use Agent, TaskAgent, or UniversalAgent instead.
 */

import { EventEmitter } from 'eventemitter3';
import { Connector } from './Connector.js';
import { ToolManager } from './ToolManager.js';
import { SessionManager, Session, ISessionStorage } from './SessionManager.js';
import { ToolPermissionManager } from './permissions/ToolPermissionManager.js';
import type { AgentPermissionsConfig, SerializedApprovalState } from './permissions/types.js';
import type { ToolFunction } from '../domain/entities/Tool.js';
import type { SerializedToolState } from './ToolManager.js';
import { logger, FrameworkLogger } from '../infrastructure/observability/Logger.js';

/**
 * Base session configuration (shared by all agent types)
 */
export interface BaseSessionConfig {
  /** Storage backend for sessions */
  storage: ISessionStorage;
  /** Resume existing session by ID */
  id?: string;
  /** Auto-save session after each interaction */
  autoSave?: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs?: number;
}

/**
 * Base configuration shared by all agent types
 */
export interface BaseAgentConfig {
  /** Connector name or instance */
  connector: string | Connector;

  /** Model identifier */
  model: string;

  /** Agent name (optional, auto-generated if not provided) */
  name?: string;

  /** Tools available to the agent */
  tools?: ToolFunction[];

  /** Provide a pre-configured ToolManager (advanced) */
  toolManager?: ToolManager;

  /** Session configuration */
  session?: BaseSessionConfig;

  /** Permission configuration */
  permissions?: AgentPermissionsConfig;
}

/**
 * Base events emitted by all agent types.
 * Agent subclasses typically extend their own event interfaces.
 */
export interface BaseAgentEvents {
  'session:saved': { sessionId: string };
  'session:loaded': { sessionId: string };
  destroyed: void;
}

/**
 * Abstract base class for all agent types.
 *
 * @internal This class is not exported in the public API.
 *
 * Note: TEvents is not constrained to BaseAgentEvents to allow subclasses
 * to define their own event interfaces (e.g., AgenticLoopEvents for Agent).
 */
export abstract class BaseAgent<
  TConfig extends BaseAgentConfig = BaseAgentConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TEvents extends Record<string, any> = BaseAgentEvents,
> extends EventEmitter<TEvents> {
  // ===== Core Properties =====
  readonly name: string;
  readonly connector: Connector;
  readonly model: string;

  // ===== Protected State =====
  protected _config: TConfig;
  protected _toolManager: ToolManager;
  protected _permissionManager: ToolPermissionManager;
  protected _sessionManager: SessionManager | null = null;
  protected _session: Session | null = null;
  protected _pendingSessionLoad: Promise<void> | null = null;
  protected _isDestroyed = false;
  protected _cleanupCallbacks: Array<() => void | Promise<void>> = [];
  protected _logger: FrameworkLogger;

  // ===== Constructor =====

  constructor(config: TConfig, loggerComponent: string) {
    super();
    this._config = config;

    // Resolve connector
    this.connector = this.resolveConnector(config.connector);

    // Set name
    this.name = config.name ?? `${this.getAgentType()}-${Date.now()}`;
    this.model = config.model;

    // Create logger
    this._logger = logger.child({
      component: loggerComponent,
      agentName: this.name,
      model: this.model,
      connector: this.connector.name,
    });

    // Initialize tool manager
    this._toolManager = this.initializeToolManager(config.toolManager, config.tools);

    // Initialize permission manager
    this._permissionManager = this.initializePermissionManager(config.permissions, config.tools);
  }

  // ===== Abstract Methods =====

  /**
   * Get the agent type identifier for session serialization
   */
  protected abstract getAgentType(): 'agent' | 'task-agent' | 'universal-agent';

  /**
   * Prepare session state before saving.
   * Subclasses override to add their specific state (plan, memory, etc.)
   */
  protected abstract prepareSessionState(): void;

  // ===== Protected Initialization Helpers =====

  /**
   * Resolve connector from string name or instance
   */
  protected resolveConnector(ref: string | Connector): Connector {
    if (typeof ref === 'string') {
      return Connector.get(ref);
    }
    return ref;
  }

  /**
   * Initialize tool manager with provided tools
   */
  protected initializeToolManager(
    existingManager?: ToolManager,
    tools?: ToolFunction[]
  ): ToolManager {
    const manager = existingManager ?? new ToolManager();

    if (tools) {
      for (const tool of tools) {
        manager.register(tool);
      }
    }

    return manager;
  }

  /**
   * Initialize permission manager
   */
  protected initializePermissionManager(
    config?: AgentPermissionsConfig,
    tools?: ToolFunction[]
  ): ToolPermissionManager {
    const manager = new ToolPermissionManager(config);

    // Register tool permission configs
    if (tools) {
      for (const tool of tools) {
        if (tool.permission) {
          manager.setToolConfig(tool.definition.function.name, tool.permission);
        }
      }
    }

    return manager;
  }

  /**
   * Initialize session management (call from subclass constructor after other setup)
   */
  protected initializeSession(sessionConfig?: BaseSessionConfig): void {
    if (!sessionConfig) {
      return;
    }

    this._sessionManager = new SessionManager({ storage: sessionConfig.storage });

    if (sessionConfig.id) {
      // Resume existing session (async)
      this._pendingSessionLoad = this.loadSessionInternal(sessionConfig.id);
    } else {
      // Create new session
      this._session = this._sessionManager.create(this.getAgentType(), {
        title: this.name,
      });

      // Setup auto-save if configured
      if (sessionConfig.autoSave) {
        const interval = sessionConfig.autoSaveIntervalMs ?? 30000;
        this._sessionManager.enableAutoSave(this._session, interval);
      }
    }
  }

  /**
   * Ensure any pending session load is complete
   */
  protected async ensureSessionLoaded(): Promise<void> {
    if (this._pendingSessionLoad) {
      await this._pendingSessionLoad;
      this._pendingSessionLoad = null;
    }
  }

  /**
   * Internal method to load session
   */
  protected async loadSessionInternal(sessionId: string): Promise<void> {
    if (!this._sessionManager) return;

    try {
      const session = await this._sessionManager.load(sessionId);
      if (session) {
        this._session = session;

        // Restore tool state
        if (session.toolState) {
          this._toolManager.loadState(session.toolState as SerializedToolState);
        }

        // Restore approval state (if permission inheritance is enabled)
        const inheritFromSession = this._config.permissions?.inheritFromSession !== false;
        if (inheritFromSession && session.custom['approvalState']) {
          this._permissionManager.loadState(
            session.custom['approvalState'] as SerializedApprovalState
          );
        }

        this._logger.info({ sessionId }, 'Session loaded');

        // Subclasses can override loadSessionInternal to emit their own events

        // Setup auto-save if configured
        if (this._config.session?.autoSave) {
          const interval = this._config.session.autoSaveIntervalMs ?? 30000;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      } else {
        this._logger.warn({ sessionId }, 'Session not found, creating new session');
        this._session = this._sessionManager.create(this.getAgentType(), {
          title: this.name,
        });
      }
    } catch (error) {
      this._logger.error(
        { error: (error as Error).message, sessionId },
        'Failed to load session'
      );
      throw error;
    }
  }

  // ===== Public Session API =====

  /**
   * Get the current session ID (if session is enabled)
   */
  getSessionId(): string | null {
    return this._session?.id ?? null;
  }

  /**
   * Check if this agent has session support enabled
   */
  hasSession(): boolean {
    return this._session !== null;
  }

  /**
   * Get the current session (for advanced use)
   */
  getSession(): Session | null {
    return this._session;
  }

  /**
   * Save the current session to storage
   * @throws Error if session is not enabled
   */
  async saveSession(): Promise<void> {
    // Ensure any pending session load is complete
    await this.ensureSessionLoaded();

    if (!this._sessionManager || !this._session) {
      throw new Error(
        'Session not enabled. Configure session in agent config to use this feature.'
      );
    }

    // Update common session state
    this._session.toolState = this._toolManager.getState();
    this._session.custom['approvalState'] = this._permissionManager.getState();

    // Let subclass add its specific state
    this.prepareSessionState();

    await this._sessionManager.save(this._session);
    this._logger.debug({ sessionId: this._session.id }, 'Session saved');

    // Subclasses can override saveSession to emit their own events
  }

  /**
   * Update session custom data
   */
  updateSessionData(key: string, value: unknown): void {
    if (!this._session) {
      throw new Error('Session not enabled');
    }
    this._session.custom[key] = value;
  }

  /**
   * Get session custom data
   */
  getSessionData<T = unknown>(key: string): T | undefined {
    return this._session?.custom[key] as T | undefined;
  }

  // ===== Public Permission API =====

  /**
   * Advanced tool management. Returns ToolManager for fine-grained control.
   */
  get tools(): ToolManager {
    return this._toolManager;
  }

  /**
   * Permission management. Returns ToolPermissionManager for approval control.
   */
  get permissions(): ToolPermissionManager {
    return this._permissionManager;
  }

  // ===== Lifecycle =====

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Register a cleanup callback
   */
  onCleanup(callback: () => void | Promise<void>): void {
    this._cleanupCallbacks.push(callback);
  }

  /**
   * Base cleanup for session and listeners.
   * Subclasses should call super.baseDestroy() in their destroy() method.
   */
  protected baseDestroy(): void {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;

    this._logger.debug('Agent destroy started');

    // Cleanup session manager
    if (this._sessionManager) {
      if (this._session) {
        this._sessionManager.stopAutoSave(this._session.id);
      }
      this._sessionManager.destroy();
    }

    // Cleanup tool manager listeners
    this._toolManager.removeAllListeners();

    // Cleanup permission manager listeners
    this._permissionManager.removeAllListeners();

    // Remove all event listeners
    this.removeAllListeners();

    // Emit destroyed event (before removing listeners)
    // Note: This won't be received since we removed listeners above
    // but subclasses can emit before calling baseDestroy if needed
  }

  /**
   * Run cleanup callbacks
   */
  protected async runCleanupCallbacks(): Promise<void> {
    for (const callback of this._cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        this._logger.error({ error: (error as Error).message }, 'Cleanup callback error');
      }
    }
    this._cleanupCallbacks = [];
  }
}
