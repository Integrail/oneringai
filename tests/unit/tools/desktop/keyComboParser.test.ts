/**
 * Tests for key combo parser
 */

import { describe, it, expect } from 'vitest';
import { parseKeyCombo } from '../../../../src/tools/desktop/driver/NutTreeDriver.js';

// Mock Key enum similar to nut-tree's
const MockKey = {
  LeftControl: 100,
  LeftCmd: 101,
  LeftAlt: 102,
  LeftShift: 103,
  Return: 200,
  Tab: 201,
  Escape: 202,
  Backspace: 203,
  Delete: 204,
  Space: 205,
  Up: 300,
  Down: 301,
  Left: 302,
  Right: 303,
  F1: 400,
  F2: 401,
  F12: 411,
  Home: 500,
  End: 501,
  PageUp: 502,
  PageDown: 503,
  A: 600,
  B: 601,
  C: 602,
  S: 603,
  V: 604,
  Z: 605,
  CapsLock: 700,
  NumLock: 701,
};

describe('parseKeyCombo', () => {
  it('should parse single key', () => {
    expect(parseKeyCombo('enter', MockKey)).toEqual([MockKey.Return]);
    expect(parseKeyCombo('tab', MockKey)).toEqual([MockKey.Tab]);
    expect(parseKeyCombo('escape', MockKey)).toEqual([MockKey.Escape]);
    expect(parseKeyCombo('space', MockKey)).toEqual([MockKey.Space]);
  });

  it('should parse modifier + key combos', () => {
    expect(parseKeyCombo('ctrl+c', MockKey)).toEqual([MockKey.LeftControl, MockKey.C]);
    expect(parseKeyCombo('cmd+s', MockKey)).toEqual([MockKey.LeftCmd, MockKey.S]);
    expect(parseKeyCombo('alt+tab', MockKey)).toEqual([MockKey.LeftAlt, MockKey.Tab]);
  });

  it('should parse multi-modifier combos', () => {
    expect(parseKeyCombo('ctrl+shift+s', MockKey)).toEqual([
      MockKey.LeftControl,
      MockKey.LeftShift,
      MockKey.S,
    ]);
    expect(parseKeyCombo('cmd+shift+z', MockKey)).toEqual([
      MockKey.LeftCmd,
      MockKey.LeftShift,
      MockKey.Z,
    ]);
  });

  it('should handle case insensitivity', () => {
    expect(parseKeyCombo('CTRL+C', MockKey)).toEqual([MockKey.LeftControl, MockKey.C]);
    expect(parseKeyCombo('Ctrl+C', MockKey)).toEqual([MockKey.LeftControl, MockKey.C]);
    expect(parseKeyCombo('ENTER', MockKey)).toEqual([MockKey.Return]);
  });

  it('should handle modifier aliases', () => {
    expect(parseKeyCombo('control+c', MockKey)).toEqual([MockKey.LeftControl, MockKey.C]);
    expect(parseKeyCombo('command+s', MockKey)).toEqual([MockKey.LeftCmd, MockKey.S]);
    expect(parseKeyCombo('meta+s', MockKey)).toEqual([MockKey.LeftCmd, MockKey.S]);
    expect(parseKeyCombo('super+s', MockKey)).toEqual([MockKey.LeftCmd, MockKey.S]);
    expect(parseKeyCombo('option+tab', MockKey)).toEqual([MockKey.LeftAlt, MockKey.Tab]);
  });

  it('should handle key aliases', () => {
    expect(parseKeyCombo('return', MockKey)).toEqual([MockKey.Return]);
    expect(parseKeyCombo('esc', MockKey)).toEqual([MockKey.Escape]);
  });

  it('should parse arrow keys', () => {
    expect(parseKeyCombo('up', MockKey)).toEqual([MockKey.Up]);
    expect(parseKeyCombo('down', MockKey)).toEqual([MockKey.Down]);
    expect(parseKeyCombo('left', MockKey)).toEqual([MockKey.Left]);
    expect(parseKeyCombo('right', MockKey)).toEqual([MockKey.Right]);
  });

  it('should parse function keys', () => {
    expect(parseKeyCombo('f1', MockKey)).toEqual([MockKey.F1]);
    expect(parseKeyCombo('f12', MockKey)).toEqual([MockKey.F12]);
  });

  it('should handle spaces in combo string', () => {
    expect(parseKeyCombo('ctrl + c', MockKey)).toEqual([MockKey.LeftControl, MockKey.C]);
    expect(parseKeyCombo(' enter ', MockKey)).toEqual([MockKey.Return]);
  });

  it('should throw on unknown key', () => {
    expect(() => parseKeyCombo('unknownkey', MockKey)).toThrow('Unknown key: "unknownkey"');
  });

  it('should parse single letter keys', () => {
    expect(parseKeyCombo('a', MockKey)).toEqual([MockKey.A]);
    expect(parseKeyCombo('v', MockKey)).toEqual([MockKey.V]);
  });

  it('should parse navigation keys', () => {
    expect(parseKeyCombo('home', MockKey)).toEqual([MockKey.Home]);
    expect(parseKeyCombo('end', MockKey)).toEqual([MockKey.End]);
    expect(parseKeyCombo('pageup', MockKey)).toEqual([MockKey.PageUp]);
    expect(parseKeyCombo('pagedown', MockKey)).toEqual([MockKey.PageDown]);
  });

  it('should parse backspace and delete', () => {
    expect(parseKeyCombo('backspace', MockKey)).toEqual([MockKey.Backspace]);
    expect(parseKeyCombo('delete', MockKey)).toEqual([MockKey.Delete]);
  });
});
