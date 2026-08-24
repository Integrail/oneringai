import type { IAsyncDisposable } from '../domain/interfaces/IDisposable.js';
import type {
  AgentInspectionRequest,
  AgentSession,
  OpenAgentSessionOptions,
  ResolvedAgentCapabilities,
  RuntimeAgentSpec,
} from './types.js';

export interface AgentExecutionBackend extends IAsyncDisposable {
  inspect(
    spec: Readonly<RuntimeAgentSpec>,
    request?: AgentInspectionRequest,
  ): Promise<ResolvedAgentCapabilities>;

  openSession(
    spec: Readonly<RuntimeAgentSpec>,
    options: OpenAgentSessionOptions,
  ): Promise<AgentSession>;
}
