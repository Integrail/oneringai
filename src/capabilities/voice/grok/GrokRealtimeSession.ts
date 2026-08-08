import {
  OpenAIRealtimeSession,
  type OpenAIRealtimeSessionOptions,
} from '../openai/OpenAIRealtimeSession.js';
import type { GrokRealtimeSessionConfig } from '../openai/RealtimeTypes.js';

/** xAI Voice Agent WebSocket options with xAI's provider-specific audio rates. */
export interface GrokRealtimeSessionOptions
  extends Omit<OpenAIRealtimeSessionOptions, 'session'> {
  session?: GrokRealtimeSessionConfig;
}

/**
 * xAI-typed facade over the connector-aware Realtime WebSocket transport.
 * OpenAIRealtimeSession deliberately retains OpenAI's stricter 24 kHz type.
 */
export class GrokRealtimeSession extends OpenAIRealtimeSession {
  constructor(options: GrokRealtimeSessionOptions) {
    super(options as OpenAIRealtimeSessionOptions);
  }

  override updateSession(
    session: NonNullable<OpenAIRealtimeSessionOptions['session']> | GrokRealtimeSessionConfig,
  ): void {
    super.updateSession(
      session as unknown as NonNullable<OpenAIRealtimeSessionOptions['session']>,
    );
  }
}
