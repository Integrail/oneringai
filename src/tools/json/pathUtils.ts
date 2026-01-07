/**
 * Path utilities for dot notation path manipulation in JSON objects
 */

/**
 * Parse dot notation path into array of keys
 *
 * Examples:
 *   'user.name' → ['user', 'name']
 *   'users.0.name' → ['users', '0', 'name']
 *   'settings.theme.colors.primary' → ['settings', 'theme', 'colors', 'primary']
 *   '' → []
 */
export function parsePath(path: string): string[] {
  if (path === '' || path === '$') {
    return [];
  }

  const keys = path.split('.');

  // Filter out empty strings (from consecutive dots)
  const filtered = keys.filter((p) => p.length > 0);

  // Validate no consecutive dots
  if (filtered.length !== keys.length) {
    throw new Error(`Invalid path format: ${path} (consecutive dots not allowed)`);
  }

  return filtered;
}

/**
 * Get value at path in object
 *
 * Returns undefined if path doesn't exist
 */
export function getValueAtPath(obj: any, path: string): any {
  const keys = parsePath(path);
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle both object properties and array indices
    current = current[key];
  }

  return current;
}

/**
 * Set value at path in object (mutates the object)
 *
 * Creates intermediate objects/arrays as needed
 *
 * @returns true if successful
 * @throws Error if path is invalid or root-level
 */
export function setValueAtPath(obj: any, path: string, value: any): boolean {
  const keys = parsePath(path);

  if (keys.length === 0) {
    throw new Error('Cannot set root object - path must not be empty');
  }

  let current = obj;

  // Navigate to parent of target
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;

    // Create intermediate objects/arrays if they don't exist
    if (!(key in current) || current[key] === null || current[key] === undefined) {
      // Check if next key is numeric (array index)
      const nextKey = keys[i + 1];
      const isArrayIndex = nextKey !== undefined && /^\d+$/.test(nextKey);

      current[key] = isArrayIndex ? [] : {};
    }

    current = current[key];

    // Validate we can continue navigation
    if (current === null || current === undefined) {
      throw new Error(`Cannot navigate through null/undefined at path: ${keys.slice(0, i + 1).join('.')}`);
    }
  }

  // Set the final value
  const lastKey = keys[keys.length - 1]!;

  // For arrays, handle numeric indices
  if (Array.isArray(current)) {
    const index = parseInt(lastKey);
    if (isNaN(index)) {
      throw new Error(`Array index must be numeric, got: ${lastKey}`);
    }
    // Allow appending beyond array length
    current[index] = value;
  } else {
    current[lastKey] = value;
  }

  return true;
}

/**
 * Delete value at path in object (mutates the object)
 *
 * @returns true if deleted, false if path doesn't exist
 * @throws Error if path is invalid or root-level
 */
export function deleteAtPath(obj: any, path: string): boolean {
  const keys = parsePath(path);

  if (keys.length === 0) {
    throw new Error('Cannot delete root object - path must not be empty');
  }

  let current = obj;

  // Navigate to parent
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;

    if (!(key in current)) {
      return false; // Path doesn't exist
    }

    current = current[key];

    if (current === null || current === undefined) {
      return false; // Can't navigate further
    }
  }

  const lastKey = keys[keys.length - 1]!;

  // Check if key exists
  if (!(lastKey in current)) {
    return false;
  }

  // Delete from array or object
  if (Array.isArray(current)) {
    const index = parseInt(lastKey);
    if (isNaN(index) || index < 0 || index >= current.length) {
      return false;
    }
    current.splice(index, 1);
  } else {
    delete current[lastKey];
  }

  return true;
}

/**
 * Check if path exists in object
 */
export function pathExists(obj: any, path: string): boolean {
  try {
    const value = getValueAtPath(obj, path);
    return value !== undefined;
  } catch {
    return false;
  }
}

/**
 * Validate path format
 *
 * @returns true if valid, throws Error with message if invalid
 */
export function validatePath(path: string): boolean {
  // Empty path is valid (represents root)
  if (path === '' || path === '$') {
    return true;
  }

  // Check for invalid characters
  if (path.includes('..')) {
    throw new Error('Invalid path: consecutive dots not allowed');
  }

  if (path.startsWith('.') || path.endsWith('.')) {
    throw new Error('Invalid path: cannot start or end with dot');
  }

  // Try to parse it
  parsePath(path);

  return true;
}
