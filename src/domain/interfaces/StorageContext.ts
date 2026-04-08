/**
 * StorageUserContext — Shared context type for all storage interfaces.
 *
 * Replaces the bare `userId: string | undefined` first parameter pattern.
 * Backward compatible: callers can still pass a plain string or undefined.
 *
 * Multi-tenant support:
 * - `bypassOwnerScope: true` allows admin operations on documents owned
 *   by other users (e.g., system routines, shared resources).
 * - The calling application (V25, Hosea) decides when to set this flag
 *   after its own authorization checks — the library never makes policy
 *   decisions about who is an admin.
 */

/**
 * Context for storage operations.
 */
export interface StorageUserContext {
    /** The acting user's ID */
    userId: string;

    /**
     * When true, storage operations match documents by ID only — not scoped
     * by ownerId. Use for admin/superadmin operations where the caller has
     * already verified authorization.
     *
     * Default: false (normal user-scoped behavior)
     */
    bypassOwnerScope?: boolean;
}

/**
 * Accepted input type for storage methods.
 * Maintains backward compatibility: bare string, undefined, or full context.
 */
export type StorageUserContextInput = string | undefined | StorageUserContext;

/**
 * Resolve any accepted input to a normalized StorageUserContext.
 *
 * - `undefined` → `{ userId: 'default' }`
 * - `'user-123'` → `{ userId: 'user-123' }`
 * - `{ userId: 'user-123', bypassOwnerScope: true }` → passed through
 */
export function resolveStorageUserContext(ctx: StorageUserContextInput): StorageUserContext {
    if (!ctx) {
        return { userId: 'default' };
    }
    if (typeof ctx === 'string') {
        return { userId: ctx };
    }
    return ctx;
}
