/**
 * Telemetry - Phone home functionality for Hosea installations.
 *
 * Sends basic system info on startup to track installations.
 * Opt-out: set telemetryEnabled = false in settings.
 */

import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';

const TELEMETRY_ENDPOINT = 'https://youetal.ai/api/telemetry';
const SEND_TIMEOUT_MS = 5000;

export interface TelemetryPayload {
  installationId: string;
  appVersion: string;
  electronVersion: string;
  platform: string;
  arch: string;
  osVersion: string;
  locale: string;
  totalMemoryGB: number;
  cpuModel: string;
  cpuCores: number;
  timestamp: string;
}

/**
 * Ensure installationId exists in settings. If not, generate and persist.
 * Returns the installationId.
 */
export function getOrCreateInstallationId(
  settings: Record<string, unknown>,
  saveSettings: (data: Record<string, unknown>) => void,
): string {
  if (typeof settings.installationId === 'string' && settings.installationId) {
    return settings.installationId;
  }

  const id = randomUUID();
  settings.installationId = id;

  // Default telemetry to enabled for new/migrating installations
  if (settings.telemetryEnabled === undefined) {
    settings.telemetryEnabled = true;
  }

  saveSettings(settings);
  return id;
}

/**
 * Collect system info into a telemetry payload.
 */
function collectPayload(installationId: string): TelemetryPayload {
  const cpus = os.cpus();
  return {
    installationId,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron || 'unknown',
    platform: process.platform,
    arch: process.arch,
    osVersion: os.release(),
    locale: app.getLocale(),
    totalMemoryGB: Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10,
    cpuModel: cpus[0]?.model || 'unknown',
    cpuCores: cpus.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * POST payload to endpoint. Fire-and-forget — errors are silently ignored.
 */
function sendPayload(payload: TelemetryPayload, endpoint: string): void {
  try {
    const data = JSON.stringify(payload);
    const url = new URL(endpoint);
    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: SEND_TIMEOUT_MS,
      },
      (res) => {
        // Consume response to free socket
        res.resume();
      },
    );

    req.on('error', () => { /* silently ignore */ });
    req.on('timeout', () => { req.destroy(); });
    req.write(data);
    req.end();
  } catch {
    // Silently ignore any errors
  }
}

/**
 * Send a telemetry ping on startup if enabled.
 * Call this during Phase 2 initialization.
 */
export function sendTelemetryPing(
  settings: Record<string, unknown>,
  saveSettings: (data: Record<string, unknown>) => void,
  endpoint?: string,
): void {
  const installationId = getOrCreateInstallationId(settings, saveSettings);

  // Check opt-out
  if (settings.telemetryEnabled === false) {
    return;
  }

  const payload = collectPayload(installationId);
  sendPayload(payload, endpoint || TELEMETRY_ENDPOINT);
}
