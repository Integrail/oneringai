export { SignalIngestor } from './SignalIngestor.js';
export type {
  SignalIngestorConfig,
  ContextHintsConfig,
  IngestSignalInput,
  IngestTextInput,
  IngestExtractedInput,
} from './SignalIngestor.js';

export { ConnectorExtractor, parseExtractionResponse } from './ConnectorExtractor.js';
export type { ConnectorExtractorConfig } from './ConnectorExtractor.js';

export type {
  ParticipantSeed,
  SeedFact,
  ExtractedSignal,
  SignalSourceAdapter,
  IExtractor,
} from './types.js';

export { PlainTextAdapter } from './adapters/PlainTextAdapter.js';
export type { PlainTextRaw } from './adapters/PlainTextAdapter.js';

export { EmailSignalAdapter } from './adapters/EmailSignalAdapter.js';
export type {
  EmailAddress,
  EmailSignal,
  EmailSignalAdapterOptions,
} from './adapters/EmailSignalAdapter.js';

export { CalendarSignalAdapter } from './adapters/CalendarSignalAdapter.js';
export type {
  CalendarAttendee,
  CalendarSignal,
  CalendarSignalAdapterOptions,
} from './adapters/CalendarSignalAdapter.js';
