# Memory Permissions — Usage Guide

The memory layer ships a three-principal access-control model on top of the existing scope system. Every entity and fact carries an `ownerId` (required) plus an optional `permissions` block governing what **group members** and **the world** can do with it. Writes are authorized; reads are filtered at the storage layer.

This guide covers the model, defaults, migration, and recipes. For the API reference, see [MEMORY_API.md § Access Control](./MEMORY_API.md#access-control).

---

## Table of contents
- [The model at a glance](#the-model-at-a-glance)
- [The three principals](#the-three-principals)
- [Access levels](#access-levels)
- [Defaults — public-read by default](#defaults--public-read-by-default)
- [The owner invariant](#the-owner-invariant)
- [Admin delegation](#admin-delegation)
- [Read filtering vs write authorization](#read-filtering-vs-write-authorization)
- [Recipes](#recipes)
- [Migration notes](#migration-notes)
- [Adapter responsibilities](#adapter-responsibilities)
- [Pitfalls](#pitfalls)

---

## The model at a glance

```ts
interface Permissions {
  group?: AccessLevel;  // what group members (non-owner) can do
  world?: AccessLevel;  // what everyone outside the group can do
}

type AccessLevel = 'none' | 'read' | 'write';   // 'write' implies 'read'
```

Every record is subject to three evaluations in order:

1. **Owner**: if `record.ownerId === caller.userId` → full access, always.
2. **Group**: if `record.groupId === caller.groupId` → use `permissions.group`.
3. **World**: otherwise → use `permissions.world`.

No admin scope, no role system, no per-user ACLs. If you need those, build them on top — we've stayed minimal so the model composes.

---

## The three principals

### Owner
- The user identified by `record.ownerId`.
- Always has full access. Not subject to any permission bit.
- Must be present on every record (see [owner invariant](#the-owner-invariant)).

### Group
- The set of users whose `scope.groupId` matches `record.groupId`.
- Only meaningful when the record has a `groupId` set.
- Access governed by `permissions.group`.

### World
- Everyone else: either callers outside `record.groupId`, or — when the record has no `groupId` — every caller.
- Access governed by `permissions.world`.

---

## Access levels

| Level     | Read?   | Write?  |
| --------- | ------- | ------- |
| `none`    | no      | no      |
| `read`    | yes     | no      |
| `write`   | yes     | yes     |

One field per principal. No bitmask confusion, no "write without read".

---

## Defaults — public-read by default

When `permissions` is omitted:

| `permissions.group`  | `permissions.world`     |
| -------------------- | ----------------------- |
| `'read'` (default)   | `'read'` (default)      |

Every record is **publicly readable, owner-only writable**. Matches UNIX `644` semantics.

**To make a record group-private (not visible outside the group):**
```ts
permissions: { world: 'none' }
```

**To make it fully owner-private:**
```ts
permissions: { group: 'none', world: 'none' }
```

**To make it group-editable (any group member can write):**
```ts
permissions: { group: 'write' }
```

**To make it world-editable (wiki-style):**
```ts
permissions: { world: 'write' }
```

`permissions.group` is only meaningful when `record.groupId` is set. For groupless records, **it's silently ignored** — the group principal doesn't exist, so setting `group: 'write'` without a `groupId` has no effect. No error is raised; document the expectation in your call sites.

---

## The owner invariant

**Every record — entity or fact — must carry an `ownerId`.**

`MemorySystem.upsertEntity` / `addFact` enforce this: if neither the caller nor the input provides an ownerId, they throw `OwnerRequiredError`.

```ts
// rejected
await mem.upsertEntity({ /* …, no ownerId */ }, {});   // throws OwnerRequiredError

// accepted — ownerId defaults from scope.userId
await mem.upsertEntity({ /* … */ }, { userId: 'alice' });

// accepted — explicit ownerId wins (admin case, see below)
await mem.upsertEntity({ /* …, ownerId: 'bob' */ }, { userId: 'admin' });
```

Why: the owner shortcut (unconditional full access) is the cornerstone of the model. Without a guaranteed owner, every mutation would need a dance to figure out who's allowed; with it, every mutation short-circuits cheaply and correctly.

Facts inherit ownership from their subject entity when `input.ownerId` is absent — so you rarely need to set it explicitly at the fact level.

### Profile regeneration inherits permissions

Auto- and manual profile regeneration (`MemorySystem.regenerateProfile`) inherits the prior profile fact's `permissions` block when one exists. A profile that was explicitly set to `{ world: 'none' }` stays private across every regeneration — the library never silently widens visibility. When no prior profile exists (first generation), the new profile uses library defaults (public-read). If you want private profiles from the start, make the first write explicit:

```ts
await mem.addFact(
  {
    subjectId: person.id,
    predicate: 'profile',
    kind: 'document',
    details: '…',
    permissions: { world: 'none' },
  },
  { userId: 'alice' },
);
// Subsequent regenerations inherit { world: 'none' }.
```

---

## Admin delegation

The library does NOT check that `input.ownerId === scope.userId`. A caller may create a record owned by *another user* by setting `ownerId` explicitly:

```ts
await mem.upsertEntity(
  {
    type: 'person',
    displayName: 'Bob Smith',
    identifiers: [{ kind: 'email', value: 'bob@acme.com' }],
    ownerId: 'bob',              // delegating ownership to bob
  },
  { userId: 'admin' },            // admin is the creator but not the owner
);
```

This is intentional — it's your admin hook. Restricting it would force every "create on behalf of" operation through an ugly bypass. If your app needs to forbid delegation, enforce it at the call site.

The resulting record is owned by `bob`: bob has full access, `admin` sees it only via group/world permissions (or not at all if those are `none`).

---

## Read filtering vs write authorization

Access enforcement happens in two places:

### Read filtering — at the storage layer

Every read path (`getEntity`, `findFacts`, `listEntities`, `searchEntities`, `traverse`, `semanticSearch`, `countFacts`, `findEntitiesByIdentifier`) returns only records where `canAccess(record, caller, 'read') === true`. Each adapter translates this into its native query language:

- **InMemoryAdapter** — an in-process predicate.
- **MongoMemoryAdapter** — a Mongo `$or` of three branches (owner / group-read / world-read).

Records you can't read are indistinguishable from records that don't exist. No `PermissionDeniedError` on reads — you just get fewer results.

### Write authorization — at MemorySystem

Every mutation method:
1. Loads the existing record via the scoped read filter.
2. If the record is not found (or invisible), throws a not-found error.
3. If found but `canAccess(record, caller, 'write') === false`, throws `PermissionDeniedError`.
4. Proceeds with the mutation.

UNIX-shaped: you need read to learn a record exists; write is a separate check. The error surface lets callers distinguish "not there" from "there but denied".

Affected methods:
- `archiveEntity`, `deleteEntity`, `mergeEntities`
- `archiveFact`, `supersedeFact`, `addFact` (when `supersedes` is set)
- `upsertEntity` (dirty path — when merging new identifiers into an existing entity)

### Permission-window caveat on cascades

`archiveEntity` / `deleteEntity` cascade to referencing facts; `mergeEntities` rewrites references. Both use the **scope-window** (only see facts visible to caller) and a new **permission-window** (only touch facts the caller can write). Facts the caller can see but not write are left untouched. That's intentional — preventing privilege escalation via cascade — but means a partial merge or cascade is possible. Handle it at the application layer (e.g. re-run the merge as admin) if you need full cleanup.

---

## Recipes

### A team-private note

```ts
await mem.addFact(
  {
    subjectId: entity.id,
    predicate: 'memo',
    kind: 'document',
    details: '…confidential…',
    permissions: { world: 'none' },
  },
  { userId: 'alice', groupId: 'engineering' },
);
```

Visible to: alice (owner), anyone in `engineering` (group default `read`). Outside callers: invisible.

### A fully-private user note

```ts
permissions: { group: 'none', world: 'none' }
```

Only the owner sees it — group members and outsiders cannot even enumerate it.

### A public read-only reference entity

```ts
await mem.upsertEntity(
  {
    type: 'organization',
    displayName: 'OpenAI',
    identifiers: [{ kind: 'domain', value: 'openai.com' }],
    ownerId: 'system',
    // default permissions → world: 'read', group: 'read'
  },
  { userId: 'admin' },
);
```

Visible to everyone, writable only by `system` (your designated admin/system user).

### A wiki-editable entry

```ts
permissions: { world: 'write' }   // anyone can edit
```

### A team-collaborative task

```ts
await mem.upsertEntity(
  {
    type: 'task',
    displayName: 'Refactor auth',
    identifiers: [{ kind: 'task_key', value: 'AUTH-42' }],
    groupId: 'backend-team',
    permissions: { group: 'write' },   // any team member can update; world read-only
  },
  { userId: 'alice', groupId: 'backend-team' },
);
```

### Changing permissions on an existing record (v1: write-once)

**Permissions are fixed at creation in v1.** No first-class API updates them, and critically, `upsertEntity` does NOT rewrite `permissions` on existing records — if the dirty path fires (adding new identifiers to an already-stored entity), the caller's `input.permissions` is **silently ignored** and the existing permissions persist. This is deliberate: upsert is an idempotent write path, not an admin tool, and it would be a foot-cannon for any code that upserts on a hot path to carry the risk of accidentally rewriting an ACL.

Migration / escalation paths:

- **Preferred**: get the owner to re-emit the record with the new permissions. Owner-driven permission changes compose with the audit trail via supersession on fact-level profiles or ordinary updates on entities (owner always has write).
- **Admin escape hatch**: call `store.updateEntity` / `store.updateFact` directly, bypassing `MemorySystem`. You must first verify the caller's authority yourself (the library won't enforce anything here — the store is a lower-level surface).
- **Future**: a first-class `updatePermissions(id, patch, scope)` method may ship in a later release. When it lands, it will check write access under the old permissions before applying the new ones.

---

## Migration notes

This is a **breaking change** relative to pre-permissions versions. Two effects to plan for:

### 1. Public-read default

Previously, a record with `{groupId: 'acme', ownerId: 'alice'}` was invisible to callers outside `acme`. Now, with default `world: 'read'`, it's readable by anyone. To preserve the old group-privacy semantics, set `permissions.world = 'none'` explicitly on records that shouldn't leak.

**Migration plan:** identify which record types your app treats as group-private and bulk-update their `permissions.world = 'none'` at migration time. Reads before migration can see more than they used to — audit any UI that surfaces "anyone's records" before rolling out.

### 2. Owner required on all new writes

Existing records without `ownerId` are tolerated on reads (the adapter's filter handles them), but you cannot create new records without one. Any caller code that created records with `scope: {}` or with no explicit `ownerId` must now:
- Use a scope with `userId` set, OR
- Pass `input.ownerId` explicitly.

**Migration plan:** run a one-time backfill that assigns `ownerId` (e.g. to a distinguished `"system"` user) for all legacy records. After backfill, write-time mutations on legacy records work via the owner shortcut for that system user.

### 3. Stricter write semantics

Previously, any caller whose scope could *see* a record could write it. Now writes require the owner shortcut or explicit `group: 'write'` / `world: 'write'`. This is an improvement but may surface bugs in code paths that relied on the permissive old behavior. Expect `PermissionDeniedError` in places that previously silently succeeded.

---

## Adapter responsibilities

If you're writing a custom `IMemoryStore` adapter, your contract for permissions:

1. **Every read path** (`getEntity`, `getFact`, `findFacts`, `listEntities`, `searchEntities`, `findEntitiesByIdentifier`, `traverse`, `semanticSearch`, `countFacts`) MUST filter results via `canAccess(record, scope, 'read')`. You can implement this either natively (InMemoryAdapter style) or via a query-language translation (MongoAdapter style using the `scopeToFilter` helper).

2. **Mutations don't need permission checks** — MemorySystem does them before calling the adapter. Your mutations still need to enforce scope visibility (can't update a record the caller can't see) via the existing scope filter. `MemorySystem` layers write-auth on top.

3. **Store `permissions` verbatim** — don't normalize or default at the storage layer. All default logic lives in `AccessControl.ts` so it stays consistent across adapters.

4. Recommended indexes (Mongo example): compound on `(ownerId, groupId)` covers the owner shortcut + group match branches. Single-field on `permissions.world` and `permissions.group` if you frequently query with filters that depend on those levels.

---

## Pitfalls

1. **Forgetting `ownerId`.** The most common migration slip. `OwnerRequiredError` is explicit — catch it at integration boundaries.

2. **Public-read surprise.** Don't assume scope isolation still makes a record private. It doesn't — `permissions.world = 'none'` is now the explicit knob.

3. **`permissions.group` on a groupless record.** Silently ignored. If you set `group: 'write'` but forget `groupId`, only the owner can write.

4. **Confusing scope vs permissions.** Scope is "which records apply to this caller"; permissions are "what this caller can do to those records." Both gates must pass for a mutation to succeed.

5. **Partial merges / cascades.** A merge or delete can leave dangling references if the caller lacks write on some referenced facts. Not an error — document in your app if full cleanup is required, and re-run with a broader scope.

6. **Admin delegation visibility.** When `admin` creates a record with `ownerId = 'bob'`, the admin may not be able to see it again unless the record also has group or world read permissions. Plan admin tooling accordingly (admin scope usually sees records because it's the group's `ownerId` or because the record is group-visible).
