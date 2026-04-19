/**
 * PlainTextAdapter — trivial adapter for raw text signals.
 *
 * No metadata, no seeding — just hands the text through. Useful as a default
 * registration so callers can use `SignalIngestor.ingest({ kind: 'text', ... })`
 * uniformly. If you already have participants (e.g. from a fetched thread),
 * prefer `SignalIngestor.ingestText({ text, participants, ... })` directly.
 */

import type { ExtractedSignal, SignalSourceAdapter } from '../types.js';

export interface PlainTextRaw {
  text: string;
  /** Optional short description, e.g. "note-attached-to-ticket-123". */
  source?: string;
}

export class PlainTextAdapter implements SignalSourceAdapter<PlainTextRaw> {
  readonly kind = 'text';

  extract(raw: PlainTextRaw): ExtractedSignal {
    return {
      signalText: raw.text,
      signalSourceDescription: raw.source,
      participants: [],
    };
  }
}
