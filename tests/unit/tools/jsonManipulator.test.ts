/**
 * JSON Manipulator Tool Tests
 * Tests dot-notation path manipulation of JSON objects
 */

import { describe, it, expect } from 'vitest';
import { jsonManipulator } from '@/tools/json/jsonManipulator.js';

describe('JSON Manipulator Tool', () => {
  describe('DELETE operation', () => {
    it('should delete top-level field', async () => {
      const result = await jsonManipulator.execute({
        operation: 'delete',
        object: { name: 'John', age: 30, city: 'NYC' },
        path: 'age'
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ name: 'John', city: 'NYC' });
    });

    it('should delete nested field with dot notation', async () => {
      const result = await jsonManipulator.execute({
        operation: 'delete',
        object: {
          user: {
            name: 'John',
            address: {
              city: 'NYC',
              zip: '10001'
            }
          }
        },
        path: 'user.address.zip'
      });

      expect(result.result).toEqual({
        user: {
          name: 'John',
          address: {
            city: 'NYC'
          }
        }
      });
    });

    it('should delete array element by index', async () => {
      const result = await jsonManipulator.execute({
        operation: 'delete',
        object: {
          users: [
            { name: 'Alice' },
            { name: 'Bob' },
            { name: 'Charlie' }
          ]
        },
        path: 'users.1'
      });

      expect(result.success).toBe(true);
      expect(result.result.users).toEqual([
        { name: 'Alice' },
        { name: 'Charlie' }
      ]);
    });

    it('should return error if path does not exist', async () => {
      const result = await jsonManipulator.execute({
        operation: 'delete',
        object: { name: 'John' },
        path: 'nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('ADD operation', () => {
    it('should add field to root', async () => {
      const result = await jsonManipulator.execute({
        operation: 'add',
        object: { name: 'John' },
        path: 'age',
        value: 30
      });

      expect(result.result).toEqual({ name: 'John', age: 30 });
    });

    it('should create nested path if not exists', async () => {
      const result = await jsonManipulator.execute({
        operation: 'add',
        object: {},
        path: 'user.address.city',
        value: 'NYC'
      });

      expect(result.result).toEqual({
        user: {
          address: {
            city: 'NYC'
          }
        }
      });
    });

    it('should add to array', async () => {
      const result = await jsonManipulator.execute({
        operation: 'add',
        object: { items: [1, 2, 3] },
        path: 'items.3',
        value: 4
      });

      expect(result.success).toBe(true);
      expect(result.result.items).toEqual([1, 2, 3, 4]);
    });

    it('should overwrite existing field if already exists', async () => {
      const result = await jsonManipulator.execute({
        operation: 'add',
        object: { name: 'John', age: 25 },
        path: 'age',
        value: 30
      });

      expect(result.success).toBe(true);
      expect(result.result.age).toBe(30);
    });
  });

  describe('REPLACE operation', () => {
    it('should replace top-level value', async () => {
      const result = await jsonManipulator.execute({
        operation: 'replace',
        object: { name: 'John', age: 25 },
        path: 'age',
        value: 30
      });

      expect(result.success).toBe(true);
      expect(result.result.age).toBe(30);
    });

    it('should replace nested value', async () => {
      const result = await jsonManipulator.execute({
        operation: 'replace',
        object: {
          user: {
            name: 'John',
            settings: {
              theme: 'light'
            }
          }
        },
        path: 'user.settings.theme',
        value: 'dark'
      });

      expect(result.success).toBe(true);
      expect(result.result.user.settings.theme).toBe('dark');
    });

    it('should return error if path does not exist', async () => {
      const result = await jsonManipulator.execute({
        operation: 'replace',
        object: { name: 'John' },
        path: 'age',
        value: 30
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', async () => {
      const result = await jsonManipulator.execute({
        operation: 'add',
        object: {},
        path: 'newField',
        value: 'value'
      });

      expect(result.result).toEqual({ newField: 'value' });
    });

    it('should handle deeply nested paths', async () => {
      const result = await jsonManipulator.execute({
        operation: 'add',
        object: {},
        path: 'a.b.c.d.e.f',
        value: 'deep'
      });

      expect(result.success).toBe(true);
      expect(result.result.a.b.c.d.e.f).toBe('deep');
    });

    it('should handle special characters in values', async () => {
      const result = await jsonManipulator.execute({
        operation: 'add',
        object: {},
        path: 'message',
        value: 'Hello "world" with \'quotes\' and\nnewlines'
      });

      expect(result.success).toBe(true);
      expect(result.result.message).toBe('Hello "world" with \'quotes\' and\nnewlines');
    });
  });
});
