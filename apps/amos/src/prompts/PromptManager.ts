/**
 * PromptManager - Manages system prompt templates
 *
 * Loads and manages system prompt templates from the filesystem.
 * Templates are stored as .md files with YAML frontmatter for metadata.
 */

import { readdir, readFile, writeFile, stat, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import type { IPromptManager, PromptTemplate, AmosConfig } from '../config/types.js';

/**
 * Parse frontmatter from a markdown file
 * Frontmatter format:
 * ---
 * description: A description of the prompt
 * ---
 * Content here...
 */
function parseFrontmatter(content: string): { description: string; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const frontmatter = match[1] || '';
    const body = match[2] || '';

    // Simple YAML parsing for description
    const descMatch = frontmatter.match(/description:\s*(.+)/);
    const description = descMatch ? descMatch[1].trim() : '';

    return { description, content: body.trim() };
  }

  // No frontmatter, entire content is the prompt
  return { description: '', content: content.trim() };
}

/**
 * Create frontmatter for a prompt file
 */
function createFrontmatter(description: string, content: string): string {
  if (description) {
    return `---\ndescription: ${description}\n---\n\n${content}`;
  }
  return content;
}

export class PromptManager implements IPromptManager {
  private config: AmosConfig;
  private promptsDir: string;
  private prompts: Map<string, PromptTemplate> = new Map();
  private activePromptName: string | null = null;

  constructor(config: AmosConfig) {
    this.config = config;
    this.promptsDir = config.prompts.promptsDir;
    this.activePromptName = config.prompts.activePrompt;
  }

  /**
   * Initialize the prompt manager
   */
  async initialize(): Promise<void> {
    // Ensure prompts directory exists
    if (!existsSync(this.promptsDir)) {
      await mkdir(this.promptsDir, { recursive: true });
      // Create a default prompt template
      await this.createDefaultPrompt();
    }

    await this.loadPrompts();
  }

  /**
   * Reload all prompts from disk
   */
  async reload(): Promise<void> {
    this.prompts.clear();
    await this.loadPrompts();
  }

  /**
   * Load all prompts from the prompts directory
   */
  private async loadPrompts(): Promise<void> {
    try {
      const files = await readdir(this.promptsDir);

      for (const file of files) {
        if (extname(file) === '.md') {
          const filePath = join(this.promptsDir, file);
          const stats = await stat(filePath);

          if (stats.isFile()) {
            const rawContent = await readFile(filePath, 'utf-8');
            const { description, content } = parseFrontmatter(rawContent);
            const name = basename(file, '.md');

            this.prompts.set(name, {
              name,
              description,
              content,
              filePath,
              createdAt: stats.birthtime.getTime(),
              updatedAt: stats.mtime.getTime(),
            });
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      console.error('Failed to load prompts:', error);
    }
  }

  /**
   * Create a default prompt template
   */
  private async createDefaultPrompt(): Promise<void> {
    const defaultContent = `---
description: Default helpful assistant prompt
---

You are a helpful AI assistant. You can help with a variety of tasks including:

- Answering questions
- Writing and editing text
- Coding and debugging
- Analysis and research
- Creative tasks

Be concise, accurate, and helpful. Ask for clarification when needed.`;

    const filePath = join(this.promptsDir, 'default.md');
    await writeFile(filePath, defaultContent, 'utf-8');
  }

  /**
   * List all available prompts
   */
  list(): PromptTemplate[] {
    return Array.from(this.prompts.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Get a prompt by name
   */
  get(name: string): PromptTemplate | null {
    return this.prompts.get(name) || null;
  }

  /**
   * Get the content of a prompt by name
   */
  getContent(name: string): string | null {
    const prompt = this.prompts.get(name);
    return prompt?.content || null;
  }

  /**
   * Create a new prompt
   */
  async create(name: string, content: string, description: string = ''): Promise<void> {
    // Validate name (no special characters except - and _)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Prompt name can only contain letters, numbers, hyphens, and underscores');
    }

    // Check if already exists
    if (this.prompts.has(name)) {
      throw new Error(`Prompt "${name}" already exists`);
    }

    const filePath = join(this.promptsDir, `${name}.md`);
    const fileContent = createFrontmatter(description, content);
    await writeFile(filePath, fileContent, 'utf-8');

    const stats = await stat(filePath);
    this.prompts.set(name, {
      name,
      description,
      content,
      filePath,
      createdAt: stats.birthtime.getTime(),
      updatedAt: stats.mtime.getTime(),
    });
  }

  /**
   * Update an existing prompt
   */
  async update(name: string, content: string, description?: string): Promise<void> {
    const existing = this.prompts.get(name);
    if (!existing) {
      throw new Error(`Prompt "${name}" not found`);
    }

    const finalDescription = description ?? existing.description;
    const fileContent = createFrontmatter(finalDescription, content);
    await writeFile(existing.filePath, fileContent, 'utf-8');

    const stats = await stat(existing.filePath);
    this.prompts.set(name, {
      ...existing,
      description: finalDescription,
      content,
      updatedAt: stats.mtime.getTime(),
    });
  }

  /**
   * Delete a prompt
   */
  async delete(name: string): Promise<void> {
    const existing = this.prompts.get(name);
    if (!existing) {
      throw new Error(`Prompt "${name}" not found`);
    }

    await unlink(existing.filePath);
    this.prompts.delete(name);

    // If this was the active prompt, clear it
    if (this.activePromptName === name) {
      this.activePromptName = null;
    }
  }

  /**
   * Set the active prompt
   */
  setActive(name: string | null): void {
    if (name !== null && !this.prompts.has(name)) {
      throw new Error(`Prompt "${name}" not found`);
    }
    this.activePromptName = name;
  }

  /**
   * Get the active prompt
   */
  getActive(): PromptTemplate | null {
    if (!this.activePromptName) {
      return null;
    }
    return this.prompts.get(this.activePromptName) || null;
  }

  /**
   * Get the content of the active prompt
   */
  getActiveContent(): string | null {
    const active = this.getActive();
    return active?.content || null;
  }

  /**
   * Get the active prompt name
   */
  getActiveName(): string | null {
    return this.activePromptName;
  }

  /**
   * Update the prompts directory
   */
  async setPromptsDir(dir: string): Promise<void> {
    this.promptsDir = dir;
    await this.reload();
  }
}
