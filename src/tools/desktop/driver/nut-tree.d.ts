/**
 * Type declarations for @nut-tree-fork/nut-js (optional peer dependency).
 * This prevents TypeScript errors when the package is not installed.
 */
declare module '@nut-tree-fork/nut-js' {
  export const screen: {
    width(): Promise<number>;
    height(): Promise<number>;
    grab(): Promise<{ data: Buffer; width: number; height: number }>;
    grabRegion(region: any): Promise<{ data: Buffer; width: number; height: number }>;
  };

  export const mouse: {
    move(target: any): Promise<void>;
    setPosition(point: Point): Promise<void>;
    click(button: any): Promise<void>;
    pressButton(button: any): Promise<void>;
    releaseButton(button: any): Promise<void>;
    scrollDown(amount: number): Promise<void>;
    scrollUp(amount: number): Promise<void>;
    scrollRight(amount: number): Promise<void>;
    scrollLeft(amount: number): Promise<void>;
    getPosition(): Promise<{ x: number; y: number }>;
    config: { mouseSpeed: number; autoDelayMs: number };
  };

  export const keyboard: {
    type(text: string): Promise<void>;
    pressKey(key: any): Promise<void>;
    releaseKey(key: any): Promise<void>;
    config: { autoDelayMs: number };
  };

  export function straightTo(target: any): any;
  export function getWindows(): Promise<any[]>;

  export class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  export class Region {
    constructor(left: number, top: number, width: number, height: number);
  }

  export const Key: Record<string, number>;
  export const Button: {
    LEFT: number;
    RIGHT: number;
    MIDDLE: number;
  };
}
