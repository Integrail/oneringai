import { constants as fsConstants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Connector } from '../core/Connector.js';
import type { IConnectorRegistry } from '../domain/interfaces/IConnectorRegistry.js';
import type { AgentDriver, DriverEvent, DriverRun, DriverRunResult, DriverSession } from './AgentDriver.js';
import type { AgentExecutionBackend } from './AgentExecutionBackend.js';
import { AsyncEventHub } from './AsyncEventHub.js';
import {
  AgentBusyError,
  AgentCapabilityUnsupportedError,
  AgentDriverConfigurationError,
  AgentDriverNotFoundError,
  AgentNativeExecutionError,
  AgentRunTimeoutError,
  AgentWorkspaceError,
} from './errors.js';
import { cloneAndFreezeJson, createDeferred, errorMessage, mergeRequirements, toJsonValue } from './internal.js';
import type {
  AgentCapabilityRequirement,
  AgentEventSubscriptionOptions,
  AgentExecutionPolicy,
  AgentInspectionRequest,
  AgentInteractionResponse,
  AgentObservationOptions,
  AgentRun,
  AgentRunInput,
  AgentRunOptions,
  AgentRunResult,
  AgentSession,
  AgentSessionState,
  OpenAgentSessionOptions,
  ResolvedAgentCapabilities,
  ResolvedWorkspace,
  RuntimeAgentSpec,
  JsonValue,
  WorkspaceRequest,
} from './types.js';

const DEFAULT_EVENT_BUFFER_BYTES = 1024 * 1024;
const DEFAULT_SESSION_JOURNAL_BYTES = 4 * DEFAULT_EVENT_BUFFER_BYTES;
const DEFAULT_CLEANUP_TIMEOUT_MS = 2_000;

export interface LocalExecutionBackendOptions {
  drivers: AgentDriver[];
  connectorRegistry?: IConnectorRegistry;
  maxSessionJournalBytes?: number;
}

export class LocalExecutionBackend implements AgentExecutionBackend {
  private readonly drivers = new Map<string, AgentDriver>();
  private readonly connectorRegistry: IConnectorRegistry;
  private readonly maxSessionJournalBytes: number;
  private readonly sessions = new Set<LocalAgentSession>();
  private readonly workspaceLeases = new Map<string, string>();
  private _isDestroyed = false;

  constructor(options: LocalExecutionBackendOptions) {
    if (options.maxSessionJournalBytes !== undefined && (
      !Number.isSafeInteger(options.maxSessionJournalBytes) || options.maxSessionJournalBytes < 1024
    )) {
      throw new AgentDriverConfigurationError('maxSessionJournalBytes must be a safe integer of at least 1024');
    }
    for (const driver of options.drivers) {
      if (this.drivers.has(driver.id)) throw new Error(`Duplicate agent driver id '${driver.id}'`);
      this.drivers.set(driver.id, driver);
    }
    this.connectorRegistry = options.connectorRegistry ?? staticConnectorRegistry;
    this.maxSessionJournalBytes = options.maxSessionJournalBytes ?? DEFAULT_SESSION_JOURNAL_BYTES;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  async inspect(
    spec: Readonly<RuntimeAgentSpec>,
    request: AgentInspectionRequest = {},
  ): Promise<ResolvedAgentCapabilities> {
    this.assertActive();
    if (request.policy) validatePolicy(request.policy);
    const driver = this.getDriver(spec.driver);
    const workspace = request.workspace
      ? await this.resolveWorkspace(request.workspace, request.policy)
      : undefined;
    this.assertActive();
    const requiredCapabilities = mergeRequirements(spec, request.requiredCapabilities);
    const descriptor = await driver.inspect({
      spec,
      context: request.context,
      workspace,
      policy: request.policy,
      requiredCapabilities,
      connectorRegistry: this.connectorRegistry,
    });
    this.assertActive();
    this.assertCapabilities(descriptor.capabilities, requiredCapabilities);
    return descriptor.capabilities;
  }

  async openSession(
    spec: Readonly<RuntimeAgentSpec>,
    options: OpenAgentSessionOptions,
  ): Promise<AgentSession> {
    this.assertActive();
    validateSessionOptions(options);
    const immutableOptions = cloneAndFreezeJson(options, 'Agent session options') as Readonly<OpenAgentSessionOptions>;
    const driver = this.getDriver(spec.driver);
    const workspace = immutableOptions.workspace
      ? await this.resolveWorkspace(immutableOptions.workspace, immutableOptions.policy)
      : undefined;
    this.assertActive();
    const requestedCapabilities = [
      ...(immutableOptions.requiredCapabilities ?? []),
      ...(immutableOptions.controlMode === 'steerable' ? [{ id: 'run.steer' as const }] : []),
    ];
    const requiredCapabilities = mergeRequirements(spec, requestedCapabilities);
    const descriptor = await driver.inspect({
      spec,
      context: immutableOptions.context,
      workspace,
      policy: immutableOptions.policy,
      requiredCapabilities,
      connectorRegistry: this.connectorRegistry,
    });
    this.assertActive();
    this.assertCapabilities(descriptor.capabilities, requiredCapabilities);

    const nativeSession = await driver.openSession({
      spec,
      context: immutableOptions.context,
      workspace,
      policy: immutableOptions.policy,
      requiredCapabilities,
      connectorRegistry: this.connectorRegistry,
      metadata: immutableOptions.metadata,
    });
    try {
      if (this._isDestroyed) throw new Error('LocalExecutionBackend has been destroyed');
      const capabilities = cloneAndFreezeJson(
        descriptor.capabilities,
        'Resolved agent capabilities',
      ) as Readonly<ResolvedAgentCapabilities>;
      const session = new LocalAgentSession({
        agentId: spec.id,
        driverId: driver.id,
        nativeSession,
        capabilities,
        policy: immutableOptions.policy,
        observation: normalizeObservation(immutableOptions.observation),
        workspace,
        maxSessionJournalBytes: this.maxSessionJournalBytes,
        acquireWorkspace: (identity, runId) => this.acquireWorkspace(identity, runId),
        releaseWorkspace: (identity, runId) => this.releaseWorkspace(identity, runId),
        onDestroy: () => this.sessions.delete(session),
      });
      this.sessions.add(session);
      return session;
    } catch (error) {
      await settleWithin(
        Promise.resolve().then(() => nativeSession.destroy()),
        DEFAULT_CLEANUP_TIMEOUT_MS,
      );
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    await Promise.allSettled([...this.sessions].map((session) => session.destroy()));
    this.sessions.clear();
    this.workspaceLeases.clear();
  }

  private getDriver(id: string): AgentDriver {
    const driver = this.drivers.get(id);
    if (!driver) throw new AgentDriverNotFoundError(id);
    return driver;
  }

  private async resolveWorkspace(
    request: WorkspaceRequest,
    policy?: AgentExecutionPolicy,
  ): Promise<ResolvedWorkspace> {
    if (request.type !== 'local-directory') {
      throw new AgentWorkspaceError("The local backend does not support managed workspaces");
    }
    try {
      const root = await realpath(request.path);
      const info = await stat(root);
      if (!info.isDirectory()) throw new AgentWorkspaceError(`Workspace '${root}' is not a directory`);
      if (path.parse(root).root === root) {
        throw new AgentWorkspaceError('Filesystem roots cannot be used as agent workspaces');
      }
      await access(root, fsConstants.R_OK);
      if (policy?.filesystem === 'workspace-write') await access(root, fsConstants.W_OK);
      return { type: 'local-directory', root, identity: root };
    } catch (error) {
      if (error instanceof AgentWorkspaceError) throw error;
      throw new AgentWorkspaceError(`Cannot resolve workspace '${request.path}': ${errorMessage(error)}`, error as Error);
    }
  }

  private assertCapabilities(
    resolved: ResolvedAgentCapabilities,
    requirements: AgentCapabilityRequirement[],
  ): void {
    for (const requirement of requirements) {
      const capability = resolved.capabilities[requirement.id];
      if (!capability || capability.support === 'unsupported') {
        throw new AgentCapabilityUnsupportedError(requirement.id, capability?.reason);
      }
      if (requirement.minimum === 'native' && capability.support !== 'native') {
        throw new AgentCapabilityUnsupportedError(requirement.id, 'native support is required');
      }
    }
  }

  private acquireWorkspace(identity: string | undefined, runId: string): void {
    if (!identity) return;
    const owner = this.workspaceLeases.get(identity);
    if (owner) throw new AgentBusyError(`Workspace '${identity}' is already used by run '${owner}'`);
    this.workspaceLeases.set(identity, runId);
  }

  private releaseWorkspace(identity: string | undefined, runId: string): void {
    if (identity && this.workspaceLeases.get(identity) === runId) this.workspaceLeases.delete(identity);
  }

  private assertActive(): void {
    if (this._isDestroyed) throw new Error('LocalExecutionBackend has been destroyed');
  }
}

interface LocalAgentSessionOptions {
  agentId: string;
  driverId: string;
  nativeSession: DriverSession;
  capabilities: ResolvedAgentCapabilities;
  policy: AgentExecutionPolicy;
  observation: Required<AgentObservationOptions>;
  workspace?: ResolvedWorkspace;
  maxSessionJournalBytes: number;
  acquireWorkspace: (identity: string | undefined, runId: string) => void;
  releaseWorkspace: (identity: string | undefined, runId: string) => void;
  onDestroy: () => void;
}

class LocalAgentSession implements AgentSession {
  readonly id = `session_${randomUUID()}`;
  readonly agentId: string;
  readonly capabilities: ResolvedAgentCapabilities;
  private _state: AgentSessionState = 'ready';
  private activeRun?: LocalAgentRun;
  private readonly completedHubs: AsyncEventHub[] = [];
  private _isDestroyed = false;

  constructor(private readonly options: LocalAgentSessionOptions) {
    this.agentId = options.agentId;
    this.capabilities = options.capabilities;
  }

  get state(): AgentSessionState {
    return this._state;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  async run(input: AgentRunInput, options: AgentRunOptions = {}): Promise<AgentRun> {
    if (this._isDestroyed) throw new Error('AgentSession has been destroyed');
    if (this._state === 'failed') throw new Error('AgentSession cannot run again after unconfirmed native termination');
    if (this.activeRun) throw new AgentBusyError();
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('Run aborted before start');
    const immutableInput = typeof input === 'string'
      ? input
      : cloneAndFreezeJson(input, 'Agent run input') as Readonly<AgentRunInput>;
    const runOptions = cloneAndFreezeJson({
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.reasoning !== undefined ? { reasoning: options.reasoning } : {}),
      ...(options.responseFormat !== undefined ? { responseFormat: options.responseFormat } : {}),
      ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    }, 'Agent run options') as Readonly<Omit<AgentRunOptions, 'signal'>>;
    if (runOptions.model !== undefined) {
      if (typeof runOptions.model !== 'string' || !runOptions.model.trim()) {
        throw new AgentDriverConfigurationError('Run model override must be a non-empty string');
      }
      this.assertRunCapability('run.model_override');
    }
    if (runOptions.reasoning !== undefined) {
      validateReasoning(runOptions.reasoning);
      this.assertRunCapability('run.reasoning_override');
    }
    if (runOptions.responseFormat !== undefined) {
      validateResponseFormat(runOptions.responseFormat);
      if (runOptions.responseFormat.type === 'json_schema') {
        this.assertRunCapability('run.structured_output');
      }
    }
    if (hasWorkspaceFileInput(immutableInput as AgentRunInput)) {
      this.assertRunCapability('input.image');
    }

    const runId = `run_${randomUUID()}`;
    this.options.acquireWorkspace(this.options.workspace?.identity, runId);
    const controller = new AbortController();
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onExternalAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });

    const wallTimeMs = this.options.policy.limits?.wallTimeMs;
    if (wallTimeMs && wallTimeMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort(new AgentRunTimeoutError(wallTimeMs));
      }, wallTimeMs);
    }

    const eventBufferBytes = Math.min(
      this.options.policy.limits?.eventBufferBytes ?? DEFAULT_EVENT_BUFFER_BYTES,
      this.options.maxSessionJournalBytes,
    );
    const hub = new AsyncEventHub(runId, this.id, eventBufferBytes);
    const deferred = createDeferred<AgentRunResult>();
    const run = new LocalAgentRun(runId, this.id, hub, deferred.promise, controller, this.capabilities);
    this.activeRun = run;
    this._state = 'running';

    const effectiveConfiguration = {
      ...this.capabilities.configuration,
      ...(runOptions.model !== undefined ? { model: runOptions.model } : {}),
      ...(runOptions.reasoning !== undefined ? { reasoning: runOptions.reasoning } : {}),
    };
    hub.publish('run.started', {
      driver: this.options.driverId,
      configuration: toJsonValue(effectiveConfiguration),
      observation: toJsonValue(this.options.observation),
    });

    const onRuntimeAbort = () => {
      const reason = controller.signal.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? 'Runtime abort signal');
      void run.cancelNative(message, this.options.nativeSession).catch(() => undefined);
    };
    controller.signal.addEventListener('abort', onRuntimeAbort, { once: true });

    let finished = false;
    const finish = (result: AgentRunResult) => {
      if (finished) return;
      finished = true;
      if (timeout) clearTimeout(timeout);
      controller.signal.removeEventListener('abort', onRuntimeAbort);
      options.signal?.removeEventListener('abort', onExternalAbort);
      if (this.activeRun === run) this.activeRun = undefined;
      const nativeTerminationIsUnconfirmed = !run.nativeTerminationConfirmed;
      if (nativeTerminationIsUnconfirmed) {
        // A native process may still be mutating the workspace. Keep the lease
        // until the backend itself is destroyed rather than allowing overlap.
      } else {
        this.options.releaseWorkspace(this.options.workspace?.identity, runId);
      }
      if (!this._isDestroyed) this._state = nativeTerminationIsUnconfirmed ? 'failed' : 'ready';
      this.retainHub(hub);
      deferred.resolve(result);
    };

    void this.executeRun(run, immutableInput as AgentRunInput, runOptions, hub, controller, () => timedOut, wallTimeMs).then(
      (result) => {
        try {
          hub.publish('run.finished', { status: result.status, finishReason: result.finishReason ?? null });
          hub.complete();
        } finally {
          finish(result);
        }
      },
      (error) => {
        const nativeError = new AgentNativeExecutionError(this.options.driverId, errorMessage(error), error as Error);
        const result: AgentRunResult = {
          runId,
          sessionId: this.id,
          status: 'failed',
          outputText: '',
          artifacts: [],
          finishReason: 'native_error',
          error: { code: nativeError.code, message: nativeError.message, retryable: false },
          configuration: effectiveConfiguration,
        };
        try {
          hub.publish('run.finished', { status: 'failed', finishReason: 'native_error' });
          hub.complete();
        } catch {
          // Preserve the original failure.
        } finally {
          finish(result);
        }
      },
    );
    return run;
  }

  async cancelActiveRun(reason?: string): Promise<void> {
    await this.activeRun?.cancel(reason);
  }

  async destroy(): Promise<void> {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._state = 'destroying';
    await this.activeRun?.cancel('Session destroyed');
    await settleWithin(
      Promise.resolve().then(() => this.options.nativeSession.destroy()),
      DEFAULT_CLEANUP_TIMEOUT_MS,
    );
    for (const hub of this.completedHubs) hub.expire();
    this.completedHubs.length = 0;
    this._state = 'destroyed';
    this.options.onDestroy();
  }

  private async executeRun(
    run: LocalAgentRun,
    input: AgentRunInput,
    options: Readonly<Omit<AgentRunOptions, 'signal'>>,
    hub: AsyncEventHub,
    controller: AbortController,
    timedOut: () => boolean,
    wallTimeMs?: number,
  ): Promise<AgentRunResult> {
    let driverResult: DriverRunResult;
    let activeDriverRun: DriverRun | undefined;
    let nativeCompletion: Promise<DriverRunResult> | undefined;
    let nativeStartup: Promise<DriverRun> | undefined;
    try {
      nativeStartup = this.options.nativeSession.run({
        input,
        model: options.model,
        reasoning: options.reasoning,
        responseFormat: options.responseFormat,
        signal: controller.signal,
        metadata: mergeRunMetadata(input, options.metadata),
      });
      activeDriverRun = await raceWithAbort(nativeStartup, controller.signal);
      run.attachDriverRun(activeDriverRun);
      nativeCompletion = this.collectDriverRun(activeDriverRun, hub);
      driverResult = await raceWithAbort(nativeCompletion, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        await run.cancelNative(
          reason instanceof Error ? reason.message : String(reason ?? 'Runtime abort signal'),
          this.options.nativeSession,
        );
        let terminationConfirmed = false;
        if (activeDriverRun) {
          terminationConfirmed = await confirmDriverRunTermination(activeDriverRun, nativeCompletion);
        } else if (nativeStartup) {
          const startup = await settleOutcomeWithin(nativeStartup, DEFAULT_CLEANUP_TIMEOUT_MS);
          if (startup.status === 'rejected') {
            terminationConfirmed = true;
          } else if (startup.status === 'fulfilled') {
            activeDriverRun = startup.value;
            run.attachDriverRun(activeDriverRun);
            await run.cancelNative(
              reason instanceof Error ? reason.message : String(reason ?? 'Runtime abort signal'),
              this.options.nativeSession,
            );
            nativeCompletion = this.collectDriverRun(activeDriverRun, hub);
            terminationConfirmed = await confirmDriverRunTermination(activeDriverRun, nativeCompletion);
          }
        }
        run.setNativeTerminationConfirmed(terminationConfirmed);
      } else if (activeDriverRun) {
        await run.cancelNative(errorMessage(error), this.options.nativeSession);
        run.setNativeTerminationConfirmed(await confirmDriverRunTermination(activeDriverRun, nativeCompletion));
      }
      const nativeError = timedOut()
        ? new AgentRunTimeoutError(wallTimeMs ?? 0)
        : new AgentNativeExecutionError(this.options.driverId, errorMessage(error), error as Error);
      driverResult = {
        status: controller.signal.aborted && !timedOut() ? 'cancelled' : 'failed',
        outputText: '',
        error: {
          code: nativeError.code,
          message: nativeError.message,
          retryable: false,
        },
        finishReason: timedOut() ? 'timeout' : controller.signal.aborted ? 'cancelled' : 'native_error',
      };
    }

    if (timedOut()) {
      const timeoutError = new AgentRunTimeoutError(wallTimeMs ?? 0);
      driverResult = {
        ...driverResult,
        status: 'failed',
        error: { code: timeoutError.code, message: timeoutError.message, retryable: false },
        finishReason: 'timeout',
      };
    } else if (controller.signal.aborted || run.wasCancelled) {
      driverResult = {
        ...driverResult,
        status: 'cancelled',
        error: undefined,
        finishReason: 'cancelled',
      };
    }

    const outputTruncated = isTextOverLimit(driverResult.outputText, this.options.policy.limits?.outputBytes);
    const artifactsTruncated = areArtifactsOverLimit(
      driverResult.artifacts ?? [],
      this.options.policy.limits?.artifactBytes,
    );
    const parsedTruncated = isJsonOverLimit(driverResult.outputParsed, this.options.policy.limits?.outputBytes);
    const result: AgentRunResult = {
      runId: run.id,
      sessionId: this.id,
      status: driverResult.status,
      outputText: boundText(driverResult.outputText, this.options.policy.limits?.outputBytes),
      outputParsed: parsedTruncated ? undefined : driverResult.outputParsed,
      artifacts: boundArtifacts(driverResult.artifacts ?? [], this.options.policy.limits?.artifactBytes),
      usage: driverResult.usage,
      finishReason: driverResult.finishReason,
      error: driverResult.error,
      configuration: driverResult.configuration ?? {
        ...this.capabilities.configuration,
        ...(options.model !== undefined ? { model: options.model } : {}),
        ...(options.reasoning !== undefined ? { reasoning: options.reasoning } : {}),
      },
      enforcement: driverResult.enforcement,
      native: driverResult.native === undefined
        ? undefined
        : {
            driver: this.options.driverId,
            sanitized: boundJsonValue(
              driverResult.native,
              this.options.policy.limits?.outputBytes ?? DEFAULT_EVENT_BUFFER_BYTES,
            ),
          },
    };
    if ((outputTruncated || artifactsTruncated || parsedTruncated) && result.status === 'completed') {
      result.status = 'incomplete';
      result.finishReason = 'runtime_limit';
    }
    return result;
  }

  private async collectDriverRun(driverRun: DriverRun, hub: AsyncEventHub): Promise<DriverRunResult> {
    for await (const event of driverRun.events) {
      if (shouldPublishEvent(event.type, this.options.observation)) {
        hub.publish(event.type, event.data, event.timestamp);
      }
    }
    return driverRun.result;
  }

  private assertRunCapability(id: string): void {
    const capability = this.capabilities.capabilities[id];
    if (!capability || capability.support === 'unsupported') {
      throw new AgentCapabilityUnsupportedError(id, capability?.reason);
    }
  }

  private retainHub(hub: AsyncEventHub): void {
    this.completedHubs.push(hub);
    let retained = this.completedHubs.reduce((sum, item) => sum + item.retainedBytes, 0);
    while (retained > this.options.maxSessionJournalBytes && this.completedHubs.length > 0) {
      const expired = this.completedHubs.shift();
      if (!expired) break;
      retained -= expired.retainedBytes;
      expired.expire();
    }
  }
}

class LocalAgentRun implements AgentRun {
  private cancellationRequested = false;
  private driverRun?: DriverRun;
  private _nativeTerminationConfirmed = true;

  constructor(
    readonly id: string,
    readonly sessionId: string,
    private readonly hub: AsyncEventHub,
    readonly result: Promise<AgentRunResult>,
    private readonly controller: AbortController,
    private readonly capabilities: ResolvedAgentCapabilities,
  ) {}

  get wasCancelled(): boolean {
    return this.cancellationRequested;
  }

  get nativeTerminationConfirmed(): boolean {
    return this._nativeTerminationConfirmed;
  }

  events(options?: AgentEventSubscriptionOptions) {
    return this.hub.subscribe(options);
  }

  async cancel(reason?: string): Promise<void> {
    if (!this.cancellationRequested) {
      this.cancellationRequested = true;
      this.controller.abort(reason);
    }
    await this.result;
  }

  async steer(input: AgentRunInput): Promise<void> {
    this.assertControlCapability('run.steer');
    if (!this.driverRun?.steer) throw new AgentBusyError('The native run is not ready to accept steering');
    await this.driverRun.steer(input);
  }

  async respondToInteraction(interactionId: string, response: AgentInteractionResponse): Promise<void> {
    this.assertControlCapability('run.interaction');
    if (!this.driverRun?.respondToInteraction) {
      throw new AgentBusyError('The native run is not ready to accept an interaction response');
    }
    await this.driverRun.respondToInteraction(interactionId, response);
  }

  attachDriverRun(driverRun: DriverRun): void {
    this.driverRun = driverRun;
  }

  setNativeTerminationConfirmed(confirmed: boolean): void {
    this._nativeTerminationConfirmed = confirmed;
  }

  async cancelNative(reason: string, nativeSession: DriverSession): Promise<void> {
    const driverRun = this.driverRun;
    if (driverRun) {
      await settleWithin(
        Promise.resolve().then(() => driverRun.cancel(reason)),
        DEFAULT_CLEANUP_TIMEOUT_MS,
      );
      return;
    }
    await settleWithin(
      Promise.resolve().then(() => nativeSession.cancelActiveRun(reason)),
      DEFAULT_CLEANUP_TIMEOUT_MS,
    );
  }

  private assertControlCapability(id: string): void {
    const capability = this.capabilities.capabilities[id];
    if (!capability || capability.support === 'unsupported') {
      throw new AgentCapabilityUnsupportedError(id, capability?.reason);
    }
  }
}

function boundText(text: string, maxBytes?: number): string {
  if (!maxBytes || Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  const suffix = '\n[output truncated by Agent Runtime]';
  const suffixBytes = Buffer.byteLength(suffix, 'utf8');
  if (maxBytes <= suffixBytes) return truncateUtf8(text, maxBytes);
  return `${truncateUtf8(text, maxBytes - suffixBytes)}${suffix}`;
}

function isTextOverLimit(text: string, maxBytes?: number): boolean {
  return maxBytes !== undefined && maxBytes > 0 && Buffer.byteLength(text, 'utf8') > maxBytes;
}

function areArtifactsOverLimit<T>(artifacts: T[], maxBytes?: number): boolean {
  if (!maxBytes) return false;
  let bytes = 0;
  for (const artifact of artifacts) {
    bytes += Buffer.byteLength(JSON.stringify(artifact), 'utf8');
    if (bytes > maxBytes) return true;
  }
  return false;
}

function isJsonOverLimit(value: JsonValue | undefined, maxBytes?: number): boolean {
  return value !== undefined
    && maxBytes !== undefined
    && maxBytes > 0
    && Buffer.byteLength(JSON.stringify(value), 'utf8') > maxBytes;
}

function boundJsonValue(value: JsonValue, maxBytes: number): JsonValue {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') <= maxBytes) return value;
  const marker = { truncated: true };
  if (Buffer.byteLength(JSON.stringify(marker), 'utf8') <= maxBytes) return marker;
  return maxBytes >= 4 ? null : 0;
}

function truncateUtf8(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  let truncated = Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8');
  if (truncated.endsWith('\uFFFD')) truncated = truncated.slice(0, -1);
  return truncated;
}

function boundArtifacts<T>(artifacts: T[], maxBytes?: number): T[] {
  if (!maxBytes) return artifacts;
  const result: T[] = [];
  let bytes = 0;
  for (const artifact of artifacts) {
    const size = Buffer.byteLength(JSON.stringify(artifact), 'utf8');
    if (bytes + size > maxBytes) break;
    result.push(artifact);
    bytes += size;
  }
  return result;
}

function validatePolicyLimits(policy: AgentExecutionPolicy): void {
  if (policy.limits !== undefined && (
    !policy.limits || typeof policy.limits !== 'object' || Array.isArray(policy.limits)
  )) {
    throw new AgentDriverConfigurationError('Agent execution policy limits must be an object');
  }
  for (const [name, value] of Object.entries(policy.limits ?? {})) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new AgentDriverConfigurationError(`Agent execution policy limit '${name}' must be a positive safe integer`);
    }
    if (name === 'eventBufferBytes' && value < 1024) {
      throw new AgentDriverConfigurationError("Agent execution policy limit 'eventBufferBytes' must be at least 1024");
    }
  }
}

function validatePolicy(policy: AgentExecutionPolicy): void {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new AgentDriverConfigurationError('Agent execution policy must be an object');
  }
  validateChoice(policy.filesystem, ['denied', 'read-only', 'workspace-write'], 'policy.filesystem');
  validateChoice(policy.commands, ['denied', 'sandboxed'], 'policy.commands');
  validateChoice(policy.sandboxNetwork, ['denied', 'allowed'], 'policy.sandboxNetwork');
  validateChoice(policy.providerWebSearch, ['denied', 'allowed'], 'policy.providerWebSearch');
  validateChoice(policy.approvals, ['deny', 'interactive'], 'policy.approvals');
  validatePolicyLimits(policy);
}

function validateSessionOptions(options: OpenAgentSessionOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new AgentDriverConfigurationError('Agent session options must be an object');
  }
  if (!options.context || typeof options.context !== 'object' || Array.isArray(options.context)) {
    throw new AgentDriverConfigurationError('Agent session context must be an object');
  }
  validatePolicy(options.policy);
  if (options.controlMode !== undefined) {
    validateChoice(options.controlMode, ['observe-only', 'steerable'], 'controlMode');
  }
  if (options.observation !== undefined) {
    if (!options.observation || typeof options.observation !== 'object' || Array.isArray(options.observation)) {
      throw new AgentDriverConfigurationError('Agent observation options must be an object');
    }
    if (options.observation.mode !== undefined) {
      validateChoice(options.observation.mode, ['live', 'final-only'], 'observation.mode');
    }
    if (options.observation.detail !== undefined) {
      validateChoice(options.observation.detail, ['status', 'activity', 'reasoning'], 'observation.detail');
    }
  }
}

function validateChoice(value: unknown, choices: readonly string[], label: string): void {
  if (typeof value !== 'string' || !choices.includes(value)) {
    throw new AgentDriverConfigurationError(`Agent ${label} must be one of: ${choices.join(', ')}`);
  }
}

function validateReasoning(reasoning: NonNullable<AgentRunOptions['reasoning']>): void {
  if (!reasoning || typeof reasoning !== 'object' || Array.isArray(reasoning)) {
    throw new AgentDriverConfigurationError('Reasoning override must be an object');
  }
  if (reasoning.enabled !== undefined && typeof reasoning.enabled !== 'boolean') {
    throw new AgentDriverConfigurationError('Reasoning enabled must be a boolean');
  }
  if (reasoning.budgetTokens !== undefined && (
    !Number.isSafeInteger(reasoning.budgetTokens) || reasoning.budgetTokens <= 0
  )) {
    throw new AgentDriverConfigurationError('Reasoning budgetTokens must be a positive safe integer');
  }
  const efforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
  if (reasoning.effort !== undefined && !efforts.has(reasoning.effort)) {
    throw new AgentDriverConfigurationError(`Invalid reasoning effort '${reasoning.effort}'`);
  }
}

function validateResponseFormat(format: NonNullable<AgentRunOptions['responseFormat']>): void {
  if (!format || typeof format !== 'object' || Array.isArray(format)) {
    throw new AgentDriverConfigurationError('Response format must be an object');
  }
  if (format.type === 'text') return;
  if (format.type !== 'json_schema') {
    throw new AgentDriverConfigurationError("Response format type must be 'text' or 'json_schema'");
  }
  if (!format.schema || typeof format.schema !== 'object' || Array.isArray(format.schema)) {
    throw new AgentDriverConfigurationError('JSON Schema response format requires an object schema');
  }
  if (format.name !== undefined && (typeof format.name !== 'string' || !format.name.trim())) {
    throw new AgentDriverConfigurationError('JSON Schema response format name must be a non-empty string');
  }
  if (format.strict !== undefined && typeof format.strict !== 'boolean') {
    throw new AgentDriverConfigurationError('JSON Schema response format strict must be a boolean');
  }
}

function hasWorkspaceFileInput(input: AgentRunInput): boolean {
  return typeof input !== 'string' && input.parts.some((part) => part.type === 'workspace-file');
}

function normalizeObservation(observation?: AgentObservationOptions): Required<AgentObservationOptions> {
  return {
    mode: observation?.mode ?? 'live',
    detail: observation?.detail ?? 'reasoning',
  };
}

function shouldPublishEvent(
  type: DriverEvent['type'],
  observation: Required<AgentObservationOptions>,
): boolean {
  const essential = type === 'agent.message.completed'
    || type === 'usage.updated'
    || type === 'diagnostic'
    || type === 'interaction.requested'
    || type === 'interaction.resolved';
  if (observation.mode === 'final-only') return essential;
  if (observation.detail === 'status') return essential;
  if (observation.detail === 'activity' && (type === 'reasoning.delta' || type === 'reasoning.completed')) {
    return false;
  }
  return true;
}

async function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason ?? new Error('Run aborted');
  let onAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason ?? new Error('Run aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

async function settleWithin(promise: Promise<unknown> | void, timeoutMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.resolve(promise).then(() => undefined, () => undefined),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, timeoutMs);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
}

type Settlement<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected' }
  | { status: 'timed-out' };

async function settleOutcomeWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<Settlement<T>> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race<Settlement<T>>([
    promise.then<Settlement<T>, Settlement<T>>(
      (value) => ({ status: 'fulfilled', value }),
      () => ({ status: 'rejected' }),
    ),
    new Promise<Settlement<T>>((resolve) => {
      timeout = setTimeout(() => resolve({ status: 'timed-out' }), timeoutMs);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  return outcome;
}

async function confirmDriverRunTermination(
  driverRun: DriverRun,
  nativeCompletion?: Promise<DriverRunResult>,
): Promise<boolean> {
  const terminal = nativeCompletion
    ? Promise.allSettled([driverRun.result, nativeCompletion]).then(() => undefined)
    : driverRun.result.then(() => undefined, () => undefined);
  return (await settleOutcomeWithin(terminal, DEFAULT_CLEANUP_TIMEOUT_MS)).status !== 'timed-out';
}

function mergeRunMetadata(input: AgentRunInput, metadata: AgentRunOptions['metadata']): AgentRunOptions['metadata'] {
  const inputMetadata = typeof input === 'string' ? undefined : input.metadata;
  if (!inputMetadata) return metadata;
  if (!metadata) return inputMetadata;
  return { ...inputMetadata, ...metadata };
}

const staticConnectorRegistry: IConnectorRegistry = {
  get: (name) => Connector.get(name),
  has: (name) => Connector.has(name),
  list: () => Connector.list(),
  listAll: () => Connector.listAll(),
  size: () => Connector.size(),
  getDescriptionsForTools: () => Connector.getDescriptionsForTools(),
  getInfo: () => Connector.getInfo(),
  getById: (id) => Connector.getById(id),
  warmup: () => Connector.warmup(),
};
