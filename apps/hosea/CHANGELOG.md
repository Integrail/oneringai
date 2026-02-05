# Changelog

All notable changes to HOSEA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
