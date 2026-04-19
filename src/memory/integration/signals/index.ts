export { SignalIngestor } from './SignalIngestor.js';
export type {
  SignalIngestorConfig,
  IngestSignalInput,
  IngestTextInput,
  IngestExtractedInput,
} from './SignalIngestor.js';

export { ConnectorExtractor, parseExtractionResponse } from './ConnectorExtractor.js';
export type { ConnectorExtractorConfig } from './ConnectorExtractor.js';

export type {
  ParticipantSeed,
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
