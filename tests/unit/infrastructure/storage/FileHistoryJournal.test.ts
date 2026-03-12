/**
 * Tests for FileHistoryJournal - JSONL-based append-only conversation history
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileHistoryJournal } from '../../../../src/infrastructure/storage/FileHistoryJournal.js';
import type { HistoryEntry } from '../../../../src/domain/interfaces/IHistoryJournal.js';
import type { Message } from '../../../../src/domain/entities/Message.js';

// Helper to create a test message
function makeMessage(role: 'user' | 'assistant', text: string): Message {
  return {
    type: 'message',
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content: [{ type: 'input_text', text }],
  } as Message;
}

function makeEntry(type: HistoryEntry['type'], text: string, turnIndex: number, timestamp?: number): HistoryEntry {
  return {
    timestamp: timestamp ?? Date.now(),
    type,
    item: makeMessage(type === 'user' ? 'user' : type === 'assistant' ? 'assistant' : 'user', text),
    turnIndex,
  };
}

describe('FileHistoryJournal', () => {
  let testDir: string;
  let journal: FileHistoryJournal;

  beforeEach(async () => {
    testDir = join(tmpdir(), `journal-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fs.mkdir(testDir, { recursive: true });
    journal = new FileHistoryJournal(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('append', () => {
    it('should create JSONL file and write entries', async () => {
      const entry = makeEntry('user', 'Hello!', 0);
      await journal.append('session-1', [entry]);

      const content = await fs.readFile(join(testDir, 'session-1.history.jsonl'), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.type).toBe('user');
      expect(parsed.turnIndex).toBe(0);
    });

    it('should append multiple entries across calls', async () => {
      await journal.append('session-1', [makeEntry('user', 'Hello', 0)]);
      await journal.append('session-1', [makeEntry('assistant', 'Hi there', 0)]);
      await journal.append('session-1', [makeEntry('user', 'How are you?', 1)]);

      const entries = await journal.read('session-1');
      expect(entries).toHaveLength(3);
      expect(entries[0]!.type).toBe('user');
      expect(entries[1]!.type).toBe('assistant');
      expect(entries[2]!.type).toBe('user');
    });

    it('should append multiple entries in a single call', async () => {
      const entries = [
        makeEntry('user', 'Hello', 0),
        makeEntry('assistant', 'Hi', 0),
      ];
      await journal.append('session-1', entries);

      const result = await journal.read('session-1');
      expect(result).toHaveLength(2);
    });

    it('should handle empty entries array', async () => {
      await journal.append('session-1', []);
      // File should not be created for empty appends
      const exists = await fs.access(join(testDir, 'session-1.history.jsonl')).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should keep separate files per session', async () => {
      await journal.append('session-1', [makeEntry('user', 'Hello 1', 0)]);
      await journal.append('session-2', [makeEntry('user', 'Hello 2', 0)]);

      const entries1 = await journal.read('session-1');
      const entries2 = await journal.read('session-2');
      expect(entries1).toHaveLength(1);
      expect(entries2).toHaveLength(1);
    });
  });

  describe('read', () => {
    it('should return empty array for non-existent session', async () => {
      const entries = await journal.read('nonexistent');
      expect(entries).toEqual([]);
    });

    it('should filter by type', async () => {
      await journal.append('s1', [
        makeEntry('user', 'Q1', 0),
        makeEntry('assistant', 'A1', 0),
        makeEntry('tool_result', 'Result', 0),
        makeEntry('user', 'Q2', 1),
      ]);

      const userOnly = await journal.read('s1', { types: ['user'] });
      expect(userOnly).toHaveLength(2);
      expect(userOnly.every(e => e.type === 'user')).toBe(true);

      const assistantOnly = await journal.read('s1', { types: ['assistant'] });
      expect(assistantOnly).toHaveLength(1);
    });

    it('should paginate with offset and limit', async () => {
      await journal.append('s1', [
        makeEntry('user', 'Q1', 0),
        makeEntry('assistant', 'A1', 0),
        makeEntry('user', 'Q2', 1),
        makeEntry('assistant', 'A2', 1),
        makeEntry('user', 'Q3', 2),
      ]);

      const page = await journal.read('s1', { offset: 1, limit: 2 });
      expect(page).toHaveLength(2);
      expect(page[0]!.type).toBe('assistant');
      expect(page[1]!.type).toBe('user');
    });

    it('should filter by turn range', async () => {
      await journal.append('s1', [
        makeEntry('user', 'Q1', 0),
        makeEntry('assistant', 'A1', 0),
        makeEntry('user', 'Q2', 1),
        makeEntry('assistant', 'A2', 1),
        makeEntry('user', 'Q3', 2),
      ]);

      const turn1 = await journal.read('s1', { fromTurn: 1, toTurn: 1 });
      expect(turn1).toHaveLength(2);
      expect(turn1[0]!.turnIndex).toBe(1);
      expect(turn1[1]!.turnIndex).toBe(1);
    });

    it('should filter by timestamp range', async () => {
      const now = Date.now();
      await journal.append('s1', [
        makeEntry('user', 'old', 0, now - 10000),
        makeEntry('user', 'mid', 1, now),
        makeEntry('user', 'new', 2, now + 10000),
      ]);

      const recent = await journal.read('s1', { after: now - 1 });
      expect(recent).toHaveLength(2);
    });
  });

  describe('count', () => {
    it('should return 0 for non-existent session', async () => {
      expect(await journal.count('nonexistent')).toBe(0);
    });

    it('should count entries correctly', async () => {
      await journal.append('s1', [
        makeEntry('user', 'Q1', 0),
        makeEntry('assistant', 'A1', 0),
        makeEntry('user', 'Q2', 1),
      ]);

      expect(await journal.count('s1')).toBe(3);
    });
  });

  describe('clear', () => {
    it('should delete the journal file', async () => {
      await journal.append('s1', [makeEntry('user', 'Hello', 0)]);
      expect(await journal.count('s1')).toBe(1);

      await journal.clear('s1');
      expect(await journal.count('s1')).toBe(0);
    });

    it('should not throw for non-existent session', async () => {
      await expect(journal.clear('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('stream', () => {
    it('should stream all entries', async () => {
      await journal.append('s1', [
        makeEntry('user', 'Q1', 0),
        makeEntry('assistant', 'A1', 0),
        makeEntry('user', 'Q2', 1),
      ]);

      const entries: HistoryEntry[] = [];
      for await (const entry of journal.stream('s1')) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(3);
    });

    it('should stream with filters', async () => {
      await journal.append('s1', [
        makeEntry('user', 'Q1', 0),
        makeEntry('assistant', 'A1', 0),
        makeEntry('user', 'Q2', 1),
        makeEntry('assistant', 'A2', 1),
      ]);

      const entries: HistoryEntry[] = [];
      for await (const entry of journal.stream('s1', { types: ['user'], limit: 1 })) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(1);
      expect(entries[0]!.type).toBe('user');
    });

    it('should yield nothing for non-existent session', async () => {
      const entries: HistoryEntry[] = [];
      for await (const entry of journal.stream('nonexistent')) {
        entries.push(entry);
      }
      expect(entries).toHaveLength(0);
    });
  });

  describe('getLocation', () => {
    it('should return the JSONL file path', () => {
      const location = journal.getLocation!('session-1');
      expect(location).toContain('session-1.history.jsonl');
      expect(location).toContain(testDir);
    });
  });

  describe('session ID sanitization', () => {
    it('should sanitize session IDs for filenames', async () => {
      await journal.append('my/weird:session!id', [makeEntry('user', 'Hello', 0)]);

      const entries = await journal.read('my/weird:session!id');
      expect(entries).toHaveLength(1);

      // Check file was created with sanitized name
      const files = await fs.readdir(testDir);
      const journalFiles = files.filter(f => f.endsWith('.history.jsonl'));
      expect(journalFiles).toHaveLength(1);
      expect(journalFiles[0]).not.toContain('/');
      expect(journalFiles[0]).not.toContain(':');
    });
  });
});
