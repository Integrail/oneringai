/**
 * Metrics Tests
 *
 * Tests for metrics collection infrastructure.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NoOpMetrics,
  ConsoleMetrics,
  InMemoryMetrics,
  createMetricsCollector,
} from '../../../src/infrastructure/observability/Metrics.js';

describe('Metrics', () => {
  describe('NoOpMetrics', () => {
    it('should do nothing (zero overhead)', () => {
      const metrics = new NoOpMetrics();

      // Should not throw
      expect(() => {
        metrics.increment('test.counter', 1);
        metrics.gauge('test.gauge', 42);
        metrics.timing('test.timing', 1234);
        metrics.histogram('test.histogram', 100);
      }).not.toThrow();
    });
  });

  describe('ConsoleMetrics', () => {
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log counter increments', () => {
      const metrics = new ConsoleMetrics('myapp');

      metrics.increment('requests.total', 1, { status: 'success' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('COUNTER');
      expect(output).toContain('myapp.requests.total');
      expect(output).toContain('"status":"success"');
    });

    it('should log gauge values', () => {
      const metrics = new ConsoleMetrics('myapp');

      metrics.gauge('memory.usage', 75.5, { unit: 'percent' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('GAUGE');
      expect(output).toContain('myapp.memory.usage');
      expect(output).toContain('75.5');
    });

    it('should log timings', () => {
      const metrics = new ConsoleMetrics('myapp');

      metrics.timing('api.latency', 1234, { endpoint: '/users' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('TIMING');
      expect(output).toContain('1234ms');
    });

    it('should log histograms', () => {
      const metrics = new ConsoleMetrics('myapp');

      metrics.histogram('response.size', 5000, { unit: 'bytes' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('HISTOGRAM');
      expect(output).toContain('5000');
    });
  });

  describe('InMemoryMetrics', () => {
    it('should track counter increments', () => {
      const metrics = new InMemoryMetrics();

      metrics.increment('requests.total', 1);
      metrics.increment('requests.total', 2);
      metrics.increment('requests.total', 3);

      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters.get('requests.total')).toBe(6); // 1+2+3
    });

    it('should track gauge values (latest only)', () => {
      const metrics = new InMemoryMetrics();

      metrics.gauge('memory.usage', 50);
      metrics.gauge('memory.usage', 75);
      metrics.gauge('memory.usage', 60);

      const allMetrics = metrics.getMetrics();
      expect(allMetrics.gauges.get('memory.usage')).toBe(60); // Latest value
    });

    it('should track timing history', () => {
      const metrics = new InMemoryMetrics();

      metrics.timing('api.latency', 100);
      metrics.timing('api.latency', 200);
      metrics.timing('api.latency', 150);

      const allMetrics = metrics.getMetrics();
      expect(allMetrics.timings.get('api.latency')).toEqual([100, 200, 150]);
    });

    it('should track histogram history', () => {
      const metrics = new InMemoryMetrics();

      metrics.histogram('response.size', 1000);
      metrics.histogram('response.size', 2000);
      metrics.histogram('response.size', 1500);

      const allMetrics = metrics.getMetrics();
      expect(allMetrics.histograms.get('response.size')).toEqual([1000, 2000, 1500]);
    });

    it('should support tags in metric keys', () => {
      const metrics = new InMemoryMetrics();

      metrics.increment('requests', 1, { status: 'success' });
      metrics.increment('requests', 1, { status: 'error' });
      metrics.increment('requests', 1, { status: 'success' });

      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters.get('requests{status:success}')).toBe(2);
      expect(allMetrics.counters.get('requests{status:error}')).toBe(1);
    });

    it('should calculate timing statistics', () => {
      const metrics = new InMemoryMetrics();

      // Add 100 timings
      for (let i = 1; i <= 100; i++) {
        metrics.timing('test.duration', i);
      }

      const stats = metrics.getTimingStats('test.duration');

      expect(stats).toBeDefined();
      expect(stats!.count).toBe(100);
      expect(stats!.min).toBe(1);
      expect(stats!.max).toBe(100);
      expect(stats!.mean).toBe(50.5);
      expect(stats!.p50).toBeGreaterThanOrEqual(45);
      expect(stats!.p50).toBeLessThanOrEqual(55);
      expect(stats!.p95).toBeGreaterThanOrEqual(90);
      expect(stats!.p99).toBeGreaterThanOrEqual(95);
    });

    it('should return null for non-existent metric stats', () => {
      const metrics = new InMemoryMetrics();

      const stats = metrics.getTimingStats('nonexistent');

      expect(stats).toBeNull();
    });

    it('should clear all metrics', () => {
      const metrics = new InMemoryMetrics();

      metrics.increment('counter', 10);
      metrics.gauge('gauge', 42);
      metrics.timing('timing', 100);

      metrics.clear();

      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters.size).toBe(0);
      expect(allMetrics.gauges.size).toBe(0);
      expect(allMetrics.timings.size).toBe(0);
    });
  });

  describe('createMetricsCollector', () => {
    it('should create NoOp collector by default', () => {
      const collector = createMetricsCollector();

      expect(collector).toBeInstanceOf(NoOpMetrics);
    });

    it('should create Console collector when specified', () => {
      const collector = createMetricsCollector('console', 'test-prefix');

      expect(collector).toBeInstanceOf(ConsoleMetrics);
    });

    it('should create InMemory collector when specified', () => {
      const collector = createMetricsCollector('inmemory');

      expect(collector).toBeInstanceOf(InMemoryMetrics);
    });
  });

  describe('Tag Handling', () => {
    it('should handle tags with different value types', () => {
      const metrics = new InMemoryMetrics();

      metrics.increment('test', 1, {
        string: 'value',
        number: 42,
        boolean: true,
      });

      const allMetrics = metrics.getMetrics();
      const key = Array.from(allMetrics.counters.keys())[0];

      expect(key).toContain('string:value');
      expect(key).toContain('number:42');
      expect(key).toContain('boolean:true');
    });

    it('should sort tags consistently', () => {
      const metrics = new InMemoryMetrics();

      // Same tags, different order
      metrics.increment('test', 1, { b: '2', a: '1', c: '3' });
      metrics.increment('test', 1, { c: '3', a: '1', b: '2' });

      const allMetrics = metrics.getMetrics();

      // Should have single entry (tags sorted consistently)
      expect(allMetrics.counters.size).toBe(1);
      expect(allMetrics.counters.get('test{a:1,b:2,c:3}')).toBe(2);
    });
  });
});
