/**
 * FileSessionStorage - File-based session storage implementation
 *
 * Stores sessions as JSON files in a directory.
 * Each session is stored in its own file: {sessionId}.json
 *
 * Features:
 * - Persistent storage across process restarts
 * - Human-readable JSON format
 * - Optional compression for large sessions
 * - Index file for fast listing
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type {
  ISessionStorage,
  Session,
  SessionFilter,
  SessionSummary,
} from '../../core/SessionManager.js';

export interface FileSessionStorageConfig {
  /** Directory to store session files */
  directory: string;
  /** Pretty-print JSON (default: false for production) */
  prettyPrint?: boolean;
  /** File extension (default: .json) */
  extension?: string;
}

interface SessionIndex {
  version: number;
  sessions: SessionIndexEntry[];
  lastUpdated: string;
}

interface SessionIndexEntry {
  id: string;
  agentType: string;
  createdAt: string;
  lastActiveAt: string;
  metadata: {
    title?: string;
    userId?: string;
    tags?: string[];
  };
  messageCount: number;
}

export class FileSessionStorage implements ISessionStorage {
  private directory: string;
  private prettyPrint: boolean;
  private extension: string;
  private indexPath: string;
  private index: SessionIndex | null = null;

  constructor(config: FileSessionStorageConfig) {
    this.directory = config.directory;
    this.prettyPrint = config.prettyPrint ?? false;
    this.extension = config.extension ?? '.json';
    this.indexPath = join(this.directory, '_index.json');
  }

  async save(session: Session): Promise<void> {
    await this.ensureDirectory();

    const filePath = this.getFilePath(session.id);
    const data = this.prettyPrint
      ? JSON.stringify(session, null, 2)
      : JSON.stringify(session);

    await fs.writeFile(filePath, data, 'utf-8');

    // Update index
    await this.updateIndex(session);
  }

  async load(sessionId: string): Promise<Session | null> {
    const filePath = this.getFilePath(sessionId);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as Session;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      // Handle corrupted JSON files gracefully
      if (error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }
  }

  async delete(sessionId: string): Promise<void> {
    const filePath = this.getFilePath(sessionId);

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Remove from index
    await this.removeFromIndex(sessionId);
  }

  async exists(sessionId: string): Promise<boolean> {
    const filePath = this.getFilePath(sessionId);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(filter?: SessionFilter): Promise<SessionSummary[]> {
    const index = await this.loadIndex();
    let entries = index.sessions;

    // Apply filters
    if (filter) {
      entries = this.applyFilter(entries, filter);
    }

    // Sort by last active (most recent first)
    entries.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );

    // Apply pagination
    if (filter?.offset) {
      entries = entries.slice(filter.offset);
    }
    if (filter?.limit) {
      entries = entries.slice(0, filter.limit);
    }

    return entries.map(this.indexEntryToSummary);
  }

  async search(query: string, filter?: SessionFilter): Promise<SessionSummary[]> {
    const index = await this.loadIndex();
    const lowerQuery = query.toLowerCase();

    let entries = index.sessions.filter((e) => {
      const titleMatch = e.metadata.title?.toLowerCase().includes(lowerQuery);
      const tagMatch = e.metadata.tags?.some((t) =>
        t.toLowerCase().includes(lowerQuery)
      );
      const idMatch = e.id.toLowerCase().includes(lowerQuery);
      return titleMatch || tagMatch || idMatch;
    });

    // Apply additional filters
    if (filter) {
      entries = this.applyFilter(entries, filter);
    }

    // Sort by relevance then date
    entries.sort((a, b) => {
      const aTitle = a.metadata.title?.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const bTitle = b.metadata.title?.toLowerCase().includes(lowerQuery) ? 1 : 0;
      if (aTitle !== bTitle) return bTitle - aTitle;
      return (
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      );
    });

    // Apply pagination
    if (filter?.offset) {
      entries = entries.slice(filter.offset);
    }
    if (filter?.limit) {
      entries = entries.slice(0, filter.limit);
    }

    return entries.map(this.indexEntryToSummary);
  }

  /**
   * Rebuild the index by scanning all session files
   * Useful for recovery or migration
   */
  async rebuildIndex(): Promise<void> {
    await this.ensureDirectory();

    const files = await fs.readdir(this.directory);
    const sessionFiles = files.filter(
      (f) => f.endsWith(this.extension) && !f.startsWith('_')
    );

    const entries: SessionIndexEntry[] = [];

    for (const file of sessionFiles) {
      try {
        const filePath = join(this.directory, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const session = JSON.parse(data) as Session;
        entries.push(this.sessionToIndexEntry(session));
      } catch {
        // Skip invalid files
      }
    }

    this.index = {
      version: 1,
      sessions: entries,
      lastUpdated: new Date().toISOString(),
    };

    await this.saveIndex();
  }

  /**
   * Get the storage directory path
   */
  getDirectory(): string {
    return this.directory;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private getFilePath(sessionId: string): string {
    // Sanitize session ID for use as filename
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.directory, `${safeId}${this.extension}`);
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async loadIndex(): Promise<SessionIndex> {
    if (this.index) {
      return this.index;
    }

    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(data) as SessionIndex;
      return this.index;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // No index yet, create empty one
        this.index = {
          version: 1,
          sessions: [],
          lastUpdated: new Date().toISOString(),
        };
        return this.index;
      }
      throw error;
    }
  }

  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    this.index.lastUpdated = new Date().toISOString();
    const data = this.prettyPrint
      ? JSON.stringify(this.index, null, 2)
      : JSON.stringify(this.index);

    await fs.writeFile(this.indexPath, data, 'utf-8');
  }

  private async updateIndex(session: Session): Promise<void> {
    const index = await this.loadIndex();
    const entry = this.sessionToIndexEntry(session);

    const existingIdx = index.sessions.findIndex((e) => e.id === session.id);
    if (existingIdx >= 0) {
      index.sessions[existingIdx] = entry;
    } else {
      index.sessions.push(entry);
    }

    await this.saveIndex();
  }

  private async removeFromIndex(sessionId: string): Promise<void> {
    await this.ensureDirectory();
    const index = await this.loadIndex();
    index.sessions = index.sessions.filter((e) => e.id !== sessionId);
    await this.saveIndex();
  }

  private sessionToIndexEntry(session: Session): SessionIndexEntry {
    // Handle createdAt as Date, string, or number
    let createdAtStr: string;
    if (typeof session.createdAt === 'string') {
      createdAtStr = session.createdAt;
    } else if (typeof session.createdAt === 'number') {
      createdAtStr = new Date(session.createdAt).toISOString();
    } else if (session.createdAt instanceof Date) {
      createdAtStr = session.createdAt.toISOString();
    } else {
      createdAtStr = new Date().toISOString();
    }

    // Handle lastActiveAt as Date, string, or number
    let lastActiveAtStr: string;
    if (typeof session.lastActiveAt === 'string') {
      lastActiveAtStr = session.lastActiveAt;
    } else if (typeof session.lastActiveAt === 'number') {
      lastActiveAtStr = new Date(session.lastActiveAt).toISOString();
    } else if (session.lastActiveAt instanceof Date) {
      lastActiveAtStr = session.lastActiveAt.toISOString();
    } else {
      lastActiveAtStr = new Date().toISOString();
    }

    return {
      id: session.id,
      agentType: session.agentType,
      createdAt: createdAtStr,
      lastActiveAt: lastActiveAtStr,
      metadata: {
        title: session.metadata.title,
        userId: session.metadata.userId,
        tags: session.metadata.tags,
      },
      messageCount: session.history.entries.length,
    };
  }

  private indexEntryToSummary(entry: SessionIndexEntry): SessionSummary {
    return {
      id: entry.id,
      agentType: entry.agentType,
      createdAt: new Date(entry.createdAt),
      lastActiveAt: new Date(entry.lastActiveAt),
      metadata: entry.metadata,
      messageCount: entry.messageCount,
    };
  }

  private applyFilter(
    entries: SessionIndexEntry[],
    filter: SessionFilter
  ): SessionIndexEntry[] {
    return entries.filter((e) => {
      if (filter.agentType && e.agentType !== filter.agentType) {
        return false;
      }

      if (filter.userId && e.metadata.userId !== filter.userId) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const entryTags = e.metadata.tags ?? [];
        const hasMatchingTag = filter.tags.some((t) => entryTags.includes(t));
        if (!hasMatchingTag) return false;
      }

      if (filter.createdAfter && new Date(e.createdAt) < filter.createdAfter) {
        return false;
      }

      if (filter.createdBefore && new Date(e.createdAt) > filter.createdBefore) {
        return false;
      }

      if (filter.activeAfter && new Date(e.lastActiveAt) < filter.activeAfter) {
        return false;
      }

      if (filter.activeBefore && new Date(e.lastActiveAt) > filter.activeBefore) {
        return false;
      }

      return true;
    });
  }
}
