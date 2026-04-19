/**
 * EmailSignalAdapter — reference adapter for email signals.
 *
 * Turns a normalized email object (from / to / cc / subject / body / ...) into
 * participant seeds (people) and a signal text built from subject + body.
 * BCC is intentionally omitted — including BCC recipients as seeds would leak
 * privacy to the LLM's view of the thread.
 *
 * Organization seeding is opt-in. When enabled, email domains not on the
 * `freeEmailProviders` list are seeded as `organization` entities identified
 * by `kind: 'domain'`. Domains like `gmail.com` or `outlook.com` are skipped
 * because they do NOT identify a single organization.
 */

import type { Identifier } from '../../../types.js';
import type { ExtractedSignal, ParticipantSeed, SignalSourceAdapter } from '../types.js';

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailSignal {
  from: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  /** BCC is NOT forwarded to the extractor for privacy reasons. */
  bcc?: EmailAddress[];
  subject?: string;
  /** Plain-text body. Caller is responsible for stripping HTML / quoted replies as needed. */
  body: string;
  date?: Date;
  messageId?: string;
  threadId?: string;
}

export interface EmailSignalAdapterOptions {
  /** Seed sender/recipient email domains as `organization` entities. Default true. */
  seedOrganizations?: boolean;
  /**
   * Domains skipped when seeding organizations. Defaults to a common-providers
   * list; pass a custom list to override entirely (not extend). Case-insensitive.
   */
  freeEmailProviders?: string[];
}

const DEFAULT_FREE_EMAIL_PROVIDERS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'fastmail.com',
  'fastmail.fm',
  'zoho.com',
  'gmx.com',
  'gmx.de',
  'mail.com',
  'pm.me',
  'tutanota.com',
  'yandex.com',
  'yandex.ru',
];

export class EmailSignalAdapter implements SignalSourceAdapter<EmailSignal> {
  readonly kind = 'email';

  private readonly seedOrganizations: boolean;
  private readonly freeProviders: Set<string>;

  constructor(opts: EmailSignalAdapterOptions = {}) {
    this.seedOrganizations = opts.seedOrganizations ?? true;
    const list = opts.freeEmailProviders ?? DEFAULT_FREE_EMAIL_PROVIDERS;
    this.freeProviders = new Set(list.map((d) => d.toLowerCase()));
  }

  extract(raw: EmailSignal): ExtractedSignal {
    const participants: ParticipantSeed[] = [];
    const seenDomains = new Set<string>();

    const pushPerson = (addr: EmailAddress | undefined, role: string): void => {
      if (!addr?.email) return;
      const email = addr.email.trim();
      if (!email) return;
      participants.push({
        role,
        type: 'person',
        identifiers: [{ kind: 'email', value: email.toLowerCase() }],
        displayName: addr.name && addr.name.trim().length > 0 ? addr.name.trim() : undefined,
      });

      if (!this.seedOrganizations) return;
      const domain = extractDomain(email);
      if (!domain) return;
      if (this.freeProviders.has(domain)) return;
      if (seenDomains.has(domain)) return;
      seenDomains.add(domain);
      const identifiers: Identifier[] = [{ kind: 'domain', value: domain }];
      participants.push({
        role: `${role}-org`,
        type: 'organization',
        identifiers,
        displayName: domain,
      });
    };

    pushPerson(raw.from, 'from');
    for (const to of raw.to ?? []) pushPerson(to, 'to');
    for (const cc of raw.cc ?? []) pushPerson(cc, 'cc');

    const subject = raw.subject?.trim();
    const body = raw.body ?? '';
    const signalText = subject ? `Subject: ${subject}\n\n${body}` : body;

    const signalSourceDescription = buildSourceDescription(raw);

    return {
      signalText,
      signalSourceDescription,
      participants,
    };
  }
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  return domain.length > 0 ? domain : null;
}

function buildSourceDescription(raw: EmailSignal): string | undefined {
  if (!raw.from?.email) return undefined;
  const recipients = [
    ...(raw.to ?? []).map((a) => a.email),
    ...(raw.cc ?? []).map((a) => `cc:${a.email}`),
  ]
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');
  const base = `email from ${raw.from.email}`;
  return recipients ? `${base} to ${recipients}` : base;
}
