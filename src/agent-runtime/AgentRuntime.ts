import type { AgentExecutionBackend } from './AgentExecutionBackend.js';
import { cloneAndFreezeSpec } from './internal.js';
import type {
  AgentInspectionRequest,
  AgentSession,
  OpenAgentSessionOptions,
  ResolvedAgentCapabilities,
  RuntimeAgent,
  RuntimeAgentSpec,
} from './types.js';

export interface AgentRuntimeOptions {
  backend: AgentExecutionBackend;
  backendOwnership?: 'owned' | 'borrowed';
}

export class AgentRuntime {
  private readonly backend: AgentExecutionBackend;
  private readonly ownsBackend: boolean;
  private readonly sessions = new Set<AgentSession>();
  private _isDestroyed = false;

  constructor(options: AgentRuntimeOptions) {
    this.backend = options.backend;
    this.ownsBackend = (options.backendOwnership ?? 'owned') === 'owned';
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  agent(spec: RuntimeAgentSpec): RuntimeAgent {
    this.assertActive();
    return new RuntimeAgentHandle(cloneAndFreezeSpec(spec), this.backend, () => this.assertActive(), (session) => {
      let tracked!: TrackedAgentSession;
      tracked = new TrackedAgentSession(session, () => this.sessions.delete(tracked));
      this.sessions.add(tracked);
      return tracked;
    });
  }

  async destroy(): Promise<void> {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    await Promise.allSettled([...this.sessions].map((session) => session.destroy()));
    this.sessions.clear();
    if (this.ownsBackend) await this.backend.destroy();
  }

  private assertActive(): void {
    if (this._isDestroyed) throw new Error('AgentRuntime has been destroyed');
  }
}

class RuntimeAgentHandle implements RuntimeAgent {
  constructor(
    readonly spec: Readonly<RuntimeAgentSpec>,
    private readonly backend: AgentExecutionBackend,
    private readonly assertActive: () => void,
    private readonly onSession: (session: AgentSession) => AgentSession,
  ) {}

  async inspect(request?: AgentInspectionRequest): Promise<ResolvedAgentCapabilities> {
    this.assertActive();
    const capabilities = await this.backend.inspect(this.spec, request);
    this.assertActive();
    return capabilities;
  }

  async openSession(options: OpenAgentSessionOptions): Promise<AgentSession> {
    this.assertActive();
    const session = await this.backend.openSession(this.spec, options);
    try {
      this.assertActive();
    } catch (error) {
      await session.destroy();
      throw error;
    }
    return this.onSession(session);
  }
}

class TrackedAgentSession implements AgentSession {
  private _isDestroyed = false;

  constructor(
    private readonly session: AgentSession,
    private readonly onDestroy: () => void,
  ) {}

  get id() { return this.session.id; }
  get agentId() { return this.session.agentId; }
  get capabilities() { return this.session.capabilities; }
  get state() { return this.session.state; }
  get isDestroyed() { return this._isDestroyed || this.session.isDestroyed; }

  run(...args: Parameters<AgentSession['run']>) {
    return this.session.run(...args);
  }

  cancelActiveRun(reason?: string): Promise<void> {
    return this.session.cancelActiveRun(reason);
  }

  async destroy(): Promise<void> {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    try {
      await this.session.destroy();
    } finally {
      this.onDestroy();
    }
  }
}
