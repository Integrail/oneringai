import { describe, expect, it, vi } from 'vitest';
import { OpenAIRealtimeChannelTransport } from '../../../src/capabilities/voice/openai/OpenAIRealtimeChannelTransport.js';
import type { RealtimeMessageChannel } from '../../../src/capabilities/voice/openai/RealtimeChannel.js';
import { OpenAIRealtimeWebRTCPeer } from '../../../src/realtime-browser/OpenAIRealtimeWebRTCPeer.js';

class MockMessageChannel implements RealtimeMessageChannel {
  isOpen = false;
  bufferedAmount = 0;
  sent: string[] = [];
  private messages = new Set<(message: string) => void>();
  private closes = new Set<(code: number, reason: string) => void>();
  private errors = new Set<(error: Error) => void>();

  async open(): Promise<void> {
    this.isOpen = true;
    queueMicrotask(() => this.receive(JSON.stringify({
      type: 'session.created',
      session: { id: 'sess-channel' },
    })));
  }

  send(message: string): void { this.sent.push(message); }
  close(code = 1000, reason = ''): void {
    this.isOpen = false;
    for (const handler of this.closes) handler(code, reason);
  }
  onMessage(handler: (message: string) => void): () => void {
    this.messages.add(handler);
    return () => this.messages.delete(handler);
  }
  onClose(handler: (code: number, reason: string) => void): () => void {
    this.closes.add(handler);
    return () => this.closes.delete(handler);
  }
  onError(handler: (error: Error) => void): () => void {
    this.errors.add(handler);
    return () => this.errors.delete(handler);
  }
  receive(message: string): void { for (const handler of this.messages) handler(message); }
}

class MockDataChannel {
  readyState = 'connecting';
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 'closed'; this.onclose?.(); }
  triggerOpen(): void { this.readyState = 'open'; this.onopen?.(); }
}

describe('OpenAI Realtime cross-process channels', () => {
  it('adapts a typed message channel to OpenAIRealtimeAgentTransport', async () => {
    const channel = new MockMessageChannel();
    const transport = new OpenAIRealtimeChannelTransport({ channel });
    const created = await transport.connect();

    expect(created.type).toBe('session.created');
    expect(transport.isConnected).toBe(true);
    transport.updateSession({ model: 'gpt-realtime-2.1' });
    transport.appendAudio(Buffer.from([1, 2, 3]));
    expect(channel.sent.map((message) => JSON.parse(message))).toEqual([
      {
        type: 'session.update',
        session: { type: 'realtime', model: 'gpt-realtime-2.1' },
      },
      { type: 'input_audio_buffer.append', audio: 'AQID' },
    ]);

    transport.close(1000, 'done');
    expect(transport.isConnected).toBe(false);
  });

  it('creates a credential-free WebRTC peer and exposes its data channel', async () => {
    const dataChannel = new MockDataChannel();
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const peer = {
      localDescription: null as { sdp?: string } | null,
      connectionState: 'new',
      ontrack: null as ((event: { streams?: unknown[]; track?: unknown }) => void) | null,
      onconnectionstatechange: null as (() => void) | null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'v=0\r\no=browser-offer' })),
      setLocalDescription: vi.fn(async (description: { sdp?: string }) => {
        peer.localDescription = description;
      }),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };
    const exchangeSdp = vi.fn(async () => ({
      sdp: 'v=0\r\no=openai-answer',
      callId: 'call_123',
    }));
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp,
      acquireMedia: async () => stream,
      peerConnectionFactory: () => peer as any,
    });
    const received: string[] = [];
    webRTC.onMessage((message) => received.push(message));

    const connecting = webRTC.connect();
    await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());
    dataChannel.triggerOpen();
    const call = await connecting;
    webRTC.send({ type: 'response.create' });
    dataChannel.onmessage?.({ data: JSON.stringify({ type: 'response.done' }) });

    expect(call.callId).toBe('call_123');
    expect(exchangeSdp).toHaveBeenCalledWith('v=0\r\no=browser-offer', { signal: undefined });
    expect(peer.addTrack).toHaveBeenCalledWith(track, stream);
    expect(dataChannel.sent).toEqual([JSON.stringify({ type: 'response.create' })]);
    expect(received).toEqual([JSON.stringify({ type: 'response.done' })]);

    webRTC.close();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(peer.close).toHaveBeenCalledOnce();
  });

  it('cleans up a partial WebRTC connection and emits close only once', async () => {
    const dataChannel = new MockDataChannel();
    const track = { stop: vi.fn() };
    const peer = {
      localDescription: null as { sdp?: string } | null,
      connectionState: 'new',
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
      setLocalDescription: vi.fn(async (description: { sdp?: string }) => {
        peer.localDescription = description;
      }),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async () => { throw new Error('SDP exchange failed'); },
      acquireMedia: async () => ({ getTracks: () => [track] }),
      peerConnectionFactory: () => peer as any,
    });

    await expect(webRTC.connect()).rejects.toThrow('SDP exchange failed');
    expect(track.stop).toHaveBeenCalledOnce();
    expect(peer.close).toHaveBeenCalledOnce();

    const closeEvents: string[] = [];
    const secondChannel = new MockDataChannel();
    const secondPeer = {
      ...peer,
      localDescription: null as { sdp?: string } | null,
      createDataChannel: vi.fn(() => secondChannel),
      setLocalDescription: vi.fn(async (description: { sdp?: string }) => {
        secondPeer.localDescription = description;
      }),
      close: vi.fn(),
    };
    const retry = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async () => ({ sdp: 'answer', callId: 'call_retry' }),
      localStream: { getTracks: () => [] },
      peerConnectionFactory: () => secondPeer as any,
    });
    retry.onClose((_code, reason) => closeEvents.push(reason));
    const connecting = retry.connect();
    await vi.waitFor(() => expect(secondPeer.setRemoteDescription).toHaveBeenCalledOnce());
    secondChannel.triggerOpen();
    await connecting;
    retry.close();

    expect(closeEvents).toEqual(['Client closed']);
    expect(secondPeer.close).toHaveBeenCalledOnce();
  });

  it('releases resources once when closed during SDP exchange', async () => {
    const dataChannel = new MockDataChannel();
    const track = { stop: vi.fn() };
    let finishExchange!: (call: { sdp: string; callId: string }) => void;
    const exchange = new Promise<{ sdp: string; callId: string }>((resolve) => {
      finishExchange = resolve;
    });
    const releaseCall = vi.fn(async () => undefined);
    const peer = {
      localDescription: null as { sdp?: string } | null,
      connectionState: 'new',
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
      setLocalDescription: vi.fn(async (description: { sdp?: string }) => {
        peer.localDescription = description;
      }),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async () => exchange,
      releaseCall,
      localStream: { getTracks: () => [track] },
      peerConnectionFactory: () => peer as any,
    });
    const closeEvents: string[] = [];
    webRTC.onClose((_code, reason) => closeEvents.push(reason));

    const connecting = webRTC.connect();
    await vi.waitFor(() => expect(peer.setLocalDescription).toHaveBeenCalledOnce());
    webRTC.close();
    finishExchange({ sdp: 'answer', callId: 'call_late' });

    await expect(connecting).rejects.toThrow('peer is closed');
    expect(peer.close).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(closeEvents).toEqual(['Client closed']);
    expect(releaseCall).toHaveBeenCalledOnce();
    expect(releaseCall).toHaveBeenCalledWith('call_late');
  });

  it('rejects immediately when closed while waiting for the data channel', async () => {
    const dataChannel = new MockDataChannel();
    const track = { stop: vi.fn() };
    const peer = {
      localDescription: null as { sdp?: string } | null,
      connectionState: 'new',
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
      setLocalDescription: vi.fn(async (description: { sdp?: string }) => {
        peer.localDescription = description;
      }),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async () => ({ sdp: 'answer', callId: 'call_waiting' }),
      localStream: { getTracks: () => [track] },
      peerConnectionFactory: () => peer as any,
      connectTimeoutMs: 60_000,
    });

    const connecting = webRTC.connect();
    await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());
    webRTC.close();

    await expect(connecting).rejects.toThrow('closed during connect: Client closed');
    expect(peer.close).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('replays all buffered events in order to a transport attached after the peer opened', async () => {
    const dataChannel = new MockDataChannel();
    const peer = {
      localDescription: { sdp: 'offer' },
      connectionState: 'connected',
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
      setLocalDescription: vi.fn(async () => undefined),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async () => ({ sdp: 'answer', callId: 'call_replay' }),
      localStream: { getTracks: () => [] },
      peerConnectionFactory: () => peer as any,
    });
    const connecting = webRTC.connect();
    await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());
    dataChannel.triggerOpen();
    await connecting;
    dataChannel.onmessage?.({
      data: JSON.stringify({ type: 'session.created', session: { id: 'session_replay' } }),
    });
    dataChannel.onmessage?.({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'early speech',
      }),
    });
    dataChannel.onmessage?.({
      data: JSON.stringify({ type: 'response.done', response: { id: 'early-response' } }),
    });

    const transport = new OpenAIRealtimeChannelTransport({ channel: webRTC });
    const replayed: string[] = [];
    transport.on('event', (event) => replayed.push(event.type));
    await expect(transport.connect()).resolves.toMatchObject({
      type: 'session.created',
      session: { id: 'session_replay' },
    });
    expect(replayed).toEqual([
      'session.created',
      'conversation.item.input_audio_transcription.completed',
      'response.done',
    ]);

    transport.close();
  });

  it('closes and releases the call when the pre-bridge event buffer overflows', async () => {
    const dataChannel = new MockDataChannel();
    const releaseCall = vi.fn(async () => undefined);
    const peer = {
      localDescription: { sdp: 'offer' },
      connectionState: 'connected',
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
      setLocalDescription: vi.fn(async () => undefined),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async () => ({ sdp: 'answer', callId: 'call_overflow' }),
      releaseCall,
      localStream: { getTracks: () => [] },
      peerConnectionFactory: () => peer as any,
      maxPendingMessages: 1,
    });
    const errors: string[] = [];
    webRTC.onError((error) => errors.push(error.message));
    const connecting = webRTC.connect();
    await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());
    dataChannel.triggerOpen();
    await connecting;

    dataChannel.onmessage?.({ data: JSON.stringify({ type: 'session.created' }) });
    dataChannel.onmessage?.({ data: JSON.stringify({ type: 'response.done' }) });

    await vi.waitFor(() => expect(releaseCall).toHaveBeenCalledWith('call_overflow'));
    expect(webRTC.isOpen).toBe(false);
    expect(errors).toContain('OpenAI Realtime pending event buffer exceeded its limit');
  });

  it('releases a created provider call when applying the SDP answer fails', async () => {
    const dataChannel = new MockDataChannel();
    const releaseCall = vi.fn(async () => undefined);
    const peer = {
      localDescription: { sdp: 'offer' },
      connectionState: 'new',
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
      setLocalDescription: vi.fn(async () => undefined),
      setRemoteDescription: vi.fn(async () => { throw new Error('invalid answer'); }),
      close: vi.fn(),
    };
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async (_offer, { signal }) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        return { sdp: 'answer', callId: 'call_orphan' };
      },
      releaseCall,
      localStream: { getTracks: () => [] },
      peerConnectionFactory: () => peer as any,
    });
    const controller = new AbortController();

    await expect(webRTC.connect({ signal: controller.signal })).rejects.toThrow('invalid answer');
    expect(releaseCall).toHaveBeenCalledOnce();
    expect(releaseCall).toHaveBeenCalledWith('call_orphan');
  });

  it('closes and releases the provider call on terminal peer failure', async () => {
    const dataChannel = new MockDataChannel();
    const releaseCall = vi.fn(async () => undefined);
    const peer = {
      localDescription: { sdp: 'offer' },
      connectionState: 'new',
      ontrack: null,
      onconnectionstatechange: null as (() => void) | null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
      setLocalDescription: vi.fn(async () => undefined),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async () => ({ sdp: 'answer', callId: 'call_failed' }),
      releaseCall,
      localStream: { getTracks: () => [] },
      peerConnectionFactory: () => peer as any,
    });
    webRTC.onError(() => undefined);
    const connecting = webRTC.connect();
    await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());
    dataChannel.triggerOpen();
    await connecting;

    peer.connectionState = 'failed';
    peer.onconnectionstatechange?.();

    await vi.waitFor(() => expect(releaseCall).toHaveBeenCalledWith('call_failed'));
    expect(webRTC.isOpen).toBe(false);
    expect(peer.close).toHaveBeenCalledOnce();
  });

  it('makes concurrent closeAndRelease callers await the same provider cleanup', async () => {
    const dataChannel = new MockDataChannel();
    let finishRelease!: () => void;
    const release = new Promise<void>((resolve) => { finishRelease = resolve; });
    const releaseCall = vi.fn(async () => release);
    const peer = {
      localDescription: { sdp: 'offer' },
      connectionState: 'new',
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
      setLocalDescription: vi.fn(async () => undefined),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };
    const webRTC = new OpenAIRealtimeWebRTCPeer({
      exchangeSdp: async () => ({ sdp: 'answer', callId: 'call_concurrent_close' }),
      releaseCall,
      localStream: { getTracks: () => [] },
      peerConnectionFactory: () => peer as any,
    });
    const connecting = webRTC.connect();
    await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());
    dataChannel.triggerOpen();
    await connecting;

    let firstClosed = false;
    let secondClosed = false;
    const first = webRTC.closeAndRelease().then(() => { firstClosed = true; });
    const second = webRTC.closeAndRelease().then(() => { secondClosed = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(releaseCall).toHaveBeenCalledOnce();
    expect(firstClosed).toBe(false);
    expect(secondClosed).toBe(false);
    finishRelease();
    await Promise.all([first, second]);
    expect(firstClosed).toBe(true);
    expect(secondClosed).toBe(true);
  });
});
