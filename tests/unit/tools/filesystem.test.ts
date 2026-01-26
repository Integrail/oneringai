/**
 * Unit tests for Filesystem Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile as fsWriteFile, mkdir, rm, readFile as fsReadFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
  createListDirectoryTool,
  validatePath,
  DEFAULT_FILESYSTEM_CONFIG,
} from '../../../src/tools/filesystem/index.js';

describe('Filesystem Tools', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `oneringai-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('validatePath', () => {
    it('should validate absolute paths', () => {
      const result = validatePath('/some/path');
      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBe('/some/path');
    });

    it('should resolve relative paths', () => {
      const result = validatePath('relative/path', { workingDirectory: '/base' });
      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBe('/base/relative/path');
    });

    it('should block node_modules by default', () => {
      const result = validatePath('/project/node_modules/package');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked');
    });

    it('should block .git by default', () => {
      const result = validatePath('/project/.git/config');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('blocked');
    });

    it('should allow custom blocked directories', () => {
      const result = validatePath('/project/secret/file', {
        blockedDirectories: ['secret'],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Read File Tool', () => {
    it('should create tool with correct definition', () => {
      const tool = createReadFileTool();
      expect(tool.definition.function.name).toBe('read_file');
      expect(tool.definition.function.parameters.required).toContain('file_path');
    });

    it('should read file content', async () => {
      const filePath = join(testDir, 'test.txt');
      await fsWriteFile(filePath, 'Hello, World!\nLine 2\nLine 3');

      const tool = createReadFileTool({ workingDirectory: testDir });
      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Hello, World!');
      expect(result.content).toContain('1\t');
      expect(result.lines).toBe(3);
    });

    it('should handle file not found', async () => {
      const tool = createReadFileTool({ workingDirectory: testDir });
      const result = await tool.execute({ file_path: join(testDir, 'nonexistent.txt') });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should support offset and limit', async () => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
      const filePath = join(testDir, 'large.txt');
      await fsWriteFile(filePath, lines);

      const tool = createReadFileTool({ workingDirectory: testDir });
      const result = await tool.execute({ file_path: filePath, offset: 50, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Line 50');
      expect(result.content).toContain('Line 59');
      expect(result.content).not.toContain('Line 60');
    });
  });

  describe('Write File Tool', () => {
    it('should create tool with correct definition', () => {
      const tool = createWriteFileTool();
      expect(tool.definition.function.name).toBe('write_file');
      expect(tool.definition.function.parameters.required).toContain('file_path');
      expect(tool.definition.function.parameters.required).toContain('content');
    });

    it('should write file content', async () => {
      const filePath = join(testDir, 'output.txt');
      const content = 'Test content';

      const tool = createWriteFileTool({ workingDirectory: testDir });
      const result = await tool.execute({ file_path: filePath, content });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);

      const written = await fsReadFile(filePath, 'utf-8');
      expect(written).toBe(content);
    });

    it('should create parent directories', async () => {
      const filePath = join(testDir, 'nested', 'deep', 'file.txt');
      const content = 'Nested content';

      const tool = createWriteFileTool({ workingDirectory: testDir });
      const result = await tool.execute({ file_path: filePath, content });

      expect(result.success).toBe(true);
      expect(existsSync(filePath)).toBe(true);
    });

    it('should overwrite existing files', async () => {
      const filePath = join(testDir, 'existing.txt');
      await fsWriteFile(filePath, 'Original');

      const tool = createWriteFileTool({ workingDirectory: testDir });
      const result = await tool.execute({ file_path: filePath, content: 'New content' });

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);

      const written = await fsReadFile(filePath, 'utf-8');
      expect(written).toBe('New content');
    });
  });

  describe('Edit File Tool', () => {
    it('should create tool with correct definition', () => {
      const tool = createEditFileTool();
      expect(tool.definition.function.name).toBe('edit_file');
      expect(tool.definition.function.parameters.required).toContain('old_string');
      expect(tool.definition.function.parameters.required).toContain('new_string');
    });

    it('should perform simple replacement', async () => {
      const filePath = join(testDir, 'edit.txt');
      await fsWriteFile(filePath, 'const x = 1;\nconst y = 2;');

      const tool = createEditFileTool({ workingDirectory: testDir });
      const result = await tool.execute({
        file_path: filePath,
        old_string: 'const x = 1;',
        new_string: 'const x = 42;',
      });

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(1);

      const content = await fsReadFile(filePath, 'utf-8');
      expect(content).toBe('const x = 42;\nconst y = 2;');
    });

    it('should reject if old_string equals new_string', async () => {
      const filePath = join(testDir, 'edit.txt');
      await fsWriteFile(filePath, 'content');

      const tool = createEditFileTool({ workingDirectory: testDir });
      const result = await tool.execute({
        file_path: filePath,
        old_string: 'same',
        new_string: 'same',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('different');
    });

    it('should fail if old_string not found', async () => {
      const filePath = join(testDir, 'edit.txt');
      await fsWriteFile(filePath, 'content');

      const tool = createEditFileTool({ workingDirectory: testDir });
      const result = await tool.execute({
        file_path: filePath,
        old_string: 'notfound',
        new_string: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail if old_string is not unique without replace_all', async () => {
      const filePath = join(testDir, 'edit.txt');
      await fsWriteFile(filePath, 'foo foo foo');

      const tool = createEditFileTool({ workingDirectory: testDir });
      const result = await tool.execute({
        file_path: filePath,
        old_string: 'foo',
        new_string: 'bar',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('3 times');
    });

    it('should replace all with replace_all flag', async () => {
      const filePath = join(testDir, 'edit.txt');
      await fsWriteFile(filePath, 'foo foo foo');

      const tool = createEditFileTool({ workingDirectory: testDir });
      const result = await tool.execute({
        file_path: filePath,
        old_string: 'foo',
        new_string: 'bar',
        replace_all: true,
      });

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(3);

      const content = await fsReadFile(filePath, 'utf-8');
      expect(content).toBe('bar bar bar');
    });
  });

  describe('Glob Tool', () => {
    beforeEach(async () => {
      // Create test file structure
      await mkdir(join(testDir, 'src'), { recursive: true });
      await mkdir(join(testDir, 'tests'), { recursive: true });
      await fsWriteFile(join(testDir, 'src', 'index.ts'), 'export {}');
      await fsWriteFile(join(testDir, 'src', 'utils.ts'), 'export {}');
      await fsWriteFile(join(testDir, 'tests', 'index.test.ts'), 'test()');
      await fsWriteFile(join(testDir, 'README.md'), '# Test');
    });

    it('should create tool with correct definition', () => {
      const tool = createGlobTool();
      expect(tool.definition.function.name).toBe('glob');
      expect(tool.definition.function.parameters.required).toContain('pattern');
    });

    it('should find files by pattern', async () => {
      const tool = createGlobTool({ workingDirectory: testDir });
      const result = await tool.execute({ pattern: '**/*.ts', path: testDir });

      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      expect(result.files!.length).toBe(3);
    });

    it('should find files in subdirectory', async () => {
      const tool = createGlobTool({ workingDirectory: testDir });
      const result = await tool.execute({ pattern: 'src/*.ts', path: testDir });

      expect(result.success).toBe(true);
      expect(result.files!.length).toBe(2);
    });

    it('should handle directory not found', async () => {
      const tool = createGlobTool({ workingDirectory: testDir });
      const result = await tool.execute({ pattern: '*.ts', path: join(testDir, 'nonexistent') });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Grep Tool', () => {
    beforeEach(async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await fsWriteFile(join(testDir, 'src', 'index.ts'), 'export function hello() {\n  console.log("Hello");\n}');
      await fsWriteFile(join(testDir, 'src', 'utils.ts'), 'export function goodbye() {\n  console.log("Goodbye");\n}');
    });

    it('should create tool with correct definition', () => {
      const tool = createGrepTool();
      expect(tool.definition.function.name).toBe('grep');
      expect(tool.definition.function.parameters.required).toContain('pattern');
    });

    it('should find matches in files', async () => {
      const tool = createGrepTool({ workingDirectory: testDir });
      const result = await tool.execute({ pattern: 'console\\.log', path: testDir });

      expect(result.success).toBe(true);
      expect(result.filesMatched).toBe(2);
      expect(result.totalMatches).toBe(2);
    });

    it('should filter by file type', async () => {
      await fsWriteFile(join(testDir, 'script.js'), 'console.log("JS")');

      const tool = createGrepTool({ workingDirectory: testDir });
      const result = await tool.execute({ pattern: 'console', path: testDir, type: 'ts' });

      expect(result.success).toBe(true);
      // Only matches .ts files
      expect(result.filesMatched).toBe(2);
    });

    it('should return content with output_mode content', async () => {
      const tool = createGrepTool({ workingDirectory: testDir });
      const result = await tool.execute({
        pattern: 'function',
        path: testDir,
        output_mode: 'content',
      });

      expect(result.success).toBe(true);
      expect(result.matches).toBeDefined();
      expect(result.matches!.length).toBeGreaterThan(0);
      expect(result.matches![0].content).toContain('function');
    });

    it('should support case insensitive search', async () => {
      const tool = createGrepTool({ workingDirectory: testDir });
      const result = await tool.execute({
        pattern: 'HELLO',
        path: testDir,
        case_insensitive: true,
      });

      expect(result.success).toBe(true);
      expect(result.totalMatches).toBeGreaterThan(0);
    });
  });

  describe('List Directory Tool', () => {
    beforeEach(async () => {
      await mkdir(join(testDir, 'subdir'), { recursive: true });
      await fsWriteFile(join(testDir, 'file1.txt'), 'content1');
      await fsWriteFile(join(testDir, 'file2.txt'), 'content2');
      await fsWriteFile(join(testDir, 'subdir', 'nested.txt'), 'nested');
    });

    it('should create tool with correct definition', () => {
      const tool = createListDirectoryTool();
      expect(tool.definition.function.name).toBe('list_directory');
      expect(tool.definition.function.parameters.required).toContain('path');
    });

    it('should list directory contents', async () => {
      const tool = createListDirectoryTool({ workingDirectory: testDir });
      const result = await tool.execute({ path: testDir });

      expect(result.success).toBe(true);
      expect(result.entries).toBeDefined();
      expect(result.count).toBe(3); // 2 files + 1 directory
    });

    it('should list recursively', async () => {
      const tool = createListDirectoryTool({ workingDirectory: testDir });
      const result = await tool.execute({ path: testDir, recursive: true });

      expect(result.success).toBe(true);
      expect(result.count).toBe(4); // 3 files + 1 directory
    });

    it('should filter by type', async () => {
      const tool = createListDirectoryTool({ workingDirectory: testDir });
      const result = await tool.execute({ path: testDir, filter: 'files' });

      expect(result.success).toBe(true);
      expect(result.entries!.every(e => e.type === 'file')).toBe(true);
    });

    it('should handle path not found', async () => {
      const tool = createListDirectoryTool({ workingDirectory: testDir });
      const result = await tool.execute({ path: join(testDir, 'nonexistent') });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
