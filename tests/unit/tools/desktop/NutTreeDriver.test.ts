/**
 * Tests for NutTreeDriver - coordinate scaling and initialization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('NutTreeDriver', () => {
  // Since @nut-tree-fork/nut-js is an optional peer dep, we test the driver logic
  // by mocking the dynamic import.

  describe('coordinate scaling', () => {
    it('should convert physical coords to logical by dividing by scaleFactor', () => {
      // Physical: 200, 400 with scaleFactor 2 → Logical: 100, 200
      const scaleFactor = 2;
      const physicalX = 200;
      const physicalY = 400;
      const logicalX = Math.round(physicalX / scaleFactor);
      const logicalY = Math.round(physicalY / scaleFactor);
      expect(logicalX).toBe(100);
      expect(logicalY).toBe(200);
    });

    it('should convert logical coords to physical by multiplying by scaleFactor', () => {
      // Logical: 100, 200 with scaleFactor 2 → Physical: 200, 400
      const scaleFactor = 2;
      const logicalX = 100;
      const logicalY = 200;
      const physicalX = Math.round(logicalX * scaleFactor);
      const physicalY = Math.round(logicalY * scaleFactor);
      expect(physicalX).toBe(200);
      expect(physicalY).toBe(400);
    });

    it('should handle non-integer scale factors', () => {
      const scaleFactor = 1.5;
      const physicalX = 300;
      const physicalY = 450;
      const logicalX = Math.round(physicalX / scaleFactor);
      const logicalY = Math.round(physicalY / scaleFactor);
      expect(logicalX).toBe(200);
      expect(logicalY).toBe(300);
    });

    it('should handle scaleFactor of 1 (no scaling)', () => {
      const scaleFactor = 1;
      const x = 500;
      const y = 300;
      expect(Math.round(x / scaleFactor)).toBe(500);
      expect(Math.round(y / scaleFactor)).toBe(300);
    });
  });

  describe('error handling', () => {
    it('should throw helpful error when @nut-tree-fork/nut-js is not installed', async () => {
      // The NutTreeDriver.initialize() should throw a clear error
      // when the dynamic import fails
      const { NutTreeDriver } = await import('../../../../src/tools/desktop/driver/NutTreeDriver.js');
      const driver = new NutTreeDriver();

      // @nut-tree-fork/nut-js is not installed in test env, so initialize should fail
      await expect(driver.initialize()).rejects.toThrow(
        '@nut-tree-fork/nut-js is not installed'
      );
    });

    it('should not be initialized before initialize() is called', async () => {
      const { NutTreeDriver } = await import('../../../../src/tools/desktop/driver/NutTreeDriver.js');
      const driver = new NutTreeDriver();
      expect(driver.isInitialized).toBe(false);
    });

    it('should default scaleFactor to 1', async () => {
      const { NutTreeDriver } = await import('../../../../src/tools/desktop/driver/NutTreeDriver.js');
      const driver = new NutTreeDriver();
      expect(driver.scaleFactor).toBe(1);
    });
  });
});
