import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import Module from 'node:module';
import type { Socket } from 'node:net';

async function main(): Promise<void> {
  delete process.env.WS_NO_BUFFER_UTIL;

  // Reproduce the shape emitted by bundlers that turn an unresolved optional
  // native dependency into an empty-but-truthy module.
  const nodeModule = Module as unknown as {
    _load(request: string, parent: unknown, isMain: boolean): unknown;
  };
  const originalLoad = nodeModule._load;
  let bufferUtilLoads = 0;
  nodeModule._load = function patchedLoad(request, parent, isMain): unknown {
    if (request === 'bufferutil') {
      bufferUtilLoads++;
      return {};
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  const sockets = new Set<Socket>();
  const server = createServer();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('upgrade', (request, socket) => {
    const key = request.headers['sec-websocket-key'];
    if (typeof key !== 'string') {
      socket.destroy();
      return;
    }
    const accept = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'));
    setTimeout(() => socket.write(textFrame(JSON.stringify({
      type: 'session.created',
      session: { id: 'sess_bundler_regression' },
    }))), 5);
  });

  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind');

    const [{ Connector }, { Vendor }, { OpenAIRealtimeSession }] = await Promise.all([
      import('../../../src/core/Connector.js'),
      import('../../../src/core/Vendor.js'),
      import('../../../src/capabilities/voice/openai/OpenAIRealtimeSession.js'),
    ]);
    const connector = Connector.create({
      name: 'ws-bundler-regression',
      vendor: Vendor.OpenAI,
      baseURL: `http://127.0.0.1:${address.port}/v1`,
      auth: { type: 'api_key', apiKey: 'not-a-secret' },
    });
    const session = new OpenAIRealtimeSession({
      connector,
      session: { instructions: 'x'.repeat(512), output_modalities: ['audio'] },
    });
    try {
      await session.connect();
    } finally {
      session.close();
      Connector.clear();
    }

    if (bufferUtilLoads !== 0) {
      throw new Error(`ws attempted to load the unsafe optional bufferutil module ${bufferUtilLoads} time(s)`);
    }
  } finally {
    nodeModule._load = originalLoad;
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function textFrame(payload: string): Buffer {
  const body = Buffer.from(payload);
  if (body.length <= 125) return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  if (body.length <= 65_535) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, body]);
  }
  throw new RangeError('Fixture frame is too large');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
