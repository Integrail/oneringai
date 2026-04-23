/**
 * CalendarSignalAdapter — reference adapter for calendar event signals.
 *
 * Normalizes a calendar event (title / description / start / end / attendees /
 * organizer / location) into:
 *   - One `event` entity seed with a deterministic canonical identifier and
 *     structural metadata (`startTime`, `endTime`, `location`, `kind`).
 *   - Person seeds for the organizer + each attendee (keyed by email).
 *   - Seed facts: `organizer attended/hosted event`, `attendee attended event`.
 *     Written deterministically by `SignalIngestor` — no LLM involvement — so
 *     `getContext.relatedEvents` surfaces the event for every participant.
 *
 * The `signalText` includes title + description + attendee list so the LLM
 * can still extract narrative facts from the event description.
 */

import { canonicalIdentifier } from '../../../identifiers.js';
import type {
  ExtractedSignal,
  ParticipantSeed,
  SeedFact,
  SignalSourceAdapter,
} from '../types.js';

export interface CalendarAttendee {
  email: string;
  name?: string;
  rsvpStatus?: 'accepted' | 'declined' | 'tentative' | 'needs_action';
}

export interface CalendarSignal {
  /** External calendar event id. Preferred source of canonical identifier stability. */
  id?: string;
  /** Calendar source, e.g. `'gcal'`, `'outlook'`, `'ical'`. Default `'calendar'`. */
  source?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime?: Date;
  organizer?: CalendarAttendee;
  /** Attendee list. Organizer MAY also appear here — deduped by email. */
  attendees?: CalendarAttendee[];
  /** Free-form hint, e.g. `'meeting'`, `'focus'`, `'travel'`, `'other'`. */
  kind?: 'meeting' | 'focus' | 'travel' | 'other';
}

export interface CalendarSignalAdapterOptions {
  /**
   * When true, attendees with `rsvpStatus: 'declined'` are omitted entirely —
   * no person seed, no `attended` seed fact, and they are not listed in
   * `signalText`. Default true: we don't want the declined attendee's name
   * showing up in the prompt, because the LLM can (and does) infer
   * attendance from the presence alone, defeating the skip intent.
   *
   * Set false to preserve prior behavior (declined attendees seeded + listed
   * in signalText; only the deterministic `attended` seed fact is skipped).
   */
  skipDeclinedAttendance?: boolean;
}

export class CalendarSignalAdapter implements SignalSourceAdapter<CalendarSignal> {
  readonly kind = 'calendar';

  private readonly skipDeclinedAttendance: boolean;

  constructor(opts: CalendarSignalAdapterOptions = {}) {
    this.skipDeclinedAttendance = opts.skipDeclinedAttendance ?? true;
  }

  extract(raw: CalendarSignal): ExtractedSignal {
    const source = raw.source?.trim().length ? raw.source : 'calendar';
    const canonicalId = canonicalIdentifier('event', {
      source,
      // Prefer external id for stability; fall back to title+start when the
      // caller doesn't have one. Same title+start → same identifier → resolver
      // converges on the same event across re-extractions.
      id: raw.id ?? `${raw.title}-${raw.startTime.toISOString()}`,
    });

    const participants: ParticipantSeed[] = [];

    // Event seed — the canonical identifier is what makes re-extraction converge.
    const metadata: Record<string, unknown> = {
      startTime: raw.startTime,
    };
    if (raw.endTime) metadata.endTime = raw.endTime;
    if (raw.location) metadata.location = raw.location;
    if (raw.kind) metadata.kind = raw.kind;

    participants.push({
      role: 'event',
      type: 'event',
      identifiers: [canonicalId],
      displayName: raw.title,
      metadata,
      // A calendar pull is authoritative for structural schedule fields —
      // re-ingests after a reschedule MUST update startTime/endTime/location.
      // Person seeds below stay on the fillMissing default so a signal can't
      // rename an attendee.
      metadataMerge: 'overwrite',
    });

    // Organizer seed — always distinct role so seedFacts can refer to them.
    const seenEmails = new Set<string>();
    const seedFacts: SeedFact[] = [];

    if (raw.organizer?.email) {
      const email = raw.organizer.email.trim().toLowerCase();
      if (email.length > 0) {
        seenEmails.add(email);
        participants.push({
          role: 'organizer',
          type: 'person',
          identifiers: [{ kind: 'email', value: email }],
          displayName: raw.organizer.name?.trim() || undefined,
        });
        seedFacts.push({
          subjectRole: 'organizer',
          predicate: 'hosted',
          objectRole: 'event',
          importance: 0.7,
        });
      }
    }

    // Attendees — deduped by email. Declined RSVPs are dropped entirely when
    // skipDeclinedAttendance is true (no seed, no seedFact, and filtered out
    // of signalText below) so the LLM can't infer attendance from the mere
    // presence of a name.
    let attendeeIdx = 0;
    for (const attendee of raw.attendees ?? []) {
      if (!attendee.email) continue;
      const email = attendee.email.trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      if (this.skipDeclinedAttendance && attendee.rsvpStatus === 'declined') continue;
      seenEmails.add(email);
      const role = `attendee_${attendeeIdx++}`;
      participants.push({
        role,
        type: 'person',
        identifiers: [{ kind: 'email', value: email }],
        displayName: attendee.name?.trim() || undefined,
      });
      seedFacts.push({
        subjectRole: role,
        predicate: 'attended',
        objectRole: 'event',
        importance: 0.5,
      });
    }

    const signalText = buildSignalText(raw, { skipDeclinedAttendance: this.skipDeclinedAttendance });
    const signalSourceDescription = `calendar event "${raw.title}" on ${raw.startTime.toISOString()}`;

    return {
      signalText,
      signalSourceDescription,
      participants,
      seedFacts: seedFacts.length > 0 ? seedFacts : undefined,
    };
  }
}

function buildSignalText(
  raw: CalendarSignal,
  opts: { skipDeclinedAttendance: boolean },
): string {
  const parts: string[] = [];
  parts.push(`Title: ${raw.title}`);
  parts.push(`Start: ${raw.startTime.toISOString()}`);
  if (raw.endTime) parts.push(`End: ${raw.endTime.toISOString()}`);
  if (raw.location) parts.push(`Location: ${raw.location}`);
  const filteredAttendees = (raw.attendees ?? []).filter(
    (a) => !opts.skipDeclinedAttendance || a.rsvpStatus !== 'declined',
  );
  const emails = [
    ...(raw.organizer?.email ? [`${raw.organizer.email} (organizer)`] : []),
    ...filteredAttendees.map((a) => a.email).filter(Boolean),
  ];
  if (emails.length > 0) parts.push(`Attendees: ${emails.join(', ')}`);
  if (raw.description && raw.description.trim().length > 0) {
    parts.push('', raw.description.trim());
  }
  return parts.join('\n');
}
