/**
 * InMemorySessionStorage - In-memory session storage implementation
 *
 * Stores sessions in memory. Data is lost when process exits.
 * Useful for testing, development, and short-lived applications.
 */

import type {
  ISessionStorage,
  Session,
  SessionFilter,
  SessionSummary,
} from '../../core/SessionManager.js';

export class InMemorySessionStorage implements ISessionStorage {
  private sessions: Map<string, Session> = new Map();

  async save(session: Session): Promise<void> {
    // Deep clone to prevent mutation issues
    this.sessions.set(session.id, JSON.parse(JSON.stringify(session)));
  }

  async load(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    // Return a deep clone
    return JSON.parse(JSON.stringify(session));
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async exists(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  async list(filter?: SessionFilter): Promise<SessionSummary[]> {
    let sessions = Array.from(this.sessions.values());

    // Apply filters
    if (filter) {
      sessions = this.applyFilter(sessions, filter);
    }

    // Sort by last active (most recent first)
    sessions.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );

    // Apply pagination
    if (filter?.offset) {
      sessions = sessions.slice(filter.offset);
    }
    if (filter?.limit) {
      sessions = sessions.slice(0, filter.limit);
    }

    // Convert to summaries
    return sessions.map(this.toSummary);
  }

  async search(query: string, filter?: SessionFilter): Promise<SessionSummary[]> {
    const lowerQuery = query.toLowerCase();
    let sessions = Array.from(this.sessions.values());

    // Apply text search
    sessions = sessions.filter((s) => {
      const titleMatch = s.metadata.title?.toLowerCase().includes(lowerQuery);
      const tagMatch = s.metadata.tags?.some((t) =>
        t.toLowerCase().includes(lowerQuery)
      );
      const idMatch = s.id.toLowerCase().includes(lowerQuery);
      return titleMatch || tagMatch || idMatch;
    });

    // Apply additional filters
    if (filter) {
      sessions = this.applyFilter(sessions, filter);
    }

    // Sort by relevance (title match first) then by date
    sessions.sort((a, b) => {
      const aTitle = a.metadata.title?.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const bTitle = b.metadata.title?.toLowerCase().includes(lowerQuery) ? 1 : 0;
      if (aTitle !== bTitle) return bTitle - aTitle;
      return (
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      );
    });

    // Apply pagination
    if (filter?.offset) {
      sessions = sessions.slice(filter.offset);
    }
    if (filter?.limit) {
      sessions = sessions.slice(0, filter.limit);
    }

    return sessions.map(this.toSummary);
  }

  /**
   * Clear all sessions (useful for testing)
   */
  clear(): void {
    this.sessions.clear();
  }

  /**
   * Get count of sessions
   */
  get size(): number {
    return this.sessions.size;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private applyFilter(sessions: Session[], filter: SessionFilter): Session[] {
    return sessions.filter((s) => {
      if (filter.agentType && s.agentType !== filter.agentType) {
        return false;
      }

      if (filter.userId && s.metadata.userId !== filter.userId) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const sessionTags = s.metadata.tags ?? [];
        const hasMatchingTag = filter.tags.some((t) => sessionTags.includes(t));
        if (!hasMatchingTag) return false;
      }

      if (filter.createdAfter && new Date(s.createdAt) < filter.createdAfter) {
        return false;
      }

      if (filter.createdBefore && new Date(s.createdAt) > filter.createdBefore) {
        return false;
      }

      if (filter.activeAfter && new Date(s.lastActiveAt) < filter.activeAfter) {
        return false;
      }

      if (filter.activeBefore && new Date(s.lastActiveAt) > filter.activeBefore) {
        return false;
      }

      return true;
    });
  }

  private toSummary(session: Session): SessionSummary {
    return {
      id: session.id,
      agentType: session.agentType,
      createdAt: new Date(session.createdAt),
      lastActiveAt: new Date(session.lastActiveAt),
      metadata: session.metadata,
      messageCount: session.history.entries.length,
    };
  }
}
