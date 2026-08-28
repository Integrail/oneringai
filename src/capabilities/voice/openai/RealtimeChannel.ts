/** SDP answer returned by a server-created OpenAI Realtime WebRTC call. */
export interface OpenAIRealtimeWebRTCCall {
  sdp: string;
  callId: string;
}

/**
 * Minimal text channel shared by WebRTC data channels, Electron MessagePorts,
 * workers, and other host bridges. Authentication and routing stay with the host.
 */
export interface RealtimeMessageChannel {
  readonly isOpen: boolean;
  readonly bufferedAmount?: number;
  open?(options?: { signal?: AbortSignal }): Promise<void>;
  /** Compatibility replay hook for a channel attached after session.created. */
  getSessionCreatedMessage?(): string | undefined;
  send(message: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (message: string) => void): () => void;
  onClose(handler: (code: number, reason: string) => void): () => void;
  onError(handler: (error: Error) => void): () => void;
}
