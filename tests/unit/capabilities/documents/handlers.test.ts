/**
 * Unit tests for Document Format Handlers
 */

import { describe, it, expect } from 'vitest';
import { TextHandler } from '../../../../src/capabilities/documents/handlers/TextHandler.js';
import { ImageHandler } from '../../../../src/capabilities/documents/handlers/ImageHandler.js';
import { HTMLHandler } from '../../../../src/capabilities/documents/handlers/HTMLHandler.js';
import type { DocumentReadOptions } from '../../../../src/capabilities/documents/types.js';

const defaultOptions: DocumentReadOptions = {};

describe('TextHandler', () => {
  const handler = new TextHandler();

  it('should handle plain text', async () => {
    const buffer = Buffer.from('Hello, world!');
    const pieces = await handler.handle(buffer, 'hello.txt', 'txt', defaultOptions);

    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.type).toBe('text');
    expect(pieces[0]!.type === 'text' && pieces[0]!.content).toBe('Hello, world!');
    expect(pieces[0]!.metadata.format).toBe('txt');
    expect(pieces[0]!.metadata.sourceFilename).toBe('hello.txt');
  });

  it('should handle markdown', async () => {
    const buffer = Buffer.from('# Hello\n\nWorld');
    const pieces = await handler.handle(buffer, 'README.md', 'md', defaultOptions);

    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.type === 'text' && pieces[0]!.content).toBe('# Hello\n\nWorld');
  });

  it('should wrap JSON in code fence', async () => {
    const json = '{"key": "value"}';
    const buffer = Buffer.from(json);
    const pieces = await handler.handle(buffer, 'data.json', 'json', defaultOptions);

    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.type === 'text' && pieces[0]!.content).toBe('```json\n{"key": "value"}\n```');
  });

  it('should wrap XML in code fence', async () => {
    const xml = '<root><item>hello</item></root>';
    const buffer = Buffer.from(xml);
    const pieces = await handler.handle(buffer, 'data.xml', 'xml', defaultOptions);

    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.type === 'text' && pieces[0]!.content).toBe(`\`\`\`xml\n${xml}\n\`\`\``);
  });

  it('should wrap YAML in code fence', async () => {
    const yaml = 'key: value\nlist:\n  - item1';
    const buffer = Buffer.from(yaml);
    const pieces = await handler.handle(buffer, 'config.yaml', 'yaml', defaultOptions);

    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.type === 'text' && pieces[0]!.content).toContain('```yaml');
  });

  it('should estimate tokens correctly', async () => {
    const text = 'a'.repeat(400); // 400 chars ≈ 100 tokens
    const buffer = Buffer.from(text);
    const pieces = await handler.handle(buffer, 'test.txt', 'txt', defaultOptions);

    expect(pieces[0]!.metadata.estimatedTokens).toBe(100);
  });
});

describe('ImageHandler', () => {
  const handler = new ImageHandler();

  it('should handle PNG image', async () => {
    const buffer = Buffer.from('fake-png-data');
    const pieces = await handler.handle(buffer, 'photo.png', 'png', defaultOptions);

    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.type).toBe('image');
    if (pieces[0]!.type === 'image') {
      expect(pieces[0]!.base64).toBe(buffer.toString('base64'));
      expect(pieces[0]!.mimeType).toBe('image/png');
    }
  });

  it('should handle JPG image', async () => {
    const buffer = Buffer.from('fake-jpg-data');
    const pieces = await handler.handle(buffer, 'photo.jpg', 'jpg', defaultOptions);

    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.type).toBe('image');
    if (pieces[0]!.type === 'image') {
      expect(pieces[0]!.mimeType).toBe('image/jpeg');
    }
  });

  it('should handle SVG with both image and text', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
    const buffer = Buffer.from(svgContent);
    const pieces = await handler.handle(buffer, 'logo.svg', 'svg', defaultOptions);

    expect(pieces).toHaveLength(2);
    expect(pieces[0]!.type).toBe('image');
    expect(pieces[1]!.type).toBe('text');
    if (pieces[1]!.type === 'text') {
      expect(pieces[1]!.content).toContain('```svg');
      expect(pieces[1]!.content).toContain('<svg');
    }
  });

  it('should set label to filename', async () => {
    const buffer = Buffer.from('fake');
    const pieces = await handler.handle(buffer, 'my-photo.png', 'png', defaultOptions);

    expect(pieces[0]!.metadata.label).toBe('my-photo.png');
  });
});

describe('HTMLHandler', () => {
  const handler = new HTMLHandler();

  it('should convert HTML to markdown', async () => {
    const html = '<html><head><title>Test</title></head><body><h1>Hello</h1><p>World</p></body></html>';
    const buffer = Buffer.from(html);
    const pieces = await handler.handle(buffer, 'page.html', 'html', defaultOptions);

    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.type).toBe('text');
    if (pieces[0]!.type === 'text') {
      expect(pieces[0]!.content).toContain('Hello');
      expect(pieces[0]!.content).toContain('World');
    }
  });

  it('should strip script and style tags', async () => {
    const html = '<html><body><script>alert("xss")</script><style>.hide{display:none}</style><p>Content</p></body></html>';
    const buffer = Buffer.from(html);
    const pieces = await handler.handle(buffer, 'page.html', 'html', defaultOptions);

    if (pieces[0]!.type === 'text') {
      expect(pieces[0]!.content).not.toContain('alert');
      expect(pieces[0]!.content).not.toContain('display:none');
      expect(pieces[0]!.content).toContain('Content');
    }
  });

  it('should respect maxLength option', async () => {
    const longContent = '<p>' + 'x'.repeat(200) + '</p>';
    const html = `<html><body>${longContent}</body></html>`;
    const buffer = Buffer.from(html);
    const pieces = await handler.handle(buffer, 'page.html', 'html', {
      formatOptions: { html: { maxLength: 100 } },
    });

    if (pieces[0]!.type === 'text') {
      expect(pieces[0]!.content.length).toBeLessThanOrEqual(150); // some overhead from truncation marker
    }
  });
});
