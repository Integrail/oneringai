# Distributed Agent Execution

This document defines how one effective OneRingAI agent moves between a trusted
server and a desktop or browser client without introducing a second agent loop.
It covers text, OpenAI Realtime voice, remote tools, telephony, and context
restoration.

## Core rule

Exactly one OneRingAI `Agent` owns each model session. A server and a desktop may
both use OneRingAI, but they do not concurrently drive the same model session.

| Interface | Agent owner | Model path |
|---|---|---|
| Server text | Server | Server connector |
| Browser Realtime voice | Server | Direct WebRTC media plus server sideband |
| Telephony | Server | Telephony adapter plus Realtime or STT/TTS pipeline |
| Desktop text | Desktop main process | Host-provided connector or authenticated proxy |
| Desktop Realtime voice | Desktop main process | Direct WebRTC media through a browser peer |

The host remains responsible for catalog persistence, authentication,
authorization, tenant resolution, connector visibility, and deciding whether a
tool executes locally or remotely. OneRingAI owns the executable package,
hydration, Agent lifecycle, tool proxy behavior, Realtime events, and transport
interfaces.

## Portable agent package

`exportAgentPackage(agent)` creates a versioned, JSON-serializable snapshot of
an already-resolved Agent. The package contains:

- logical connector name and model, never connector credentials;
- the unrendered instruction template and portable runtime options;
- context feature flags, plugin names, and serialized state;
- enabled tool definitions with `local` or `remote` placement;
- an optional provider-neutral Realtime profile;
- package ID, protocol version, revision, expiry, and host metadata.

It deliberately excludes trusted runtime identity, connector/model authority,
permission policy, arbitrary `vendorOptions`, provider-hosted `nativeTools`,
prompt-cache policy, data-handling policy, and open-ended Realtime session
configuration. Those fields can contain authorization data or change where
data is processed and retained. The receiving host supplies `userId`, an
explicitly authorized connector and model, permissions, identities, executable
tools, `contextFactory`, and trusted provider-local policy while calling
`hydrateAgentPackage()`.

This package is an execution snapshot. It is not an authorization token, agent
catalog, database document, credential store, or security boundary. A client
that receives a package can inspect or modify it. Remote services must continue
to authorize every request from trusted host context.

### Context plugins

OneRingAI serializes plugin state, not executable plugin factories or external
storage dependencies. The receiving runtime must provide a trusted
`contextFactory` for every package. Package feature flags and plugin names are
compatibility hints only: they never activate plugins or select tool scopes.
The host factory owns feature flags, plugin dependencies, `toolCategories`, and
all other context policy. OneRingAI validates that all package plugin names
exist before restoring state.

Plugin-owned executable tools are not written into the package. The receiving
context recreates them against its own restored plugin state, preventing a
remote proxy from overwriting `store_*` or another plugin-local function.

Plugin state is application data and may be private, but it must never be used
as credential storage. A custom plugin that currently serializes a key or token
must keep that dependency host-local and resolve it again in `contextFactory`.

Applications may instead materialize server-only context into ordinary
instructions or in-context memory before export. Do not silently enable a
plugin without its dependencies.

### Tools

Executable functions never cross the wire:

- `local` tools are resolved by `localToolResolver` in the receiving runtime;
- `remote` tools become normal `ToolFunction` proxies backed by
  `RemoteToolTransport`;
- omitted tools are not exported.

`AgentPackageToolServer` owns the server-side tool execution lifecycle. It
allows only tools marked `remote` in its package and executes them through the
Agent external-execution path, preserving tool limits, hooks, approval,
permissions, metrics, and cancellation semantics. Request IDs are idempotent
for the bounded server-session lifetime: an exact retry receives the same
in-flight/completed response, while reuse for different arguments is rejected.

The host transport authenticates and authorizes each request before passing it
to `AgentPackageToolServer.execute()`. Client-supplied tenant, actor, connector,
or ACL fields must never be accepted as trusted input.

## Desktop text flow

1. The server authenticates the user and resolves the effective agent.
2. The server exports a short-lived `SerializedAgentPackage`.
3. Desktop main maps the package hints to an explicitly authorized local
   connector and model and supplies the host-owned permission policy. The
   connector may use the host's authenticated LLM proxy.
4. Desktop main resolves local tools and installs a `RemoteToolTransport` for
   session-bound server tools.
5. `hydrateAgentPackage()` creates the desktop Agent and restores context.
6. The desktop Agent owns `run()`, `stream()`, tools, compaction, and metrics.
7. Logout, tenant change, expiry, or session end destroys the Agent and closes
   the remote tool session.

## Desktop OpenAI Realtime flow

OpenAI recommends WebRTC for browser and client media. The unified setup flow
allows a trusted server to submit the browser SDP offer and session
configuration using the standard provider connector. The client receives the
SDP answer and opaque call ID, but no provider credentials; media then flows
directly between the browser peer and OpenAI.

1. Desktop main hydrates the Agent package with
   `executionProfile: 'realtime'`. The package's Realtime connector and model
   are hints; the trusted host resolver selects the authorized connector and
   model while preserving the same prompt, tools, context, and limits.
2. The renderer creates `OpenAIRealtimeWebRTCPeer` from the browser-safe
   `@everworker/oneringai/realtime-browser` export.
3. The renderer obtains microphone permission, adds the audio track, and creates
   the `oai-events` data channel.
4. A narrow host callback sends the SDP offer to the authenticated server.
5. Server `OpenAIRealtimeAPI.createWebRTCCallWithMetadata()` resolves the
   provider connector and returns `{ sdp, callId }`. The backward-compatible
   `createWebRTCCall()` continues to return only the SDP string.
6. The renderer applies the SDP answer. Audio flows directly to OpenAI.
7. A typed renderer/main bridge exposes the data channel as
   `RealtimeMessageChannel`.
8. Desktop main wraps it in `OpenAIRealtimeChannelTransport` and starts
   `OpenAIRealtimeAgentSession` with the hydrated Agent.
9. OneRingAI main handles context refresh, transcripts, tools, MCP approval,
   usage, cancellation, and lifecycle. The renderer only owns media and forwards
   Realtime messages.

The SDP callback receives the setup `AbortSignal` and must return both a
non-empty SDP answer and call ID. Configure `releaseCall(callId)` to invoke the
trusted server's hangup command. `closeAndRelease()` waits for that cleanup;
partial setup and terminal peer failure also release exactly once. The browser
peer retains a bounded, ordered event backlog until a channel bridge attaches;
the channel transport retains that backlog until `connect()` has consumers.
This prevents creation, transcript, tool, response, error, and usage events
from being lost during the renderer/main attachment gap.

No standard provider key is sent to the renderer. A deployment may choose an
ephemeral client secret instead, but connector credentials remain outside the
portable package.

Official protocol references:

- [OpenAI Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [OpenAI Realtime server controls](https://developers.openai.com/api/docs/guides/realtime-server-controls)
- [OpenAI Realtime create call](https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/calls/methods/create)

## Browser server-owned Realtime flow

For a browser product whose tools and context remain server-owned, the browser
still uses direct WebRTC media. The server keeps the Agent and attaches an
`OpenAIRealtimeAgentSession({ agent, callId })` sideband WebSocket using the
`callId` returned by `createWebRTCCallWithMetadata()`. The Agent session then
drives tools and context from the server.

This differs from desktop-local execution only in Agent ownership. The browser
WebRTC peer and SDP setup remain the same.

## Telephony

`VoiceBridge` accepts either a static `agent` configuration or an asynchronous
`agentFactory(session)`. The factory must return a new Agent for every call.
`VoiceSession` owns and destroys that Agent. Factory failures end and hang up
the pre-connect call rather than leaving a ringing session behind.

Use the factory when the host must resolve caller-specific authorization,
identities, tools, instructions, memory, or context plugins.

## Protocol compatibility and failure behavior

- `AGENT_PACKAGE_PROTOCOL_VERSION` versions both packages and remote tool DTOs.
- Incompatible or expired packages fail before Agent creation.
- Missing connector, plugin, local tool, or remote transport dependencies fail
  closed.
- WebRTC setup closes tracks, peer connections, data channels, and Agent
  sessions after partial failure and releases a created provider call.
- Cross-package and non-allowlisted remote tool calls are rejected.
- Remote errors expose bounded codes and safe messages, never internal stacks or
  credentials.
- Provider usage is authoritative. Client-reported metrics are observational.

## Non-goals

- OneRingAI does not define application tenant or role semantics.
- The package does not grant access to a connector or remote tool.
- The browser peer does not persist audio or transcripts.
- `RuntimeAgentSpec` remains the agent-runtime execution descriptor and is not
  reused as this portable native-Agent snapshot.
