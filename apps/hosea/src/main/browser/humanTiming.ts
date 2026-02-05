/**
 * Human-Like Timing Utilities for Browser Automation Stealth Mode
 *
 * Provides functions for generating realistic human-like timing patterns
 * for typing, clicking, and mouse movements to avoid bot detection.
 */

// ============ Types ============

export interface Point {
  x: number;
  y: number;
}

export interface MouseMovementStep {
  point: Point;
  /** Delay in ms before moving to this point */
  delay: number;
}

// ============ Core Random Functions ============

/**
 * Generate a random number from a Gaussian (normal) distribution.
 * Uses the Box-Muller transform.
 *
 * @param mean - The mean of the distribution
 * @param stdDev - Standard deviation
 * @returns Random value from Gaussian distribution
 */
export function gaussianRandom(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Clamp a value to a range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a random value with Gaussian distribution, clamped to bounds
 */
export function gaussianRandomClamped(
  mean: number,
  stdDev: number,
  min: number,
  max: number
): number {
  return clamp(gaussianRandom(mean, stdDev), min, max);
}

// ============ Typing Functions ============

/**
 * Character categories for typing delay calculation
 */
type CharCategory = 'common' | 'shift' | 'number' | 'punctuation' | 'special' | 'space';

/**
 * Categorize a character for typing delay calculation
 */
function categorizeChar(char: string): CharCategory {
  if (char === ' ') return 'space';
  if (/[a-z]/.test(char)) return 'common';
  if (/[A-Z]/.test(char)) return 'shift'; // Requires shift key
  if (/[0-9]/.test(char)) return 'number';
  if (/[.,!?;:'"-]/.test(char)) return 'punctuation';
  return 'special'; // @#$%^&*()[] etc.
}

/**
 * Multiplier for character difficulty
 */
const CHAR_DIFFICULTY_MULTIPLIERS: Record<CharCategory, number> = {
  common: 1.0,
  space: 0.8, // Space bar is easy
  shift: 1.15, // Slightly slower for shift+key
  number: 1.1, // Number row is slightly slower
  punctuation: 1.2, // Punctuation requires more thinking
  special: 1.3, // Special chars are hardest
};

/**
 * Get typing delay for a character with human-like variance.
 *
 * @param char - Current character being typed
 * @param prevChar - Previous character (for context)
 * @param baseDelay - Base delay in ms (default: 50)
 * @returns Delay in ms before typing this character
 */
export function getTypingDelay(
  char: string,
  prevChar: string | null,
  baseDelay: number = 50
): number {
  const category = categorizeChar(char);
  const difficultyMultiplier = CHAR_DIFFICULTY_MULTIPLIERS[category];

  // Base timing with Gaussian variance
  // Mean: baseDelay * difficulty, StdDev: 20ms
  const baseTiming = gaussianRandomClamped(
    baseDelay * difficultyMultiplier,
    20,
    15, // Minimum 15ms (very fast)
    200 // Maximum 200ms per character
  );

  // Additional delay after capital letters (simulates releasing shift)
  let additionalDelay = 0;
  if (prevChar && /[A-Z]/.test(prevChar)) {
    additionalDelay += gaussianRandomClamped(10, 5, 0, 25);
  }

  // Slight pause after punctuation (natural rhythm)
  if (prevChar && /[.,!?;:]/.test(prevChar)) {
    additionalDelay += gaussianRandomClamped(30, 15, 10, 80);
  }

  return Math.round(baseTiming + additionalDelay);
}

/**
 * Get pause duration for word boundaries (space, after punctuation).
 * Simulates natural "thinking" pauses between words.
 *
 * @returns Delay in ms
 */
export function getWordBoundaryPause(): number {
  // Longer pauses between words
  // Mean: 150ms, StdDev: 50ms
  return Math.round(gaussianRandomClamped(150, 50, 80, 350));
}

/**
 * Determine if we should insert a random micro-pause.
 * Simulates brief distractions or hesitations during typing.
 *
 * @param probability - Probability of pause (default: 0.02 = 2%)
 * @returns true if we should pause
 */
export function shouldInsertMicroPause(probability: number = 0.02): boolean {
  return Math.random() < probability;
}

/**
 * Get the duration of a micro-pause.
 *
 * @returns Delay in ms (200-500ms range)
 */
export function getMicroPauseDuration(): number {
  return Math.round(gaussianRandomClamped(350, 100, 200, 600));
}

/**
 * Generate timing for typing a burst of characters quickly.
 * Humans often type common letter combinations faster.
 *
 * @param burstLength - Number of characters in the burst
 * @returns Array of delays in ms
 */
export function getTypingBurstDelays(burstLength: number): number[] {
  const delays: number[] = [];
  for (let i = 0; i < burstLength; i++) {
    // Burst typing is faster: 15-35ms
    delays.push(Math.round(gaussianRandomClamped(22, 8, 12, 40)));
  }
  return delays;
}

/**
 * Determine if we should type a burst (quick succession of keys).
 * Common letter patterns trigger bursts.
 *
 * @param probability - Probability of burst (default: 0.15 = 15%)
 * @returns true if we should burst
 */
export function shouldTypeBurst(probability: number = 0.15): boolean {
  return Math.random() < probability;
}

// ============ Mouse Movement Functions ============

/**
 * Calculate a point on a cubic Bezier curve.
 *
 * @param t - Parameter from 0 to 1
 * @param p0 - Start point
 * @param p1 - First control point
 * @param p2 - Second control point
 * @param p3 - End point
 */
function cubicBezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Generate random control points for a bezier curve.
 * Creates natural-looking curved movement paths.
 */
function generateControlPoints(
  start: Point,
  end: Point
): { cp1: Point; cp2: Point } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Control points are offset perpendicular to the line
  // with some randomness for natural curves
  const curvature = gaussianRandom(0, 0.3); // How much curve
  const perpX = -dy / distance;
  const perpY = dx / distance;

  // First control point: about 1/3 of the way
  const cp1 = {
    x: start.x + dx * 0.3 + perpX * distance * curvature * gaussianRandom(0.1, 0.1),
    y: start.y + dy * 0.3 + perpY * distance * curvature * gaussianRandom(0.1, 0.1),
  };

  // Second control point: about 2/3 of the way
  const cp2 = {
    x: start.x + dx * 0.7 + perpX * distance * curvature * gaussianRandom(-0.1, 0.1),
    y: start.y + dy * 0.7 + perpY * distance * curvature * gaussianRandom(-0.1, 0.1),
  };

  return { cp1, cp2 };
}

/**
 * Add noise/jitter to a point to simulate human imprecision.
 */
function addJitter(point: Point, amount: number = 2): Point {
  return {
    x: point.x + gaussianRandom(0, amount),
    y: point.y + gaussianRandom(0, amount),
  };
}

/**
 * Calculate movement speed for a step in the path.
 * Humans accelerate at start, decelerate near target.
 *
 * @param t - Progress through path (0 to 1)
 * @param baseSpeed - Base delay per step in ms
 * @returns Delay in ms for this step
 */
function getMovementDelay(t: number, baseSpeed: number): number {
  // Ease in-out: slower at start and end, faster in middle
  // Using a sinusoidal ease
  const speedMultiplier = 1 - 0.5 * Math.sin(Math.PI * t);

  // Add some random variance
  const variance = gaussianRandom(0, baseSpeed * 0.2);

  return Math.max(2, Math.round(baseSpeed * speedMultiplier + variance));
}

/**
 * Generate a bezier curve path for mouse movement.
 *
 * @param start - Starting position
 * @param end - Target position
 * @param steps - Number of intermediate points (default: calculated from distance)
 * @returns Array of points and delays forming the movement path
 */
export function generateBezierPath(
  start: Point,
  end: Point,
  steps?: number
): MouseMovementStep[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Calculate steps based on distance if not provided
  // Roughly 1 step per 15-30 pixels
  const calculatedSteps = steps ?? Math.max(10, Math.min(50, Math.round(distance / 20)));

  // Generate control points for natural curve
  const { cp1, cp2 } = generateControlPoints(start, end);

  // Base speed: longer distances = slightly faster per-step
  const baseSpeed = clamp(10 - distance / 200, 5, 15);

  const path: MouseMovementStep[] = [];

  // Starting point (no delay for first point)
  path.push({ point: { ...start }, delay: 0 });

  // Generate intermediate points
  for (let i = 1; i <= calculatedSteps; i++) {
    const t = i / calculatedSteps;
    let point = cubicBezier(t, start, cp1, cp2, end);

    // Add jitter to intermediate points (less near the end for accuracy)
    const jitterAmount = 3 * (1 - t * t); // Decreases as we approach target
    if (i < calculatedSteps) {
      point = addJitter(point, jitterAmount);
    }

    // Round to integers
    point.x = Math.round(point.x);
    point.y = Math.round(point.y);

    path.push({
      point,
      delay: getMovementDelay(t, baseSpeed),
    });
  }

  return path;
}

/**
 * Generate overshoot movement - go slightly past target, then correct.
 * This mimics common human behavior.
 *
 * @param end - Target position
 * @param probability - Chance of overshoot (default: 0.1 = 10%)
 * @returns Overshoot point or null
 */
export function generateOvershoot(
  end: Point,
  probability: number = 0.1
): Point | null {
  if (Math.random() > probability) return null;

  // Overshoot by 5-20 pixels in a random direction (biased toward movement direction)
  const overshootAmount = gaussianRandomClamped(12, 5, 5, 25);
  const angle = gaussianRandom(0, Math.PI / 4); // Mostly forward

  return {
    x: Math.round(end.x + Math.cos(angle) * overshootAmount),
    y: Math.round(end.y + Math.sin(angle) * overshootAmount),
  };
}

// ============ Click Functions ============

/**
 * Get a random offset from center for clicking.
 * Humans rarely click the exact center of an element.
 *
 * @param elementWidth - Width of the element
 * @param elementHeight - Height of the element
 * @returns Offset from center in pixels
 */
export function getClickOffset(elementWidth: number, elementHeight: number): Point {
  // Click within central 60% of element (Gaussian distribution)
  // Mean: 0 (center), StdDev: 1/6 of dimension (95% within central 66%)
  const xOffset = gaussianRandomClamped(0, elementWidth / 6, -elementWidth * 0.3, elementWidth * 0.3);
  const yOffset = gaussianRandomClamped(0, elementHeight / 6, -elementHeight * 0.3, elementHeight * 0.3);

  return {
    x: Math.round(xOffset),
    y: Math.round(yOffset),
  };
}

/**
 * Get hover time before clicking.
 * Brief pause after mouse reaches element before clicking.
 *
 * @returns Delay in ms
 */
export function getHoverDelay(): number {
  return Math.round(gaussianRandomClamped(80, 30, 30, 200));
}

/**
 * Get delay before mouse starts moving.
 * Simulates reaction/decision time.
 *
 * @returns Delay in ms
 */
export function getReactionDelay(): number {
  return Math.round(gaussianRandomClamped(120, 50, 50, 300));
}

// ============ Scroll Functions ============

/**
 * Get scroll amount with human-like variance.
 *
 * @param baseAmount - Base scroll amount in pixels
 * @returns Scroll amount with +/- 5-15% variance
 */
export function getScrollAmount(baseAmount: number): number {
  // Add variance: +/- 5-15% using Gaussian distribution
  const variance = gaussianRandom(1.0, 0.08); // Mean 1, StdDev 0.08 (most within +/-15%)
  const clampedVariance = clamp(variance, 0.85, 1.15);
  return Math.round(baseAmount * clampedVariance);
}

/**
 * Get delay between scroll wheel events.
 *
 * @returns Delay in ms
 */
export function getScrollWheelDelay(): number {
  return Math.round(gaussianRandomClamped(50, 20, 20, 120));
}

/**
 * Break a large scroll into multiple smaller wheel-like increments.
 *
 * @param totalAmount - Total scroll distance
 * @param maxIncrement - Max per-wheel event (default: 100)
 * @returns Array of scroll amounts
 */
export function getScrollIncrements(
  totalAmount: number,
  maxIncrement: number = 100
): number[] {
  const increments: number[] = [];
  let remaining = Math.abs(totalAmount);
  const sign = totalAmount >= 0 ? 1 : -1;

  while (remaining > 0) {
    // Each wheel event scrolls roughly 40-120 pixels
    const increment = Math.min(remaining, Math.round(gaussianRandomClamped(80, 25, 40, maxIncrement)));
    increments.push(sign * increment);
    remaining -= increment;
  }

  return increments;
}

// ============ General Timing ============

/**
 * Get a general human-like delay for various operations.
 *
 * @param min - Minimum delay
 * @param max - Maximum delay
 * @returns Delay in ms
 */
export function getHumanDelay(min: number, max: number): number {
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 4; // 95% within range
  return Math.round(gaussianRandomClamped(mean, stdDev, min, max));
}
