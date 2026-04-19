import { describe, it, expect } from 'vitest';
import { EmailSignalAdapter } from '@/memory/integration/signals/adapters/EmailSignalAdapter.js';

describe('EmailSignalAdapter', () => {
  const baseEmail = {
    from: { email: 'anton@everworker.ai', name: 'Anton Antich' },
    to: [{ email: 'sarah@acme.com', name: 'Sarah Chen' }],
    cc: [{ email: 'bob@acme.com' }],
    subject: 'Q3 Planning',
    body: 'Let us catch up on Q3 priorities.',
  };

  it('seeds from/to/cc as person participants with email identifiers', () => {
    const adapter = new EmailSignalAdapter({ seedOrganizations: false });
    const out = adapter.extract(baseEmail);
    const people = out.participants.filter((p) => p.type === 'person');
    expect(people.map((p) => p.role)).toEqual(['from', 'to', 'cc']);
    expect(people[0]!.identifiers[0]).toEqual({ kind: 'email', value: 'anton@everworker.ai' });
    expect(people[0]!.displayName).toBe('Anton Antich');
    expect(people[2]!.displayName).toBeUndefined();
  });

  it('omits BCC recipients for privacy', () => {
    const adapter = new EmailSignalAdapter({ seedOrganizations: false });
    const out = adapter.extract({
      ...baseEmail,
      bcc: [{ email: 'hidden@elsewhere.com' }],
    });
    const emails = out.participants
      .filter((p) => p.type === 'person')
      .map((p) => p.identifiers[0]!.value);
    expect(emails).not.toContain('hidden@elsewhere.com');
  });

  it('prepends the subject to the signalText', () => {
    const adapter = new EmailSignalAdapter();
    const out = adapter.extract(baseEmail);
    expect(out.signalText).toBe('Subject: Q3 Planning\n\nLet us catch up on Q3 priorities.');
  });

  it('skips the subject prefix when subject is missing', () => {
    const adapter = new EmailSignalAdapter();
    const out = adapter.extract({ ...baseEmail, subject: undefined });
    expect(out.signalText).toBe('Let us catch up on Q3 priorities.');
  });

  it('seeds organization entities for non-free email domains, deduped', () => {
    const adapter = new EmailSignalAdapter();
    const out = adapter.extract(baseEmail);
    const orgs = out.participants.filter((p) => p.type === 'organization');
    const domains = orgs.map((o) => o.identifiers[0]!.value);
    expect(domains).toContain('everworker.ai');
    expect(domains).toContain('acme.com');
    const acmeCount = domains.filter((d) => d === 'acme.com').length;
    expect(acmeCount).toBe(1);
  });

  it('skips common free providers when seeding organizations', () => {
    const adapter = new EmailSignalAdapter();
    const out = adapter.extract({
      from: { email: 'user@gmail.com' },
      to: [{ email: 'other@outlook.com' }],
      body: 'hey',
    });
    const orgs = out.participants.filter((p) => p.type === 'organization');
    expect(orgs).toEqual([]);
  });

  it('respects seedOrganizations=false', () => {
    const adapter = new EmailSignalAdapter({ seedOrganizations: false });
    const out = adapter.extract(baseEmail);
    const orgs = out.participants.filter((p) => p.type === 'organization');
    expect(orgs).toEqual([]);
  });

  it('lowercases email identifier values', () => {
    const adapter = new EmailSignalAdapter({ seedOrganizations: false });
    const out = adapter.extract({
      from: { email: 'Anton@Everworker.AI', name: 'Anton' },
      body: 'hi',
    });
    expect(out.participants[0]!.identifiers[0]!.value).toBe('anton@everworker.ai');
  });

  it('builds a source description referencing from + first recipients', () => {
    const adapter = new EmailSignalAdapter({ seedOrganizations: false });
    const out = adapter.extract(baseEmail);
    expect(out.signalSourceDescription).toContain('anton@everworker.ai');
    expect(out.signalSourceDescription).toContain('sarah@acme.com');
  });

  it('advertises kind = email', () => {
    expect(new EmailSignalAdapter().kind).toBe('email');
  });
});
