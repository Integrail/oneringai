import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleEmbeddingProvider } from '@/infrastructure/providers/google/GoogleEmbeddingProvider.js';

describe('GoogleEmbeddingProvider multimodal media', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches external HTTP media and sends inline bytes', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ embedding: { values: [0.1, 0.2] } }), {
        headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });

    await provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [{ type: 'image', data: 'https://example.test/source.jpg' }],
    });

    const request = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(request.content.parts[0]).toEqual({
      inlineData: { data: jpeg.toString('base64'), mimeType: 'image/jpeg' },
    });
    expect(request.content.parts[0]).not.toHaveProperty('fileData');
  });

  it('preserves Google-hosted file URIs as fileData', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      embedding: { values: [0.1, 0.2] },
    }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });
    const fileUri = 'https://generativelanguage.googleapis.com/v1beta/files/file-123';

    await provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [{ type: 'image', data: fileUri, mimeType: 'image/png' }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.content.parts[0]).toEqual({
      fileData: { fileUri, mimeType: 'image/png' },
    });
  });

  it('rejects malformed data URI base64 before sending an embedding request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });

    await expect(provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [{ type: 'image', data: 'data:image/png;base64,!!!!!!!!' }],
    })).rejects.toThrow('contains invalid base64');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('canonicalizes valid unpadded data URI base64 before transmission', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      embedding: { values: [0.1] },
    }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });

    await provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [{ type: 'image', data: 'data:image/png;base64,aGk' }],
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.content.parts[0].inlineData.data).toBe('aGk=');
  });

  it('rejects an oversized external response from Content-Length before reading it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from([0]), {
      headers: {
        'content-length': String(101 * 1024 * 1024),
        'content-type': 'image/jpeg',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });

    await expect(provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [{ type: 'image', data: 'https://example.test/oversized.jpg' }],
    })).rejects.toThrow("Google's 100 MB inline limit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("applies Google's lower 50 MB inline PDF limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from([0]), {
      headers: {
        'content-length': String(51 * 1024 * 1024),
        'content-type': 'application/pdf',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });

    await expect(provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [{ type: 'document', data: 'https://example.test/oversized.pdf' }],
    })).rejects.toThrow("Google's 50 MB inline limit");
  });

  it('aborts external downloads that exceed the configured timeout', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });

    await expect(provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [{ type: 'audio', data: 'https://example.test/stalled.mp3' }],
      vendorOptions: { mediaDownloadTimeoutMs: 5 },
    })).rejects.toThrow('Embedding media download timed out after 5 ms');
  });

  it('sniffs optional JPEG, MP3, and MOV Buffer MIME types', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      embedding: { values: [0.1, 0.2] },
    }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const mp3 = Buffer.from('ID3sample');
    const mov = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypqt  ')]);
    await provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [
        { type: 'image', data: jpeg },
        { type: 'audio', data: mp3 },
        { type: 'video', data: mov },
      ],
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.content.parts[0].inlineData.mimeType).toBe('image/jpeg');
    expect(request.content.parts[1].inlineData.mimeType).toBe('audio/mpeg');
    expect(request.content.parts[2].inlineData.mimeType).toBe('video/quicktime');
  });

  it('ignores generic HTTP content types and falls back to a MOV extension', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(Buffer.from([0]), {
        headers: { 'content-type': 'application/octet-stream' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ embedding: { values: [0.1] } }), {
        headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });

    await provider.embed({
      model: 'gemini-embedding-2',
      input: '',
      content: [{ type: 'video', data: 'https://example.test/source.mov' }],
    });

    const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(request.content.parts[0].inlineData.mimeType).toBe('video/quicktime');
  });
});
