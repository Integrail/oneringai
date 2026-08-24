import type { JsonObject, JsonValue, RuntimeAgentSpec } from './types.js';
import { AgentDriverConfigurationError } from './errors.js';

export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

export function toJsonValue(value: unknown): JsonValue {
  if (isJsonValue(value)) return value;
  try {
    const serialized = JSON.parse(JSON.stringify(value)) as unknown;
    return isJsonValue(serialized) ? serialized : String(value);
  } catch {
    return String(value);
  }
}

export function toJsonObject(value: unknown): JsonObject {
  const converted = toJsonValue(value);
  return typeof converted === 'object' && converted !== null && !Array.isArray(converted)
    ? converted
    : { value: converted };
}

export function cloneAndFreezeSpec(spec: RuntimeAgentSpec): Readonly<RuntimeAgentSpec> {
  if (!spec || typeof spec !== 'object') {
    throw new AgentDriverConfigurationError('Runtime agent spec must be an object');
  }
  if (typeof spec.id !== 'string' || !spec.id.trim()) {
    throw new AgentDriverConfigurationError('Runtime agent spec id is required');
  }
  if (typeof spec.driver !== 'string' || !spec.driver.trim()) {
    throw new AgentDriverConfigurationError('Runtime agent driver id is required');
  }
  for (const field of ['name', 'connector', 'model', 'instructions'] as const) {
    if (spec[field] !== undefined && typeof spec[field] !== 'string') {
      throw new AgentDriverConfigurationError(`Runtime agent ${field} must be a string`);
    }
  }
  if (spec.model !== undefined && !spec.model.trim()) {
    throw new AgentDriverConfigurationError('Runtime agent model must be non-empty');
  }
  if (spec.reasoning !== undefined) {
    if (!spec.reasoning || typeof spec.reasoning !== 'object' || Array.isArray(spec.reasoning)) {
      throw new AgentDriverConfigurationError('Runtime agent reasoning must be an object');
    }
    if (spec.reasoning.enabled !== undefined && typeof spec.reasoning.enabled !== 'boolean') {
      throw new AgentDriverConfigurationError('Runtime agent reasoning.enabled must be a boolean');
    }
    if (spec.reasoning.budgetTokens !== undefined && (
      !Number.isSafeInteger(spec.reasoning.budgetTokens) || spec.reasoning.budgetTokens <= 0
    )) {
      throw new AgentDriverConfigurationError('Runtime agent reasoning.budgetTokens must be a positive safe integer');
    }
    validateReasoningEffort(spec.reasoning.effort, 'Runtime agent reasoning.effort');
  }
  validateCapabilityRequirements(spec.requiredCapabilities, 'Runtime agent requiredCapabilities');
  if (!isJsonValue(spec as unknown)) {
    throw new AgentDriverConfigurationError('Runtime agent spec must contain only JSON-serializable values');
  }

  return cloneAndFreezeJson(spec, 'Runtime agent spec');
}

export function cloneAndFreezeJson<T>(value: T, label: string): Readonly<T> {
  if (!isJsonSerializableInput(value as unknown)) {
    throw new AgentDriverConfigurationError(`${label} must contain only JSON-serializable values`);
  }
  const clone = JSON.parse(JSON.stringify(value)) as T;
  return deepFreeze(clone);
}

function isJsonSerializableInput(value: unknown, inArray = false): boolean {
  if (value === undefined) return !inArray;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonSerializableInput(item, true));
  if (typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every((item) => isJsonSerializableInput(item));
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function mergeRequirements(
  spec: Readonly<RuntimeAgentSpec>,
  requested: readonly { id: string; minimum?: 'native' | 'emulated' }[] | undefined,
): Array<{ id: string; minimum?: 'native' | 'emulated' }> {
  validateCapabilityRequirements(requested, 'Agent capability requirements');
  const merged = new Map<string, { id: string; minimum?: 'native' | 'emulated' }>();
  for (const requirement of [...(spec.requiredCapabilities ?? []), ...(requested ?? [])]) {
    const current = merged.get(requirement.id);
    const minimum = current?.minimum === 'native' || requirement.minimum === 'native'
      ? 'native'
      : current?.minimum ?? requirement.minimum;
    merged.set(requirement.id, minimum ? { id: requirement.id, minimum } : { id: requirement.id });
  }
  return [...merged.values()];
}

function validateCapabilityRequirements(
  requirements: readonly { id: string; minimum?: 'native' | 'emulated' }[] | undefined,
  label: string,
): void {
  if (requirements === undefined) return;
  if (!Array.isArray(requirements)) {
    throw new AgentDriverConfigurationError(`${label} must be an array`);
  }
  for (const requirement of requirements) {
    if (!requirement || typeof requirement !== 'object' || typeof requirement.id !== 'string' || !requirement.id.trim()) {
      throw new AgentDriverConfigurationError(`${label} entries require a non-empty id`);
    }
    if (requirement.minimum !== undefined && requirement.minimum !== 'native' && requirement.minimum !== 'emulated') {
      throw new AgentDriverConfigurationError(`${label} minimum must be 'native' or 'emulated'`);
    }
  }
}

function validateReasoningEffort(effort: unknown, label: string): void {
  if (effort === undefined) return;
  const efforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
  if (typeof effort !== 'string' || !efforts.has(effort)) {
    throw new AgentDriverConfigurationError(`${label} is invalid`);
  }
}
