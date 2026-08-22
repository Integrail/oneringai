# Vendor-Neutral Agent Runtime

**Status:** final design proposed for approval; not implemented

**Date:** 2026-08-22

**First implementation:** local proof of concept using native OneRingAI agents and
the OpenAI Codex TypeScript SDK

**Later integrations:** Claude Agent SDK, Codex App Server, hosted agents, isolated
server workers, and A2A interoperability

## Executive decision

Add an `agent-runtime` API above OneRingAI's existing `Agent` API. It executes a
complete agent harness—a system that owns its loop, tools, context, sessions, and
workspace—not another text-model provider.

The design has two independent extension points:

1. An **agent driver** adapts a native agent system such as OneRingAI, Codex, Claude,
   or a remote A2A agent.
2. An **execution backend** decides where a driver executes: in the current Node.js
   process, in a future isolated worker, or behind a remote runtime service.

The local proof of concept will implement only:

- a small vendor-neutral agent/session/run API;
- normalized capabilities, policies, events, results, and errors;
- an in-process local backend;
- a OneRingAI driver;
- an optional Codex SDK driver;
- deterministic contract tests and two real local examples.

It will not implement durable cross-process sessions, containers, a control-plane
HTTP API, App Server, Claude, A2A, interactive approvals, or an orchestrator rewrite.
Those are designed here only far enough to ensure that the local contracts do not
block them.

The architectural decisions are:

- Agent drivers are not `ITextProvider` implementations.
- Execution location is not encoded in a driver.
- OneRingAI's existing `Agent`, `StoredAgentDefinition`, `AgentResponse`,
  `StreamEvent`, context plugins, and `ToolManager` remain unchanged.
- `RuntimeAgentSpec` is an execution descriptor, not a second authoritative agent
  catalog.
- Capabilities are negotiated; unsupported requirements fail in preflight.
- A session has at most one active mutating run.
- The backend owns the native event pump, so completion does not depend on a caller
  consuming a stream.
- The local backend is for trusted developer execution, not tenant isolation.
- A future server assigns an isolated **execution lease per active run**, with
  optional warm session affinity. A logical session does not permanently own a VM.
- A2A belongs at an external interoperability boundary, not between OneRingAI's
  control plane and its workers.

Approval of this document authorizes only the local proof of concept.

## What changed after the final critical review

The previous draft had the right driver/backend split but carried too much server
machinery into the first implementation. It also tried to make the current persisted
OneRingAI definition generic. That would have produced unnecessary public type
changes and a misleading promise that all native agent state is serializable.

| Previous design choice | Issue | Final design |
|---|---|---|
| Upgrade `StoredAgentDefinition` to a generic version 2 | It is intentionally a OneRingAI definition and is used directly by `Agent.fromStorage()` | Keep it unchanged; add a separate, lightweight `RuntimeAgentSpec` |
| Migrate connector/model and identity fields | Unrelated to proving cross-runtime execution and semver-significant | No storage migration and no identity migration |
| Ship session, run, event, and artifact stores in the PoC | Creates a control plane before the execution contract has been validated | Use in-memory handles in the PoC; design durable records only for the later server phase |
| Make cross-process resume a PoC acceptance criterion | Native SDK state and workspaces require deployment-specific checkpointing | Prove same-process multi-turn sessions; validate native resume mapping without promising portability |
| Container per active session | Idle conversations retain expensive compute and workspace locks | Lease isolation per active run; optionally retain a warm worker for a short idle TTL |
| Hold a workspace write lease for the logical session | An idle session can block unrelated work | Hold the exclusive write lease only while a run is active |
| Large driver interface with config migration and inspection hooks | Prematurely freezes extension points that no second implementation needs yet | Keep the base driver contract minimal and add optional capabilities deliberately |
| Public replay/storage methods and `run.release()` | Exposes implementation lifecycle and complicates local use | No public release method; backend manages its buffers and future retention policy |
| Arbitrary native config passthrough | Bypasses policy and couples callers to unstable vendor details | Expose a reviewed, typed driver config; add fields only when needed |
| Treat an SDK sandbox as a server tenant boundary | Process sandboxing and tenant isolation solve different threats | Local is explicitly trusted; future servers use container or microVM isolation plus policy enforcement |

This is a deliberate reduction in scope, not a reduction in extensibility. The stable
abstractions are the ones that must span vendors and locations; persistence and
transport remain replaceable deployment concerns.

## Why this belongs in OneRingAI

OneRingAI already supplies a complete agent harness: named connectors, one shared
tool manager, context plugins, memory, permissions, persistence, and orchestration.
Coding-agent SDKs operate at the same level. They have their own loop, built-in file
and command tools, session state, workspace assumptions, and approval rules.

Putting Codex or Claude behind `ITextProvider` would create two competing loops and
blur ownership of tools and context. Wrapping an external coding agent as one giant
tool would be useful for delegation in some workflows, but it would hide native
streaming, cancellation, sessions, artifacts, and interactions. Neither is an
adequate primary integration.

The runtime therefore sits above both the existing OneRingAI `Agent` and external
agent harnesses:

```text
Application / workflow / future orchestrator
                    |
             AgentRuntime API
                    |
          AgentExecutionBackend
            /               \
      Local backend       Future remote backend
            |                    |
        Driver registry      Isolated worker lease
       /       |      \             |
  OneRingAI  Codex   future      same driver contract
```

The existing connector-first and plugin-first rules remain non-negotiable:

- credentials come from named connectors, never prompts or runtime specs;
- AI vendor is explicit and is not inferred from a model name;
- a OneRingAI driver's native agent retains exactly one `ToolManager`, with
  `agent.tools === agent.context.tools`;
- external agent drivers own their native tool pipeline; OneRingAI does not create a
  shadow copy of it;
- host authorization determines tenant, user, connector visibility, workspace, and
  policy before the model runs.

## Vendor facts that constrain the design

### OpenAI Codex TypeScript SDK

The Codex SDK is a library wrapper around a locally executed Codex CLI process. It
communicates through JSONL, exposes thread creation and resume, streamed turn events,
structured output, image input, workspace and sandbox configuration, and cancellation
with `AbortSignal`.

Consequences:

- there is no hosted Codex SDK server for OneRingAI to call;
- the application running the driver must have the SDK/CLI and supported runtime;
- a thread ID is not by itself a portable checkpoint because native state lives in
  the Codex state directory and work may depend on workspace contents;
- the child process must receive a deliberately built environment rather than the
  server's entire inherited environment;
- the SDK is suitable for a local PoC and later for execution inside an isolated
  worker;
- its interaction surface is narrower than Codex App Server, so the PoC must not
  advertise interactive approval or user-input support.

### Codex App Server

Codex App Server is a separate process started with `codex app-server`. OpenAI does
not host a dedicated App Server instance for an application. A host application starts
and supervises it locally or in its own container/VM and speaks its JSON-RPC protocol.

App Server supports richer thread control and bidirectional interactions than the SDK.
Its normal transports are local-process oriented; the documented WebSocket transport
is experimental and not the production server boundary for this design.

Therefore App Server is a future `openai.codex.app-server` driver. It may share
Codex event-mapping helpers with the SDK driver, but it is not the first driver and is
not silently substituted for the SDK.

### Claude and hosted agent systems

The Claude Agent SDK has sessions, streaming, structured output, permissions, hooks,
subagents, MCP, and bidirectional tool-approval callbacks. These are similar enough to
fit the session/run model but different enough to require capability negotiation.

A hosted agent service is also a driver, not an execution backend. The driver adapts
the hosted service's agent/session/event API; the backend merely determines where the
adapter code runs. A future Claude driver must use supported API authentication and
must not silently reuse a developer's consumer login.

### A2A

A2A is valuable for discovery and communication across a network trust boundary. It
provides messages, tasks, states, artifacts, streaming, cancellation, and agent cards.
It does not define worker scheduling, workspace mounts, native SDK state, credential
leases, or sufficiently detailed command/file events.

The later A2A support should consist of:

- an outbound `a2a.remote` driver; and
- an inbound adapter exposing selected runtime agents as A2A agents.

A2A is not the internal backend-to-worker protocol.

## Goals

1. Give callers the same session/run workflow for OneRingAI and external agent SDKs.
2. Preserve native capabilities instead of forcing a false lowest common denominator.
3. Support local development with minimal setup.
4. Leave a clean boundary for isolated server execution.
5. Preserve connector-first authentication and trusted host scoping.
6. Normalize lifecycle, policy, output, files, commands, tools, usage, and errors.
7. Allow feature requirements to be checked before expensive work starts.
8. Keep optional vendor dependencies out of the core install and public core types.
9. Enable later orchestration without changing the existing orchestrator now.

## Non-goals for the local PoC

- durable sessions across process or machine restarts;
- a generic persistent agent-definition service;
- a server HTTP API, queue, worker scheduler, or container image;
- complete event replay after a caller disconnects;
- interactive approvals, steering, or user questions;
- arbitrary host filesystem access;
- automatic tool translation between native agent systems;
- automatic migration of native SDK sessions across versions;
- A2A, Claude, App Server, or hosted-agent implementation;
- refactoring `createOrchestrator()`;
- sandboxing untrusted tenants in the local Node.js process.

## Core domain model

### Terms

- **Runtime spec:** a JSON-serializable description of which driver to use and the
  references/configuration needed to create it. It is not necessarily persisted.
- **Runtime agent:** an immutable handle created from a spec.
- **Session:** a logical multi-turn conversation and workspace association.
- **Run:** one active turn inside a session.
- **Driver:** an adapter for one native agent system.
- **Backend:** a placement and lifecycle manager that invokes drivers.
- **Execution lease:** a future server allocation granting a run exclusive use of a
  worker and workspace for a bounded time.
- **Native checkpoint:** driver-owned state needed to continue a session; its format
  is opaque to the generic runtime.

### Runtime spec is not a stored OneRingAI definition

`StoredAgentDefinition` remains version 1 and remains specific to `Agent.hydrate()` and
`Agent.fromStorage()`. No existing public storage interfaces change in the PoC.

The new descriptor is intentionally small:

```ts
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface RuntimeAgentSpec {
  /** Stable caller-supplied identity for logging and future persistence. */
  id: string;
  name?: string;
  /** Stable dotted ID, e.g. `oneringai.agent` or `openai.codex.sdk`. */
  driver: string;
  /** Named connector when the native source does not already own one. */
  connector?: string;
  /** Optional because some hosted agents own model selection. */
  model?: string;
  instructions?: string;
  /** Version 1 is implicit for the preview API; migration is added with persistence. */
  driverConfig?: Record<string, JsonValue>;
  requiredCapabilities?: AgentCapabilityRequirement[];
  metadata?: Record<string, JsonValue>;
}
```

Drivers decide which generic fields they require. The Codex driver requires a named
OpenAI connector and an explicit active, Codex-capable model validated through
OneRingAI's model/capability registries. The OneRingAI driver may instead resolve an
existing stored definition, bound agent, or factory whose connector and model are
already defined.

`driverConfig` contains only reviewed, serializable options. It cannot contain
credentials, functions, arbitrary environment variables, absolute untrusted paths, or
an unrestricted vendor configuration bag. A driver-specific exported helper validates
and constructs it.

If product needs later require a cross-driver agent catalog, a separate runtime-spec
repository can persist this type. That decision is deferred until there is a real
catalog use case. It must not replace native definitions or make a runtime spec the
source of truth for credentials.

For `stored-definition`, `binding`, and `factory` OneRingAI sources, the PoC rejects
common `connector`, `model`, or `instructions` overrides. The native source remains
authoritative. This avoids unclear precedence and accidental mutation of a bound
agent. A future explicit overlay feature would need its own capability and tests.

For drivers that accept `instructions`, they are mapped to the native
developer/system-instruction channel. They are never concatenated into the user's task
text as an invisible fallback. A driver that cannot preserve the distinction rejects
the field or reports a specifically documented emulation.

### Local bindings

Existing OneRingAI agents can contain tools, hooks, and plugin instances that cannot
be serialized. The OneRingAI driver used by the local backend therefore accepts an
explicit binding registry:

```ts
export interface LocalAgentBindings {
  oneringaiAgents?: Record<
    string,
    { agent: Agent; ownership?: 'borrowed' | 'owned' }
  >;
  oneringaiFactories?: Record<
    string,
    (context: LocalAgentFactoryContext) => Agent | Promise<Agent>
  >;
}
```

The OneRingAI driver's `source` config is one of:

```ts
type OneRingAgentSource =
  | { type: 'stored-definition'; agentId: string }
  | { type: 'binding'; name: string }
  | { type: 'factory'; name: string };
```

Bindings never cross a remote boundary. Bound agents are borrowed by default; a
borrowed agent is never destroyed by the runtime, while an explicitly owned one is.
A factory creates one owned native agent per runtime session. A bound singleton can
back only one active runtime session unless explicitly declared safe by a later API;
this avoids accidental context sharing.

The stored-definition path reconstructs only what the existing public storage format
actually represents. Missing application tool factories or plugin resources fail
preflight instead of silently creating a weaker agent.

## Public API

The application-facing surface is deliberately independent of placement:

```ts
const runtime = new AgentRuntime({
  backend: new LocalExecutionBackend({
    drivers: [
      new OneRingAIDriver({ definitionStorage, bindings }),
      new CodexSdkDriver(),
    ],
  }),
});

const agent = runtime.agent({
  id: 'repo-worker',
  driver: 'openai.codex.sdk',
  connector: 'openai-main',
  model: 'gpt-5.3-codex',
  instructions: 'Make focused changes and verify them.',
  driverConfig: { reasoningEffort: 'high' },
});

const session = await agent.openSession({
  workspace: { type: 'local-directory', path: '/absolute/trusted/path' },
  policy: {
    filesystem: 'workspace-write',
    commands: 'sandboxed',
    sandboxNetwork: 'denied',
    providerWebSearch: 'denied',
    approvals: 'deny',
  },
  context: { userId: 'local-developer' },
});

const run = await session.run('Implement the requested change.');

for await (const event of run.events()) {
  render(event);
}

const result = await run.result;
await session.destroy();
await runtime.destroy();
```

Changing the driver to `oneringai.agent` does not change session, run, event, or
result handling.

### Interfaces

```ts
export interface AgentRuntimeOptions {
  backend: AgentExecutionBackend;
  backendOwnership?: 'owned' | 'borrowed';
}

export class AgentRuntime implements IAsyncDisposable {
  agent(spec: RuntimeAgentSpec): RuntimeAgent;
  destroy(): Promise<void>;
  readonly isDestroyed: boolean;
}

export interface RuntimeAgent {
  readonly spec: Readonly<RuntimeAgentSpec>;
  inspect(request?: AgentInspectionRequest): Promise<ResolvedAgentCapabilities>;
  openSession(options: OpenAgentSessionOptions): Promise<AgentSession>;
}

export interface AgentSession extends IAsyncDisposable {
  readonly id: string;
  readonly agentId: string;
  readonly capabilities: ResolvedAgentCapabilities;
  readonly state: AgentSessionState;

  run(input: AgentRunInput, options?: AgentRunOptions): Promise<AgentRun>;
  cancelActiveRun(reason?: string): Promise<void>;
}

export interface AgentRun {
  readonly id: string;
  readonly sessionId: string;
  readonly result: Promise<AgentRunResult>;

  events(): AsyncIterable<AgentRunEvent>;
  cancel(reason?: string): Promise<void>;
}
```

The implementation follows the repository's `IAsyncDisposable` convention:
`destroy(): Promise<void>` and `isDestroyed`. Destroy operations are idempotent.
Injected backends are owned by default so the simple construction pattern cannot leak
processes. A caller sharing a backend across runtimes must explicitly mark it
`borrowed`. The runtime always destroys the sessions it opened; ownership controls
whether it also destroys the backend itself.

`agent()` validates, deep-clones, and freezes the JSON spec. Later mutations to the
caller's original object cannot change a live runtime agent or session.

`inspect()` is read-only: it may validate dependency versions, connectors, registries,
workspace shape, and policy, but it does not start an agent turn or modify a workspace.
An inspection without workspace/policy context is only a static capability view;
`openSession()` performs the authoritative contextual preflight. Requirements in the
spec and session options are combined, never replaced or weakened.

`run.result` settles independently of event consumption. The backend starts the
native stream pump before returning the handle, writes normalized events to a bounded
in-memory journal/hub, and settles the result itself. A slow or absent subscriber
cannot stall the native run.

`events()` first yields the retained journal from sequence one and then follows live
events. This ensures that events emitted between `session.run()` and subscription are
not lost. The journal is retained until the run/session retention boundary and is
bounded by policy. When it approaches its limit, the hub coalesces or drops only
high-volume deltas and emits a diagnostic gap; it preserves structural and terminal
events. Each subscriber also has a bounded queue. If a subscriber exceeds that queue,
that subscriber receives a typed overflow error; the native run continues and
`result` remains available. None of this promises replay after process failure.

The local backend also enforces a total journal budget per session. It may evict the
oldest terminal run journal after that budget is reached; settled `run.result` handles
remain valid, while a new event subscription to evicted history fails explicitly with
`AgentEventHistoryExpiredError`. Active-run structural events are never evicted.

### Input and run options

```ts
export type AgentRunInput =
  | string
  | {
      parts: AgentInputPart[];
      metadata?: Record<string, JsonValue>;
    };

export type AgentInputPart =
  | { type: 'text'; text: string }
  | { type: 'workspace-file'; path: string; mediaType?: string };

export interface AgentRunOptions {
  signal?: AbortSignal;
  responseFormat?: RuntimeResponseFormat;
  metadata?: Record<string, JsonValue>;
}

export type RuntimeResponseFormat =
  | { type: 'text' }
  | {
      type: 'json_schema';
      name?: string;
      schema: JsonValue;
      strict?: boolean;
    };
```

Workspace-file paths are relative to the resolved workspace root. Traversal and
absolute paths are rejected before they reach a driver. Generic metadata is control
plane data and is not added to a prompt or tool arguments unless a typed mapping says
so.

Structured-output requirements are capability checked. The driver passes the schema
to a native feature where possible, validates the returned value, and reports whether
enforcement was `native` or `emulated`. The generic runtime does not perform a hidden
second model call. OneRingAI may use its existing documented repair behavior and must
report that as part of its enforcement metadata.

## Driver contract

The first version exposes the smallest contract needed by two drivers:

```ts
export interface AgentDriver {
  readonly id: string;

  inspect(context: DriverInspectionContext): Promise<DriverDescriptor>;
  openSession(request: DriverOpenSessionRequest): Promise<DriverSession>;
}

export interface DriverSession extends IAsyncDisposable {
  readonly nativeSessionId?: string;
  run(request: DriverRunRequest): Promise<DriverRun>;
  cancelActiveRun(reason?: string): Promise<void>;
}

export interface DriverRun {
  readonly events: AsyncIterable<DriverEvent>;
  readonly result: Promise<DriverRunResult>;
  cancel(reason?: string): Promise<void>;
}
```

The driver performs semantic native-to-generic mapping. A `DriverEvent` is an event
draft containing the public event type and sanitized data, but no public sequence or
runtime IDs. The backend, not the application, consumes `DriverRun.events`; it stamps
IDs/timestamps/sequences, applies size and buffer limits, records diagnostics, and
resolves terminal state. The backend never needs vendor-specific event knowledge.

The base contract intentionally excludes generic methods for config migration,
durable checkpointing, steering, approvals, and schema discovery. Those become
optional capability interfaces only when an implementation needs them:

```ts
export interface RestorableDriver {
  restoreSession(request: DriverRestoreSessionRequest): Promise<DriverSession>;
}

export interface CheckpointableDriverSession {
  checkpoint(): Promise<OpaqueDriverCheckpoint>;
}

export interface InteractiveDriverRun {
  respond(requestId: string, response: JsonValue): Promise<void>;
}
```

This prevents a giant interface full of methods that most drivers cannot honor. A
future persistent runtime must version the opaque checkpoint envelope and pin driver
and worker-image compatibility; that does not need to be frozen in the PoC.

Drivers must:

- resolve authentication only through connector services supplied by trusted host
  context;
- validate their typed config and capability requirements before starting native
  work;
- map cancellation to the strongest native primitive available;
- destroy processes and resources they own;
- redact secrets from errors, events, and logs;
- avoid exposing private chain-of-thought;
- state honestly which policies are enforced, emulated, advisory, or unsupported.

## Execution backend contract

```ts
export interface AgentExecutionBackend extends IAsyncDisposable {
  inspect(
    spec: RuntimeAgentSpec,
    request?: AgentInspectionRequest,
  ): Promise<ResolvedAgentCapabilities>;

  openSession(
    spec: RuntimeAgentSpec,
    options: OpenAgentSessionOptions,
  ): Promise<BackendAgentSession>;
}
```

`LocalExecutionBackend` owns a driver registry, validates duplicate driver IDs,
resolves trusted local workspaces, creates the event hub, and supervises active
sessions and child processes. It accepts `local-directory` workspaces only from direct
library calls made by a trusted developer application.

A future remote backend can implement the same contract by calling a OneRingAI
control plane. The core API therefore does not contain container IDs, queue names,
HTTP response codes, SSE cursors, or cloud-specific job types.

## Capability model

Capabilities avoid both a false common denominator and silent degradation.

```ts
export type CapabilitySupport = 'native' | 'emulated' | 'unsupported';

export interface AgentCapability {
  id: AgentCapabilityId;
  support: CapabilitySupport;
  constraints?: Record<string, JsonValue>;
  reason?: string;
}

export interface AgentCapabilityRequirement {
  id: AgentCapabilityId;
  minimum?: Exclude<CapabilitySupport, 'unsupported'>;
}
```

`minimum: 'emulated'` accepts native or emulated support. `minimum: 'native'` accepts
only native support. Omitting it means any non-unsupported implementation.

The initial registry is intentionally small:

| Capability | Meaning |
|---|---|
| `session.continue` | More than one turn in the live session |
| `session.restore` | Restore from native state after the live object is gone |
| `run.cancel` | Request and observe native cancellation |
| `run.structured_output` | JSON Schema response support |
| `run.interaction` | Pause and accept an approval or user response |
| `run.steer` | Add guidance to a running turn |
| `input.image` | Native image input |
| `event.command` | Structured command lifecycle events |
| `event.file_change` | Structured file-change events |
| `event.tool` | Structured tool-call lifecycle events |
| `isolation.workspace` | Filesystem actions constrained to the workspace |
| `isolation.tenant` | Isolation suitable for mutually untrusted tenants |

Driver support is intersected with backend enforcement and the requested policy. For
example, Codex may natively constrain workspace writes, but the local backend still
reports `isolation.tenant: unsupported`. A container backend may report tenant
isolation only after its threat model and controls have been reviewed.

Required capabilities are checked during `inspect()` or `openSession()`. The runtime
throws a typed capability error before native work if a minimum cannot be met. It
never turns unsupported isolation or interaction into a best-effort promise.

The capability registry is public and additive. New capabilities do not add methods
to the base interface automatically.

## Policy and trusted context

```ts
export interface TrustedRuntimeContext {
  tenantId?: string;
  userId?: string;
  groupId?: string;
  metadata?: Record<string, JsonValue>;
}

export interface OpenAgentSessionOptions {
  context: TrustedRuntimeContext;
  workspace?: WorkspaceRequest;
  policy: AgentExecutionPolicy;
  requiredCapabilities?: AgentCapabilityRequirement[];
  metadata?: Record<string, JsonValue>;
}

export interface AgentExecutionPolicy {
  filesystem: 'denied' | 'read-only' | 'workspace-write';
  commands: 'denied' | 'sandboxed';
  sandboxNetwork: 'denied' | 'allowed';
  providerWebSearch: 'denied' | 'allowed';
  approvals: 'deny' | 'interactive';
  limits?: {
    wallTimeMs?: number;
    eventBufferBytes?: number;
    outputBytes?: number;
    artifactBytes?: number;
  };
}
```

The PoC policy is purposely coarser than a future production policy. Domain/IP
egress allowlists are not represented until a backend exists that can actually
enforce them. A native boolean network option must never masquerade as an allowlist.

`sandboxNetwork` controls egress from commands and native workspace tools. It does not
block the driver's control connection to the model provider; that service channel is
authorized by the named connector. Provider-hosted web search is a separate
permission, and enabling it does not enable network access for shell commands.
Connector-backed OneRingAI tools are governed by their own authorized identities and
host tool policy. The default local examples deny sandbox network and provider search.

`commands: 'denied'` is accepted only if the resolved driver can truly prevent its
command tools from running. Otherwise preflight fails. `approvals: 'interactive'`
requires end-to-end interaction support from caller, backend, and driver; the Codex
SDK PoC reports it unsupported.

The host constructs `TrustedRuntimeContext` from authenticated state. It is never
taken from model output or a tool argument. Local examples may use a conventional
single-developer context. A server backend makes `tenantId` mandatory and scopes every
session, workspace, credential lease, event, and artifact lookup to it.

Opaque session/run IDs are lookup keys, not authorization. A future server resolves
connectors through a tenant-scoped registry or credential service on every lease and
does not expose the process-global local connector registry to mutually untrusted
tenants.

Policy is resolved once when the session opens and may only be tightened for a run in
a later API. Drivers receive the resolved policy, not untrusted raw request fields.

This policy controls authority granted by the runtime and native harness. It cannot
prove the implementation of an arbitrary application-supplied `ToolFunction`. Bound
or factory-created OneRingAI agents remain trusted application code and must apply the
existing `PermissionPolicyManager` and host authorization to their tools. The
OneRingAI driver does not claim that an opaque tool is process- or network-sandboxed.
Future tenant safety comes from both tool policy and worker isolation.

### Environment construction

The Codex child environment is built explicitly:

1. begin with a documented minimal platform baseline needed to launch Node/CLI and
   validate TLS;
2. add proxy or certificate variables only when allowed by host policy;
3. inject connector-derived credentials into the native SDK option or child
   environment only for the lifetime of the native process;
4. set a session-owned Codex state directory;
5. add reviewed driver variables;
6. never inherit the entire server environment wholesale.

This is stricter than copying `process.env`, but it must retain platform-required
variables such as executable paths and trusted certificate configuration. Secret
values are never placed in runtime specs, events, metadata, command arguments, or
logs.

Controller credentials require a stricter boundary than ordinary environment
filtering. If the Codex CLI receives an API key, commands executed by the agent must
not inherit that key. The driver configures the native shell-environment policy to
exclude all connector secrets and verifies this with an integration test that asks a
command to inspect its environment. Native user/project configuration must not be able
to weaken that filter or re-enable MCP servers, hooks, commands, or network beyond the
resolved runtime policy.

Repository instructions such as `AGENTS.md` are expected model input; repository
configuration that grants executable authority is different. The PoC documents which
native user and project configuration sources remain active, pins all security-critical
settings at the highest supported precedence, and fails preflight if the SDK cannot
guarantee the requested policy. It never assumes that changing `CODEX_HOME` disables
every repository-local configuration source.

For the initial Codex path, use an API-key OpenAI connector. Reusing an existing local
Codex profile may be offered later as an explicit delegated identity mode, never as a
silent fallback to `~/.codex`.

The local driver may use the existing authorized connector lookup and credential
accessors; it does not add a new public secret-returning API. A future remote backend
must materialize credentials as a scoped lease inside the worker rather than
serializing them into `RuntimeAgentSpec` or a queue message.

## Workspace model

```ts
export type WorkspaceRequest =
  | { type: 'local-directory'; path: string }
  | { type: 'managed'; reference: string };
```

Only the local backend accepts `local-directory`, and only from a trusted in-process
caller. It canonicalizes the path, verifies existence and requested access, rejects
unsafe roots, and does not accept a path derived from model input.

`managed` is reserved for a server backend. Its opaque reference is resolved by the
host into a checkout or volume inside an isolated worker. A server API never accepts
an arbitrary host path.

A session associates conversation state with one logical workspace identity. Each
mutating run acquires an exclusive write lease for that workspace. The lease is
released when the native process stops and the run reaches a terminal state. Idle
logical sessions do not hold the write lease.

Read-only concurrent runs may be considered later, but are not part of the first
contract. The initial runtime permits only one active run per session and rejects a
second with `AgentBusyError`.

## Session and run lifecycle

```text
Session: opening -> ready <-> running -> destroying -> destroyed
                      \-> failed

Run:     starting -> running -> completed
                           \-> failed
                           \-> cancelling -> cancelled
                           \-> incomplete
```

Rules:

1. `openSession()` resolves the spec, connector visibility, capabilities, workspace,
   and policy before returning.
2. The resolved spec is pinned to the live session. Editing a stored OneRingAI
   definition affects only newly opened sessions.
3. Only one run may be active per session.
4. Cancellation is idempotent.
5. A run becomes `cancelled` only after the native work has stopped. Requesting abort
   is not itself a terminal result.
6. If a local native process ignores cancellation, the runtime reports a timeout or
   failure; it does not falsely claim that mutations stopped.
7. Destroying a session cancels its active run, waits for bounded cleanup, then
   destroys owned native resources.
8. A caller-supplied aborted signal prevents a run from starting; an abort during the
   run follows the same cancellation path as `run.cancel()`.
9. `incomplete` means native execution ended without a successful completed result,
   such as a policy refusal or limit. Details explain the reason.

The live PoC supports multi-turn continuation within the same process. The Codex
driver retains its native thread object; the OneRingAI driver retains its native
agent/context. This is not advertised as durable restore.

## Events and results

The runtime introduces a separate event domain. It does not widen or replace the
current OneRingAI `StreamEvent`, which remains an LLM/provider stream type.

```ts
export interface AgentRunEvent {
  runId: string;
  sessionId: string;
  sequence: number;
  timestamp: string;
  type: AgentRunEventType;
  data: Record<string, JsonValue>;
}

export type AgentRunEventType =
  | 'run.started'
  | 'output.delta'
  | 'message.completed'
  | 'command.started'
  | 'command.completed'
  | 'file.changed'
  | 'tool.started'
  | 'tool.completed'
  | 'interaction.requested'
  | 'interaction.resolved'
  | 'usage.updated'
  | 'diagnostic'
  | 'run.finished';
```

Only common lifecycle semantics are normalized. Vendor-specific detail can appear in
a namespaced, sanitized data field. Unknown native events become diagnostics rather
than breaking a run. Secrets and raw private reasoning are excluded. Reasoning may be
emitted only when a provider explicitly supplies a user-visible summary.

Events have monotonically increasing per-run sequence numbers. In the PoC they allow
deterministic ordering and live multi-subscriber delivery, not durable reconnect.
Events are observational: `result.outputText` and `result.outputParsed` are the
authoritative final values. Callers must not reconstruct a guaranteed final answer
from deltas because bounded journals may coalesce them. Command/tool payloads are
redacted and truncated under policy before entering the journal.

```ts
export interface AgentRunResult {
  runId: string;
  sessionId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'incomplete';
  outputText: string;
  outputParsed?: JsonValue;
  artifacts: AgentArtifact[];
  usage?: RuntimeUsage;
  finishReason?: string;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: Record<string, JsonValue>;
  };
  enforcement?: Record<string, 'native' | 'emulated'>;
  native?: {
    driver: string;
    sanitized: JsonValue;
  };
}

export type AgentArtifact =
  | {
      type: 'workspace-change';
      path: string;
      change: 'created' | 'modified' | 'deleted';
      patch?: string;
    }
  | {
      type: 'reference';
      name: string;
      mediaType?: string;
      reference: string;
    };
```

The PoC does not create a generic artifact store or expose raw absolute paths.
Workspace-change artifacts are derived from reliable native events or a bounded
before/after workspace comparison. If neither is reliable, the driver omits them
rather than inventing completeness.

Artifact contents follow explicit size, path, and redaction rules. Secret-like files
and host-denied paths produce change metadata only; their content or patch is not
embedded in an event/result by default.

Usage is optional because vendors account differently. The normalized fields remain
small, while sanitized native usage can be retained for observability.

There is one terminal-result rule: once `session.run()` returns an `AgentRun`, its
`result` promise resolves exactly once for `completed`, `failed`, `cancelled`, or
`incomplete`. A failed result carries safe structured `error` data. Configuration,
policy, capability, workspace, and other preflight failures throw before a run handle
is returned. The backend catches failures after start and converts them to a failed
terminal result. This avoids the contradictory combination of a `failed` status and a
separate rejected result promise.

## Driver mappings

### `oneringai.agent`

- Resolves a stored definition, local binding, or local factory.
- Uses the existing public `Agent` surface.
- Calls `agent.stream()` when normalized incremental events are requested and
  `agent.run()` where its non-streaming semantics are required, including documented
  structured-output repair behavior.
- Maps current `StreamEvent` and `AgentResponse` into runtime events/results without
  changing their types.
- Keeps `agent.tools === agent.context.tools`; it never creates a second tool manager.
- Passes trusted `userId` and other existing scope through host construction, not
  prompt input.
- Destroys only agents it owns.
- Reports file/command events only when actual OneRingAI tools provide structured
  events; ordinary model text is not parsed to manufacture them.

For the PoC, `session.continue` is native for a normal managed-context agent.
`session.restore` is unsupported through the runtime even though OneRingAI has native
context save/load mechanisms; durable runtime restore is a later backend concern.
The adapter selects exactly one of `stream()` or `run()` for a turn and never executes
both. If a required non-streaming repair path prevents output deltas, capability
constraints report that limitation before the run.

A stored-definition agent is constructed with trusted host overrides such as
`userId`. A bound agent already has an execution scope; if it is incompatible with the
requested trusted context, the driver rejects the session rather than mutating or
silently reusing that scope. Factories receive the trusted context at construction.

### `openai.codex.sdk`

- Is published from an optional `agent-runtime/codex` subpath.
- Dynamically loads the Codex SDK and throws a typed dependency error when absent.
- Requires Node.js 22+, a named OpenAI connector, and an explicit active model from
  the OneRingAI registry.
- Requires the connector's explicit vendor to be OpenAI and API-key authentication in
  the PoC. A custom base URL or organization setting is mapped only when the supported
  SDK exposes an equivalent; otherwise preflight rejects it.
- Creates one native Codex thread per runtime session and reuses it for later turns.
- Uses the resolved workspace as the working directory.
- Maps only reviewed typed config: model, reasoning effort, web-search permission,
  sandbox/workspace settings, and git-repository validation behavior.
- Does not expose a raw `nativeConfig` escape hatch in the PoC.
- Builds a controlled child environment and session-owned Codex state directory.
- Applies a shell-environment filter so native commands cannot read connector
  credentials from their inherited environment.
- Maps native thread/turn/item/usage events into the generic event domain.
- Maps `AbortSignal` and `cancel()` to native cancellation and waits for process
  termination before reporting terminal cancellation.
- Uses native JSON Schema output when available and validates the returned value.
- Advertises same-process `session.continue`, structured output, image input where
  verified, command/file events where verified, and cancellation.
- Advertises interactive approvals, steering, tenant isolation, and durable restore as
  unsupported in the PoC.

The driver does not silently read a developer's global Codex configuration or login.
If the SDK itself requires a minimal state/config layout, the driver creates it under
the session-owned directory and records only non-secret diagnostics.

### Future `openai.codex.app-server`

This is a distinct driver because it has a richer, bidirectional protocol and a
different process-supervision contract. It is the likely Codex path for interactive
approvals, user questions, steering, review, and detailed thread management. It will
run as a supervised process inside the trusted local host or isolated worker; OneRingAI
will not expose its experimental WebSocket transport as the product server API.

### Future Claude driver

The Claude driver will map its native session/resume, permission callback, MCP,
subagent, hook, and structured-output features. Native tool policy remains native to
Claude; connector credentials and maximum host policy remain controlled by OneRingAI.
Capabilities that have no Codex SDK equivalent are exposed through capability-gated
optional interfaces rather than forced into the common base.

### Future hosted and A2A drivers

Hosted drivers may require no local workspace and may own their model choice. Their
connector still identifies the authenticated service account. The outbound A2A driver
maps a runtime session/run onto remote messages/tasks and honestly reports any loss of
command/file event fidelity.

## Workflow and orchestrator integration

The PoC runtime is directly usable as a workflow step: a workflow opens or reuses a
session, starts a run, observes its async events, awaits the terminal result, and
cascades cancellation through the run handle. No special workflow protocol is needed.

The existing `createOrchestrator()` is not changed in the PoC. A later adapter can let
an orchestrator delegate to a runtime agent while mapping runtime artifacts into
`SharedWorkspace` and preserving host scope, cancellation, and workspace leases. A
convenience “runtime agent as a OneRingAI tool” may also be useful for delegation, but
it is an adapter over this API—not the primary integration and not a second execution
implementation.

The session-first API is intentional. A one-shot convenience helper may later open,
run, and destroy an ephemeral session, but it must not obscure ownership or make a
multi-turn workflow accidentally lose native context.

## Local security boundary

The local backend is intended for a developer deliberately running agents against a
trusted workspace. It must still apply policy, redact secrets, constrain paths, and
clean up children, but it cannot make hostile tenant code safe inside the current
Node.js process.

In particular:

- arbitrary application-supplied OneRingAI `ToolFunction`s execute with the host
  process's authority unless those tools implement their own controls;
- a native SDK sandbox is defense in depth, not tenant isolation;
- a local directory writable by other processes can change during a run;
- environment or connector mistakes can still expose more authority than intended;
- local capability inspection must report `isolation.tenant: unsupported`.

The documentation and examples must not imply otherwise.

## Future server architecture

The local API can be preserved while a server backend adds a control plane and
isolated workers:

```text
Authenticated application request
              |
       Runtime control plane
       - scope and policy
       - idempotency
       - session/run records
       - event stream
              |
          work queue
              |
      worker/lease allocator
              |
   container or microVM execution lease
       - one tenant/workspace at a time
       - mounted managed workspace
       - leased connector credentials
       - pinned driver image/version
       - separate controller and command egress
       - enforced CPU/memory/time limits
              |
         native agent driver
```

### Unit of isolation

The default unit is an execution lease for an active run, not a permanent VM per
agent definition or tenant. The allocator may keep a worker warm and affined to the
same logical session for a short TTL when this materially improves multi-turn latency.
Warm retention is an optimization, not session identity.

Required invariants:

- one untrusted tenant/workspace uses a worker at a time;
- the write lease is exclusive for the active run;
- credential exposure is scoped to the lease, with short-lived tokens preferred when
  the connector supports them;
- model-provider traffic is allowed only from the controller path, while command
  sandbox egress follows `sandboxNetwork`;
- credentials and tenant residue are removed before worker reuse;
- workspace and native state are externalized or deliberately discarded;
- cancellation can terminate the whole lease when native cancellation fails;
- container/microVM choice follows the threat model; a container sharing the host
  kernel is not automatically sufficient for hostile workloads.

Merely stripping the child command environment is not a complete Linux server
boundary: code running as the same user may be able to inspect the controller's
environment through process interfaces. The server phase must isolate controller
credentials from the command sandbox using an appropriate combination of separate
users/PID namespaces, restricted process filesystems, a credential/API proxy, and
short-lived tokens. If raw provider credentials remain observable to agent-executed
code, the backend cannot advertise tenant isolation.

A dedicated tenant VM remains a valid deployment policy for stronger isolation,
compliance, or very warm long-running sessions. It is not baked into the library API.

A non-restorable driver cannot transparently outlive its worker. Such a session either
stays on a warm worker for a declared bounded TTL or ends when that worker is released.
Only drivers with a verified native checkpoint can promise continuation after a cold
lease. The control plane exposes this through `session.restore`; it never hides the
difference behind best-effort scheduling.

### Durable state

Server durability is a coordinated control-plane feature, not JSON files added to the
local PoC. A later design must define at least:

- a session record containing trusted scope, a pinned credential-free spec snapshot,
  resolved capability/policy metadata, workspace identity, driver/image versions,
  and an opaque native-checkpoint locator;
- a run record with lifecycle, idempotency key, cancellation state, and terminal
  result;
- an append-only sequenced event log with retention/backpressure rules;
- an artifact index whose reads are reauthorized by tenant/user scope;
- a workspace checkpoint/version and exclusive lease protocol.

Checkpointing occurs only at a quiescent boundary after native work has stopped and
workspace/state persistence succeeds. A run is not declared durably complete before
its terminal event and result are committed. If a worker dies during an ambiguous
command or edit, the control plane reports an interrupted/unknown outcome and does not
automatically replay the prompt. Agentic filesystem operations are not generally
idempotent.

Native state is opaque and version-sensitive. Restoring it requires a compatible
driver, native SDK/CLI, worker image, state directory, and workspace checkpoint. If
compatibility cannot be proven, restore fails explicitly. A native thread ID alone is
never considered a complete portable checkpoint.

These records and protocols should be designed when the server phase starts, using a
real datastore and queue. They are not public core interfaces in the PoC.

The control plane also owns quotas and cost controls: tenant concurrency, queue depth,
wall time, workspace/artifact bytes, provider rate limits, and spend accounting.
Drivers report usage when available but do not pretend they can enforce a precise
cross-vendor token or cost budget mid-turn.

### Server transport

The TypeScript runtime API remains normative. A future server may project it over
authenticated HTTP plus SSE or WebSocket, with idempotency and replay at the control
plane. Transport details should live in the remote backend package rather than the
domain model. A2A remains a separate standards-facing adapter.

## Error model

Runtime errors extend the existing `AIError` hierarchy and carry safe structured
metadata. The initial set should remain small:

- `AgentDriverNotFoundError`
- `AgentDriverConfigurationError`
- `AgentCapabilityUnsupportedError`
- `AgentPolicyUnsupportedError`
- `AgentWorkspaceError`
- `AgentBusyError`
- `AgentEventHistoryExpiredError`
- `AgentRunTimeoutError`
- `AgentNativeExecutionError`
- `AgentRuntimeDependencyError`

Errors must preserve a safe cause where useful but redact command environments,
connector credentials, native config paths, prompt data not intended for logs, and
provider-private reasoning. Native exit codes and sanitized stderr tails may be
included in diagnostics.

Normal provider refusal or policy-denied completion is represented as an `incomplete`
result. Infrastructure/native failures after a run starts become a `failed` result
whose safe error payload is derived from the typed error. Preflight and invalid
control operations throw the typed error directly. The exact distinction is covered
by contract tests.

For a `failed` result, `error` is required by runtime validation even though the
compact interface above models it as optional for the other statuses.

## Observability and privacy

The runtime integrates with OneRingAI's existing logger and metrics facilities. Every
record includes driver ID, runtime agent ID, session ID, run ID, status, duration, and
capability/policy outcome. Usage and native exit codes are included when available.
The future remote backend adds queue delay, lease/worker ID, image version, checkpoint
version, and retry/interruption metadata.

Prompts, model output, command output, patches, absolute paths, connector names, and
tenant/user identifiers are not logged by default. Applications can opt into content
logging only through an explicit redaction/retention policy. Native SDK log and state
files follow the same cleanup and privacy review as runtime events.

## Packaging

Proposed exports:

```json
{
  "exports": {
    "./agent-runtime": "...",
    "./agent-runtime/codex": "..."
  }
}
```

The core `agent-runtime` subpath contains domain types, runtime, local backend, fake
driver utilities used by tests, and the OneRingAI adapter. The Codex subpath contains
the optional driver. Codex SDK types do not leak into core declarations.

The Codex package is an optional peer dependency with a documented supported range.
Importing `@everworker/oneringai` or `@everworker/oneringai/agent-runtime` must work
without it installed. Importing the Codex subpath should not eagerly launch or load a
binary; inspecting or opening the Codex driver without the peer installed returns the
typed dependency error.

Before publication, the PoC must verify the SDK/CLI distribution license, supported
platforms, binary/package size, install behavior, and whether redistribution inside a
worker image has additional requirements. ESM and CJS builds must both keep the peer
external and preserve lazy loading.

The preview API should initially be subpath-only rather than re-exported from the root.
This limits accidental coupling while contracts are evaluated. Relative source imports
use `.js`, runtime values and types are exported separately, and generated registries
are updated only through their generator if one is introduced.

Proposed source layout:

```text
src/agent-runtime/
  domain/
    AgentCapability.ts
    AgentEvent.ts
    AgentPolicy.ts
    AgentResult.ts
    RuntimeAgentSpec.ts
  AgentRuntime.ts
  AgentDriver.ts
  AgentExecutionBackend.ts
  LocalExecutionBackend.ts
  drivers/
    oneringai/
      OneRingAIDriver.ts
    codex/
      CodexSdkDriver.ts
      CodexEventMapper.ts
      CodexEnvironment.ts
  internal/
    AsyncEventHub.ts
    lifecycle.ts
  index.ts
  codex.ts
```

Exact file boundaries may change during implementation; the public ownership model
must not.

## Testing strategy

### Contract tests with a fake driver

Run the same suite against the fake, OneRingAI, and Codex drivers where applicable:

- preflight rejects missing drivers, invalid config, unmet capabilities, and
  unenforceable policy;
- result completes without an event subscriber;
- an immediate or late in-process subscriber sees retained early events in order;
- two live subscribers observe ordered events;
- subscriber overflow does not stall or cancel native work;
- one active run per session is enforced;
- repeated cancellation and destruction are safe;
- terminal cancellation occurs only after native stop acknowledgement;
- multi-turn session state is retained in process;
- structured output is validated and enforcement mode is reported;
- paths cannot escape the workspace;
- secrets and raw environments do not appear in events, errors, or logs;
- borrowed resources survive session/runtime destruction while owned resources do
  not;
- no private reasoning is normalized as an event.

### OneRingAI driver tests

- stored definition, bound agent, and factory paths;
- missing local binding/factory fails preflight;
- `agent.tools === agent.context.tools` before and during execution;
- existing `AgentResponse` and `StreamEvent` behavior remains unchanged;
- connector identity and trusted `userId` propagate correctly;
- bound singleton concurrency is rejected;
- only owned agents are destroyed.

### Codex driver tests

- optional dependency missing and incompatible-version diagnostics;
- ESM/CJS lazy-loading behavior and no eager child-process launch on import;
- connector-derived API authentication without secret leakage;
- no silent global profile or wholesale environment inheritance;
- a native command inspecting its environment cannot observe connector secrets;
- user/project native config cannot weaken resolved sandbox, credential-filter, MCP,
  or network policy;
- workspace and sandbox policy mapping;
- native event mapping using recorded, sanitized fixtures;
- same-process thread continuation;
- cancellation and child-process cleanup;
- structured output and malformed-output handling;
- command and file event mapping;
- unsupported interaction, tenant isolation, and durable restore fail preflight;
- no orphan CLI process remains after test teardown.

Real-provider integration tests are opt-in and credential-gated. Unit tests never add
or print secrets. Repository validation is:

```bash
npm run build
npm run typecheck
npm run lint
npm run test:unit
npm run examples:check
```

## Implementation plan

### Phase 0 — contracts and fake driver

- Add the preview subpath and domain types.
- Implement `AgentRuntime`, the minimal driver/backend interfaces, lifecycle checks,
  and bounded in-memory event hub.
- Add the fake driver and contract tests.
- Freeze naming only after tests exercise cancellation, no-subscriber completion,
  capabilities, and ownership.

### Phase 1 — OneRingAI local driver

- Implement stored-definition, binding, and factory reconstruction paths.
- Adapt existing events/results without changing current public contracts.
- Verify shared tool-manager, connector, scope, ownership, and multi-turn behavior.
- Add a runnable local example.

### Phase 2 — Codex SDK local driver

- Add the optional package/subpath.
- Implement typed config, connector auth, controlled environment, workspace policy,
  event/result mapping, structured output, cancellation, and cleanup.
- Add fixture tests and an opt-in real local smoke test.
- Add a runnable example using the same caller workflow as Phase 1.

### Phase 3 — evaluation and contract freeze

- Run both drivers through representative repository tasks.
- Compare event usefulness, cancellation reliability, structured output, cleanup,
  latency, and unsupported-capability behavior.
- Remove abstractions that still have only hypothetical value.
- Document the preview API and decide whether it is ready for wider export.

### Separate later design phases

1. Server threat model, control plane, datastore, queue, workspace service, execution
   leases, worker image, credential leasing, and durable replay/checkpoint protocol.
2. Codex App Server driver and interaction model.
3. Claude Agent SDK driver.
4. A2A inbound/outbound adapters.
5. Orchestrator integration and migration strategy.

No later phase is implicitly authorized by approving the PoC.

## PoC acceptance criteria

The proof of concept is successful when:

1. One caller workflow opens, runs, streams, cancels, and closes both a OneRingAI and
   Codex agent.
2. Each driver supports at least two turns in the same live session.
3. Runs finish correctly even when events are never consumed.
4. Events are ordered, bounded, sanitized, and useful enough for a workflow UI.
5. Cancellation stops owned native work and leaves no child process behind.
6. Capability and policy mismatches fail before execution.
7. Structured output is validated and its enforcement mode is explicit.
8. Codex remains optional and does not leak its types into the core subpath.
9. Connector credentials and inherited server secrets do not appear in specs, events,
   errors, logs, child command arguments, or command environments.
10. The OneRingAI adapter preserves its single tool manager and current public APIs.
11. The local backend clearly reports that it is not tenant isolation.
12. Build, typecheck, lint, unit tests, and example checks pass.

The PoC does not need cross-process session restore or containers to pass.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| A lowest-common-denominator API hides useful native behavior | Small common lifecycle plus capability-gated optional interfaces and sanitized native detail |
| Two agent loops or tool managers compete | Drivers own native loops; OneRingAI adapter preserves its existing shared manager |
| Runtime spec becomes a second agent source of truth | Keep it an execution descriptor; leave native definitions and connectors authoritative |
| Local-only objects are mistaken for portable configuration | Explicit binding/factory sources; remote backends reject them |
| SDK/CLI version drift breaks event mapping | Supported peer range, fixture tests, fail-fast version diagnostics |
| SDK-bundled CLI affects licensing, image size, or platforms | Verify distribution terms and packaging before publication; pin and scan server images |
| Event subscribers apply backpressure to native work | Backend-owned pump and bounded per-subscriber buffers |
| Cancellation is reported too early | Terminal state waits for native stop or later lease termination |
| Secrets leak through inherited environment or diagnostics | Explicit environment builder, connector injection, redaction tests |
| Agent commands read the controller's provider key | Native shell filtering in the PoC; separate controller/command security boundary or credential proxy before server tenant isolation |
| Native state/logs outlive their intended privacy boundary | Session-owned state directory, explicit retention, cleanup tests, and later server privacy review |
| Native sandbox is mistaken for tenant isolation | Explicit local threat boundary and capability reporting |
| Containers are allocated too coarsely | Per-run execution lease with optional warm affinity; tenant VM remains policy choice |
| Native thread IDs are treated as portable state | Future checkpoint includes native state, workspace, and pinned version compatibility |
| Crash recovery duplicates edits or commands | Checkpoint only at quiescent boundaries; never auto-replay ambiguous runs |
| Premature server interfaces ossify the local API | Defer storage, transport, and queue contracts until the server phase |
| Driver interface grows without evidence | Minimal base interface; add optional capabilities only with implementations/tests |

## Alternatives rejected

### Put Codex behind `ITextProvider`

Rejected because Codex owns a higher-level agent loop, workspace, tools, session, and
events. Treating it as a model provider loses or duplicates those semantics.

### Expose Codex only as a OneRingAI tool

Useful later for delegation, but insufficient as the primary integration because the
outer agent cannot naturally manage native session/event/cancellation semantics.

### Build a Codex-specific public wrapper

Fast initially, but immediately repeats work for Claude and hosted agents and couples
workflows to vendor event types.

### Start with Codex App Server

Rejected for the PoC because process supervision and bidirectional protocol handling
add complexity before the common local contract is proven. It remains the likely
future path for interactive Codex capabilities.

### Use A2A internally

Rejected because A2A does not cover placement, workspace, native checkpoints,
credential leases, or event fidelity. It is appropriate at external boundaries.

### Container or VM per tenant/session as the fixed model

Rejected as a library invariant. Isolation strength and warm retention are deployment
policy. The stable primitive is a bounded execution lease for an active run.

### Make the current stored definition generic

Rejected because it is a valid OneRingAI-native persistence contract, does not
serialize arbitrary runtime objects, and should not incur a semver-significant
migration for this PoC.

### Implement durable file stores locally first

Rejected because a local JSONL/checkpoint design would not validate the transactional,
scoped, distributed semantics required by a server and would distract from the driver
contract.

## Approval decisions

Approval confirms:

1. Add a preview `agent-runtime` subpath above the current `Agent` API.
2. Keep agent drivers separate from execution backends.
3. Keep `StoredAgentDefinition` and existing OneRingAI APIs unchanged.
4. Treat `RuntimeAgentSpec` as a lightweight execution descriptor, not a required
   persistent catalog.
5. Implement only the local backend, OneRingAI driver, and optional Codex SDK driver.
6. Support same-process multi-turn sessions, bounded live events, independent results,
   structured output, policy preflight, cancellation, and cleanup.
7. Use named API-key connectors for the first Codex authentication path.
8. Separate model-provider transport from command-sandbox network, and require that
   agent-executed commands cannot observe connector credentials.
9. Do not advertise interactive approval, durable restore, or tenant isolation in the
   Codex SDK/local PoC.
10. Keep App Server as a separate future driver and A2A at external boundaries.
11. Use per-active-run execution leases with optional warm session affinity as the
    default future server model; allow stronger tenant-dedicated deployments by policy.
12. Defer server stores, transport, checkpoint protocol, Claude, A2A, and orchestrator
    changes to separately reviewed phases.

## References

- [OpenAI Codex SDK documentation](https://learn.chatgpt.com/docs/codex-sdk)
- [OpenAI Codex App Server documentation](https://learn.chatgpt.com/docs/app-server)
- [OpenAI Codex sandboxing documentation](https://learn.chatgpt.com/docs/sandboxing)
- [OpenAI GPT-5.3-Codex model](https://developers.openai.com/api/docs/models/gpt-5.3-codex)
- [OpenAI Codex TypeScript SDK source](https://github.com/openai/codex/tree/main/sdk/typescript)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK user input and approvals](https://code.claude.com/docs/en/agent-sdk/user-input)
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [A2A specification](https://a2a-protocol.org/latest/specification/)
- `src/core/Agent.ts`
- `src/domain/entities/Response.ts`
- `src/domain/entities/StreamEvent.ts`
- `src/domain/interfaces/IAgentDefinitionStorage.ts`
- `src/core/orchestrator/createOrchestrator.ts`
- `docs/designs/PERSISTENT_SESSIONS.md`
- `docs/designs/MULTI_AGENT_ORCHESTRATION.md`
