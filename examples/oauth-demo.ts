/**
 * OAuth manager and encrypted token storage demo.
 *
 * A local mock token endpoint keeps this example deterministic while still
 * exercising the real client-credentials request, cache, and FileStorage.
 */

import 'dotenv/config';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { OAuthManager, FileStorage, generateEncryptionKey } from '../src/index.js';

async function main(): Promise<void> {
  let tokenRequests = 0;
  const server = createServer((_request, response) => {
    tokenRequests += 1;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      access_token: `local-demo-token-${tokenRequests}`,
      token_type: 'Bearer',
      expires_in: 3600,
    }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  const tokenUrl = `http://127.0.0.1:${address.port}/oauth/token`;
  const tokenDirectory = await mkdtemp(join(tmpdir(), 'oneringai-oauth-'));
  const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY || generateEncryptionKey();
  process.env.OAUTH_ENCRYPTION_KEY ||= encryptionKey;

  try {
    console.log('1. Client credentials with in-memory caching');
    const memoryOAuth = new OAuthManager({
      flow: 'client_credentials',
      clientId: 'demo-client',
      clientSecret: 'demo-secret',
      tokenUrl,
      scope: 'read write',
    });

    const firstToken = await memoryOAuth.getToken();
    const cachedToken = await memoryOAuth.getToken();
    console.log(`Token is valid: ${await memoryOAuth.isTokenValid()}`);
    console.log(`Second call reused the cached token: ${firstToken === cachedToken}`);
    console.log(`Token endpoint requests: ${tokenRequests}`);

    console.log('\n2. Encrypted FileStorage');
    const fileOAuth = new OAuthManager({
      flow: 'client_credentials',
      clientId: 'file-demo-client',
      clientSecret: 'demo-secret',
      tokenUrl,
      storage: new FileStorage({ directory: tokenDirectory, encryptionKey }),
    });

    const storedToken = await fileOAuth.getToken();
    const tokenFiles = await readdir(tokenDirectory);
    const encryptedPayload = await readFile(join(tokenDirectory, tokenFiles[0]!), 'utf8');
    console.log(`Created ${tokenFiles.length} encrypted token file.`);
    console.log(`Plain access token is absent from the file: ${!encryptedPayload.includes(storedToken)}`);

    console.log('\n3. Authorization-code flow shape');
    const authCodeOAuth = new OAuthManager({
      flow: 'authorization_code',
      clientId: 'demo-web-client',
      authorizationUrl: 'https://provider.example/oauth/authorize',
      tokenUrl: 'https://provider.example/oauth/token',
      redirectUri: 'http://localhost:3000/callback',
      scope: 'profile email',
    });
    const authorizationUrl = await authCodeOAuth.startAuthFlow('user-123');
    const parsedURL = new URL(authorizationUrl);
    console.log(`PKCE challenge present: ${parsedURL.searchParams.has('code_challenge')}`);
    console.log(`State present: ${parsedURL.searchParams.has('state')}`);

    console.log('\nOAuth demo completed successfully.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(tokenDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
