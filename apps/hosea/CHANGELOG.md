# Changelog

All notable changes to HOSEA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Everworker Backend Proxy Integration** - Connect HOSEA to an Everworker backend for centrally managed AI connectors
  - API keys managed on the EW server, not stored on desktops
  - JWT-based authentication with `llm:proxy` scope
  - Transparent HTTP reverse proxy - all vendor SDKs work without changes via `baseURL` override
  - **Mixed mode**: local connectors and EW connectors coexist seamlessly
  - Works for all connector types: LLM text, image, video, TTS, web search, universal APIs
- **Settings > Everworker Backend** - New settings section to configure EW backend connection
  - Backend URL and JWT token configuration
  - Test connection button to verify connectivity
  - Sync connectors button to fetch available connectors from EW
  - Enable/disable toggle for EW integration
- **Connector Source Badges** - LLM Providers page shows "EW" badge for Everworker connectors and "Local" badge for local ones
  - EW connectors show available models
  - EW connectors are marked as "Managed by Everworker" (key management disabled)
- **IPC Bridge** - New `window.hosea.everworker` API for renderer communication
  - `getConfig()`, `setConfig()`, `testConnection()`, `syncConnectors()`
- **Connector Source Tracking** - `StoredConnectorConfig` now includes `source` field (`'local' | 'everworker'`)

### Fixed
- **EW Sync: Non-LLM connectors no longer appear in LLM Providers** - `syncEWConnectors()` now routes connectors by type: LLM vendors (openai, anthropic, etc.) go to the LLM providers store, while non-LLM services (slack, github, zenrows, serper, etc.) go to the Universal Connectors store
- **EW Sync counter** - Sync now reports "X added, Y updated, Z removed" instead of showing "0 added" on re-sync
- **EW Proxy: 0 connectors available** - Proxy discovery endpoint now reads from the oneringai `Connector` registry (populated by V25 startup) instead of a separate empty Map
- **EW discovery endpoint** - Now includes `type` ('llm' | 'universal') and `serviceType` fields for each connector
- **Improved logging** - Added detailed logging for EW connection testing and connector discovery on both Hosea and EW sides

### Changed
- **Universal Connectors page** - Now shows EW/Local source badges, similar to LLM Providers page; EW-managed connectors show "Managed" instead of Edit
- **StoredUniversalConnector** - Added optional `source` field (`'local' | 'everworker'`)

### Removed
- **Legacy API Connectors system** - Removed dead `apiConnectors` Map, `StoredAPIConnectorConfig` interface, `loadAPIConnectors()` method, CRUD methods, IPC handlers (`api-connector:*`), and preload bridge. The migration function (`migrateAPIConnectorsToUniversal`) is preserved for existing users

## [0.1.0] - 2026-02-05

### Added
- Initial release of HOSEA (Human-Oriented System for Engaging Agents)
- **Desktop Application** - Electron-based cross-platform UI for AI agents
- **Chat Interface** - Multi-turn conversation with AI agents
- **Agent Configuration** - Configure connectors, models, and tools
- **Tool Management** - Enable/disable tools, view tool catalog
- **Connector Management** - Create and manage API connectors for various services
- **Browser Automation** - Built-in browser tools for web interaction
- **Rich Message Rendering**
  - Markdown with GitHub Flavored Markdown (GFM)
  - Syntax highlighting for code blocks
  - LaTeX/KaTeX for math equations
  - Mermaid diagrams
  - Markmap mind maps
  - Vega/Vega-Lite charts
- **Settings Management** - Persistent settings with electron-store
- **Vendor Logos** - Visual icons for 40+ service integrations

### Technical
- Built with Electron 29, React 18, TypeScript 5
- Vite for fast development and building
- Bootstrap 5 + React Bootstrap for UI components
- Integrates with `@everworker/oneringai` core library

[Unreleased]: https://github.com/Integrail/oneringai/compare/hosea-v0.1.0...HEAD
[0.1.0]: https://github.com/Integrail/oneringai/releases/tag/hosea-v0.1.0
