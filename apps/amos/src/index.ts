#!/usr/bin/env node

/**
 * AMOS - Advanced Multimodal Orchestration System
 *
 * A terminal-based agentic application powered by OneRing AI Agents.
 *
 * Features:
 * - Runtime vendor/model switching
 * - Dynamic connector management
 * - Extensible tool system
 * - Planning and task execution
 * - Session persistence
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AmosApp } from './app.js';

// Get the directory of the entry point
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine data directory
const dataDir = process.env.AMOS_DATA_DIR || join(__dirname, '..', 'data');

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Main entry point
async function main(): Promise<void> {
  const app = new AmosApp(dataDir);

  // Handle interrupt signals
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    process.exit(0);
  });

  try {
    // Initialize
    await app.initialize();

    // Run main loop
    await app.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run
main();
