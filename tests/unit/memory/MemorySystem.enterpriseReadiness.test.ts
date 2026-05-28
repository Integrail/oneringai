/**
 * MemorySystem.assertEnterpriseReady() — readiness healthcheck regression.
 *
 * The check surfaces two readiness tiers:
 *   - `ok === true` (no `severity: 'error'`)        → minimum-safety
 *   - `ok && findings.every(f => f.severity !== 'warn')` → full enterprise
 *
 * Coverage:
 *   - Bare defaults: world-read + permissive predicates → errors AND warnings
 *   - With visibility policy + registry: still permissive → ok, but warns
 *   - Strict + policy + registry: clean (ok, zero findings)
 *   - Error codes are stable identifiers, not free-form prose
 *   - Hosts that gate on the stricter tier reject permissive mode correctly
 */

import { describe, it, expect } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { PredicateRegistry } from '@/memory/predicates/PredicateRegistry.js';

const PRIVATE_POLICY = () => ({ world: 'none' as const });

describe('MemorySystem.assertEnterpriseReady — readiness tiers', () => {
  it('flags bare defaults with errors AND warnings', () => {
    const mem = new MemorySystem({ store: new InMemoryAdapter() });
    const { ok, findings } = mem.assertEnterpriseReady();
    // Errors fail the minimum-safety tier.
    expect(ok).toBe(false);
    const codes = findings.map((f) => f.code);
    expect(codes).toContain('no-predicate-registry');
    expect(codes).toContain('no-visibility-policy');
    // Permissive mode is a warning, not an error — surfaces in the same call.
    expect(codes).toContain('predicate-mode-permissive');
  });

  it('reaches minimum-safety tier (ok=true) with policy + registry, even without strict mode', () => {
    const mem = new MemorySystem({
      store: new InMemoryAdapter(),
      visibilityPolicy: PRIVATE_POLICY,
      predicates: PredicateRegistry.standard(),
      // predicateMode defaults to 'permissive'
    });
    const { ok, findings } = mem.assertEnterpriseReady();
    expect(ok).toBe(true);
    // BUT the permissive-mode warning is still present — full enterprise
    // readiness requires removing this too.
    expect(findings.some((f) => f.code === 'predicate-mode-permissive')).toBe(true);
    expect(findings.every((f) => f.severity !== 'error')).toBe(true);
  });

  it('full enterprise readiness: strict + policy + registry → ok AND zero warnings', () => {
    const mem = new MemorySystem({
      store: new InMemoryAdapter(),
      visibilityPolicy: PRIVATE_POLICY,
      predicates: PredicateRegistry.standard(),
      predicateMode: 'strict',
    });
    const { ok, findings } = mem.assertEnterpriseReady();
    expect(ok).toBe(true);
    // The stricter gate hosts compose themselves.
    const enterpriseReady = ok && findings.every((f) => f.severity !== 'warn');
    expect(enterpriseReady).toBe(true);
    // InMemory adapter has no Mongo-specific findings.
    expect(findings).toEqual([]);
  });

  it('finding codes are stable identifiers (not free-form prose) so hosts can match them', () => {
    const mem = new MemorySystem({ store: new InMemoryAdapter() });
    const { findings } = mem.assertEnterpriseReady();
    for (const f of findings) {
      // Code: lowercase + dashes (no spaces / Caps).
      expect(f.code).toMatch(/^[a-z][a-z0-9-]*$/);
      // Message: must be non-empty so operators have something to print.
      expect(f.message.length).toBeGreaterThan(0);
      // Severity: strict union.
      expect(['error', 'warn']).toContain(f.severity);
    }
  });

  it("permissive predicate mode is a warning, NOT an error (intentional — vocabulary hygiene, not data integrity)", () => {
    const mem = new MemorySystem({
      store: new InMemoryAdapter(),
      visibilityPolicy: PRIVATE_POLICY,
      predicates: PredicateRegistry.standard(),
      // predicateMode left default ('permissive')
    });
    const { findings } = mem.assertEnterpriseReady();
    const permissive = findings.find((f) => f.code === 'predicate-mode-permissive');
    expect(permissive).toBeDefined();
    expect(permissive!.severity).toBe('warn');
  });

  it('flags missing PredicateRegistry as an error (LLM-writer fragmentation risk)', () => {
    const mem = new MemorySystem({
      store: new InMemoryAdapter(),
      visibilityPolicy: PRIVATE_POLICY,
      // no predicates
    });
    const { findings } = mem.assertEnterpriseReady();
    const noRegistry = findings.find((f) => f.code === 'no-predicate-registry');
    expect(noRegistry).toBeDefined();
    expect(noRegistry!.severity).toBe('error');
  });

  it('flags missing visibilityPolicy as an error (cross-tenant leak risk)', () => {
    const mem = new MemorySystem({
      store: new InMemoryAdapter(),
      predicates: PredicateRegistry.standard(),
      // no visibilityPolicy
    });
    const { findings } = mem.assertEnterpriseReady();
    const noPolicy = findings.find((f) => f.code === 'no-visibility-policy');
    expect(noPolicy).toBeDefined();
    expect(noPolicy!.severity).toBe('error');
  });
});
