/**
 * MemoryWritePluginNextGen — lightweight sidecar that adds write tools to an
 * agent that already has `MemoryPluginNextGen` (read-only) registered.
 *
 * Split from `MemoryPluginNextGen` so that:
 *   - Read-only agents don't pay the write-tool schema overhead in every turn.
 *   - Autonomous architectures (main agent reads; a `SessionIngestorPluginNextGen`
 *     or similar pipeline writes) can cleanly forbid direct writes from the
 *     agent.
 *
 * This plugin:
 *   - Injects NO system-message content (reads already handle profile injection).
 *   - Ships only the 6 write tools: memory_remember, memory_link, memory_forget,
 *     memory_restore, memory_upsert_entity, memory_set_agent_rule.
 *   - Provides a short write-specific instruction block.
 *   - Does NOT bootstrap user/agent entities — that's `MemoryPluginNextGen`'s
 *     job. Host must register `MemoryPluginNextGen` first; write tools that
 *     use `"me"` / `"this_agent"` tokens rely on its bootstrap.
 */

import type { IContextPluginNextGen, ITokenEstimator } from '../types.js';
import type { ToolFunction } from '../../../domain/entities/Tool.js';
import type { MemorySystem } from '../../../memory/index.js';
import type { PredicateRegistry } from '../../../memory/predicates/PredicateRegistry.js';
import { simpleTokenEstimator } from '../BasePluginNextGen.js';
import { createMemoryWriteTools, type Visibility } from '../../../tools/memory/index.js';

export interface MemoryWritePluginConfig {
  /** Live memory system. REQUIRED. */
  memory: MemorySystem;
  /** Agent id. REQUIRED — matches `MemoryPluginNextGen.agentId`. */
  agentId: string;
  /** Current user id. REQUIRED — matches `MemoryPluginNextGen.userId`. */
  userId: string;
  /** Trusted group id from host auth. Matches `MemoryPluginNextGen.groupId`. */
  groupId?: string;
  /**
   * Optional explicit predicate registry override for prompt rendering.
   * When unset, the plugin uses `memory.getPredicateRegistry()` — that's
   * almost always what you want, since the same registry governs
   * canonicalization, validation, and ranking on writes. Override only when
   * you intentionally want the LLM's advertised vocabulary to differ from
   * the storage-enforced one (rare; mostly testing).
   */
  predicates?: PredicateRegistry;
  /** Default visibility for remember/link. Matches MemoryPlugin defaults. */
  defaultVisibility?: {
    forUser?: Visibility;
    forAgent?: Visibility;
    forOther?: Visibility;
  };
  /** Fuzzy-match threshold for `{surface}` subject lookups. Default 0.9. */
  autoResolveThreshold?: number;
  /**
   * Callback supplied by the sibling `MemoryPluginNextGen` so `"me"` /
   * `"this_agent"` tokens resolve to its bootstrapped entities. When absent,
   * those tokens return "not available".
   */
  getOwnSubjectIds?: () => { userEntityId?: string; agentEntityId?: string };
  /** Rate-limit override for memory_forget. Also used as the fallback for
   *  `setAgentRuleRateLimit` when that field is omitted. */
  forgetRateLimit?: { maxCallsPerWindow?: number; windowMs?: number };
  /** Rate-limit override for memory_set_agent_rule. Falls back to
   *  `forgetRateLimit` when omitted; allows hosts to give rule-writes a
   *  larger budget than destructive forgets without sharing one knob. */
  setAgentRuleRateLimit?: { maxCallsPerWindow?: number; windowMs?: number };
}

/**
 * Static fallback used when no `PredicateRegistry` is reachable (the host
 * configured `MemorySystem` without one, OR did not pass `predicates` to
 * the plugin config). Short, deliberately generic — agents on registry-less
 * setups still need *some* shape guidance.
 *
 * When a registry IS available, `renderPredicateSection` replaces this with
 * the registry's own `renderForPrompt()` output so the LLM-facing vocabulary
 * stays in lockstep with what `addFact` actually validates and ranks.
 */
const PREDICATE_SECTION_FALLBACK = `### Predicate naming

Use snake_case predicate names. The library ships a standard vocabulary (\`works_at\`, \`reports_to\`, \`attended\`, \`hosted\`, \`decision_made\`, \`committed_to\`, \`blocked_by\`, \`depends_on\`, \`tracks_priority\`, \`has_document\`, etc.) — when one fits, use the exact name. If none fits, invent a snake_case predicate; the registry's dedup layer will still merge identical (subject, predicate, value/object) writes from this agent and any ambient ingestor.`;

/** Build the predicate-vocabulary section from a live registry. */
function renderPredicateSection(registry: PredicateRegistry | undefined): string {
  if (!registry) return PREDICATE_SECTION_FALLBACK;
  const rendered = registry.renderForPrompt({ maxPerCategory: 8 });
  if (!rendered || rendered.trim().length === 0) {
    return PREDICATE_SECTION_FALLBACK;
  }
  // `renderForPrompt` emits its own `## Predicate vocabulary` header; demote
  // that to `### Predicate vocabulary` so it sits at the same depth as the
  // surrounding `### …` sections in the write instructions block.
  const demoted = rendered.replace(/^## Predicate vocabulary/, '### Predicate vocabulary');
  return [
    demoted,
    '',
    'The background ingestor uses this same vocabulary; matching predicates lets the dedup layer merge your writes with ambient observations. Prefer exact registry names over coinages — invent a new snake_case predicate only when nothing in the list fits.',
  ].join('\n');
}

const PREDICATE_SECTION_MARKER = '__PREDICATE_SECTION__';

/**
 * Assemble the full write-instructions block, replacing the predicate-section
 * placeholder with either the live registry's rendered vocabulary or a
 * static fallback. Called per agent at construction time + once when
 * `getInstructions()` first fires, so the cost is negligible.
 */
function buildWriteInstructions(registry: PredicateRegistry | undefined): string {
  return WRITE_INSTRUCTIONS_TEMPLATE.replace(
    PREDICATE_SECTION_MARKER,
    renderPredicateSection(registry),
  );
}

const WRITE_INSTRUCTIONS_TEMPLATE = `## Memory writes

### Memory is SUBCONSCIOUS — never discuss it with the user

Memory operations are YOUR internal mechanism, like a private notebook only you can see. The user must never know you're using memory unless they explicitly ask ("what do you remember about me?", "do you have X noted?").

Forbidden patterns — do NOT produce any reply containing these or paraphrases thereof:
- "I'll remember that." / "I saved that." / "I've noted this." / "Memory updated." / "Got it, stored."
- "I tried to link X but …" / "I couldn't find X in memory." / Any error message mentioning memory.
- "Should I remember this?" / "Want me to save this?" / "Do you want to record this?"
- Asking for display name, entity type, domain, identifiers, confidence, or any memory-internal concept. The user doesn't know these concepts exist.
- Narrating what you're about to remember or why.

Instead — just do the memory operations silently and reply to the user as if you simply *know* things. If the user says "my name is Anton", the correct reply is "Nice to meet you, Anton." — NOT "I've saved that your name is Anton."

### Never lie about memory writes

Do NOT claim to have saved, scheduled, reminded, recorded, noted, stored, or tracked anything unless you actually called a memory write tool this turn AND its \`[tool_result]\` was \`ok\`. Phrases like "I'll remind you on April 30", "Got it — stored", "Noted for future reference" are **lies** if no preceding tool call exists. If the tool call failed, see "Recover silently" below; but never assert success.

Acceptable, non-committal phrasings when you did NOT write (e.g. the user just made small talk): "Nice to meet you.", "Understood.", "What would you like to do?". Acceptable after a SUCCESSFUL write: plain "Okay." / "Done." without narrating what you stored — the user doesn't need the memory internals.

### Act decisively on imperative task requests

When the user says "remind me to X", "schedule Y", "track Z", and memory is the right tool (no dedicated connector available), CREATE the entity in this turn. Fill in reasonable defaults for missing optional fields rather than asking:

- Time not specified → default \`dueAt\` to 09:00 local time on the named day.
- Priority not specified → default \`priority: 'medium'\`.
- Visibility not specified → default private (owner-only). Never ask.
- Assignee not specified → the user is the assignee implicitly; omit \`assigneeId\` (subject-owner is implicit).

Ask a clarifying question ONLY if the DATE itself is genuinely ambiguous ("tomorrow" said on a date boundary, "next Tuesday" when two are near). Do not ask about time-of-day, priority, or any memory-internal detail. After getting the clarification, CALL THE TOOL in the same turn — do not reply with "Got it" and no tool call.

### Recover from memory failures silently

If a memory operation fails, do NOT tell the user. Recover yourself:
- \`memory_link\` fails with "no entity matching surface/identifier X" → call \`memory_upsert_entity\` to create that entity (with a sensible type + identifier inferred from context), then retry the link. Do NOT ask the user for a display name, visibility, or anything else — infer it.
- \`memory_remember\` rejects a write on a foreign-owned subject → pick a different subject (usually "me" if the fact is about the user's own view) or skip the write entirely and proceed with your reply.
- Any memory operation fails persistently (two retries or a non-recoverable error) → drop the memory task, continue answering the user's original question without mentioning the failure. Memory is best-effort.

Memory is infrastructure, not a feature. Keep it invisible.

### Decide BEFORE calling a memory write tool: is there a more specific tool?

Memory is NOT a substitute for real-world integrations. If the user's request has a dedicated connector tool available in your tool list, use THAT tool, not memory:
- Calendar request ("add to my calendar", "schedule X") → calendar tool (\`google_calendar_*\`, \`microsoft_graph_*\`, etc.).
- Task tracking ("create a task in Jira / Todoist / Linear") → that service's tool.
- Note-taking ("add to my Notion", "save in Obsidian") → that service's tool.
- Email / message → messaging tool.

Memory is the RIGHT tool when:
- The user explicitly asks YOU to remember something ("remember that…", "note this for future reference").
- The user corrects a prior memory ("actually my name is Y, not X").
- No dedicated connector tool exists for the requested action and the user wants persistence.

Memory is the WRONG tool when:
- A more specific connector tool exists — prefer that tool.
- The user is just conversing ("I work at Acme", "Alice mentioned Bob") — a background pipeline captures ambient facts from every turn. Do NOT write these yourself; you'd duplicate work and waste tokens.
- The user wants a real-world side effect (event in their actual calendar, ticket in their actual tracker, email actually sent).

When the user's intent truly requires disambiguation (e.g. "remind me to X" and both a calendar connector and a task connector are available), ask the user ONE short non-memory question — phrased around the REAL-WORLD tool choice ("Should I put that on your Google Calendar or add it to Todoist?"), NOT around memory internals. Never ask five questions.

__PREDICATE_SECTION__

### When memory IS the right tool — pick the right shape

- **task** — actionable item with a deadline or priority.
  \`memory_upsert_entity({type:'task', displayName:'Call the doctor', identifiers:[{kind:'canonical', value:'task:<userId>:call-doctor-2026-04-30'}], metadata:{state:'pending', dueAt:'2026-04-30T09:00:00Z', priority:'medium'}})\`
  State vocabulary: \`pending\` | \`in_progress\` | \`blocked\` | \`deferred\` | \`done\` | \`cancelled\`.
- **event** — time-bound occurrence.
  \`memory_upsert_entity({type:'event', displayName:'Meeting with Sarah', identifiers:[{kind:'canonical', value:'event:<userId>:meeting-sarah-2026-04-21'}], metadata:{startTime:'2026-04-21T15:00:00+02:00', endTime:'2026-04-21T16:00:00+02:00', location:'Office'}})\`
- **person** — with strong identifier:
  \`memory_upsert_entity({type:'person', displayName:'Alice Smith', identifiers:[{kind:'email', value:'alice@acme.com'}]})\`
- **organization** — with domain:
  \`memory_upsert_entity({type:'organization', displayName:'Acme', identifiers:[{kind:'domain', value:'acme.com'}]})\`
- **priority** — long-term goal a user is tracking (Chief-of-Staff: "my Q2 priority is the NA launch", "my yearly goal is to ship X"). All priorities are user-private — do not ask the user about sharing or visibility. Two-step:
  1. Upsert the priority entity:
     \`memory_upsert_entity({type:'priority', displayName:'Ship NA launch', identifiers:[{kind:'canonical', value:'priority:<userId>:ship-na-launch-2026-q2'}], metadata:{jarvis:{priority:{horizon:'Q', weight:0.8, deadline:'2026-06-30T00:00:00Z', status:'active'}}}})\`
  2. Link the user to it so it surfaces in profile / ranking:
     \`memory_link({from:'me', predicate:'tracks_priority', to:{id:'<priorityIdFromStep1>'}})\`
  Fields: \`horizon\` 'Q' (quarterly) or 'Y' (yearly); \`weight\` 0..1 drives ordering (heavier = more central, default 0.5); \`status\` starts at 'active'.
  Status transitions ('met' / 'dropped') are host-driven — surface the observation as a \`decision_made\` fact on the user with the priority in \`contextIds\`:
  \`memory_remember({subject:'me', predicate:'decision_made', value:'Met priority: Ship NA launch', contextIds:['<priorityId>'], observedAt:'<iso>'})\` (or value 'Dropped priority: …').
  The host watches for these and updates the priority's metadata. Do NOT re-upsert the priority entity to change its status — the metadata merge is shallow and would corrupt the priority's other fields.
- **priority → affected entity** — when the user ties a priority to specific work ("this priority affects the NA Launch project", "that goal is about Acme"):
  \`memory_link({from:{id:'<priorityId>'}, predicate:'priority_affects', to:{surface:'NA Launch project'}})\`
  Future ranking uses these links to answer "is this signal/task relevant to a current priority?". Always link new priorities to the projects/people/topics they govern when the user mentions them.
- **Fact on the user** — pick a predicate from the vocabulary section above that fits the assertion. Coining unregistered names (\`prefers\`, \`likes\`, \`tracks\`) works under permissive mode but is rejected outright under strict mode; the registry-rendered list is the safe surface.
- **Long-form note** — "remember this for future reference: <prose>":
  \`memory_remember({subject:'me', predicate:'memo', kind:'document', details:'<prose>'})\`
  Other document predicates from the registry: \`meeting_notes\`, \`research_note\`, \`biography\`. Match the predicate to the genre of prose; default to \`memo\` when nothing more specific fits.
- **Relation between entities** — "Alice works at Acme":
  \`memory_link({from:{surface:'Alice'}, predicate:'works_at', to:{surface:'Acme'}})\`
  If the target entity doesn't exist yet, \`memory_upsert_entity\` it first (silently — don't ask the user), then retry the link.
- **Correction** — user says "actually my name is Y, not X":
  Use \`memory_forget\` on the old fact with \`replaceWith\` to supersede cleanly (keeps the correction chain auditable).
  If you archive the wrong fact by mistake, use \`memory_restore\` to un-archive it.

### Documents (long-form work artefacts)

Use a **document** entity when you need to persist content that's too long for a single fact — plans, briefs, meeting transcripts, specs, multi-paragraph notes. Convention (no special tools — use the existing entity/fact write tools):

- **Create** (\`memory_upsert_entity\`):
  \`memory_upsert_entity({type:'document', displayName:'Q3 Launch Brief', identifiers:[{kind:'canonical', value:'doc:q3-launch-brief'}], metadata:{body:'<full markdown>', role:'brief', format:'markdown'}})\`
  - \`metadata.body\` (string) carries the full content.
  - \`metadata.role\` (free string): \`brief\` | \`plan\` | \`transcript\` | \`spec\` | \`notes\` | \`artifact\` | ... — distinguishes attached docs of the same parent.
  - \`metadata.format\`: \`markdown\` (default) | \`plain\` | \`json\`.
  - \`metadata.summary\` (optional): short abstract; when present it's used as the embedding source (better semantic search on long docs).
  - Slug is optional but recommended for docs you'll reference later — \`{kind:'canonical', value:'doc:<slug>'}\` lets you fetch by slug. Without a slug, only the entity id resolves the doc.

- **Update body / role / summary** — re-call \`memory_upsert_entity\` with the same identifiers and \`metadataMerge:'overwrite'\` so only the keys you pass are touched:
  \`memory_upsert_entity({type:'document', displayName:'Q3 Launch Brief', identifiers:[{kind:'canonical', value:'doc:q3-launch-brief'}], metadata:{body:'<new content>'}, metadataMerge:'overwrite'})\`
  Without \`metadataMerge:'overwrite'\` the merge is \`fillMissing\` and existing keys are never replaced — your body update would silently no-op.

- **Attach a document to another entity** — use \`memory_link\` with predicate \`has_document\`:
  \`memory_link({from:{surface:'NA Launch project'}, predicate:'has_document', to:{identifier:{kind:'canonical', value:'doc:q3-launch-brief'}}})\`
  One predicate covers every attachment (brief, plan, transcript, …) — the document's own \`metadata.role\` tells you which kind it is. To list all docs attached to a parent, walk \`has_document\` facts with \`memory_list_facts({subjectId, predicate:'has_document'})\`.

- **Delete** — \`memory_forget\` on the doc entity id (soft archive). Use \`memory_restore\` to undo.

When the user says "save this as a doc", "remember this brief", or similar — silently create the document, optionally attach it to the relevant project / event / topic, and reply naturally ("Got it." — see the SUBCONSCIOUS rules above). Never narrate that you stored a document.

### Privacy

Who can read each record is decided by the host platform — not by you. Write the fact; the system handles visibility. Do not ask the user about privacy, visibility, groups, or sharing.

### User-specific directives about YOU — \`memory_set_agent_rule\`

When the user tells you something about **YOU** that should persist across turns — your identity, persona, name, tone, format, language, or interaction rules — call \`memory_set_agent_rule\`. Asymmetry test: "your name is Jason" is a rule about YOU (call this tool); "my name is Anton" is a fact about the USER (do not write — the ambient ingestor handles it). The tool's own description has the full YES/NO trigger list and the first-person rephrasing table — follow it precisely; the prose you pass is read back to you each turn as self-description.

If the user states multiple distinct rules in one turn ("be terse, no bullets, in Russian"), call the tool **once per atomic rule** — each rule supersedes independently and renders as its own line.

Rules render back in the system message as \`- [ruleId=<id>] <rule>\`. To **supersede** a rule when the user contradicts it, pass that \`ruleId\` as \`replaces\`. To **drop** a rule entirely with no replacement, call \`memory_forget({factId: <ruleId>})\` — the bracketed value is the same id either way.

Do NOT use \`memory_remember\` to set behavior rules — that path won't bind to the rules block reliably. Do NOT call \`memory_set_agent_rule\` from ambient inference; under-calling is fine, over-calling pollutes the rule list.`;

export class MemoryWritePluginNextGen implements IContextPluginNextGen {
  readonly name = 'memory_write';

  private readonly memory: MemorySystem;
  private readonly agentId: string;
  private readonly userId: string;
  private readonly groupId: string | undefined;
  private readonly defaultVisibility: {
    forUser: Visibility;
    forAgent: Visibility;
    forOther: Visibility;
  };
  private readonly autoResolveThreshold: number;
  private readonly getOwnSubjectIds: () => {
    userEntityId?: string;
    agentEntityId?: string;
  };
  private readonly forgetRateLimit: MemoryWritePluginConfig['forgetRateLimit'];
  private readonly setAgentRuleRateLimit: MemoryWritePluginConfig['setAgentRuleRateLimit'];
  /**
   * Pre-rendered write-instructions block — built once at construction time
   * from the configured (or `memory`-derived) predicate registry. Storing
   * the string avoids re-rendering the registry on every system-message
   * assembly, AND makes the token-size cache trivially correct (instructions
   * never change for a given plugin instance).
   */
  private readonly instructions: string;

  private readonly estimator: ITokenEstimator = simpleTokenEstimator;
  private instructionsTokenCache: number | null = null;
  private cachedTools: ToolFunction[] | null = null;
  private destroyed = false;

  constructor(config: MemoryWritePluginConfig) {
    if (!config.memory) {
      throw new Error('MemoryWritePluginNextGen requires config.memory (MemorySystem instance)');
    }
    if (!config.agentId) {
      throw new Error('MemoryWritePluginNextGen requires config.agentId');
    }
    if (!config.userId) {
      throw new Error(
        'MemoryWritePluginNextGen requires config.userId — the memory layer ' +
          'enforces an owner invariant on every entity/fact.',
      );
    }
    this.memory = config.memory;
    this.agentId = config.agentId;
    this.userId = config.userId;
    this.groupId = config.groupId;
    this.defaultVisibility = {
      forUser: config.defaultVisibility?.forUser ?? 'private',
      forAgent: config.defaultVisibility?.forAgent ?? 'group',
      forOther: config.defaultVisibility?.forOther ?? 'private',
    };
    this.autoResolveThreshold = config.autoResolveThreshold ?? 0.9;
    this.getOwnSubjectIds = config.getOwnSubjectIds ?? (() => ({}));
    this.forgetRateLimit = config.forgetRateLimit;
    this.setAgentRuleRateLimit = config.setAgentRuleRateLimit;
    // Derive predicate vocabulary from the live MemorySystem's registry by
    // default — keeps the LLM-facing list in lockstep with what `addFact`
    // actually canonicalizes, validates, and ranks. Hand-maintained lists
    // drift; this doesn't.
    const registry = config.predicates ?? this.memory.getPredicateRegistry();
    this.instructions = buildWriteInstructions(registry);
  }

  getInstructions(): string | null {
    return this.instructions;
  }

  async getContent(): Promise<string | null> {
    // Side-effect plugin — no system-message content of its own.
    return null;
  }

  getContents(): unknown {
    return {
      agentId: this.agentId,
      userId: this.userId,
      tools: this.cachedTools?.map((t) => t.definition.function.name) ?? [],
    };
  }

  getTokenSize(): number {
    return 0;
  }

  getInstructionsTokenSize(): number {
    if (this.instructionsTokenCache === null) {
      this.instructionsTokenCache = this.estimator.estimateTokens(this.instructions);
    }
    return this.instructionsTokenCache;
  }

  isCompactable(): boolean {
    return false;
  }

  async compact(_targetTokensToFree: number): Promise<number> {
    return 0;
  }

  getTools(): ToolFunction[] {
    if (!this.cachedTools) {
      this.cachedTools = createMemoryWriteTools({
        memory: this.memory,
        agentId: this.agentId,
        defaultUserId: this.userId,
        defaultGroupId: this.groupId,
        defaultVisibility: this.defaultVisibility,
        autoResolveThreshold: this.autoResolveThreshold,
        getOwnSubjectIds: this.getOwnSubjectIds,
        forgetRateLimit: this.forgetRateLimit,
        setAgentRuleRateLimit: this.setAgentRuleRateLimit,
      });
    }
    return this.cachedTools;
  }

  destroy(): void {
    this.destroyed = true;
    this.cachedTools = null;
  }

  getState(): unknown {
    return { version: 1, agentId: this.agentId, userId: this.userId };
  }

  restoreState(_state: unknown): void {
    // No mutable state to restore.
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }
}
