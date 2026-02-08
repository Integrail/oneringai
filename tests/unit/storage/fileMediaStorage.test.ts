/**
 * Tests for FileMediaStorage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  FileMediaStorage,
  createFileMediaStorage,
} from '../../../src/infrastructure/storage/FileMediaStorage.js';
import type {
  MediaStorageMetadata,
} from '../../../src/domain/interfaces/IMediaStorage.js';

describe('FileMediaStorage', () => {
  let storage: FileMediaStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `filemedia-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileMediaStorage({ outputDir: testDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const testImageMetadata: MediaStorageMetadata = {
    type: 'image',
    format: 'png',
    model: 'dall-e-3',
    vendor: 'openai',
  };

  const testAudioMetadata: MediaStorageMetadata = {
    type: 'audio',
    format: 'mp3',
    model: 'tts-1',
    vendor: 'openai',
  };

  const testVideoMetadata: MediaStorageMetadata = {
    type: 'video',
    format: 'mp4',
    model: 'sora',
    vendor: 'openai',
  };

  describe('save', () => {
    it('should save data and return location, mimeType, size', async () => {
      const data = Buffer.from('fake png data');
      const result = await storage.save(data, testImageMetadata);

      expect(result.location).toContain(testDir);
      expect(result.location).toMatch(/image_\d+_[a-f0-9]+\.png$/);
      expect(result.mimeType).toBe('image/png');
      expect(result.size).toBe(data.length);

      // Verify file actually exists on disk
      const fileData = await fs.readFile(result.location);
      expect(fileData).toEqual(data);
    });

    it('should use suggestedFilename when provided', async () => {
      const data = Buffer.from('test');
      const result = await storage.save(data, {
        ...testImageMetadata,
        suggestedFilename: 'my-image.png',
      });

      expect(result.location).toContain('my-image.png');
    });

    it('should include index suffix when provided', async () => {
      const data = Buffer.from('test');
      const result = await storage.save(data, {
        ...testImageMetadata,
        index: 2,
      });

      expect(result.location).toMatch(/_2\.png$/);
    });

    it('should return correct MIME types', async () => {
      const data = Buffer.from('test');

      const mp3 = await storage.save(data, testAudioMetadata);
      expect(mp3.mimeType).toBe('audio/mpeg');

      const mp4 = await storage.save(data, testVideoMetadata);
      expect(mp4.mimeType).toBe('video/mp4');

      const wav = await storage.save(data, { ...testAudioMetadata, format: 'wav' });
      expect(wav.mimeType).toBe('audio/wav');

      const webp = await storage.save(data, { ...testImageMetadata, format: 'webp' });
      expect(webp.mimeType).toBe('image/webp');
    });

    it('should fall back to application/octet-stream for unknown formats', async () => {
      const data = Buffer.from('test');
      const result = await storage.save(data, { ...testImageMetadata, format: 'xyz' });
      expect(result.mimeType).toBe('application/octet-stream');
    });

    it('should create output directory automatically', async () => {
      const deepDir = join(testDir, 'a', 'b', 'c');
      const deepStorage = new FileMediaStorage({ outputDir: deepDir });

      const data = Buffer.from('test');
      const result = await deepStorage.save(data, testImageMetadata);

      expect(result.location).toContain(deepDir);
    });
  });

  describe('read', () => {
    it('should read saved data', async () => {
      const data = Buffer.from('hello media');
      const saveResult = await storage.save(data, testImageMetadata);

      const readData = await storage.read(saveResult.location);
      expect(readData).toEqual(data);
    });

    it('should return null for non-existent file', async () => {
      const result = await storage.read('/nonexistent/path/file.png');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a saved file', async () => {
      const data = Buffer.from('to delete');
      const saveResult = await storage.save(data, testImageMetadata);

      expect(await storage.exists(saveResult.location)).toBe(true);

      await storage.delete(saveResult.location);

      expect(await storage.exists(saveResult.location)).toBe(false);
    });

    it('should not throw for non-existent file', async () => {
      await expect(storage.delete('/nonexistent/file.png')).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const data = Buffer.from('test');
      const saveResult = await storage.save(data, testImageMetadata);

      expect(await storage.exists(saveResult.location)).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await storage.exists('/nonexistent/file.png')).toBe(false);
    });
  });

  describe('save/read/delete round-trip', () => {
    it('should complete a full CRUD cycle', async () => {
      const data = Buffer.from('round trip data');

      // Save
      const saveResult = await storage.save(data, testImageMetadata);
      expect(saveResult.size).toBe(data.length);

      // Read
      const readData = await storage.read(saveResult.location);
      expect(readData).toEqual(data);

      // Exists
      expect(await storage.exists(saveResult.location)).toBe(true);

      // Delete
      await storage.delete(saveResult.location);

      // Verify deleted
      expect(await storage.exists(saveResult.location)).toBe(false);
      expect(await storage.read(saveResult.location)).toBeNull();
    });
  });

  describe('list', () => {
    it('should list saved files', async () => {
      await storage.save(Buffer.from('img'), testImageMetadata);
      await storage.save(Buffer.from('audio'), testAudioMetadata);
      await storage.save(Buffer.from('video'), testVideoMetadata);

      const entries = await storage.list!();
      expect(entries).toHaveLength(3);
    });

    it('should filter by type', async () => {
      await storage.save(Buffer.from('img1'), testImageMetadata);
      await storage.save(Buffer.from('img2'), testImageMetadata);
      await storage.save(Buffer.from('audio'), testAudioMetadata);

      const images = await storage.list!({ type: 'image' });
      expect(images).toHaveLength(2);
      expect(images.every((e) => e.type === 'image')).toBe(true);

      const audio = await storage.list!({ type: 'audio' });
      expect(audio).toHaveLength(1);
    });

    it('should support pagination', async () => {
      await storage.save(Buffer.from('1'), testImageMetadata);
      await storage.save(Buffer.from('2'), testImageMetadata);
      await storage.save(Buffer.from('3'), testImageMetadata);

      const page1 = await storage.list!({ limit: 2 });
      expect(page1).toHaveLength(2);

      const page2 = await storage.list!({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(1);
    });

    it('should return entries with correct metadata', async () => {
      const data = Buffer.from('test data');
      const saveResult = await storage.save(data, testImageMetadata);

      const entries = await storage.list!();
      expect(entries).toHaveLength(1);

      const entry = entries[0]!;
      expect(entry.location).toBe(saveResult.location);
      expect(entry.mimeType).toBe('image/png');
      expect(entry.size).toBe(data.length);
      expect(entry.type).toBe('image');
      expect(entry.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getPath', () => {
    it('should return the output directory', () => {
      expect(storage.getPath()).toBe(testDir);
    });

    it('should use default path when no config provided', () => {
      const defaultStorage = new FileMediaStorage();
      expect(defaultStorage.getPath()).toContain('oneringai-media');
    });
  });

  describe('generateFilename format', () => {
    it('should generate filenames with correct pattern', async () => {
      const data = Buffer.from('test');
      const result = await storage.save(data, testImageMetadata);
      const filename = result.location.split('/').pop()!;

      // Pattern: {type}_{timestamp}_{random}.{format}
      expect(filename).toMatch(/^image_\d+_[a-f0-9]{8}\.png$/);
    });

    it('should generate unique filenames', async () => {
      const data = Buffer.from('test');
      const result1 = await storage.save(data, testImageMetadata);
      const result2 = await storage.save(data, testImageMetadata);

      expect(result1.location).not.toBe(result2.location);
    });
  });

  describe('createFileMediaStorage helper', () => {
    it('should create storage with defaults', () => {
      const s = createFileMediaStorage();
      expect(s).toBeInstanceOf(FileMediaStorage);
      expect(s.getPath()).toContain('oneringai-media');
    });

    it('should accept custom output directory', () => {
      const customDir = join(testDir, 'custom');
      const s = createFileMediaStorage({ outputDir: customDir });
      expect(s.getPath()).toBe(customDir);
    });
  });
});
